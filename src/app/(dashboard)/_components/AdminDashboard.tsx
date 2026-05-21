"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { 
  Loader2, X, Users, PhoneCall, FileText, Award, DollarSign, TrendingUp, Wallet, ArrowUpRight, ChevronRight, Activity, Calendar, Eye
} from "lucide-react"
import {
  BG, SURFACE, CARD_BG, TH_BG, GREEN, AMBER, RED, WHITE, DIM, BORDER, ROWBDR, HOVER,
  AGENT_COLORS, CONTACTADO_ST, FUNNEL_STAGES,
  generateMonths, monthRange, fmtMoney, fmtWR, getInitials, cleanSrc, timeAgo, pill,
  MonthSelect, MetricCard, FunnelCard, SourceCard,
  calcCommission, calcBonus, calcTotalEarnings, calcBonusProgress, calcToNextBonus
} from "./shared"

type AgentData = {
  id: string
  name: string
  avatar_url: string | null
  leads: number
  contactados: number
  propuestas: number
  ventas: number
  revenue: number
  commissionBase: number
  bonus: number
  totalEarnings: number
}

type DetailPanel = AgentData & { activities: any[]; leads_raw: any[] }

export function AdminDashboard({ onViewAsAgent }: { onViewAsAgent?: (agent: AgentData) => void }) {
  const months = useMemo(generateMonths, [])
  const [month, setMonth] = useState(months[0].value)
  const [fetching, setFetching] = useState(false)
  const [agents, setAgents] = useState<AgentData[]>([])
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [totals, setTotals] = useState({ 
    leads: 0, 
    contactados: 0, 
    propuestas: 0, 
    ventas: 0, 
    revenue: 0,
    commissionBase: 0,
    bonus: 0,
    totalEarnings: 0
  })
  const [detail, setDetail] = useState<DetailPanel | null>(null)

  useEffect(() => {
    fetch(month)
  }, [month])

  async function fetch(m: string) {
    setFetching(true)
    const { gte, lt } = monthRange(m)

    const [{ data: profs }, { data: leadsRaw }, { data: salesRaw }] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url").order("name"),
      supabase.from("leads").select("id, assigned_to, status, source, business_name, contact_name, created_at").gte("created_at", gte).lt("created_at", lt),
      supabase.from("sales").select("id, lead_id, total_amount, leads!inner(assigned_to)").gte("created_at", gte).lt("created_at", lt),
    ])

    const profiles = (profs || []).filter(p => !p.name?.toLowerCase().includes("rodrigo") && !p.name?.toLowerCase().includes("gerardo"))
    const leads = leadsRaw || []
    setAllLeads(leads)

    const salesMap: Record<string, { count: number; rev: number }> = {}
    ;(salesRaw || []).forEach((s: any) => {
      const aid = s.leads?.assigned_to
      if (!aid) return
      if (!salesMap[aid]) salesMap[aid] = { count: 0, rev: 0 }
      salesMap[aid].count++
      salesMap[aid].rev += s.total_amount || 0
    })

    const rows: AgentData[] = profiles.map(p => {
      const ml = leads.filter(l => l.assigned_to === p.id)
      const ventas = salesMap[p.id]?.count || 0
      const revenue = salesMap[p.id]?.rev || 0
      const commissionBase = calcCommission(ventas)
      const bonus = calcBonus(ventas)
      const totalEarnings = calcTotalEarnings(ventas)

      return {
        id: p.id,
        name: p.name || "Agente",
        avatar_url: p.avatar_url,
        leads: ml.length,
        contactados: ml.filter(l => CONTACTADO_ST.includes((l.status || "").toLowerCase())).length,
        propuestas: ml.filter(l => (l.status || "").toLowerCase() === "propuesta").length,
        ventas,
        revenue,
        commissionBase,
        bonus,
        totalEarnings
      }
    }).sort((a, b) => b.ventas - a.ventas || b.leads - a.leads)

    setAgents(rows)
    setTotals({
      leads: rows.reduce((a, r) => a + r.leads, 0),
      contactados: rows.reduce((a, r) => a + r.contactados, 0),
      propuestas: rows.reduce((a, r) => a + r.propuestas, 0),
      ventas: rows.reduce((a, r) => a + r.ventas, 0),
      revenue: rows.reduce((a, r) => a + r.revenue, 0),
      commissionBase: rows.reduce((a, r) => a + r.commissionBase, 0),
      bonus: rows.reduce((a, r) => a + r.bonus, 0),
      totalEarnings: rows.reduce((a, r) => a + r.totalEarnings, 0)
    })
    setFetching(false)

    // Update detail panel if open
    if (detail) {
      const updatedAgent = rows.find(r => r.id === detail.id)
      if (updatedAgent) {
        setDetail(prev => ({
          ...prev!,
          ...updatedAgent,
          leads_raw: leads.filter(l => l.assigned_to === updatedAgent.id)
        }))
      }
    }
  }

  async function openDetail(agent: AgentData) {
    try {
      const agentLeads = allLeads.filter(l => l.assigned_to === agent.id)
      const leadIds = agentLeads.map(l => l.id)
      let acts: any[] = []
      if (leadIds.length > 0) {
        const { data, error } = await supabase
          .from("activities")
          .select("id, action, description, created_at, lead_id")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
          .limit(10)
        
        if (error && error.code !== '42P01') {
          console.warn("Activities tracking disabled or table missing.")
        }
        acts = data || []
      }
      setDetail({ ...agent, activities: acts, leads_raw: agentLeads })
    } catch (err) {
      console.warn("openDetail error:", err)
      setDetail({ ...agent, activities: [], leads_raw: allLeads.filter(l => l.assigned_to === agent.id) })
    }
  }

  const maxC = Math.max(...agents.map(a => a.contactados), 1)
  const mesLabel = months.find(m2 => m2.value === month)?.label || ""

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-surface-container-lowest border border-outline-variant/15 p-5 md:p-6 rounded-2xl shadow-[0_4px_20px_rgba(19,27,46,0.02)]">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-on-background tracking-tight">Rendimiento de Ventas</h1>
          <p className="text-xs font-medium text-on-surface-variant/70 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
            Vista general del equipo · {mesLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetching && <Loader2 size={16} className="animate-spin text-primary" />}
          <MonthSelect months={months} value={month} onChange={setMonth} />
        </div>
      </div>

      {/* Metric Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Leads Asignados" value={totals.leads.toString()} sub="Prospección general" icon={Users} />
        <MetricCard 
          label="Leads Contactados" 
          value={totals.contactados.toString()} 
          sub={totals.leads > 0 ? `${Math.round((totals.contactados / totals.leads) * 100)}% de contacto` : "—"} 
          accent={totals.leads > 0 && (totals.contactados / totals.leads) >= 0.5}
          icon={PhoneCall}
        />
        <MetricCard label="Propuestas Enviadas" value={totals.propuestas.toString()} sub="Enviadas este mes" icon={FileText} />
        <MetricCard 
          label="Sitios Vendidos" 
          value={totals.ventas.toString()} 
          sub={`Tasa de cierre: ${fmtWR(totals.ventas, totals.leads)}`} 
          accent={totals.ventas > 0}
          icon={Award}
        />
      </div>

      {/* Consolidador Financiero Admin */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 border border-emerald-800/40 rounded-2xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-[15%] -translate-y-[15%] w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <span className="bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/30">
              Resumen Financiero Admin
            </span>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-2">Compensación Total del Equipo</h2>
            <p className="text-xs text-emerald-200/70">Comisiones y bonos de sitios web devengados este mes</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 w-full md:w-auto">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">Facturado</p>
              <p className="text-lg md:text-xl font-extrabold text-white">{fmtMoney(totals.revenue)}</p>
            </div>
            <div className="space-y-1 border-l border-emerald-800/50 pl-4 sm:pl-6">
              <p className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">Comisión Base</p>
              <p className="text-lg md:text-xl font-extrabold text-emerald-200">{fmtMoney(totals.commissionBase)}</p>
            </div>
            <div className="space-y-1 border-l border-emerald-800/50 pl-4 sm:pl-6">
              <p className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">Bonos</p>
              <p className="text-lg md:text-xl font-extrabold text-emerald-200">{fmtMoney(totals.bonus)}</p>
            </div>
            <div className="space-y-1 border-l border-emerald-800/50 pl-4 sm:pl-6 bg-emerald-500/10 rounded-xl p-2 -m-2">
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Pagar Total</p>
              <p className="text-xl md:text-2xl font-black text-emerald-400">{fmtMoney(totals.totalEarnings)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Productivity Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl shadow-[0_4px_20px_rgba(19,27,46,0.02)] overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/20">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Métricas de Productividad de Agentes</h3>
          <span className="text-[11px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
            {agents.length} Agentes activos
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/40 border-b border-outline-variant/10">
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5">Agente</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5 text-center">Leads Trab.</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5 text-center">Ventas (Webs)</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5">Total Facturado</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5">Comisión Base</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5">Bonos</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5 font-semibold text-primary">Pagar Neto</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5 text-center">Win Rate</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 px-6 py-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm text-on-surface-variant/50 italic bg-white/50">
                    No hay datos registrados para este mes
                  </td>
                </tr>
              ) : (
                agents.map((a, i) => (
                  <AgentRow 
                    key={a.id} 
                    agent={a} 
                    idx={i} 
                    maxC={maxC} 
                    onClick={() => openDetail(a)} 
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FunnelCard leads={allLeads} />
        <SourceCard leads={allLeads} />
      </div>

      {/* Sliding Detail panel */}
      {detail && (
        <DetailSlider 
          detail={detail} 
          onClose={() => setDetail(null)} 
          onViewAsAgent={onViewAsAgent} 
        />
      )}
    </div>
  )
}

function AgentRow({ agent, idx, maxC, onClick }: { agent: AgentData; idx: number; maxC: number; onClick: () => void }) {
  const color = AGENT_COLORS[idx % AGENT_COLORS.length]
  const wrNum = agent.leads > 0 ? Math.round((agent.ventas / agent.leads) * 100) : -1
  const p = pill(wrNum < 0 ? 0 : wrNum, agent.leads)
  const wrColor = wrNum >= 15 ? "text-emerald-600 font-bold" : wrNum > 0 ? "text-amber-600 font-semibold" : "text-on-surface-variant/60"

  const progress = calcBonusProgress(agent.ventas)

  return (
    <tr
      onClick={onClick}
      className="hover:bg-surface-container-low/30 transition-all duration-150 cursor-pointer group"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border shadow-sm transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: `${color}12`, 
              borderColor: `${color}33`, 
              color 
            }}
          >
            {getInitials(agent.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{agent.name}</p>
            <p className="text-[11px] text-on-surface-variant/60">Agente Stella</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="inline-flex flex-col items-center">
          <span className="text-sm font-bold text-on-surface tabular-nums">{agent.leads}</span>
          <span className="text-[10px] text-on-surface-variant/50 tabular-nums">{agent.contactados} cont.</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center text-sm font-extrabold text-on-surface tabular-nums">
        {agent.ventas}
      </td>
      <td className="px-6 py-4 text-sm font-medium text-on-surface-variant/80 tabular-nums">
        {fmtMoney(agent.revenue)}
      </td>
      <td className="px-6 py-4 text-sm font-medium text-on-surface-variant/80 tabular-nums">
        {fmtMoney(agent.commissionBase)}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1.5 justify-center">
          <span className="text-sm font-medium text-on-surface-variant/80 tabular-nums">{fmtMoney(agent.bonus)}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(step => (
              <span 
                key={step} 
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${step <= progress ? "bg-emerald-500 shadow-sm shadow-emerald-500/30" : "bg-outline-variant/30"}`} 
              />
            ))}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-extrabold text-primary tabular-nums">
        {fmtMoney(agent.totalEarnings)}
      </td>
      <td className={`px-6 py-4 text-center text-sm tabular-nums ${wrColor}`}>
        {agent.leads > 0 ? `${wrNum}%` : "—"}
      </td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight capitalize ${p.bg}`}>
          {p.label}
        </span>
      </td>
    </tr>
  )
}

function DetailSlider({ detail, onClose, onViewAsAgent }: { 
  detail: DetailPanel; 
  onClose: () => void; 
  onViewAsAgent?: (agent: any) => void 
}) {
  const wrNum = detail.leads > 0 ? Math.round((detail.ventas / detail.leads) * 100) : 0
  const bonusProgress = calcBonusProgress(detail.ventas)
  const toNextBonus = calcToNextBonus(detail.ventas)

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" 
      />
      {/* Slide-over panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-surface-container-lowest border-l border-outline-variant/15 z-50 overflow-y-auto p-6 md:p-8 flex flex-col shadow-2xl transition-all duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-5 border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-primary border border-emerald-200/50 flex items-center justify-center font-black text-sm shadow-sm">
              {getInitials(detail.name)}
            </div>
            <div>
              <h4 className="text-base font-bold text-on-surface leading-tight">{detail.name}</h4>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5">Ficha de Rendimiento</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-surface-container-low text-on-surface-variant/80 hover:text-on-surface rounded-xl border border-outline-variant/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 py-6 space-y-6">
          {/* Action Button: Impersonate Agent */}
          {onViewAsAgent && (
            <button
              onClick={() => {
                onViewAsAgent(detail)
                onClose()
              }}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 duration-150"
            >
              <Eye size={14} className="stroke-[2.5]" />
              Ver Dashboard como {detail.name.split(" ")[0]}
            </button>
          )}

          {/* Bento metrics mini-grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Leads Asignados", value: detail.leads.toString(), desc: `${detail.contactados} contactados` },
              { label: "Sitios Vendidos", value: detail.ventas.toString(), desc: `Win rate: ${wrNum}%` },
            ].map(m => (
              <div key={m.label} className="bg-surface-container-low/40 border border-outline-variant/15 rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">{m.label}</p>
                <p className="text-xl font-extrabold text-on-surface tracking-tight leading-none mb-1.5">{m.value}</p>
                <p className="text-[10px] text-on-surface-variant/60 font-medium">{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Premium Agent Wallet Card */}
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-[25%] -translate-y-[25%] w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Compensación Acumulada</p>
                <p className="text-3xl font-black text-white mt-1 tracking-tight leading-none">{fmtMoney(detail.totalEarnings)}</p>
                <p className="text-[11px] text-emerald-100/70 font-medium mt-1">Facturado para la empresa: {fmtMoney(detail.revenue)}</p>
              </div>

              <div className="border-t border-emerald-500/30 pt-3.5 grid grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Comisión Base</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{fmtMoney(detail.commissionBase)}</p>
                  <p className="text-[9px] text-emerald-100/60 font-normal mt-0.5">$150 × {detail.ventas} venta{detail.ventas !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Bonos</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{fmtMoney(detail.bonus)}</p>
                  <p className="text-[9px] text-emerald-100/60 font-normal mt-0.5">{Math.floor(detail.ventas / 5)} bono{Math.floor(detail.ventas / 5) !== 1 ? 's' : ''} ganados</p>
                </div>
              </div>

              {/* Bonus Progress tracker */}
              <div className="border-t border-emerald-500/30 pt-3.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-emerald-200 tracking-wider">
                  <span>Progreso al siguiente bono</span>
                  <span>{bonusProgress}/5 ventas</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(step => (
                    <div 
                      key={step} 
                      className={`flex-1 h-2 rounded-full transition-all duration-300 ${step <= bonusProgress ? "bg-white shadow-sm" : "bg-white/20"}`} 
                    />
                  ))}
                </div>
                <p className="text-[10px] text-emerald-100/80 font-medium text-center italic mt-1.5">
                  {detail.ventas > 0 && detail.ventas % 5 === 0 
                    ? "¡Bono de $150 completado! 🎉" 
                    : `Le falta${toNextBonus !== 1 ? 'n' : ''} ${toNextBonus} venta${toNextBonus !== 1 ? 's' : ''} para desbloquear bono de $150`}
                </p>
              </div>
            </div>
          </div>

          {/* Funnel de conversión */}
          <FunnelCard leads={detail.leads_raw} />

          {/* Leads de este mes */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/80 flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-primary rounded-full inline-block"></span>
              Leads Asignados ({detail.leads_raw.length})
            </p>
            <div className="max-h-48 overflow-y-auto border border-outline-variant/10 rounded-xl divide-y divide-outline-variant/10">
              {detail.leads_raw.length === 0 ? (
                <p className="text-xs text-on-surface-variant/50 italic p-4 text-center">Sin leads este mes</p>
              ) : (
                detail.leads_raw.map(l => (
                  <div key={l.id} className="p-3 hover:bg-surface-container-low/20 transition-colors flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-on-surface leading-snug">{l.business_name || "Negocio sin nombre"}</p>
                      <p className="text-[10px] text-on-surface-variant/70 mt-0.5">{l.contact_name || "Sin contacto"}</p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-full capitalize">
                      {l.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actividades del agente */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/85 flex items-center gap-1.5">
              <Activity size={14} className="text-primary" />
              Actividad Reciente
            </p>
            {detail.activities.length === 0 ? (
              <p className="text-xs text-on-surface-variant/50 italic pl-5">Sin actividad registrada en este mes</p>
            ) : (
              <div className="relative pl-3.5 border-l border-outline-variant/20 space-y-4 py-1">
                {detail.activities.map((a, i) => (
                  <div key={a.id || i} className="relative group">
                    <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-surface-container-lowest" />
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
    </>
  )
}
