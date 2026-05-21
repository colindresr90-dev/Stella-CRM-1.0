"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { 
  Plus, 
  Filter, 
  CreditCard, 
  TrendingUp, 
  ChevronRight, 
  Calendar, 
  Loader2, 
  DollarSign, 
  Wallet, 
  Search, 
  X, 
  CheckCircle, 
  User, 
  Users, 
  ArrowRight, 
  History, 
  Shield, 
  LayoutGrid, 
  Zap, 
  Target,
  Pencil
} from "lucide-react"
import { createNotification } from "@/lib/notifications"
import { getUserRole } from "@/lib/authHelper"
import { MonthSelect, generateMonths, monthRange } from "../_components/shared"

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

  // Monthly goal and month selector states
  const monthsList = useMemo(() => generateMonths(), [])
  const [selectedMonth, setSelectedMonth] = useState<string>(monthsList[0]?.value || '')
  const [orgSettings, setOrgSettings] = useState<any>(null)
  const [showGoalEditModal, setShowGoalEditModal] = useState(false)
  const [newGoalVal, setNewGoalVal] = useState('')
  const [savingGoalState, setSavingGoalState] = useState(false)

  // Tabs State
  const [activeTab, setActiveTab] = useState<'ledger' | 'pipeline' | 'analytics'>('ledger')

  // Modals state
  const [showLeadSelectModal, setShowLeadSelectModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false)
  
  // Loss Reason modal state
  const [showLossModal, setShowLossModal] = useState(false)
  const [selectedLeadForLoss, setSelectedLeadForLoss] = useState<Lead | null>(null)
  const [lossReason, setLossReason] = useState('')
  const [customLossReason, setCustomLossReason] = useState('')
  const [savingLoss, setSavingLoss] = useState(false)

  // Selected entities for details or sale creation
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
  
  // Search terms
  const [salesSearchTerm, setSalesSearchTerm] = useState('')
  const [leadSearchTerm, setLeadSearchTerm] = useState('')

  // Abonos / Installments State
  const [saleActivities, setSaleActivities] = useState<any[]>([])
  const [loadingSaleActivities, setLoadingSaleActivities] = useState(false)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [registeringAbono, setRegisteringAbono] = useState(false)

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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      const { role, permissions } = await getUserRole()
      setUserRole(role)
      setPermissions(permissions)
      
      // If Vendedor, force showOnlyMine to true
      const isUserAdmin = role === 'admin'
      const initialShowOnlyMine = !isUserAdmin
      if (initialShowOnlyMine) {
        setShowOnlyMine(true)
      }
      
      fetchData(user, role, permissions, initialShowOnlyMine, monthsList[0]?.value || '')
    }
    
    init()
  }, [])

  // Redirect to ledger if Vendedor tries to access analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && userRole !== null && userRole !== 'admin') {
      setActiveTab('ledger')
    }
  }, [activeTab, userRole])

  // Refetch when toggle or selected month changes
  useEffect(() => {
    if (currentUser && userRole !== null) {
      fetchData(currentUser, userRole, permissions, showOnlyMine, selectedMonth)
    }
  }, [showOnlyMine, selectedMonth])

  // Fetch activities for selected sale detail
  useEffect(() => {
    if (selectedSaleDetail) {
      fetchSaleActivities(selectedSaleDetail.lead_id)
    } else {
      setSaleActivities([])
    }
  }, [selectedSaleDetail])

  const fetchSaleActivities = async (leadId: string) => {
    setLoadingSaleActivities(true)
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      
      if (!error) {
        setSaleActivities(data || [])
      }
    } catch (err) {
      console.error("Error fetching sale activities:", err)
    } finally {
      setLoadingSaleActivities(false)
    }
  }

  const fetchData = async (
    user = currentUser, 
    role = userRole, 
    currentPerms = permissions, 
    onlyMine = showOnlyMine, 
    month = selectedMonth
  ) => {
    setLoading(true)
    try {
      // 1. Fetch organization settings via API Route
      let orgDataToUse = orgSettings
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        try {
          const orgResponse = await fetch('/api/organization-settings', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          if (orgResponse.ok) {
            const orgData = await orgResponse.json()
            setOrgSettings(orgData)
            orgDataToUse = orgData
          } else {
            console.error("Failed to load organization settings via API:", orgResponse.statusText)
          }
        } catch (orgErr) {
          console.error("Error loading organization settings via API:", orgErr)
        }
      }

      // 2. Fetch Profiles (Excluding CEOs)
      const { data: profilesData } = await supabase.from('profiles').select('id, name')
      if (profilesData) {
        const filteredProfiles = profilesData.filter(p => 
          !p.name.toLowerCase().includes('rodrigo') && 
          !p.name.toLowerCase().includes('gerardo')
        );
        setProfiles(filteredProfiles)
      }
      
      // Calculate month range for queries
      const range = monthRange(month)

      // 3. Fetch Sales (with filters applied at query level where possible)
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
        .gte('created_at', range.gte)
        .lt('created_at', range.lt)
        .order('created_at', { ascending: false })

      if (filterPaymentStatus !== 'all') {
        salesQuery = salesQuery.eq('status', filterPaymentStatus)
      }
      if (filterDateRange.from) {
        salesQuery = salesQuery.gte('created_at', filterDateRange.from)
      }
      if (filterDateRange.to) {
        salesQuery = salesQuery.lte('created_at', `${filterDateRange.to}T23:59:59`)
      }
      
      const { data: allSales, error: salesError } = await salesQuery
      if (salesError) throw salesError

      // 4. Fetch Leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, business_name, contact_name, status, sale_price, reminder_date, created_at, assigned_to')
        .gte('created_at', range.gte)
        .lt('created_at', range.lt)
      
      const { data: allLeads, error: leadsError } = await leadsQuery
      if (leadsError) throw leadsError

      // Filter data by Role/Toggle / Assigned filters
      let filteredSales = allSales as any[] || []
      let filteredLeads = allLeads || []

      // If user is not admin, force showOnlyMine
      const strictOnlyMine = onlyMine || (role !== 'admin')

      if (strictOnlyMine && user) {
        filteredSales = filteredSales.filter(s => (s.lead?.assigned_to || s.assigned_to) === user.id)
        filteredLeads = filteredLeads.filter(l => l.assigned_to === user.id)
      }

      if (filterAssignedUser !== 'all') {
        filteredSales = filteredSales.filter(s => (s.lead?.assigned_to || s.assigned_to) === filterAssignedUser)
      }

      // 5. Fetch Activities (last 3 days for 'sin seguimiento' calculation)
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const { data: recentActivities } = await supabase
        .from('activities')
        .select('lead_id')
        .gte('created_at', threeDaysAgo.toISOString())
      
      const activeLeadIds = new Set(recentActivities?.map(a => a.lead_id) || [])

      // 6. Fetch Loss Reasons (last 50 status changes to 'perdido')
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

      calculateAdvancedMetrics(filteredSales, filteredLeads, activeLeadIds, lossDist, orgDataToUse, month)

    } catch (error) {
      console.error("Error fetching sales data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAdvancedMetrics = (
    salesArr: Sale[], 
    leadsArr: Lead[], 
    activeLeadIds: Set<string>, 
    lossDistribution: Record<string, number>,
    currentOrgSettings = orgSettings,
    month = selectedMonth
  ) => {
    const now = new Date()
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

    // A. Revenue
    // Since salesArr is filtered by month in query, ingresosMes is total total_amount of salesArr
    const ingresosMes = salesArr.reduce((acc, s) => acc + (s.total_amount || 0), 0)

    const ingresosTrimestre = salesArr
      .filter(s => new Date(s.created_at) >= startOfQuarter)
      .reduce((acc, s) => acc + (s.total_amount || 0), 0)

    // B. Conversion & Velocity
    const totalLeads = leadsArr.length
    const wonLeads = leadsArr.filter(l => l.status === 'venta')
    const ventasCount = wonLeads.length
    const conversionRate = totalLeads > 0 ? (ventasCount / totalLeads) * 100 : 0

    // Average Velocity (Days from created to closed for won leads)
    let totalDays = 0
    let leadsWithDates = 0
    wonLeads.forEach(l => {
      const created = new Date(l.created_at)
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
    const totalCommissions = salesArr.filter(s => s.status === 'pagado').length * 150

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
       const user = s.lead?.assigned_to || s.assigned_to || 'Sin asignar'
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
    // If lost, trigger custom Loss Reason modal to gather details
    if (direction === 'lost') {
      const leadObj = leads.find(l => l.id === leadId)
      if (leadObj) {
        setSelectedLeadForLoss(leadObj)
        setShowLossModal(true)
      }
      return
    }

    // If advancing from "Propuesta", it must trigger the "Registrar Venta" Modal
    if (currentStatus === 'propuesta' && direction === 'next') {
      const leadObj = leads.find(l => l.id === leadId)
      if (leadObj) {
        setSelectedLead(leadObj)
        setSalePrice(leadObj.sale_price ? String(leadObj.sale_price) : '')
        setShowSaleModal(true)
      }
      return
    }

    const stages = ['nuevo', 'contactado', 'reunión', 'propuesta']
    const currentIndex = stages.indexOf(currentStatus.toLowerCase())
    if (currentIndex === -1 || currentIndex >= 3) return // Block direct progression to Venta

    const newStatus = stages[currentIndex + 1]

    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)

    if (!error) {
      await fetchData()
      
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

      // 3. Activity log
      await supabase.from('activities').insert({
        lead_id: selectedLead.id,
        type: 'sale',
        description: `Venta registrada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Total: $${total.toLocaleString()}`,
        created_by: currentUser?.id
      })

      // 4. Send notification
      if (selectedLead.assigned_to) {
        await createNotification({
          user_id: selectedLead.assigned_to,
          title: 'Nueva Venta Registrada',
          message: `Se ha registrado una venta de ${salePackage} para ${selectedLead.business_name} por $${total.toLocaleString()}`,
          type: 'sale',
          related_id: selectedLead.id
        })
      }

      // Update UI
      await fetchData()
      setShowSaleModal(false)
      setSelectedLead(null)
      resetSaleForm()
    } catch (error: any) {
      alert('Error al registrar la venta: ' + error.message)
    } finally {
      setSavingSale(false)
    }
  }

  const handleRegisterAbono = async () => {
    if (!selectedSaleDetail || registeringAbono) return
    
    const amount = Number(abonoAmount)
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor ingrese un monto válido mayor a 0.")
      return
    }
    if (amount > selectedSaleDetail.pending_amount) {
      alert(`El abono no puede superar el saldo pendiente de $${selectedSaleDetail.pending_amount.toLocaleString()}.`)
      return
    }

    setRegisteringAbono(true)
    try {
      const newDeposit = selectedSaleDetail.deposit_amount + amount
      const newPending = selectedSaleDetail.pending_amount - amount
      const newStatus = newPending <= 0 ? 'pagado' : 'pendiente'

      // 1. Update Sale
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          deposit_amount: newDeposit,
          pending_amount: newPending,
          status: newStatus
        })
        .eq('id', selectedSaleDetail.id)

      if (saleError) throw saleError

      // 2. Insert Activity
      const { error: activityError } = await supabase
        .from('activities').insert({
          lead_id: selectedSaleDetail.lead_id,
          type: 'payment',
          description: `Abono de $${amount.toLocaleString()} registrado. Saldo pendiente: $${newPending.toLocaleString()}`,
          created_by: currentUser?.id
        })

      if (activityError) console.warn("Activity log failed:", activityError.message)

      // 3. Send Notification
      const advisorId = selectedSaleDetail.lead?.assigned_to || selectedSaleDetail.assigned_to
      if (advisorId) {
        await createNotification({
          user_id: advisorId,
          title: 'Abono Registrado',
          message: `Se registró un abono de $${amount.toLocaleString()} para la venta de ${selectedSaleDetail.lead?.business_name || 'Cliente'}`,
          type: 'payment',
          related_id: selectedSaleDetail.lead_id
        })
      }

      // 4. Update local states
      setAbonoAmount('')
      
      // Update selectedSaleDetail in place so modal updates
      setSelectedSaleDetail(prev => prev ? {
        ...prev,
        deposit_amount: newDeposit,
        pending_amount: newPending,
        status: newStatus
      } : null)

      // Refresh list
      await fetchData()
    } catch (error: any) {
      alert("Error al registrar el abono: " + error.message)
    } finally {
      setRegisteringAbono(false)
    }
  }

  const handleLossSubmit = async () => {
    if (!selectedLeadForLoss || savingLoss || !lossReason) return
    const finalReason = lossReason === 'Otro' ? customLossReason.trim() : lossReason
    if (!finalReason) {
      alert("Por favor ingrese el motivo de pérdida.")
      return
    }

    setSavingLoss(true)
    try {
      // 1. Update lead status to 'perdido'
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'perdido' })
        .eq('id', selectedLeadForLoss.id)

      if (leadError) throw leadError

      // 2. Insert activity log with standard format (Motivo: ...)
      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          lead_id: selectedLeadForLoss.id,
          type: 'status_change',
          description: `Estado actualizado a perdido desde el Pipeline. Motivo: ${finalReason}`,
          created_by: currentUser?.id
        })

      if (activityError) console.warn("Activity insertion failed:", activityError.message)

      // 3. Refresh lists
      await fetchData()
      setShowLossModal(false)
      setSelectedLeadForLoss(null)
      setLossReason('')
      setCustomLossReason('')
    } catch (error: any) {
      alert("Error al actualizar estado del lead: " + error.message)
    } finally {
      setSavingLoss(false)
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

  // Filter Sales list client-side
  const filteredSalesList = sales.filter(sale => {
    const bizName = sale.lead?.business_name || ''
    const contact = sale.lead?.contact_name || ''
    const pkg = sale.package || ''
    const matchSearch = bizName.toLowerCase().includes(salesSearchTerm.toLowerCase()) || 
                        contact.toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
                        pkg.toLowerCase().includes(salesSearchTerm.toLowerCase())
    return matchSearch
  })

  // Configurable Monthly Revenue Goal Progress
  // Parse the goals map from logo_url
  const monthlyGoalsMap = useMemo(() => {
    let map: Record<string, number> = {}
    if (orgSettings?.logo_url) {
      try {
        map = JSON.parse(orgSettings.logo_url)
      } catch (e) {
        console.error("Error parsing monthly goals map from logo_url:", e)
      }
    }
    return map
  }, [orgSettings])

  const monthlyGoal = useMemo(() => {
    if (monthlyGoalsMap[selectedMonth] !== undefined) {
      return monthlyGoalsMap[selectedMonth]
    }
    return orgSettings?.monthly_sales_target || 20000
  }, [monthlyGoalsMap, selectedMonth, orgSettings])

  const goalProgress = useMemo(() => {
    if (monthlyGoal <= 0) return 0
    return Math.min(Math.round((advancedMetrics.ingresosMes / monthlyGoal) * 100), 100)
  }, [advancedMetrics.ingresosMes, monthlyGoal])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-10 relative">
      {/* BACKGROUND DECORATIVE GLOWS FOR PREMIUM GLASSMORPHISM */}
      <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-primary/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute top-[35%] left-[-10%] w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] -z-10" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[110px] -z-10" />

      {/* HEADER AREA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-background tracking-tight">Centro de Ventas</h2>
          <p className="text-on-surface-variant text-sm mt-1.5">Control de ingresos, cuentas por cobrar y pipeline comercial</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {/* Month Selector */}
          <MonthSelect 
            months={monthsList} 
            value={selectedMonth} 
            onChange={(v) => setSelectedMonth(v)} 
          />

          {/* Role Toggle for Admins only */}
          {userRole === 'admin' && (
            <div className="flex p-1 bg-surface-container-high/40 backdrop-blur-md rounded-xl border border-outline-variant/20 flex-1 sm:flex-none">
              <button
                onClick={() => setShowOnlyMine(false)}
                className={`flex-1 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !showOnlyMine 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
                }`}
              >
                <LayoutGrid size={14} /> Todas
              </button>
              <button
                onClick={() => setShowOnlyMine(true)}
                className={`flex-1 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
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
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              (filterDateRange.from || filterPaymentStatus !== 'all' || filterAssignedUser !== 'all') 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'bg-white/60 hover:bg-white border border-outline-variant/20 text-on-surface'
            }`}
          >
            <Filter size={16} /> Filtros
          </button>
          <button 
            onClick={() => setShowLeadSelectModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Plus size={18} /> <span className="whitespace-nowrap">Nueva Venta</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border border-outline-variant/20 bg-white/60 backdrop-blur-md p-1.5 rounded-2xl max-w-lg shadow-sm">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ledger'
              ? 'bg-primary text-on-primary shadow-md'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
          }`}
        >
          <CreditCard size={16} />
          Control de Ingresos
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'pipeline'
              ? 'bg-primary text-on-primary shadow-md'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
          }`}
        >
          <Target size={16} />
          Pipeline de Ventas
        </button>
        {userRole === 'admin' && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
            }`}
          >
            <TrendingUp size={16} />
            Analíticas
          </button>
        )}
      </div>

      {/* TAB CONTENTS */}

      {/* TAB 1: CONTROL DE INGRESOS / LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-8 animate-fadeIn">
          {/* FINANCIAL KPIs BENTO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-40">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
              <div>
                <div className="flex items-center gap-2 text-on-surface-variant mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign size={18} />
                  </div>
                  <h3 className="text-xs font-bold tracking-wider uppercase">Ingresos del Mes</h3>
                </div>
                <p className="font-headline text-3xl font-extrabold text-on-background tracking-tight">
                  ${advancedMetrics.ingresosMes.toLocaleString()}
                </p>
                <p className="text-xs text-on-surface-variant mt-1.5">Ventas facturadas este mes</p>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-40">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
              <div>
                <div className="flex items-center gap-2 text-on-surface-variant mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Wallet size={18} />
                  </div>
                  <h3 className="text-xs font-bold tracking-wider uppercase">Cuentas por Cobrar</h3>
                </div>
                <p className="font-headline text-3xl font-extrabold text-amber-600 tracking-tight">
                  ${metrics.totalPendiente.toLocaleString()}
                </p>
                <p className="text-xs text-on-surface-variant mt-1.5">Saldo pendiente total por cobrar</p>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-40">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
              <div>
                <div className="flex items-center gap-2 text-on-surface-variant mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <CheckCircle size={18} />
                  </div>
                  <h3 className="text-xs font-bold tracking-wider uppercase">Total Recibido</h3>
                </div>
                <p className="font-headline text-3xl font-extrabold text-emerald-600 tracking-tight">
                  ${metrics.totalPagado.toLocaleString()}
                </p>
                <p className="text-xs text-on-surface-variant mt-1.5">Monto total liquidado/cobrado</p>
              </div>
            </div>

            {/* MONTHLY GOAL CARD */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-40">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Target size={18} />
                    </div>
                    <h3 className="text-xs font-bold tracking-wider uppercase">Meta del Mes</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => {
                          setNewGoalVal(String(monthlyGoal));
                          setShowGoalEditModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-surface-container-high/40 hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                        title="Editar Meta"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{goalProgress}%</span>
                  </div>
                </div>
                
                <p className="font-headline text-3xl font-extrabold text-on-background tracking-tight">
                  ${monthlyGoal.toLocaleString()} <span className="text-xs font-semibold text-on-surface-variant">USD</span>
                </p>
                
                <div className="mt-3">
                  <div className="w-full bg-surface-container-low/50 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${goalProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN TRANSACTION LEDGER & SIDEBARS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* HISTORIAL DE TRANSACCIONES */}
            <div className="lg:col-span-8 glass-panel rounded-3xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-background">Historial de Ventas</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Listado y estatus de cuentas registradas</p>
                </div>
                
                {/* LOCAL SEARCH INPUT */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar negocio, contacto o paquete..."
                    value={salesSearchTerm}
                    onChange={(e) => setSalesSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/60 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent rounded-xl text-xs sm:text-sm transition-all"
                  />
                </div>
              </div>

              {/* TABLE HEADERS */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 pb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/10">
                <div className="col-span-4">Cliente / Asesor</div>
                <div className="col-span-3">Paquete</div>
                <div className="col-span-3">Monto & Cobro</div>
                <div className="col-span-2 text-right">Estatus</div>
              </div>

              {/* TRANSACTIONS LIST */}
              <div className="space-y-3">
                {filteredSalesList.map(sale => {
                  const percentPaid = Math.round((sale.deposit_amount / sale.total_amount) * 100)
                  return (
                    <div 
                      key={sale.id} 
                      onClick={() => { setSelectedSaleDetail(sale); setShowSaleDetailModal(true); }}
                      className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 px-5 py-4 bg-white/30 backdrop-blur-md hover:bg-white/70 border border-outline-variant/10 hover:border-primary/20 rounded-2xl transition-all items-start sm:items-center group cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <div className="col-span-4 w-full">
                        <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{sale.lead?.business_name || 'Negocio sin nombre'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <User size={12} className="text-on-surface-variant" />
                          <p className="text-xs text-on-surface-variant font-medium">{sale.lead?.contact_name || 'Sin contacto'}</p>
                        </div>
                      </div>
                      
                      <div className="col-span-3">
                        <span className="text-xs font-bold px-2.5 py-1 bg-surface-container-high/60 backdrop-blur-sm rounded-lg text-on-surface-variant uppercase">
                          {sale.package}
                        </span>
                      </div>
                      
                      <div className="col-span-3 w-full space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-on-surface font-bold">${sale.total_amount.toLocaleString()}</span>
                          <span className="text-on-surface-variant">Abonado: {percentPaid}%</span>
                        </div>
                        <div className="w-full bg-surface-container-low/50 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${percentPaid}%` }} />
                        </div>
                      </div>
                      
                      <div className="col-span-2 w-full flex items-center justify-between sm:justify-end gap-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          sale.status === 'pagado'
                            ? 'bg-green-500/10 text-green-700 border-green-500/20'
                            : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                        }`}>
                          {sale.status === 'pagado' ? 'Liquidado' : 'Pendiente'}
                        </span>
                        <ChevronRight size={16} className="text-on-surface-variant hidden sm:block opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  )
                })}
                {filteredSalesList.length === 0 && (
                  <div className="py-12 text-center text-on-surface-variant text-sm italic">
                    No se encontraron transacciones registradas.
                  </div>
                )}
              </div>
            </div>

            {/* SIDEBAR: CUENTAS POR COBRAR Y LEADERBOARD */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* CUENTAS POR COBRAR WIDGET */}
              <div className="glass-panel rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline text-lg font-bold text-on-background">Cobros Pendientes</h3>
                  <Wallet size={18} className="text-amber-500" />
                </div>
                <div className="space-y-3">
                  {advancedMetrics.pendingPayments.map(sale => (
                    <div 
                      key={sale.id} 
                      onClick={() => { setSelectedSaleDetail(sale); setShowSaleDetailModal(true); }}
                      className="p-4 bg-white/30 backdrop-blur-md border border-outline-variant/10 hover:border-amber-500/30 rounded-2xl cursor-pointer hover:bg-white/70 transition-all shadow-sm flex flex-col justify-between gap-3 group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-on-surface truncate max-w-[180px] group-hover:text-primary transition-colors">{sale.lead?.business_name}</p>
                          <p className="text-xs text-on-surface-variant font-medium mt-0.5">{sale.package}</p>
                        </div>
                        <span className="text-xs font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">Pendiente</span>
                      </div>
                      <div className="flex justify-between items-end border-t border-outline-variant/5 pt-2">
                        <div className="text-xs text-on-surface-variant">
                          <span>Total: ${sale.total_amount.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-on-surface-variant font-semibold">Resta:</p>
                          <p className="text-sm font-extrabold text-amber-700">${sale.pending_amount.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {advancedMetrics.pendingPayments.length === 0 && (
                    <div className="py-8 text-center text-on-surface-variant text-xs italic">
                      No hay cobros pendientes. ¡Todo al corriente!
                    </div>
                  )}
                </div>
              </div>

              {/* LEADERBOARD WIDGET */}
              {userRole === 'admin' && (
                <div className="glass-panel rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline text-lg font-bold text-on-background">Ventas por Asesor</h3>
                    <Users size={18} className="text-primary" />
                  </div>
                  <div className="space-y-4">
                    {Object.entries(advancedMetrics.revenueByUser)
                      .filter(([userId]) => userId === 'Sin asignar' || profiles.some(p => p.id === userId))
                      .sort((a,b) => b[1] - a[1])
                      .map(([userId, amount]) => {
                        const profile = profiles.find(p => p.id === userId)
                        const totalVendidoAll = metrics.totalVendido || 1
                        const percentage = (amount / totalVendidoAll) * 100
                        return (
                          <div key={userId} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                              <span className="text-on-surface truncate pr-2">{profile?.name || 'Asesor sin nombre'}</span>
                              <span className="text-primary">${amount.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-surface-container-low/50 rounded-full overflow-hidden flex">
                              <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    {Object.keys(advancedMetrics.revenueByUser).length === 0 && (
                      <div className="py-8 text-center text-on-surface-variant text-xs italic">
                        No hay registros de ventas.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PIPELINE DE VENTAS / KANBAN */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6 pb-20 animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <Target className="text-primary" size={18} />
            <h3 className="font-headline text-lg font-bold text-on-background">Embudos y Negociaciones Activas</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4 custom-scrollbar">
            {['nuevo', 'contactado', 'reunión', 'propuesta'].map((status) => {
              const stageLeads = advancedMetrics.leadsByStatus[status] || []
              const stageLabels: Record<string, string> = {
                nuevo: "Nuevos Prospectos",
                contactado: "Contactados",
                reunión: "Reunión Agendada",
                propuesta: "Propuesta Enviada"
              }
              const stageColors: Record<string, string> = {
                nuevo: "bg-surface-container-low/20 backdrop-blur-md border-outline-variant/20 shadow-sm",
                contactado: "bg-blue-500/5 backdrop-blur-md border-blue-500/20 shadow-sm",
                reunión: "bg-amber-500/5 backdrop-blur-md border-amber-500/20 shadow-sm",
                propuesta: "bg-primary/5 backdrop-blur-md border-primary/20 shadow-sm"
              }

              return (
                <div key={status} className={`flex flex-col min-h-[450px] rounded-2xl border p-4 ${stageColors[status] || 'bg-surface-container-low/20 backdrop-blur-md'}`}>
                  <div className="flex items-center justify-between mb-4 px-1 border-b border-outline-variant/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <h4 className="font-headline text-sm font-bold text-on-background">{stageLabels[status]}</h4>
                    </div>
                    <span className="text-xs font-bold bg-surface-container-high/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-on-surface-variant">{stageLeads.length}</span>
                  </div>

                  <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                    {stageLeads.map((lead) => {
                      const createdDate = new Date(lead.created_at)
                      const daysInStage = Math.ceil(Math.abs(new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
                      
                      return (
                        <div key={lead.id} className="bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-outline-variant/10 hover:border-primary/30 hover:bg-white/60 transition-all shadow-sm hover:shadow group flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate pr-1">{lead.business_name}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${daysInStage > 7 ? 'bg-red-500/10 text-red-600' : 'bg-surface-container-high/40 backdrop-blur-sm text-on-surface-variant'}`}>
                              {daysInStage}d
                            </span>
                          </div>
                          
                          <p className="text-xs text-on-surface-variant font-medium truncate">{lead.contact_name}</p>
                          
                          <div className="flex items-center justify-between gap-1 pt-3 border-t border-outline-variant/5 mt-1">
                            <button 
                              onClick={() => handleQuickStatusUpdate(lead.id, lead.status, 'lost')}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/5 hover:bg-red-500/15 text-on-surface-variant hover:text-red-600 transition-colors"
                              title="Marcar como perdido"
                            >
                              <X size={16} />
                            </button>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-primary">${(lead.sale_price || 0).toLocaleString()}</span>
                              <button 
                                onClick={() => handleQuickStatusUpdate(lead.id, lead.status, 'next')}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all shadow-sm"
                                title={status === 'propuesta' ? 'Convertir a Venta' : 'Siguiente etapa'}
                              >
                                {status === 'propuesta' ? <DollarSign size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {stageLeads.length === 0 && (
                      <div className="py-12 text-center text-on-surface-variant text-xs italic opacity-60">
                        Sin leads en esta etapa
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ANALÍTICAS / ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
          {/* ANÁLISIS DE MOTIVOS DE PÉRDIDA */}
          <div className="glass-panel rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold text-on-background">Análisis de Oportunidades Perdidas</h3>
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
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-on-surface-variant truncate pr-2">{reason}</span>
                        <span className="text-on-surface">{count}</span>
                      </div>
                      <div className="h-2 bg-surface-container-low/50 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-red-500/60 to-red-500 h-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              {Object.keys(advancedMetrics.lossDistribution).length === 0 && (
                <div className="py-12 text-center text-on-surface-variant text-xs italic">
                  No hay suficientes datos de pérdidas para mostrar.
                </div>
              )}
            </div>
          </div>

          {/* DISTRIBUTION OF PREDEFINED PACKAGES */}
          <div className="glass-panel rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold text-on-background">Distribución de Paquetes Vendidos</h3>
              <TrendingUp size={18} className="text-primary" />
            </div>
            <div className="space-y-4">
              {(() => {
                const packageCounts: Record<string, number> = {}
                sales.forEach(s => {
                  const name = s.package || 'Otro'
                  packageCounts[name] = (packageCounts[name] || 0) + 1
                })
                const totalSales = sales.length || 1
                
                return Object.entries(packageCounts)
                  .sort((a,b) => b[1] - a[1])
                  .map(([pkg, count]) => {
                    const percentage = (count / totalSales) * 100
                    return (
                      <div key={pkg} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                          <span className="text-on-surface-variant">{pkg}</span>
                          <span className="text-on-surface">{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="h-2 bg-surface-container-low/50 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )
                  })
              })()}
              {sales.length === 0 && (
                <div className="py-12 text-center text-on-surface-variant text-xs italic">
                  No hay suficientes ventas registradas para analizar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS SECTION */}
      {/* ======================================================== */}

      {/* 1. LEAD SELECTION MODAL */}
      {showLeadSelectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Seleccionar Cliente</h3>
                <p className="text-xs text-on-surface-variant mt-1">Busca el lead al que deseas registrarle una venta</p>
              </div>
              <button 
                onClick={() => { setShowLeadSelectModal(false); setLeadSearchTerm(''); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Buscar por nombre de negocio o contacto..." 
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm"
                  value={leadSearchTerm}
                  onChange={(e) => setLeadSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
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
                        // Pre-fill the price if set on the lead
                        setSalePrice(lead.sale_price ? String(lead.sale_price) : '')
                        setShowSaleModal(true);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group bg-white/20 backdrop-blur-sm hover:bg-white/50"
                    >
                      <div className="text-left">
                        <p className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">{lead.business_name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{lead.contact_name}</p>
                      </div>
                      <ArrowRight size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                    </button>
                  ))
                }
                {leads.length === 0 && (
                  <div className="py-8 text-center text-on-surface-variant text-sm">
                    No se encontraron leads disponibles.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SALE FORM MODAL */}
      {showSaleModal && selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Registrar Venta</h3>
                <p className="text-xs text-on-surface-variant mt-1">Para: <span className="font-bold text-primary">{selectedLead.business_name}</span></p>
              </div>
              <button 
                onClick={() => { setShowSaleModal(false); setSelectedLead(null); resetSaleForm(); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Paquete / Servicio</label>
                  <select 
                    value={salePackage}
                    onChange={(e) => setSalePackage(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm appearance-none"
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Nombre Personalizado</label>
                      <input 
                        type="text"
                        value={saleCustomName}
                        onChange={(e) => setSaleCustomName(e.target.value)}
                        placeholder="Ej. Proyecto Especial de Rediseño"
                        className="w-full px-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Descripción</label>
                      <textarea 
                        value={saleCustomDescription}
                        onChange={(e) => setSaleCustomDescription(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm resize-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Precio Total</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                    <input 
                      type="number"
                      value={salePrice}
                      onChange={(e) => {
                        setSalePrice(e.target.value);
                        if (isFullPayment) setSaleDeposit(e.target.value);
                      }}
                      className="w-full pl-8 pr-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm font-bold text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Anticipo / Pagado</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                    <input 
                      type="number"
                      disabled={isFullPayment}
                      value={saleDeposit}
                      onChange={(e) => setSaleDeposit(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm font-bold ${isFullPayment ? 'text-on-surface-variant opacity-60' : 'text-green-600'}`}
                    />
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-3 px-2">
                  <button 
                    onClick={() => {
                      const nextFullPayment = !isFullPayment
                      setIsFullPayment(nextFullPayment);
                      if (nextFullPayment) setSaleDeposit(salePrice);
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
                  className="flex-1 px-6 py-3 rounded-2xl bg-surface-container-highest/40 backdrop-blur-sm text-on-surface font-bold text-xs sm:text-sm hover:bg-outline-variant/20 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  disabled={savingSale || !salePackage || !salePrice}
                  onClick={handleSaleSubmit}
                  className="flex-[2] px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-xs sm:text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {savingSale ? <Loader2 size={18} className="animate-spin" /> : <DollarSign size={18} />}
                  Confirmar Venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTERS MODAL */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Filtros de Ventas</h3>
                <p className="text-xs text-on-surface-variant mt-1">Refina el reporte de ingresos</p>
              </div>
              <button 
                onClick={() => setShowFiltersModal(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 ml-1">Rango de Fecha</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input 
                      type="date"
                      value={filterDateRange.from}
                      onChange={(e) => setFilterDateRange({...filterDateRange, from: e.target.value})}
                      className="w-full pl-9 pr-2 py-2.5 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input 
                      type="date"
                      value={filterDateRange.to}
                      onChange={(e) => setFilterDateRange({...filterDateRange, to: e.target.value})}
                      className="w-full pl-9 pr-2 py-2.5 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 ml-1">Estado de Pago</label>
                <div className="flex gap-2">
                  {['all', 'pagado', 'pendiente'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterPaymentStatus(status)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                        filterPaymentStatus === status 
                          ? 'bg-primary text-on-primary border-primary' 
                          : 'bg-surface-container-low/40 backdrop-blur-sm text-on-surface-variant border-outline-variant/30 hover:bg-outline-variant/10'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : status}
                    </button>
                  ))}
                </div>
              </div>

              {userRole === 'admin' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 ml-1">Usuario Asignado</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <select 
                      value={filterAssignedUser}
                      onChange={(e) => setFilterAssignedUser(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none"
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
                className="w-full py-2 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
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

      {/* 4. SALE DETAIL & ABONO MODAL */}
      {showSaleDetailModal && selectedSaleDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Detalle de Venta</h3>
                <p className="text-xs text-on-surface-variant mt-1">Estatus actual del cobro de la cuenta</p>
              </div>
              <button 
                onClick={() => { setShowSaleDetailModal(false); setSelectedSaleDetail(null); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto">
              {/* HEADER INFO */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-outline-variant/10">
                <div>
                  <h4 className="font-headline text-lg font-black text-on-background">{selectedSaleDetail.lead?.business_name || 'Cliente sin nombre'}</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Contacto: <span className="font-bold">{selectedSaleDetail.lead?.contact_name || 'Sin contacto'}</span></p>
                  <p className="text-xs text-on-surface-variant">Registrado: <span className="font-semibold">{new Date(selectedSaleDetail.created_at).toLocaleDateString()}</span></p>
                </div>
                
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  selectedSaleDetail.status === 'pagado'
                    ? 'bg-green-500/10 text-green-700 border-green-500/20'
                    : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                }`}>
                  {selectedSaleDetail.status === 'pagado' ? 'Liquidado' : 'Pago Pendiente'}
                </span>
              </div>

              {/* PAYMENT LEDGER SUMMARY */}
              <div className="grid grid-cols-3 gap-4 bg-surface-container/40 backdrop-blur-sm p-4 rounded-2xl border border-outline-variant/10">
                <div className="text-center border-r border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Monto Total</p>
                  <p className="text-lg font-extrabold text-on-background mt-1">${selectedSaleDetail.total_amount.toLocaleString()}</p>
                </div>
                <div className="text-center border-r border-outline-variant/10">
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider text-green-700">Abonado</p>
                  <p className="text-lg font-extrabold text-green-600 mt-1">${selectedSaleDetail.deposit_amount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider text-amber-700">Pendiente</p>
                  <p className="text-lg font-extrabold text-amber-600 mt-1">${selectedSaleDetail.pending_amount.toLocaleString()}</p>
                </div>
              </div>

              {/* PROGRESS BAR */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-on-surface-variant">Progreso del Cobro</span>
                  <span className="text-primary">{Math.round((selectedSaleDetail.deposit_amount / selectedSaleDetail.total_amount) * 100)}% Completado</span>
                </div>
                <div className="w-full bg-surface-container-low/50 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(selectedSaleDetail.deposit_amount / selectedSaleDetail.total_amount) * 100}%` }}
                  />
                </div>
              </div>

              {/* ABONO REGISTRATION FORM */}
              {selectedSaleDetail.status === 'pendiente' && (
                <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Wallet size={14} /> Registrar Abono / Pago Parcial
                  </h5>
                  <p className="text-xs text-on-surface-variant">Añade pagos al saldo para registrar deudas y comisiones al corriente.</p>
                  
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">$</span>
                      <input 
                        type="number" 
                        max={selectedSaleDetail.pending_amount}
                        min="1"
                        placeholder="Monto a abonar..." 
                        value={abonoAmount}
                        onChange={(e) => setAbonoAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 bg-white border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-primary text-xs sm:text-sm font-bold text-primary"
                      />
                    </div>
                    <button 
                      onClick={handleRegisterAbono}
                      disabled={registeringAbono || !abonoAmount}
                      className="px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      {registeringAbono ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Registrar
                    </button>
                  </div>
                </div>
              )}

              {/* HISTORIAL DE ABONOS / ACTIVITIES */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <History size={14} /> Historial de Transacciones & Actividades
                </h5>
                <div className="bg-white/40 backdrop-blur-sm border border-outline-variant/10 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-3 custom-scrollbar">
                  {loadingSaleActivities ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : saleActivities.length > 0 ? (
                    saleActivities.map((act) => (
                      <div key={act.id} className="flex justify-between items-start gap-4 text-xs pb-2 border-b border-outline-variant/5 last:border-0 last:pb-0">
                        <div>
                          <p className="font-semibold text-on-surface">{act.description}</p>
                          <span className="text-[10px] text-on-surface-variant bg-surface-container-high/40 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold">{act.type}</span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{new Date(act.created_at).toLocaleDateString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-xs text-on-surface-variant italic">No hay historial disponible para esta cuenta.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LOSS REASON MODAL */}
      {showLossModal && selectedLeadForLoss && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Motivo de Pérdida</h3>
                <p className="text-xs text-on-surface-variant mt-1">Lead: <span className="font-bold text-red-600">{selectedLeadForLoss.business_name}</span></p>
              </div>
              <button 
                onClick={() => { setShowLossModal(false); setSelectedLeadForLoss(null); setLossReason(''); setCustomLossReason(''); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Selecciona el Motivo</label>
                <select 
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm appearance-none"
                >
                  <option value="">Seleccionar motivo...</option>
                  <option value="Precio muy alto">Precio muy alto</option>
                  <option value="No responde">No responde / Perdimos contacto</option>
                  <option value="Compró a la competencia">Compró a la competencia</option>
                  <option value="No le interesa el servicio">No le interesa el servicio</option>
                  <option value="Presupuesto insuficiente">Presupuesto insuficiente</option>
                  <option value="Otro">Otro (Especificar)</option>
                </select>
              </div>

              {lossReason === 'Otro' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Escribe el Motivo Especial</label>
                  <input 
                    type="text" 
                    value={customLossReason}
                    onChange={(e) => setCustomLossReason(e.target.value)}
                    placeholder="Ej. Cambió de giro de negocio"
                    className="w-full px-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm font-medium"
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => { setShowLossModal(false); setSelectedLeadForLoss(null); setLossReason(''); setCustomLossReason(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-highest/40 backdrop-blur-sm text-on-surface font-bold text-xs sm:text-sm hover:bg-outline-variant/20 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleLossSubmit}
                  disabled={savingLoss || !lossReason}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs sm:text-sm shadow-md hover:bg-red-700 transition-all flex items-center justify-center gap-1.5"
                >
                  {savingLoss ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                  Registrar Pérdida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. EDIT MONTHLY GOAL MODAL */}
      {showGoalEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-md">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-background">Editar Meta del Mes</h3>
                <p className="text-xs text-on-surface-variant mt-1">Establece la meta de facturación para el mes seleccionado</p>
              </div>
              <button 
                onClick={() => { setShowGoalEditModal(false); setNewGoalVal(''); }}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest/40 backdrop-blur-sm transition-colors text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Nueva Meta (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                  <input 
                    type="number"
                    value={newGoalVal}
                    onChange={(e) => setNewGoalVal(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm font-bold text-primary"
                    placeholder="Monto de la meta..."
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => { setShowGoalEditModal(false); setNewGoalVal(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-highest/40 backdrop-blur-sm text-on-surface font-bold text-xs sm:text-sm hover:bg-outline-variant/20 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    const val = Number(newGoalVal)
                    if (isNaN(val) || val <= 0) {
                      alert("Por favor ingrese un monto válido.")
                      return
                    }
                    if (!orgSettings) {
                      alert("No se cargaron los ajustes de organización.")
                      return
                    }
                    setSavingGoalState(true)
                    try {
                      let currentGoalsMap: Record<string, number> = {}
                      if (orgSettings.logo_url) {
                        try {
                          currentGoalsMap = JSON.parse(orgSettings.logo_url)
                        } catch (e) {
                          // ignore or overwrite if invalid
                        }
                      }
                      const updatedMap = { ...currentGoalsMap, [selectedMonth]: val }
                      const { data: { session } } = await supabase.auth.getSession()
                      if (!session) throw new Error("No hay sesión activa")

                      const response = await fetch('/api/organization-settings', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ logo_url: JSON.stringify(updatedMap) })
                      })

                      if (!response.ok) {
                        const errData = await response.json()
                        throw new Error(errData.error || "Error al actualizar la meta en el servidor")
                      }
                      
                      // Update local states
                      setOrgSettings((prev: any) => ({ ...prev, logo_url: JSON.stringify(updatedMap) }))
                      setShowGoalEditModal(false)
                      setNewGoalVal('')
                      // Trigger data fetch to update metrics calculation
                      await fetchData(currentUser, userRole, permissions, showOnlyMine, selectedMonth)
                    } catch (e: any) {
                      alert("Error al guardar la meta: " + e.message)
                    } finally {
                      setSavingGoalState(false)
                    }
                  }}
                  disabled={savingGoalState || !newGoalVal}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm shadow-md hover:bg-primary/95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingGoalState && <Loader2 size={16} className="animate-spin" />}
                  Guardar Meta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
