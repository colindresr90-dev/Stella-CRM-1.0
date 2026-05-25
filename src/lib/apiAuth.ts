import { createClient, User } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Extracts and validates the authenticated user from the Request headers or cookies.
 */
export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  let token: string | null = null

  // 1. Try to get token from Authorization header (Bearer)
  const authHeader = request.headers.get("Authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1]
  }

  // 2. Try to get token from sb-access-token cookie
  if (!token) {
    const cookieHeader = request.headers.get("cookie")
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [name, ...value] = cookie.trim().split("=")
        if (name) {
          acc[name] = value.join("=")
        }
        return acc
      }, {} as Record<string, string>)
      
      token = cookies["sb-access-token"] || null
    }
  }

  if (!token) {
    return null
  }

  try {
    // Validate session token with Supabase Auth
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    const { data: { user }, error } = await tempClient.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error("[API Auth] Error validating user token:", err)
    return null
  }
}

interface ProfileData {
  role: string | null
  permissions: string[]
  status: string | null
}

interface AuthResult {
  user: User | null
  profile: ProfileData | null
  error?: string
  status?: number
}

/**
 * Ensures user is authenticated and optionally checks role and permission.
 */
export async function requireAdminOrPermission(
  request: Request,
  requiredPermission?: string
): Promise<AuthResult> {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return { user: null, profile: null, error: "No autorizado", status: 401 }
  }

  try {
    // Initialize admin client to bypass regular RLS to fetch profile
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, permissions, status")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return { user: null, profile: null, error: "Perfil no encontrado", status: 403 }
    }

    if (profile.status === "inactive") {
      return { user: null, profile: null, error: "Usuario inactivo", status: 403 }
    }

    const typedProfile: ProfileData = {
      role: profile.role || null,
      permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
      status: profile.status || null
    }

    // Admins always have all rights
    if (typedProfile.role === "admin") {
      return { user, profile: typedProfile }
    }

    // Non-admin checks
    if (requiredPermission) {
      if (!typedProfile.permissions.includes(requiredPermission)) {
        return { user: null, profile: null, error: "Acceso denegado: Permiso faltante", status: 403 }
      }
    }

    return { user, profile: typedProfile }
  } catch (err) {
    console.error("[API Auth] Error checking profile status:", err)
    const message = err instanceof Error ? err.message : "Error de servidor"
    return { user: null, profile: null, error: message, status: 500 }
  }
}
