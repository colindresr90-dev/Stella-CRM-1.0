import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const leadEmail = searchParams.get("email")

    if (!leadEmail) {
      return NextResponse.json(
        { error: "Falta el email del lead" },
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

    console.log(`[IMAP] Connecting to Titan Email for lead: ${leadEmail}`)
    await client.connect()

    const fetchEmailsFromFolder = async (folderPath: string) => {
      try {
        console.log(`[IMAP] Selecting folder: ${folderPath}`)
        const lock = await client.getMailboxLock(folderPath)
        interface MailAddress {
          name: string
          address: string
        }
        interface EmailRecord {
          id: string
          from: MailAddress
          to: MailAddress[]
          subject: string
          preview: string
          body: string
          date: string
          folder: string
        }
        const emailsList: EmailRecord[] = []

        try {
          // Search for emails involving the leadEmail in from or to headers
          const searchResult = await client.search({
            or: [
              { from: leadEmail },
              { to: leadEmail }
            ]
          })

          const searchResultArray = Array.isArray(searchResult) ? searchResult : []
          console.log(`[IMAP] Found ${searchResultArray.length} emails in folder ${folderPath}`)
          
          // Fetch last 15 emails for quick loading
          const seqs = searchResultArray.slice(-15)
          
          for (const seq of seqs) {
            const message = await client.fetchOne(seq.toString(), { source: true })
            if (message && message.source) {
              const parsed = await simpleParser(message.source)
              emailsList.push({
                id: parsed.messageId || seq.toString(),
                from: parsed.from ? { name: parsed.from.value[0]?.name || "", address: parsed.from.value[0]?.address || "" } : { name: "", address: "" },
                to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) => {
                  const val = (t as unknown as { value: Array<{ name?: string; address?: string }> }).value;
                  return Array.isArray(val) ? val.map((v) => ({ name: v.name || "", address: v.address || "" })) : [];
                }) : [],
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
        const errMsg = err instanceof Error ? err.message : "Error desconocido"
        console.warn(`[IMAP] Error reading folder ${folderPath}:`, errMsg)
        return []
      }
    }

    const inboxEmails = await fetchEmailsFromFolder('INBOX')
    const sentEmails = await fetchEmailsFromFolder('Sent')

    await client.logout()
    console.log(`[IMAP] Disconnected successfully.`)

    // Merge and sort descending by date (newest first)
    const allEmails = [...inboxEmails, ...sentEmails].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json({ success: true, emails: allEmails })
  } catch (error) {
    console.error("Critical error in GET /api/emails:", error)
    const errorMsg = error instanceof Error ? error.message : "Error interno al obtener los correos"
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
