import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { user_id, title, message, type, related_id } = body

    if (!user_id || !title || !message || !type) {
      return NextResponse.json(
        { error: "Faltan datos requeridos para la notificación" },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        related_id,
        read: false
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating notification via API:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Critical error in notifications API:", error)
    const errorMsg = error instanceof Error ? error.message : "Error interno del servidor"
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
