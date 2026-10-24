import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { processNextEmailJob } from "@/lib/emailQueue"

export const dynamic = "force-dynamic"
export const maxDuration = 30 // seconds — enough for SMTP handshake + send

// Internal endpoint: only callable with the shared secret
// Fire-and-forget from /api/emails/send — should never be exposed publicly
export async function POST(request: Request) {
  // No default secret: without WORKER_SECRET the worker stays closed instead of
  // accepting a guessable value
  const expected = process.env.WORKER_SECRET
  if (!expected) {
    console.error("[email-worker] WORKER_SECRET is not set; worker disabled.")
    return NextResponse.json(
      { error: "Servidor no configurado: Falta WORKER_SECRET" },
      { status: 500 }
    )
  }

  const provided = Buffer.from(request.headers.get("x-worker-secret") ?? "")
  const secret = Buffer.from(expected)
  if (provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await processNextEmailJob()
  return NextResponse.json({ result })
}
