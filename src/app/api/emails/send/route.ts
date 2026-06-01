import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"
import { enqueueEmail } from "@/lib/emailQueue"

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { to, subject, htmlText, cc, bcc, attachments, lead_id } = body

    if (!to || !subject || !htmlText) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (to, subject, htmlText)" },
        { status: 400 }
      )
    }

    if (!process.env.EMAIL_PASSWORD) {
      return NextResponse.json(
        { error: "Servidor no configurado: Falta EMAIL_PASSWORD" },
        { status: 500 }
      )
    }

    const t0 = performance.now()

    // Enqueue the job (~50ms DB insert) instead of blocking on SMTP (~2-5s)
    const jobId = await enqueueEmail({
      created_by: authResult.user!.id,
      lead_id: lead_id ?? undefined,
      to,
      subject,
      html_text: htmlText,
      cc: cc || undefined,
      bcc: bcc || undefined,
      attachments: attachments?.length ? attachments : undefined,
    })


    // Kick the worker in the background — don't await, response is already ready
    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/jobs/email-worker`
    fetch(workerUrl, {
      method: "POST",
      headers: { "x-worker-secret": process.env.WORKER_SECRET ?? "internal" },
    }).catch((e) => console.error("[email-queue] Worker kick failed:", e))

    const ms = (performance.now() - t0).toFixed(1)
    console.log(`[email-queue] Enqueued job ${jobId} in ${ms}ms for ${to}`)

    return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 })
  } catch (error) {
    console.error("Critical error in POST /api/emails/send:", error)
    const errorMsg = error instanceof Error ? error.message : "Error al encolar el correo"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
