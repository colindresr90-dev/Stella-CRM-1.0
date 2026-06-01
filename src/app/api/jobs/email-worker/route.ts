import { NextResponse } from "next/server"
import { processNextEmailJob } from "@/lib/emailQueue"

export const dynamic = "force-dynamic"
export const maxDuration = 30 // seconds — enough for SMTP handshake + send

// Internal endpoint: only callable with the shared secret
// Fire-and-forget from /api/emails/send — should never be exposed publicly
export async function POST(request: Request) {
  const secret = request.headers.get("x-worker-secret")
  if (secret !== (process.env.WORKER_SECRET ?? "internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await processNextEmailJob()
  return NextResponse.json({ result })
}
