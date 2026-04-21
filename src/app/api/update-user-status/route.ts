import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, status } = await request.json()

    if (!userId || !status) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (userId, status)" },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Update Profile Status
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ status: status })
      .eq("id", userId)

    if (profileError) throw profileError

    // 2. Handle Auth Banning (Supabase Auth Admin)
    // If status is 'inactive', we ban the user. If 'active', we unban.
    // Supabase uses 'ban_duration' to suspend users. 
    // Setting it to a very long time (e.g., 100 years) effectively deactivates the account.
    // 'none' or '' clears the ban.
    
    const banDuration = status === "inactive" ? "876000h" : "none" // 876000h = 100 years

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: banDuration }
    )

    if (authError) {
      console.error("Error banning/unbanning user in Auth:", authError)
      // We don't necessarily want to fail the whole request if Auth fails, 
      // but it's important for security.
      throw authError
    }

    return NextResponse.json({ 
      success: true, 
      message: `Usuario marcado como ${status === 'active' ? 'activo' : 'inactivo'}` 
    })
  } catch (error: any) {
    console.error("Error in update-user-status:", error)
    return NextResponse.json(
      { error: error.message || "Error al actualizar el estado del usuario" },
      { status: 500 }
    )
  }
}
