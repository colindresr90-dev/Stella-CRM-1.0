import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminOrPermission } from "@/lib/apiAuth"

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminOrPermission(req, "manage_team_roster")
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const { email, password, role } = await req.json()

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Servidor no configurado: Falta SUPABASE_SERVICE_ROLE_KEY")
    }

    // Instanciamos el cliente administrador con la llave de servicio de Supabase
    // Esto brinca el RLS y las protecciones regulares (Por eso es exclusivo para Backend)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 1. Crear al usuario con la API especial de administrador
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automáticamente marcado como confirmado
    })

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Error al crear la cuenta base")
    }

    // 2. Insertar inmediatamente su perfil de aplicación
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      name: email.split("@")[0], // Nombre inicial genérico
      role: role,
      must_change_password: true, // Forzará a cambiar la clave al loguearse
      onboarding_completed: false, // Nueva bandera para el flujo de bienvenida
    })

    if (profileError) {
      throw new Error(profileError.message || "Error al registrar el perfil del usuario")
    }

    return NextResponse.json({ success: true, message: "Usuario creado exitosamente" }, { status: 200 })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al crear usuario"
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 })
  }
}
