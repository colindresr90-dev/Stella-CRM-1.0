import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export async function GET(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const userId = authResult.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error interno del servidor"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

interface NotificationPayload {
  user_id: string
  title: string
  message: string
  type: string
  related_id?: string
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Batch mode: { notifications: [...] }
    if (Array.isArray(body.notifications)) {
      const rows = body.notifications as NotificationPayload[]
      if (rows.length === 0) return NextResponse.json({ success: true, data: [] })

      for (const n of rows) {
        if (!n.user_id || !n.title || !n.message || !n.type) {
          return NextResponse.json({ error: "Faltan datos requeridos en una notificación" }, { status: 400 })
        }
      }

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(rows.map(n => ({ ...n, read: false })))
        .select()

      if (error) {
        console.error("Error creating notifications batch:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, data })
    }

    // Single mode: { user_id, title, message, type, related_id }
    const { user_id, title, message, type, related_id } = body
    if (!user_id || !title || !message || !type) {
      return NextResponse.json(
        { error: "Faltan datos requeridos para la notificación" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id, title, message, type, related_id, read: false })
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
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
