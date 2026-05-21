"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { 
  Loader2, Users, PhoneCall, FileText, Award, DollarSign, TrendingUp, Wallet, ArrowUpRight, Activity, Calendar, Search, Sparkles
} from "lucide-react"
import {
  CONTACTADO_ST, FUNNEL_STAGES, generateMonths, monthRange, fmtMoney, fmtWR, timeAgo, cleanSrc,
  MonthSelect, MetricCard, FunnelCard, SourceCard,
  calcCommission, calcBonus, calcTotalEarnings, calcBonusProgress, calcToNextBonus
} from "./shared"

type Profile = { role: string; name: string; avatar_url: string|null }

export function AgentDashboard({ userId, profile }: { userId: string; profile: Profile }) {
  const months = useMemo(generateMonths, [])
  const [month, setMonth] = useState(months[0].value)
  const [fetching, setFetching] = useState(false)
  
  const [metrics, setMetrics] = useState({ leads: 0, contactados: 0, propuestas: 0, ventas: 0 })
  const [myLeads, setMyLeads] = useState<any[]>([])
  const [wallet, setWallet] = useState({ revenue: 0, ventas: 0 })
  const [activities, setActivities] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (userId) load(month)
  }, [month, userId])

  async function load(m: string) {
    setFetching(true)
    const { gte, lt } = monthRange(m)

    // 1. Fetch leads assigned to the agent created in the selected month
    const { data: leadsRaw } = await supabase
      .from("leads")
      .select("id, status, source, business_name, contact_name, created_at")
      .eq("assigned_to", userId)
      .gte("created_at", gte)
      .lt("created_at", lt)
    
    const leads = leadsRaw || []
    setMyLeads(leads)
    const leadIds = leads.map(l => l.id)

    // 2. Fetch sales created in the selected month for leads assigned to this agent
    const { data: salesRaw } = await supabase
      .from("sales")
      .select("id, total_amount, lead_id, leads!inner(assigned_to)")
      .eq("leads.assigned_to", userId)
      .gte("created_at", gte)
      .lt("created_at", lt)

    const sales = salesRaw || []
    const ventas = sales.length
    const revenue = sales.reduce((a, s) => a + (s.total_amount || 0), 0)

    const contactados = leads.filter(l => CONTACTADO_ST.includes((l.status || "").toLowerCase())).length
    const propuestas = leads.filter(l => (l.status || "").toLowerCase() === "propuesta").length

    setMetrics({ leads: leads.length, contactados, propuestas, ventas })
    setWallet({ revenue, ventas })

    // 3. Fetch recent activities for the agent's leads
    if (leadIds.length > 0) {
      const { data: actsRaw } = await supabase
        .from("activities")
        .select("id, action, description, created_at, lead_id")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(10)
      setActivities(actsRaw || [])
    } else {
      setActivities([])
    }

    setFetching(false)
  }

  const firstName = profile.name.split(" ")[0]
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  const todayStr = today.charAt(0).toUpperCase() + today.slice(1)

  const commissionBase = calcCommission(wallet.ventas)
  const bonus = calcBonus(wallet.ventas)
  const totalEarnings = calcTotalEarnings(wallet.ventas)
  const bonusProgress = calcBonusProgress(wallet.ventas)
  const toNextBonus = calcToNextBonus(wallet.ventas)

  const motivationalMsg = useMemo(() => {
    if (wallet.ventas === 0) {
      return "¡Comienza a vender para desbloquear tu primer bono de $150! 🎯"
    }
    if (wallet.ventas % 5 === 0) {
      return "¡Excelente! Has alcanzado un hito de bono. ¡Cada 5 ventas sumas $150 extra! 🎉"
    }
    if (toNextBonus === 1) {
      return "¡Te falta solo 1 venta para desbloquear tu próximo bono de $150! 🚀"
    }
    return `Faltan ${toNextBonus} ventas para tu próximo bono de $150. 💪`
  }, [wallet.ventas, toNextBonus])

  // Filter leads locally by search query
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return myLeads
    const q = searchQuery.toLowerCase()
    return myLeads.filter(l => 
      (l.business_name || "").toLowerCase().includes(q) ||
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.status || "").toLowerCase().includes(q) ||
      (l.source || "").toLowerCase().includes(q)
    )
  }, [myLeads, searchQuery])

  function getStatusColor(status: string | null) {
    if (!status) return "#94A3B8"
    const st = status.toLowerCase()
    const stage = FUNNEL_STAGES.find(s => s.matches.includes(st))
    return stage ? stage.color : "#94A3B8"
  }

  function getStatusLabel(status: string | null) {
    if (!status) return "Sin Estado"
    const st = status.toLowerCase()
    const stage = FUNNEL_STAGES.find(s => s.matches.includes(st))
    return stage ? stage.label : status
  }

  const mesLabel = months.find(m => m.value === month)?.label || ""

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1">
      {/* Header personal */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-surface-container-lowest border border-outline-variant/15 p-5 md:p-6 rounded-2xl shadow-[0_4px_20px_rgba(19,27,46,0.02)]">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-on-background tracking-tight">¡Hola, {firstName}! 👋</h1>
          <p className="text-xs font-medium text-on-surface-variant/70 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
            {todayStr} · Tu resumen financiero y métricas del mes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetching && <Loader2 size={16} className="animate-spin text-primary" />}
          <MonthSelect months={months} value={month} onChange={setMonth} />
        </div>
      </div>

      {/* Metric Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Mis leads del mes" value={metrics.leads.toString()} sub="Asignados a mí" icon={Users} />
        <MetricCard
          label="Leads Contactados"
          value={metrics.contactados.toString()}
          sub={metrics.leads > 0 ? `${Math.round((metrics.contactados / metrics.leads) * 100)}% del total` : "—"}
          accent={metrics.leads > 0 && (metrics.contactados / metrics.leads) >= 0.5}
          icon={PhoneCall}
        />
        <MetricCard label="Propuestas Enviadas" value={metrics.propuestas.toString()} sub={`De ${metrics.leads} leads`} icon={FileText} />
        <MetricCard
          label="Ventas Cerradas"
          value={metrics.ventas.toString()}
          sub={`Win rate: ${fmtWR(metrics.ventas, metrics.leads)}`}
          accent={metrics.ventas > 0}
          icon={Award}
        />
      </div>

      {/* Billetera y Comisiones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Compensación Premium */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 translate-x-[20%] -translate-y-[20%] w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Mi Billetera Stella
                </span>
                <h2 className="text-sm font-bold text-emerald-300/80 uppercase tracking-wider mt-4">Compensación Total Acumulada</h2>
                <p className="text-4xl md:text-5xl font-black text-white mt-2 tracking-tight leading-none">{fmtMoney(totalEarnings)}</p>
                <p className="text-xs text-emerald-100/70 font-medium mt-2.5 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-300" />
                  Facturado para la empresa: {fmtMoney(wallet.revenue)}
                </p>
              </div>
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
                <Wallet size={26} className="text-emerald-300" />
              </div>
            </div>

            <div className="border-t border-emerald-800/40 pt-5 grid grid-cols-2 gap-6 text-sm font-semibold">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/85">Comisión Base</p>
                <p className="text-lg font-extrabold text-white mt-1">{fmtMoney(commissionBase)}</p>
                <p className="text-[11px] text-emerald-200/50 font-normal mt-0.5">$150 por cada sitio vendido ({wallet.ventas})</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/85">Bonos de Volumen</p>
                <p className="text-lg font-extrabold text-white mt-1">{fmtMoney(bonus)}</p>
                <p className="text-[11px] text-emerald-200/50 font-normal mt-0.5">$150 por cada 5 ventas ({Math.floor(wallet.ventas / 5)} ganado{Math.floor(wallet.ventas / 5) !== 1 ? 's' : ''})</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progreso del Bono */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Meta de Bono Mensual
              </span>
              <span className="text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {bonusProgress}/5 Ventas
              </span>
            </div>
            
            <p className="text-sm font-medium text-on-surface leading-relaxed">
              Consigue <strong className="text-primary font-bold">5 ventas</strong> para desbloquear un bono extra de <strong className="text-primary font-bold">$150</strong>. ¡Sin límites de acumulación!
            </p>

            {/* Medidor visual de 5 pasos */}
            <div className="flex items-center gap-2.5 py-4">
              {[1, 2, 3, 4, 5].map(step => {
                const isActive = step <= bonusProgress
                return (
                  <div key={step} className="flex-1 relative flex flex-col items-center">
                    <div 
                      className={`w-full h-2.5 rounded-full transition-all duration-500 ${
                        isActive 
                          ? "bg-emerald-500 shadow-sm shadow-emerald-500/25" 
                          : "bg-surface-container-low border border-outline-variant/15"
                      }`} 
                    />
                    <span className={`text-[9px] font-bold mt-2 ${isActive ? "text-emerald-600" : "text-on-surface-variant/40"}`}>
                      {step}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-outline-variant/10 pt-4 text-center">
            <span className="text-xs font-semibold text-on-surface-variant/80 block">
              {motivationalMsg}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row — funnel + activity + leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Funnel & Sources */}
        <div className="space-y-6">
          <FunnelCard leads={myLeads} />
          <SourceCard leads={myLeads} />
        </div>

        {/* Right Side: Leads list & Recent Activities */}
        <div className="space-y-6">
          {/* Leads Asignados del Mes */}
          <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)] space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-outline-variant/10 pb-4">
              <div>
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-primary rounded-full inline-block"></span>
                  Leads de {mesLabel} ({filteredLeads.length})
                </h3>
              </div>
              <div className="relative w-full sm:w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Buscar lead..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/15 text-on-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/40"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-outline-variant/10 rounded-xl border border-outline-variant/10">
              {filteredLeads.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant/50 italic text-xs">
                  {myLeads.length === 0 ? "No tienes leads asignados en este mes" : "No se encontraron leads coincidentes"}
                </div>
              ) : (
                filteredLeads.map(l => {
                  const badgeColor = getStatusColor(l.status)
                  const label = getStatusLabel(l.status)
                  return (
                    <div key={l.id} className="p-3.5 hover:bg-surface-container-low/20 transition-colors flex justify-between items-center group">
                      <div className="space-y-1 min-w-0 pr-3">
                        <p className="text-xs font-bold text-on-surface leading-snug truncate group-hover:text-primary transition-colors">
                          {l.business_name || "Negocio sin nombre"}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/65 flex items-center gap-1.5">
                          <span className="font-semibold">{l.contact_name || "Sin contacto"}</span>
                          <span>·</span>
                          <span className="truncate">{l.source ? cleanSrc(l.source) : "Sin Origen"}</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span 
                          className="text-[9px] font-extrabold px-2 py-0.5 rounded-full capitalize"
                          style={{
                            backgroundColor: `${badgeColor}15`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}25`
                          }}
                        >
                          {label}
                        </span>
                        <span className="text-[9px] text-on-surface-variant/50 tabular-nums">
                          {new Date(l.created_at).toLocaleDateString("es-ES", { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Actividad Reciente */}
          <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)] space-y-4">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-4">
              <Activity size={14} className="text-primary animate-pulse" />
              Actividad Reciente de tus Leads
            </h3>
            {activities.length === 0 ? (
              <p className="text-xs text-on-surface-variant/50 italic py-6 text-center">Sin actividad registrada en este período</p>
            ) : (
              <div className="relative pl-3.5 border-l border-outline-variant/20 space-y-4 py-1 max-h-64 overflow-y-auto">
                {activities.map((a, i) => (
                  <div key={a.id || i} className="relative group">
                    <div className="absolute -left-[17.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface-container-lowest transition-transform group-hover:scale-125" />
                    <div>
                      <p className="text-xs text-on-surface font-semibold leading-relaxed">{a.description || a.action}</p>
                      <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
