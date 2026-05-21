import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, updates } = await request.json()

    if (!userId || !updates) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (userId, updates)" },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating member info:", error)
    return NextResponse.json(
      { error: error.message || "Error al actualizar información" },
      { status: 500 }
    )
  }
}
