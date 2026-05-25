import { ImapFlow } from "imapflow"
import nodemailer from "nodemailer"
import MailComposer from "nodemailer/lib/mail-composer"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { to, subject, htmlText, cc, bcc, attachments } = body

    if (!to || !subject || !htmlText) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (to, subject, htmlText)" },
        { status: 400 }
      )
    }

    const emailPassword = process.env.EMAIL_PASSWORD
    if (!emailPassword) {
      return NextResponse.json(
        { error: "Servidor no configurado: Falta EMAIL_PASSWORD" },
        { status: 500 }
      )
    }

    // 1. Send via SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.titan.email',
      port: 465,
      secure: true,
      auth: {
        user: 'info@taskmasters.site',
        pass: emailPassword
      }
    })

    interface AttachmentType {
      filename: string;
      content: string;
    }

    const mailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      cc?: string;
      bcc?: string;
      attachments?: Array<{ filename: string; content: string; encoding: string }>;
    } = {
      from: '"Taskmasters CRM" <info@taskmasters.site>',
      to,
      subject,
      html: htmlText
    }

    if (cc) {
      mailOptions.cc = cc
    }
    if (bcc) {
      mailOptions.bcc = bcc
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = (attachments as AttachmentType[]).map((att) => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64'
      }))
    }

    console.log(`[SMTP] Sending email to ${to}...`)
    const info = await transporter.sendMail(mailOptions)
    console.log(`[SMTP] Sent successfully. MessageId: ${info.messageId}`)

    // 2. Compile message source & append to Sent folder via IMAP
    try {
      console.log(`[IMAP] Compiling raw email for Sent folder...`)
      const mailComposer = new MailComposer(mailOptions)
      const rawSource = await mailComposer.compile().build()

      const client = new ImapFlow({
        host: 'imap.titan.email',
        port: 993,
        secure: true,
        auth: {
          user: 'info@taskmasters.site',
          pass: emailPassword
        },
        logger: false
      })

      console.log(`[IMAP] Appending sent email to Sent folder...`)
      await client.connect()
      const lock = await client.getMailboxLock('Sent')
      try {
        await client.append('Sent', rawSource, ['\\Seen'])
        console.log(`[IMAP] Appended successfully.`)
      } finally {
        lock.release()
      }
      await client.logout()
    } catch (imapErr) {
      const errMsg = imapErr instanceof Error ? imapErr.message : "Error desconocido"
      console.error(`[IMAP] Failed to archive sent email in Sent folder:`, errMsg)
      // Do not fail the whole response if SMTP succeeded
    }

    // 3. Emit a new-email event via WebSocket
    const globalWithIo = global as unknown as { io?: { emit: (event: string, data: Record<string, unknown>) => void } }
    if (globalWithIo.io) {
      console.log("[SMTP] Emitting new-email event via socket.io for sent email")
      const formatAddresses = (addrStr?: string) => {
        if (!addrStr) return []
        return addrStr.split(',').map((email) => ({ name: "", address: email.trim() }))
      }
      
      globalWithIo.io.emit('new-email', {
        id: info.messageId || Date.now().toString(),
        from: { name: "Taskmasters CRM", address: "info@taskmasters.site" },
        to: formatAddresses(to),
        cc: formatAddresses(cc),
        bcc: formatAddresses(bcc),
        subject,
        preview: htmlText.replace(/<[^>]*>/g, '').slice(0, 100) + "...",
        body: htmlText,
        date: new Date().toISOString(),
        folder: 'Sent'
      })
    }

    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("Critical error in POST /api/emails/send:", error)
    const errorMsg = error instanceof Error ? error.message : "Error al enviar el correo"
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
