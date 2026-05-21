"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, ArrowLeft, Eye } from "lucide-react"
import { AdminDashboard } from "./_components/AdminDashboard"
import { AgentDashboard } from "./_components/AgentDashboard"

type Profile = { role: string; name: string; avatar_url: string | null }
type ImpersonatedAgent = { id: string; name: string; avatar_url: string | null }

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [impersonatedAgent, setImpersonatedAgent] = useState<ImpersonatedAgent | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }

      const uid = session.user.id
      const { data: p } = await supabase
        .from("profiles")
        .select("role, name, avatar_url, must_change_password, onboarding_completed")
        .eq("id", uid)
        .single()

      if (!p) { router.push("/login"); return }
      if (p.must_change_password) { router.push("/change-password"); return }
      if (p.onboarding_completed === false) { router.push("/onboarding"); return }

      setUserId(uid)
      setProfile({ role: p.role || "agent", name: p.name || "", avatar_url: p.avatar_url })
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  if (profile?.role?.toLowerCase() === "admin") {
    if (impersonatedAgent) {
      return (
        <div className="space-y-4">
          {/* Banner de Impersonación */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 max-w-7xl mx-auto px-6 shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
            <div className="flex items-center gap-2.5 text-amber-700 text-sm font-semibold">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
              <Eye size={16} className="text-amber-600" />
              <span>Modo Vista Previa · Viendo el dashboard como: <strong className="font-extrabold text-amber-800">{impersonatedAgent.name}</strong></span>
            </div>
            <button 
              onClick={() => setImpersonatedAgent(null)}
              className="flex items-center gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 duration-150"
            >
              <ArrowLeft size={13} />
              Volver al Panel Admin
            </button>
          </div>
          
          <AgentDashboard 
            userId={impersonatedAgent.id} 
            profile={{ role: "agent", name: impersonatedAgent.name, avatar_url: impersonatedAgent.avatar_url }} 
          />
        </div>
      )
    }

    return (
      <AdminDashboard 
        onViewAsAgent={(agent) => setImpersonatedAgent({ id: agent.id, name: agent.name, avatar_url: agent.avatar_url })} 
      />
    )
  }

  return <AgentDashboard userId={userId!} profile={profile!} />
}
