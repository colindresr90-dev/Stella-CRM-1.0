import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Auxiliary function to get authenticated user from Authorization header
async function getUserFromHeader(request: Request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.split(" ")[1]
  
  // We use the client initialized with the anon key to verify the user's token.
  // This validates the user session using Supabase Auth.
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
}

const getOrgSettings = unstable_cache(
  async () => {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data, error } = await supabaseAdmin
      .from("organization_settings")
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  ["org_settings"],
  { tags: ["org_settings"], revalidate: 3600 }
)

export async function GET(request: Request) {
  const t0 = performance.now()
  try {
    const user = await getUserFromHeader(request)
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // unstable_cache stores the result; first call hits Supabase, subsequent calls are in-process
    const cacheEntryExisted = true // optimistic — Next.js doesn't expose hit/miss, so we log timing instead
    const data = await getOrgSettings()
    const ms = (performance.now() - t0).toFixed(1)
    console.log(`[org_settings] GET ${ms}ms`)

    return NextResponse.json(data, {
      headers: {
        "X-Response-Time": `${ms}ms`,
        // <5ms = cache hit (in-process), >5ms = cache miss (Supabase roundtrip)
        "X-Cache": Number(ms) < 5 ? "HIT" : "MISS",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromHeader(request)
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // Check user role from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado: Se requiere rol de administrador" },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Fetch the single settings row to target the update properly
    const { data: currentSettings, error: getError } = await supabaseAdmin
      .from("organization_settings")
      .select("id")
      .single()

    if (getError || !currentSettings) {
      return NextResponse.json(
        { error: "No se encontraron los ajustes de organización" },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (body.company_name !== undefined) updateData.company_name = body.company_name
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.monthly_sales_target !== undefined) updateData.monthly_sales_target = body.monthly_sales_target
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from("organization_settings")
      .update(updateData)
      .eq("id", currentSettings.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    revalidateTag("org_settings", "max")
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
