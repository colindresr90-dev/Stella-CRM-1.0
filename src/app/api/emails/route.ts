import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"
import { Redis } from "@upstash/redis"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const IMAP_CACHE_TTL_S = 5 * 60 // 5 minutos

// Redis compartido entre todas las instancias serverless
const redis = Redis.fromEnv()

export async function invalidateImapCache(leadEmail: string) {
  await redis.del(`imap:${leadEmail}`)
}

interface MailAddress { name: string; address: string }
interface EmailRecord {
  id: string
  from: MailAddress
  to: MailAddress[]
  cc?: MailAddress[]
  bcc?: MailAddress[]
  subject: string
  preview: string
  body: string
  date: string
  folder: string
  status?: string
}

function makeImapClient(password: string): ImapFlow {
  return new ImapFlow({
    host: 'imap.titan.email',
    port: 993,
    secure: true,
    auth: { user: 'info@taskmasters.site', pass: password },
    logger: false
  })
}

async function fetchEmailsFromFolder(
  client: ImapFlow,
  folderPath: string,
  leadEmail: string
): Promise<EmailRecord[]> {
  try {
    const lock = await client.getMailboxLock(folderPath)
    const emailsList: EmailRecord[] = []
    try {
      const searchResult = await client.search({
        or: [{ from: leadEmail }, { to: leadEmail }]
      })
      const seqs = (Array.isArray(searchResult) ? searchResult : []).slice(-15)
      for (const seq of seqs) {
        const message = await client.fetchOne(seq.toString(), { source: true })
        if (message && 'source' in message && message.source) {
          const parsed = await simpleParser((message as unknown as { source: Buffer }).source)
          emailsList.push({
            id: parsed.messageId || seq.toString(),
            from: parsed.from
              ? { name: parsed.from.value[0]?.name || "", address: parsed.from.value[0]?.address || "" }
              : { name: "", address: "" },
            to: parsed.to
              ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) => {
                  const val = (t as unknown as { value: Array<{ name?: string; address?: string }> }).value
                  return Array.isArray(val) ? val.map((v) => ({ name: v.name || "", address: v.address || "" })) : []
                })
              : [],
            subject: parsed.subject || "(Sin asunto)",
            preview: parsed.text ? parsed.text.slice(0, 100).replace(/\s+/g, ' ') + "..." : "",
            body: parsed.html || parsed.textAsHtml || parsed.text || "",
            date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
            folder: folderPath
          })
        }
      }
    } finally {
      lock.release()
    }
    return emailsList
  } catch (err) {
    console.warn(`[IMAP] Error reading folder ${folderPath}:`, err instanceof Error ? err.message : err)
    return []
  }
}

async function fetchFolder(password: string, folder: string, leadEmail: string): Promise<EmailRecord[]> {
  const client = makeImapClient(password)
  try {
    await client.connect()
    return await fetchEmailsFromFolder(client, folder, leadEmail)
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const leadEmail = searchParams.get("email")
    if (!leadEmail) {
      return NextResponse.json({ error: "Falta el email del lead" }, { status: 400 })
    }

    const emailPassword = process.env.EMAIL_PASSWORD
    if (!emailPassword) {
      return NextResponse.json({ error: "Servidor no configurado: Falta EMAIL_PASSWORD" }, { status: 500 })
    }

    const t0 = performance.now()
    const cacheKey = `imap:${leadEmail}`
    const force = searchParams.get("force") === "true"

    if (force) {
      await redis.del(cacheKey)
      console.log(`[IMAP] Cache busted for: ${leadEmail}`)
    }

    // 1. Get base IMAP emails (either from Redis cache or fresh IMAP fetch)
    let allEmails: EmailRecord[] = []
    let cacheStatus = "HIT"

    const cached = await redis.get<EmailRecord[]>(cacheKey)
    if (cached) {
      allEmails = cached
    } else {
      cacheStatus = "MISS"
      console.log(`[IMAP] Cache MISS — fetching INBOX+Sent for: ${leadEmail}`)
      const [inboxEmails, sentEmails] = await Promise.all([
        fetchFolder(emailPassword, 'INBOX', leadEmail),
        fetchFolder(emailPassword, 'Sent', leadEmail)
      ])

      allEmails = [...inboxEmails, ...sentEmails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      await redis.set(cacheKey, allEmails, { ex: IMAP_CACHE_TTL_S })
    }

    // 2. Fetch real-time queued emails from Supabase to cover the sending gap
    let queuedEmails: EmailRecord[] = []
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      interface QueueJob {
        id: string
        to: string
        subject: string
        html_text: string
        cc: string | null
        bcc: string | null
        status: string
        created_at: string
      }

      const { data: queueJobs } = await supabaseAdmin
        .from('email_queue')
        .select('*')
        .eq('to', leadEmail)
        .order('created_at', { ascending: false })
        .limit(20)

      if (queueJobs && queueJobs.length > 0) {
        queuedEmails = (queueJobs as QueueJob[]).map((job) => ({
          id: job.id,
          from: { name: "Tú", address: "info@taskmasters.site" },
          to: [{ name: "", address: job.to }],
          cc: job.cc ? job.cc.split(',').map((e: string) => ({ name: "", address: e.trim() })) : undefined,
          bcc: job.bcc ? job.bcc.split(',').map((e: string) => ({ name: "", address: e.trim() })) : undefined,
          subject: job.subject,
          preview: (job.html_text || "").replace(/<[^>]*>/g, '').slice(0, 100).replace(/\s+/g, ' ') + "...",
          body: job.html_text || "",
          date: job.created_at,
          folder: 'Sent',
          status: job.status
        }))
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.warn('[API/emails] Failed to fetch queued emails:', msg)
    }

    // 3. Merge and deduplicate
    const finalEmails: EmailRecord[] = [...allEmails]
    for (const qEmail of queuedEmails) {
      const isAlreadyInImap = allEmails.some(imapEmail => {
        const sameSubject = imapEmail.subject.toLowerCase().trim() === qEmail.subject.toLowerCase().trim()
        const timeDiff = Math.abs(new Date(imapEmail.date).getTime() - new Date(qEmail.date).getTime())
        const withinTime = timeDiff < 5 * 60 * 1000 // 5 minutes
        return sameSubject && withinTime
      })

      if (!isAlreadyInImap) {
        finalEmails.push(qEmail)
      }
    }

    // Sort again to ensure correct chronological order (newest first)
    finalEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const ms = (performance.now() - t0).toFixed(1)
    console.log(`[IMAP] GET /api/emails resolved in ${ms}ms. Cache: ${cacheStatus}, Total: ${finalEmails.length}`)

    return NextResponse.json({ success: true, emails: finalEmails }, {
      headers: { 
        "X-Cache": cacheStatus, 
        "X-Response-Time": `${ms}ms`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      }
    })
  } catch (error) {
    console.error("Critical error in GET /api/emails:", error)
    const errorMsg = error instanceof Error ? error.message : "Error interno al obtener los correos"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
