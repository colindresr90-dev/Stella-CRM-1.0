import { createClient } from "@supabase/supabase-js"
import nodemailer from "nodemailer"
import MailComposer from "nodemailer/lib/mail-composer"
import { ImapFlow } from "imapflow"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface EmailJobPayload {
  created_by: string
  lead_id?: string
  to: string
  subject: string
  html_text: string
  cc?: string
  bcc?: string
  attachments?: { filename: string; content: string; encoding?: string }[]
}

/** Insert a job and return its id. Throws if insert fails. */
export async function enqueueEmail(payload: EmailJobPayload): Promise<string> {
  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db
    .from("email_queue")
    .insert({
      created_by: payload.created_by,
      lead_id: payload.lead_id ?? null,
      to: payload.to,
      subject: payload.subject,
      html_text: payload.html_text,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
      attachments: payload.attachments?.length ? payload.attachments : null,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

/** Claim and process one pending job. */
export async function processNextEmailJob(): Promise<"processed" | "empty" | "failed"> {
  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Find oldest pending job
  const { data: job, error: findErr } = await db
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  if (findErr || !job) return "empty"

  // Claim: only proceed if still pending (guards against rare concurrent worker calls)
  const { data: claimed } = await db
    .from("email_queue")
    .update({ status: "processing", attempts: job.attempts + 1 })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id")

  if (!claimed || claimed.length === 0) return "empty" // another worker claimed it first

  return await runJob(job)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runJob(job: Record<string, any>
): Promise<"processed" | "failed"> {
  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const id = job.id as string
  const emailPassword = process.env.EMAIL_PASSWORD!

  try {
    const attachments: { filename: string; content: string; encoding?: string; cid?: string }[] = []

    // Convert inline base64 images to CID attachments
    let processedHtml = job.html_text as string
    let imgIdx = 1
    processedHtml = processedHtml.replace(
      /src=["']data:image\/([a-zA-Z+.-]+);base64,([^"']+)["']/g,
      (_: string, ext: string, b64: string) => {
        const cid = `inline_img_${Date.now()}_${imgIdx++}`
        attachments.push({ filename: `logo_${imgIdx - 1}.${ext}`, content: b64, encoding: "base64", cid })
        return `src="cid:${cid}"`
      }
    )

    const extra = (job.attachments as typeof attachments | null) ?? []
    attachments.push(...extra)

    const mailOptions: {
      from: string; to: string; subject: string; html: string;
      cc?: string; bcc?: string; attachments?: typeof attachments
    } = {
      from: '"Taskmasters CRM" <info@taskmasters.site>',
      to: job.to as string,
      subject: job.subject as string,
      html: processedHtml,
    }
    if (job.cc) mailOptions.cc = job.cc as string
    if (job.bcc) mailOptions.bcc = job.bcc as string
    if (attachments.length > 0) mailOptions.attachments = attachments

    const transporter = nodemailer.createTransport({
      host: "smtp.titan.email",
      port: 465,
      secure: true,
      auth: { user: "info@taskmasters.site", pass: emailPassword },
    })

    const info = await transporter.sendMail(mailOptions)

    // Append to Sent folder (fire-and-forget)
    const mailComposer = new MailComposer(mailOptions)
    mailComposer.compile().build().then(async (raw) => {
      const client = new ImapFlow({
        host: "imap.titan.email", port: 993, secure: true,
        auth: { user: "info@taskmasters.site", pass: emailPassword }, logger: false,
      })
      try {
        await client.connect()
        const lock = await client.getMailboxLock("Sent")
        try { await client.append("Sent", raw, ["\\Seen"]) } finally { lock.release() }
        await client.logout()
      } catch { await client.logout().catch(() => {}) }
    }).catch(() => {})

    // Mark sent
    await db
      .from("email_queue")
      .update({ status: "sent", message_id: info.messageId, processed_at: new Date().toISOString() })
      .eq("id", id)

    // Notify user on success
    if (job.created_by) {
      await db.from("notifications").insert({
        user_id: job.created_by,
        title: "Correo enviado",
        message: `Tu correo "${job.subject}" fue entregado a ${job.to}.`,
        type: "update",
        related_id: (job.lead_id as string) ?? null,
        read: false,
      })
    }

    console.log(`[email-worker] Job ${id} sent. MessageId: ${info.messageId}`)
    return "processed"
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[email-worker] Job ${id} failed:`, errorMsg)

    const attempts = (job.attempts as number) + 1
    const exhausted = attempts >= (job.max_attempts as number)

    await db
      .from("email_queue")
      .update({
        status: exhausted ? "failed" : "pending",
        error: errorMsg,
        retry_after: exhausted ? null : new Date(Date.now() + 30_000).toISOString(),
        processed_at: exhausted ? new Date().toISOString() : null,
      })
      .eq("id", id)

    // Notify user only when all retries exhausted
    if (exhausted && job.created_by) {
      await db.from("notifications").insert({
        user_id: job.created_by,
        title: "Error al enviar correo",
        message: `No se pudo enviar "${job.subject}" a ${job.to}. ${errorMsg}`,
        type: "update",
        related_id: (job.lead_id as string) ?? null,
        read: false,
      })
    }

    return "failed"
  }
}
