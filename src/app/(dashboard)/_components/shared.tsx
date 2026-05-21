import React from "react"
import { Calendar, ChevronDown } from "lucide-react"

// ── Helpers de Compensación ──────────────────────────────────────────────────
export function calcCommission(ventas: number): number {
  return ventas * 150
}

export function calcBonus(ventas: number): number {
  return Math.floor(ventas / 5) * 150
}

export function calcTotalEarnings(ventas: number): number {
  return calcCommission(ventas) + calcBonus(ventas)
}

export function calcBonusProgress(ventas: number): number {
  return ventas % 5
}

export function calcToNextBonus(ventas: number): number {
  return 5 - (ventas % 5)
}

// ── Tokens ─────────────────────────────────────────────────────────────────
export const BG       = "transparent"
export const SURFACE  = "var(--color-surface-container-lowest)"
export const CARD_BG  = "var(--color-surface-container-lowest)"
export const TH_BG    = "var(--color-surface-container-low)"
export const GREEN    = "var(--color-primary)"
export const AMBER    = "#F59E0B"
export const RED      = "#EF4444"
export const WHITE    = "var(--color-on-surface)"
export const DIM      = "var(--color-on-surface-variant)"
export const BORDER   = "rgba(19, 27, 46, 0.12)"
export const ROWBDR   = "rgba(19, 27, 46, 0.06)"
export const HOVER    = "rgba(19, 27, 46, 0.03)"

export const FUNNEL_STAGES = [
  { matches: ["nuevo","new"],                         label: "Nuevos",     color: "#818CF8" },
  { matches: ["contactado","interesado"],             label: "Contactados",color: "#38BDF8" },
  { matches: ["reunión","reunion","meeting","cita"],  label: "Reuniones",  color: "#A78BFA" },
  { matches: ["demo"],                               label: "Demos",      color: "#F472B6" },
  { matches: ["propuesta"],                          label: "Propuestas", color: "#FB923C" },
  { matches: ["venta","sold","cerrado"],             label: "Ventas",     color: "#10B981" },
]

export const AGENT_COLORS = ["#6366F1","#F59E0B","#EC4899","#3B82F6","#8B5CF6","#10B981","#F97316","#14B8A6"]

export const CONTACTADO_ST = ["contactado","interesado","reunión","reunion","meeting","cita","demo","propuesta","venta","sold","cerrado"]

// ── Helpers ────────────────────────────────────────────────────────────────
export function monthRange(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return {
    gte: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
    lt:  new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
  }
}

export function generateMonths(): { label: string; value: string }[] {
  const out = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`
    const raw = d.toLocaleDateString("es-ES",{month:"long",year:"numeric"})
    out.push({ label: raw.charAt(0).toUpperCase() + raw.slice(1), value })
  }
  return out
}

export function fmtMoney(n: number|null|undefined): string {
  if (n === null || n === undefined) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function fmtWR(v: number, l: number): string {
  if (l === 0) return "—"
  return `${Math.round((v/l)*100)}%`
}

export function getInitials(name: string) {
  return name.split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase()
}

export function cleanSrc(src: string|null): string|null {
  if (!src) return null
  const s = src.toLowerCase()
  if (s.includes("instagram")) return "Instagram"
  if (s.includes("facebook")||s.includes("fb")) return "Facebook"
  if (s.includes("whatsapp")||s.includes("wa.")) return "WhatsApp"
  if (s.includes("tiktok")) return "TikTok"
  if (s.includes("google")) return "Google"
  if (s.includes("referido")||s.includes("recomend")) return "Referido"
  return src.length > 22 ? src.slice(0,20)+"…" : src
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff/60000)
  if (m < 1) return "ahora"
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m/60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h/24)
  return `hace ${d} día${d>1?"s":""}`
}

export function pill(wr: number, leads: number) {
  if (leads === 0) return { label:"Sin datos",   bg:"bg-slate-100 text-slate-500 border border-slate-200/50", color:"text-slate-500" }
  if (wr === 0)   return { label:"Sin ventas",  bg:"bg-slate-100 text-slate-500 border border-slate-200/50", color:"text-slate-500" }
  if (wr >= 15)   return { label:"Alto",        bg:"bg-emerald-50 text-emerald-700 border border-emerald-200/50",   color:"text-emerald-700" }
  if (wr >= 5)    return { label:"Medio",       bg:"bg-amber-50 text-amber-700 border border-amber-200/50",  color:"text-amber-700" }
  return            { label:"Bajo",         bg:"bg-red-50 text-red-700 border border-red-200/50",   color:"text-red-700" }
}

// ── Shared Components ──────────────────────────────────────────────────────

export function MonthSelect({ months, value, onChange }: {
  months: {label:string;value:string}[]
  value: string
  onChange: (v:string)=>void
}) {
  return (
    <div className="relative flex items-center">
      <Calendar size={15} className="absolute left-3.5 text-on-surface-variant/70 pointer-events-none" />
      <select
        value={value}
        onChange={e=>onChange(e.target.value)}
        className="appearance-none bg-surface-container-lowest border border-outline-variant/25 text-on-surface rounded-xl pl-9 pr-10 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 cursor-pointer hover:bg-surface-container-low/40"
      >
        {months.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 text-on-surface-variant/70 pointer-events-none" />
    </div>
  )
}

export function MetricCard({ label, value, sub, accent=false, icon: Icon }: {
  label: string
  value: string
  sub: string
  accent?: boolean
  icon?: React.ComponentType<any>
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)] hover:shadow-[0_8px_30px_rgba(19,27,46,0.05)] transition-all duration-300 hover:-translate-y-0.5 flex items-start justify-between">
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/80">{label}</p>
        <p className={`text-2xl md:text-3xl font-extrabold tracking-tight ${accent ? "text-primary" : "text-on-surface"}`}>{value}</p>
        <p className="text-xs font-medium text-on-surface-variant/60">{sub}</p>
      </div>
      {Icon && (
        <div className={`p-3 rounded-xl flex items-center justify-center ${accent ? "bg-primary/10 text-primary" : "bg-surface-container-low text-on-surface-variant/75"}`}>
          <Icon size={20} className={accent ? "stroke-[2.5]" : "stroke-[2]"} />
        </div>
      )}
    </div>
  )
}

export function FunnelCard({ leads }: { leads:{status:string|null}[] }) {
  const rows = FUNNEL_STAGES.map(s=>({
    label:s.label, color:s.color,
    count:leads.filter(l=>s.matches.includes((l.status||"").toLowerCase())).length
  }))
  const max = Math.max(...rows.map(r=>r.count),1)
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)]">
      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/85 mb-5 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-primary rounded-full inline-block"></span>
        Funnel del mes
      </p>
      <div className="flex flex-col gap-4">
        {rows.map(r=>(
          <div key={r.label} className="flex items-center gap-3.5 group">
            <span className="text-xs font-semibold text-on-surface-variant/80 w-24 truncate">{r.label}</span>
            <div className="flex-1 h-5 bg-surface-container-low/60 rounded-lg overflow-hidden relative">
              <div 
                className="height-full h-full rounded-lg transition-all duration-700 ease-out shadow-[inset_-3px_0_8px_rgba(0,0,0,0.02)]" 
                style={{ 
                  width: `${(r.count/max)*100}%`, 
                  backgroundColor: r.color,
                  minWidth: r.count > 0 ? "8px" : "0px"
                }} 
              />
            </div>
            <span className="text-xs font-bold text-on-surface min-w-[28px] text-right">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SourceCard({ leads }: { leads:{source:string|null}[] }) {
  const map: Record<string,number> = {}
  leads.forEach(l=>{ const s=cleanSrc(l.source); if(s) map[s]=(map[s]||0)+1 })
  const total = Object.values(map).reduce((a,b)=>a+b,0)
  const rows = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6)
    .map(([name,count])=>({name,count,pct:total>0?Math.round((count/total)*100):0}))
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 md:p-6 shadow-[0_4px_20px_rgba(19,27,46,0.02)]">
      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/85 mb-5 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-sky-500 rounded-full inline-block"></span>
        Fuentes de leads
      </p>
      <div className="flex flex-col gap-4">
        {rows.length===0 && <span className="text-xs text-on-surface-variant/50 italic py-4">Sin datos de origen</span>}
        {rows.map(r=>(
          <div key={r.name} className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-medium">
              <span className="text-on-surface font-semibold">{r.name}</span>
              <span className="text-on-surface-variant/65">{r.count} leads · {r.pct}%</span>
            </div>
            <div className="h-2 bg-surface-container-low/60 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-500/85 rounded-full transition-all duration-700 ease-out" 
                style={{ width: `${r.pct}%` }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
