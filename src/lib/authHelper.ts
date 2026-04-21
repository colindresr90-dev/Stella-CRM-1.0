import { supabase } from "@/lib/supabaseClient"

export async function getUserRole(): Promise<{ role: string | null, permissions: string[] }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return { role: null, permissions: [] }
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, permissions")
      .eq("id", session.user.id)
      .single()
      
    if (error) throw error

    return {
      role: profile?.role?.toLowerCase() || null,
      permissions: Array.isArray(profile?.permissions) ? profile.permissions : []
    }
  } catch (error) {
    console.error("Error fetching user role:", error)
    return { role: null, permissions: [] }
  }
}
