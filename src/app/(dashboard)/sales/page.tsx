"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Plus, Filter, CreditCard, TrendingUp, ChevronRight, MoreHorizontal, Calendar, Loader2, DollarSign, Wallet, Clock, Search, X, CheckCircle, User, Users, ArrowRight, History, Shield, LayoutGrid, Zap, Target } from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { getUserRole } from "@/lib/authHelper"

type Sale = {
  id: string
  lead_id: string
  package: string
  custom_name: string | null
  custom_description: string | null
  total_amount: number
  deposit_amount: number
  pending_amount: number
  status: string
  created_at: string
  lead?: Lead
  assigned_to?: string
}

type Lead = {
  id: string
  business_name: string
  contact_name: string
  status: string
  sale_price: number | null
  reminder_date: string | null
  created_at: string
  assigned_to?: string
}

type Profile = {
  id: string
  name: string
}

export default function SalesPage() {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [showOnlyMine, setShowOnlyMine] = useState(false)

  // Modals state
  const [showLeadSelectModal, setShowLeadSelectModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  
  // Sale Form State
  const [salePackage, setSalePackage] = useState('')
  const [saleCustomName, setSaleCustomName] = useState('')
  const [saleCustomDescription, setSaleCustomDescription] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleDeposit, setSaleDeposit] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [isFullPayment, setIsFullPayment] = useState(false)

  // Filters State
  const [filterDateRange, setFilterDateRange] = useState({ from: '', to: '' })
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all')
  const [filterAssignedUser, setFilterAssignedUser] = useState('all')
  const [leadSearchTerm, setLeadSearchTerm] = useState('')

  // Metrics
  const [metrics, setMetrics] = useState({
    totalVendido: 0,
    totalPagado: 0,
    totalPendiente: 0,
    pipelineValue: 0
  })

  // Funnel
  const [funnelData, setFunnelData] = useState([
    { label: 'Nuevo', count: 0, h: 0, color: 'bg-outline' },
    { label: 'Contactado', count: 0, h: 0, color: 'bg-secondary' },
    { label: 'Reunión', count: 0, h: 0, color: 'bg-primary' },
    { label: 'Propuesta', count: 0, h: 0, color: 'bg-primary-container' },
    { label: 'Venta', count: 0, h: 0, color: 'bg-primary-container', highlight: true },
    { label: 'Perdido', count: 0, h: 0, color: 'bg-red-200' },
  ])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      const { role, permissions } = await getUserRole()
      setUserRole(role)
      setPermissions(permissions)
      
      const canViewAll = true // Everyone can view all sales now
      
      if (!canViewAll) {
        setShowOnlyMine(true)
      }
      
      fetchData(user, role, permissions, !canViewAll || showOnlyMine)
    }
    
    init()
  }, [])

  // Refetch when toggle changes
  useEffect(() => {
    if (currentUser && userRole) {
      fetchData(currentUser, userRole, permissions, showOnlyMine)
    }
  }, [showOnlyMine])

  const fetchData = async (user = currentUser, role = userRole, currentPerms = permissions, onlyMine = showOnlyMine) => {
    setLoading(true)
    try {
      // 1. Fetch Profiles (Excluding CEOs)
      const { data: profilesData } = await supabase.from('profiles').select('id, name')
      if (profilesData) {
        const filteredProfiles = profilesData.filter(p => 
          !p.name.toLowerCase().includes('rodrigo') && 
          !p.name.toLowerCase().includes('gerardo')
        );
        setProfiles(filteredProfiles)
      }
       // 2. Fetch ALL Sales
      let salesQuery = supabase
        .from('sales')
        .select(`
          *,
          lead:leads (
            business_name,
            contact_name,
            status,
            assigned_to
          )
        `)
        .order('created_at', { ascending: false })
      
      const { data: allSales, error: salesError } = await salesQuery
      if (salesError) throw salesError

      // 3. Fetch ALL Leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, business_name, contact_name, status, sale_price, reminder_date, created_at, assigned_to')
      
      const { data: allLeads, error: leadsError } = await leadsQuery
      if (leadsError) throw leadsError

      // Filter data by Role/Toggle
      let filteredSales = allSales as any[] || []
      let filteredLeads = allLeads || []

      if (onlyMine && user) {
        filteredSales = filteredSales.filter(s => (s.lead?.assigned_to || s.assigned_to) === user.id)
        filteredLeads = filteredLeads.filter(l => l.assigned_to === user.id)
      }

      // 4. Fetch Activities (last 3 days for 'sin seguimiento' calculation)
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const { data: recentActivities } = await supabase
        .from('activities')
        .select('lead_id')
        .gte('created_at', threeDaysAgo.toISOString())
      
      const activeLeadIds = new Set(recentActivities?.map(a => a.lead_id) || [])

      // 5. Fetch Loss Reasons (last 50 status changes to 'perdido')
      const { data: lossActivities } = await supabase
        .from('activities')
        .select('description')
        .eq('type', 'status_change')
        .ilike('description', '%Motivo: %')
        .order('created_at', { ascending: false })
        .limit(50)

      const lossDist: Record<string, number> = {}
      lossActivities?.forEach(a => {
        const match = a.description.match(/Motivo: (.*)/)
        if (match && match[1]) {
          const reason = match[1].trim()
          lossDist[reason] = (lossDist[reason] || 0) + 1
        }
      })

      setSales(filteredSales)
      setLeads(filteredLeads)

      calculateAdvancedMetrics(filteredSales, filteredLeads, activeLeadIds, lossDist)

    } catch (error) {
      console.error("Error fetching sales data:", error)
    } finally {
      setLoading(false)
    }
  }

  const [advancedMetrics, setAdvancedMetrics] = useState({
    ingresosMes: 0,
    ingresosTrimestre: 0,
    conversionRate: 0,
    leadsSinSeguimiento: 0,
    projectedRevenue: 0,
    averageLeadVelocity: 0, // days
    totalCommissions: 0,
    recentSales: [] as Sale[],
    pendingPayments: [] as Sale[],
    revenueByUser: {} as Record<string, number>,
    leadsByStatus: {} as Record<string, Lead[]>,
    lossDistribution: {} as Record<string, number>
  })

  const calculateAdvancedMetrics = (salesArr: Sale[], leadsArr: Lead[], activeLeadIds: Set<string>, lossDistribution: Record<string, number>) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

    // A. Revenue
    const ingresosMes = salesArr
      .filter(s => new Date(s.created_at) >= startOfMonth)
      .reduce((acc, s) => acc + (s.total_amount || 0), 0)

    const ingresosTrimestre = salesArr
      .filter(s => new Date(s.created_at) >= startOfQuarter)
      .reduce((acc, s) => acc + (s.total_amount || 0), 0)

    // B. Conversion & Velocity
    const totalLeads = leadsArr.length
    const wonLeads = leadsArr.filter(l => l.status === 'venta')
    const ventasCount = wonLeads.length
    const conversionRate = totalLeads > 0 ? (ventasCount / totalLeads) * 100 : 0

    // Average Velocity (Days from created to closed for won leads)
    // Assuming closed_at is used, or fallback to now if missing (but we want historical)
    let totalDays = 0
    let leadsWithDates = 0
    wonLeads.forEach(l => {
      const created = new Date(l.created_at)
      // Ideally we'd have a closed_at field. If not, we estimate from created_at of related sale
      const relatedSale = salesArr.find(s => s.lead_id === l.id)
      const closedDate = relatedSale ? new Date(relatedSale.created_at) : new Date()
      const diffTime = Math.abs(closedDate.getTime() - created.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      totalDays += diffDays
      leadsWithDates++
    })
    const averageLeadVelocity = leadsWithDates > 0 ? Math.round(totalDays / leadsWithDates) : 0

    // C. No activity (active leads that didn't have activity in 3 days)
    const activeLeads = leadsArr.filter(l => l.status !== 'venta' && l.status !== 'perdido')
    const leadsSinSeguimiento = activeLeads
      .filter(l => !activeLeadIds.has(l.id)).length

    // D. Forecasting
    const pipelineValue = activeLeads.reduce((acc, l) => acc + (l.sale_price || 0), 0)
    const projectedRevenue = pipelineValue * (conversionRate / 100)

    // E. Commissions ($150 per sale)
    const totalCommissions = ventasCount * 150

    // F. Tables & Grouping
    const recentSales = salesArr.slice(0, 8)
    const pendingPayments = salesArr.filter(s => s.pending_amount > 0).slice(0, 8)

    // Group leads by status for Kanban
    const leadsByStatus: Record<string, Lead[]> = {
      nuevo: [],
      contactado: [],
      reunión: [],
      propuesta: []
    }
    activeLeads.forEach(l => {
      const s = (l.status || '').toLowerCase()
      if (leadsByStatus[s]) leadsByStatus[s].push(l)
    })

    // G. Revenue by user
    const revenueByUser: Record<string, number> = {}
    salesArr.forEach(s => {
       const user = s.assigned_to || 'Sin asignar'
       revenueByUser[user] = (revenueByUser[user] || 0) + s.total_amount
    })

    setAdvancedMetrics({
      ingresosMes,
      ingresosTrimestre,
      conversionRate,
      leadsSinSeguimiento,
      projectedRevenue,
      averageLeadVelocity,
      totalCommissions,
      recentSales,
      pendingPayments,
      revenueByUser,
      leadsByStatus,
      lossDistribution
    })

    // Legacy metrics support for current UI
    const totalVendido = salesArr.reduce((acc, s) => acc + (s.total_amount || 0), 0)
    const totalPagado = salesArr.reduce((acc, s) => acc + (s.deposit_amount || 0), 0)
    const totalPendiente = totalVendido - totalPagado
    // pipelineValue is already defined above in the forecasting section

    setMetrics({ totalVendido, totalPagado, totalPendiente, pipelineValue })

    // Funnel logic
    const counts: Record<string, number> = { nuevo: 0, contactado: 0, reunión: 0, propuesta: 0, venta: 0, perdido: 0 }
    leadsArr.forEach(l => {
      const status = (l.status || '').toLowerCase()
      if (counts.hasOwnProperty(status)) counts[status]++
        })
    const maxCount = Math.max(...Object.values(counts), 1)
    
    setFunnelData([
      { label: 'Nuevo', count: counts.nuevo, h: (counts.nuevo / maxCount) * 100, color: 'bg-outline' },
      { label: 'Contactado', count: counts.contactado, h: (counts.contactado / maxCount) * 100, color: 'bg-secondary' },
      { label: 'Reunión', count: counts.reunión, h: (counts.reunión / maxCount) * 100, color: 'bg-primary-container' },
      { label: 'Propuesta', count: counts.propuesta, h: (counts.propuesta / maxCount) * 100, color: 'bg-primary', highlight: true },
      { label: 'Venta', count: counts.venta, h: (counts.venta / maxCount) * 100, color: 'bg-green-500' },
      { label: 'Perdido', count: counts.perdido, h: (counts.perdido / maxCount) * 100, color: 'bg-red-200' },
    ])
  }

  const handleQuickStatusUpdate = async (leadId: string, currentStatus: string, direction: 'next' | 'lost') => {
    const stages = ['nuevo', 'contactado', 'reunión', 'propuesta', 'venta', 'perdido']
    const currentIndex = stages.indexOf(currentStatus.toLowerCase())
    
    let newStatus = currentStatus
    if (direction === 'next' && currentIndex < 4) {
      newStatus = stages[currentIndex + 1]
    } else if (direction === 'lost') {
      newStatus = 'perdido'
    }

    if (newStatus === currentStatus) return

    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)

    if (!error) {
      // Re-fetch data to reflect changes
      if (currentUser && userRole) fetchData(currentUser, userRole, permissions, showOnlyMine)
      
      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'status_change',
        description: `Estado actualizado rápidamente a ${newStatus} desde el Pipeline`,
        created_by: currentUser?.id
      })
    }
  }

  const handleSaleSubmit = async () => {
    if (!selectedLead || savingSale || !salePackage) return
    
    const isOther = salePackage === 'Otro'
    if (isOther && !saleCustomName.trim()) {
      alert('Por favor indica el nombre del paquete personalizado.')
      return
    }

    const total = Number(salePrice) || 0
    if (total <= 0) {
      alert('El precio debe ser mayor a 0.')
      return
    }

    setSavingSale(true)

    const deposit = Number(saleDeposit) || 0
    const pending = total - deposit
    const pStatus = pending <= 0 ? 'pagado' : 'pendiente'

    try {
      // 1. Create Sale
      const { data: newSale, error: saleError } = await supabase
        .from('sales')
        .insert({
          lead_id: selectedLead.id,
          package: salePackage,
          custom_name: isOther ? saleCustomName.trim() : null,
          custom_description: isOther ? saleCustomDescription.trim() : null,
          total_amount: total,
          deposit_amount: deposit,
          pending_amount: pending,
          status: pStatus,
          created_by: currentUser?.id
        })
        .select()
        .single()

      if (saleError) throw saleError

      // 2. Update Lead status to 'venta'
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'venta',
          closed_at: new Date().toISOString()
        })
        .eq('id', selectedLead.id)

      if (leadError) console.warn('Lead status update failed:', leadError.message)

      // 3. Activity and Notifications
      await supabase.from('activities').insert({
        lead_id: selectedLead.id,
        type: 'sale',
        description: `Venta registrada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Total: $${total.toLocaleString()}`,
        created_by: currentUser?.id
      })

      // Update UI
      fetchData()
      setShowSaleModal(false)
      setSelectedLead(null)
      resetSaleForm()
    } catch (error: any) {
      alert('Error al registrar la venta: ' + error.message)
    } finally {
      setSavingSale(false)
    }
  }

  const resetSaleForm = () => {
    setSalePackage('')
    setSaleCustomName('')
    setSaleCustomDescription('')
    setSalePrice('')
    setSaleDeposit('')
    setIsFullPayment(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">Ventas</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1">Resumen de ingresos y pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Role Toggle for Admins or those with view_all_sales permission */}
          {(userRole === 'admin' || permissions.includes('view_all_sales')) && (
            <div className="flex p-1 bg-surface-container-high rounded-xl border border-outline-variant/10 flex-1 sm:flex-none">
              <button
                onClick={() => setShowOnlyMine(false)}
                className={`flex-1 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !showOnlyMine 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
                }`}
              >
                <LayoutGrid size={14} /> Todas
              </button>
              <button
                onClick={() => setShowOnlyMine(true)}
                className={`flex-1 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  showOnlyMine 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
                }`}
              >
                <User size={14} /> Mis Ventas
              </button>
            </div>
          )}

          <button 
            onClick={() => setShowFiltersModal(true)}
            className={`flex-1 sm:flex-none px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              (filterDateRange.from || filterPaymentStatus !== 'all' || filterAssignedUser !== 'all') 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'
            }`}
          >
            <Filter size={16} /> Filtros
          </button>
          <button 
            onClick={() => setShowLeadSelectModal(true)}
            className="flex-1 sm:flex-none px-3 sm:px-5 py-2.5 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Plus size={18} /> <span className="whitespace-nowrap">Nueva venta</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-surface-container-lowest rounded-2xl p-6 ambient-shadow relative overflow-hidden flex flex-col justify-between h-40 border border-outline-variant/10">
          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <DollarSign size={16} />
              </div>
              <h3 className="text-xs font-bold tracking-widest uppercase">Ingresos Mes</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-on-background tracking-tight">${advancedMetrics.ingresosMes.toLocaleString()}</p>
          </div>
        </div>

        <div className="lg:col-span-1 bg-surface-container-lowest rounded-2xl p-6 ambient-shadow relative overflow-hidden flex flex-col justify-between h-40 border border-outline-variant/10">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                <Target size={16} />
              </div>
              <h3 className="text-xs font-bold tracking-widest uppercase">Proyección</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-on-background tracking-tight text-green-600">${Math.round(advancedMetrics.projectedRevenue).toLocaleString()}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">Valor proyectado del pipeline</p>
          </div>
        </div>

        <div className="lg:col-span-1 bg-surface-container-lowest rounded-2xl p-6 ambient-shadow relative overflow-hidden flex flex-col justify-between h-40 border border-outline-variant/10">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Zap size={16} />
              </div>
              <h3 className="text-xs font-bold tracking-widest uppercase">Velocidad</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-on-background tracking-tight text-amber-600">{advancedMetrics.averageLeadVelocity} <span className="text-sm font-bold opacity-70">días</span></p>
            <p className="text-[10px] text-on-surface-variant mt-1">Promedio de cierre de venta</p>
          </div>
        </div>

        <div className="lg:col-span-1 bg-surface-container-lowest rounded-2xl p-6 ambient-shadow relative overflow-hidden flex flex-col justify-between h-40 border border-outline-variant/10">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <History size={16} />
              </div>
              <h3 className="text-xs font-bold tracking-widest uppercase">Comisiones</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-on-background tracking-tight text-primary">
              ${advancedMetrics.totalCommissions.toLocaleString()}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">$150 por venta cerrada</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: Recent Sales */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-3xl p-2 border border-outline-variant/10">
          <div className="px-6 py-5 flex items-center justify-between">
            <h3 className="font-headline text-lg font-bold text-on-background">Ventas Recientes</h3>
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="hidden sm:grid grid-cols-12 gap-4 px-8 pb-3 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/5">
            <div className="col-span-4">Negocio / Contacto</div>
            <div className="col-span-3">Paquete</div>
            <div className="col-span-2">Monto</div>
            <div className="col-span-3 text-right">Fecha</div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {advancedMetrics.recentSales.map(sale => (
              <div 
                key={sale.id} 
                onClick={() => { setSelectedSaleDetail(sale); setShowSaleDetailModal(true); }}
                className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-6 py-4 sm:py-3 hover:bg-white rounded-2xl transition-all items-start sm:items-center group cursor-pointer border border-transparent hover:border-outline-variant/10 bg-surface-container-lowest/50 sm:bg-transparent mb-1"
              >
                <div className="col-span-4 w-full">
                  <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{sale.lead?.business_name || 'Desconocido'}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">{sale.lead?.contact_name || 'Sin contacto'}</p>
                </div>
                <div className="col-span-3">
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 bg-surface-container-highest rounded text-on-surface-variant uppercase">
                    {sale.package}
                  </span>
                </div>
                <div className="col-span-2 flex justify-between sm:block w-full">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase sm:hidden">Monto:</span>
                  <p className="font-bold text-sm text-on-surface">${sale.total_amount.toLocaleString()}</p>
                </div>
                <div className="col-span-3 w-full sm:text-right flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-outline-variant/5">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase sm:hidden">Fecha:</span>
                  <p className="text-[10px] font-bold text-on-surface-variant">{new Date(sale.created_at).toLocaleDateString()}</p>
                  <ChevronRight size={14} className="text-on-surface-variant hidden sm:block opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
            {advancedMetrics.recentSales.length === 0 && (
              <div className="py-12 text-center text-on-surface-variant text-sm">No hay ventas registradas.</div>
            )}
          </div>
        </div>

        {/* RIGHT: Revenue by User */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline text-lg font-bold text-on-background">Análisis de Pérdidas</h3>
              <Shield size={18} className="text-red-500" />
            </div>
            <div className="space-y-4">
              {Object.entries(advancedMetrics.lossDistribution)
                .sort((a,b) => b[1] - a[1])
                .map(([reason, count]) => {
                  const total = Object.values(advancedMetrics.lossDistribution).reduce((a,b) => a+b, 0)
                  const percentage = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={reason} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-on-surface-variant truncate pr-2">{reason}</span>
                        <span className="text-on-surface">{count}</span>
                      </div>
                      <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className="bg-red-500/60 h-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              {Object.keys(advancedMetrics.lossDistribution).length === 0 && (
                <div className="py-10 text-center text-on-surface-variant text-xs italic">No hay datos de pérdida registrados</div>
              )}
            </div>
          </div>

          {(userRole === 'admin' || permissions.includes('view_team_sales_stats')) && (
            <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline text-lg font-bold text-on-background">Ingresos por Vendedor</h3>
                <Users size={18} className="text-primary" />
              </div>
              <div className="space-y-4">
                {Object.entries(advancedMetrics.revenueByUser)
                  .filter(([userId]) => userId === 'Sin asignar' || profiles.some(p => p.id === userId))
                  .sort((a,b) => b[1] - a[1])
                  .map(([userId, amount]) => {
                   const profile = profiles.find(p => p.id === userId)
                   const percentage = (amount / metrics.totalVendido) * 100
                   return (
                   <div key={userId} className="space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                       <span className="text-on-surface truncate pr-2">{profile?.name || 'Sistema'}</span>
                       <span className="text-primary">${amount.toLocaleString()}</span>
                     </div>
                     <div className="h-1.5 bg-surface-container rounded-full overflow-hidden flex">
                       <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                     </div>
                   </div>
                   )
                 })}
                {Object.keys(advancedMetrics.revenueByUser).length === 0 && (
                  <div className="py-10 text-center text-on-surface-variant text-xs italic">No hay datos de ingresos por vendedor</div>
                )}
              </div>
            </div>
          )}

           <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline text-lg font-bold text-on-background">Pagos Pendientes</h3>
                <Wallet size={18} className="text-amber-500" />
              </div>
              <div className="space-y-3">
                {advancedMetrics.pendingPayments.map(sale => (
                  <div key={sale.id} className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/5">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-xs text-on-surface truncate pr-2">{sale.lead?.business_name}</p>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Pendiente</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-[10px] text-on-surface-variant flex gap-2">
                         <span>Total: ${sale.total_amount.toLocaleString()}</span>
                         <span>•</span>
                         <span>Pagado: ${sale.deposit_amount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-extrabold text-amber-700">${sale.pending_amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {advancedMetrics.pendingPayments.length === 0 && (
                  <div className="py-8 text-center text-on-surface-variant text-xs">No hay pagos pendientes.</div>
                )}
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-6 pb-20">
        <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface-variant flex items-center gap-2">
          <LayoutGrid size={12} /> Gestión del Pipeline Interactivo
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {['nuevo', 'contactado', 'reunión', 'propuesta'].map((status) => {
            const stageLeads = advancedMetrics.leadsByStatus[status] || []
            const stageLabels: Record<string, string> = {
              nuevo: "Nuevos",
              contactado: "Contactados",
              reunión: "En Reunión",
              propuesta: "Propuesta"
            }
            const stageColors: Record<string, string> = {
              nuevo: "bg-surface-container",
              contactado: "bg-blue-500/5 border-blue-500/20",
              reunión: "bg-amber-500/5 border-amber-500/20",
              propuesta: "bg-primary/5 border-primary/20"
            }

            return (
              <div key={status} className={`flex flex-col min-h-[400px] rounded-2xl border border-outline-variant/10 p-4 ${stageColors[status] || 'bg-surface-container-low'}`}>
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <h4 className="font-headline text-sm font-bold text-on-background">{stageLabels[status]}</h4>
                  </div>
                  <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant">{stageLeads.length}</span>
                </div>

                <div className="space-y-3">
                  {stageLeads.map((lead) => {
                    const createdDate = new Date(lead.created_at)
                    const daysInStage = Math.ceil(Math.abs(new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
                    
                    return (
                      <div key={lead.id} className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/5 ambient-shadow group hover:border-primary/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors truncate pr-1">{lead.business_name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${daysInStage > 7 ? 'bg-red-500/10 text-red-600' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {daysInStage}d
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-on-surface-variant mb-3 truncate">{lead.contact_name}</p>
                        
                        <div className="flex items-center justify-between gap-1 pt-2 border-t border-outline-variant/5">
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => handleQuickStatusUpdate(lead.id, lead.status, 'lost')}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-red-600 transition-colors"
                              title="Marcar como perdido"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-primary">${(lead.sale_price || 0).toLocaleString()}</span>
                            <button 
                              onClick={() => handleQuickStatusUpdate(lead.id, lead.status, 'next')}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all"
                              title="Siguiente etapa"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {stageLeads.length === 0 && (
                    <div className="py-10 text-center text-on-surface-variant text-[10px] italic opacity-50">Sin leads</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* MODALS */}

      {/* LEAD SELECTION MODAL */}
      {showLeadSelectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg overflow-hidden ambient-shadow border border-outline-variant/10 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Seleccionar Cliente</h3>
                <p className="text-xs text-on-surface-variant mt-1">Busca el lead al que deseas registrarle una venta</p>
              </div>
              <button 
                onClick={() => { setShowLeadSelectModal(false); setLeadSearchTerm(''); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Buscar por nombre de negocio o contacto..." 
                  className="w-full pl-12 pr-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={leadSearchTerm}
                  onChange={(e) => setLeadSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
                {leads
                  .filter(l => 
                    l.business_name.toLowerCase().includes(leadSearchTerm.toLowerCase()) || 
                    l.contact_name.toLowerCase().includes(leadSearchTerm.toLowerCase())
                  )
                  .map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setShowLeadSelectModal(false);
                        setShowSaleModal(true);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group"
                    >
                      <div className="text-left">
                        <p className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">{lead.business_name}</p>
                        <p className="text-xs text-on-surface-variant">{lead.contact_name}</p>
                      </div>
                      <ArrowRight size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                    </button>
                  ))
                }
                {leads.length === 0 && (
                  <div className="py-8 text-center text-on-surface-variant text-sm">
                    No se encontraron leads.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALE FORM MODAL */}
      {showSaleModal && selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-xl overflow-hidden ambient-shadow border border-outline-variant/10 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Registrar Venta</h3>
                <p className="text-xs text-on-surface-variant mt-1">Para: <span className="font-bold text-primary">{selectedLead.business_name}</span></p>
              </div>
              <button 
                onClick={() => { setShowSaleModal(false); setSelectedLead(null); resetSaleForm(); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Paquete / Servicio</label>
                  <select 
                    value={salePackage}
                    onChange={(e) => setSalePackage(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm appearance-none"
                  >
                    <option value="">Seleccionar paquete...</option>
                    <option value="Servicio Mensual">Servicio Mensual</option>
                    <option value="Landing Page">Landing Page</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Paquete Ads">Paquete Ads</option>
                    <option value="Branding">Branding</option>
                    <option value="Otro">Otro (Personalizado)</option>
                  </select>
                </div>

                {salePackage === 'Otro' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Nombre Personalizado</label>
                      <input 
                        type="text"
                        value={saleCustomName}
                        onChange={(e) => setSaleCustomName(e.target.value)}
                        placeholder="Ej. Proyecto Especial de Rediseño"
                        className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Descripción</label>
                      <textarea 
                        value={saleCustomDescription}
                        onChange={(e) => setSaleCustomDescription(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Precio Total</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                    <input 
                      type="number"
                      value={salePrice}
                      onChange={(e) => {
                        setSalePrice(e.target.value);
                        if (isFullPayment) setSaleDeposit(e.target.value);
                      }}
                      className="w-full pl-8 pr-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-bold text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Anticipo / Pagado</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                    <input 
                      type="number"
                      disabled={isFullPayment}
                      value={saleDeposit}
                      onChange={(e) => setSaleDeposit(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-surface-container rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-bold ${isFullPayment ? 'text-on-surface-variant opacity-60' : 'text-green-600'}`}
                    />
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-3 px-2">
                  <button 
                    onClick={() => {
                      setIsFullPayment(!isFullPayment);
                      if (!isFullPayment) setSaleDeposit(salePrice);
                    }}
                    className="flex items-center gap-3 group"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isFullPayment ? 'bg-primary border-primary' : 'border-outline group-hover:border-primary'}`}>
                      {isFullPayment && <CheckCircle size={14} className="text-on-primary" />}
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant">Pago Completo (Liquidado)</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => { setShowSaleModal(false); setSelectedLead(null); resetSaleForm(); }}
                  className="flex-1 px-6 py-3 rounded-2xl bg-surface-container-highest text-on-surface font-bold text-sm hover:bg-outline-variant/20 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  disabled={savingSale || !salePackage || !salePrice}
                  onClick={handleSaleSubmit}
                  className="flex-[2] px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {savingSale ? <Loader2 size={18} className="animate-spin" /> : <DollarSign size={18} />}
                  Confirmar Venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTERS MODAL */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md overflow-hidden ambient-shadow border border-outline-variant/10 flex flex-col">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Filtros de Ventas</h3>
                <p className="text-xs text-on-surface-variant mt-1">Refina el reporte de ingresos</p>
              </div>
              <button 
                onClick={() => setShowFiltersModal(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Rango de Fecha</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input 
                      type="date"
                      value={filterDateRange.from}
                      onChange={(e) => setFilterDateRange({...filterDateRange, from: e.target.value})}
                      className="w-full pl-9 pr-2 py-2.5 bg-surface-container rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input 
                      type="date"
                      value={filterDateRange.to}
                      onChange={(e) => setFilterDateRange({...filterDateRange, to: e.target.value})}
                      className="w-full pl-9 pr-2 py-2.5 bg-surface-container rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Estado de Pago</label>
                <div className="flex gap-2">
                  {['all', 'pagado', 'pendiente'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterPaymentStatus(status)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                        filterPaymentStatus === status 
                          ? 'bg-primary text-on-primary border-primary' 
                          : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-outline-variant/10'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : status}
                    </button>
                  ))}
                </div>
              </div>

              {userRole === 'admin' && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Usuario Asignado</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <select 
                      value={filterAssignedUser}
                      onChange={(e) => setFilterAssignedUser(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none"
                    >
                      <option value="all">Todos los usuarios</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* CLEAR FILTERS */}
              <button 
                onClick={() => {
                  setFilterDateRange({ from: '', to: '' });
                  setFilterPaymentStatus('all');
                  setFilterAssignedUser('all');
                }}
                className="w-full py-2 text-[10px] font-extrabold uppercase tracking-widest text-primary hover:underline"
              >
                Limpiar Filtros
              </button>

              <button 
                onClick={() => { fetchData(); setShowFiltersModal(false); }}
                className="w-full py-3 bg-primary text-on-primary rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
