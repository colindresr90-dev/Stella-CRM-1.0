import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOrPermission(request, "manage_team_roster")
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

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
  } catch (error) {
    console.error("Error updating member info:", error)
    const errorMsg = error instanceof Error ? error.message : "Error al actualizar información"
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
