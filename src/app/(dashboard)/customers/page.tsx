"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { 
  Users, 
  Search, 
  Filter, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  MoreVertical, 
  Loader2, 
  DollarSign, 
  Wallet,
  ShieldAlert,
  ArrowUpRight,
  Download,
  X
} from "lucide-react"

type Customer = {
  id: string
  business_name: string
  contact_name: string
  phone: string | null
  email: string | null
  assigned_to: string
  assigned_name: string
  total_spent: number
  pending_total: number
  last_purchase: string | null
  client_since: string | null
  has_activity: boolean
  health: 'VIP' | 'Riesgo' | 'Dormido' | 'Bueno'
  upsell_suggestion: string | null
}

type Metrics = {
  totalClients: number
  totalRevenue: number
  totalPending: number
}

export default function CustomersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [metrics, setMetrics] = useState<Metrics>({ totalClients: 0, totalRevenue: 0, totalPending: 0 })
  const [rawSales, setRawSales] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'Todos' | 'Con deuda' | 'Sin actividad'>('Todos')
  
  // Expert Features State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allProfiles, setAllProfiles] = useState<{id: string, name: string}[]>([])
  const [isReassigning, setIsReassigning] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  
  // Auth & Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { role, permissions } = await getUserRole()
      setUserRole(role)
      setPermissions(permissions)
      
      const isSystemAdmin = role === 'admin'
      const canViewAll = true // Everyone can view all customers now
      let query = supabase.from('leads').select('*').eq('status', 'venta')
      
      if (!canViewAll) {
        query = query.eq('assigned_to', user.id)
      }
      
      const { data: leads, error: leadsError } = await query
      if (leadsError || !leads) {
        console.error("Error fetching leads:", leadsError)
        setLoading(false)
        return
      }

      // 2. Fetch all sales for these leads
      const leadIds = leads.map(l => l.id)
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .in('lead_id', leadIds)
      
      // 3. Fetch profiles for assignment names
      const assignedIds = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))]
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', assignedIds)
      const profileMap: Record<string, string> = {}
      profiles?.forEach(p => profileMap[p.id] = p.name)

      // 4. Fetch recent activity (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: recentActivities } = await supabase
        .from('activities')
        .select('lead_id')
        .in('lead_id', leadIds)
        .gte('created_at', sevenDaysAgo.toISOString())
      
      const activeLeadIds = new Set(recentActivities?.map(a => a.lead_id) || [])

      // 4.1 Fetch all profiles if admin or reassign permission
      if (isSystemAdmin || permissions.includes('reassign_leads')) {
        const { data: profilesData } = await supabase.from('profiles').select('id, name').order('name')
        if (profilesData) setAllProfiles(profilesData)
      }
      setUserRole(role)

      // 5. Aggregate Data
      const customersData: Customer[] = leads.map(lead => {
        const leadSales = sales?.filter(s => s.lead_id === lead.id) || []
        const totalSpent = leadSales.reduce((acc, s) => acc + (s.total_amount || 0), 0)
        const pendingTotal = leadSales.reduce((acc, s) => acc + (s.pending_amount || 0), 0)
        const lastSaleDate = leadSales.length > 0 
          ? leadSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at 
          : null

        return {
          id: lead.id,
          business_name: lead.business_name,
          contact_name: lead.contact_name,
          phone: lead.phone,
          email: lead.email,
          assigned_to: lead.assigned_to,
          assigned_name: profileMap[lead.assigned_to] || 'Sin asignar',
          total_spent: totalSpent,
          pending_total: pendingTotal,
          last_purchase: lastSaleDate,
          client_since: lead.closed_at,
          has_activity: activeLeadIds.has(lead.id),
          health: 
            totalSpent > 2500 && pendingTotal === 0 ? 'VIP' :
            pendingTotal > 0 && !activeLeadIds.has(lead.id) ? 'Riesgo' :
            lastSaleDate && new Date(lastSaleDate).getTime() < new Date().getTime() - (60 * 24 * 60 * 60 * 1000) ? 'Dormido' :
            'Bueno',
          upsell_suggestion: 
            leadSales.some(s => s.package.includes('Landing')) ? 'SEO & Mantenimiento' :
            leadSales.some(s => s.package.includes('Empresarial')) ? 'Ecommerce & Reservas' :
            leadSales.some(s => s.package.includes('Ecommerce')) ? 'Marketing Digital' :
            'Servicios Premium'
        }
      })

      // Calculate Top Metrics
      const totalRevenue = customersData.reduce((acc, c) => acc + c.total_spent, 0)
      const totalPending = customersData.reduce((acc, c) => acc + c.pending_total, 0)

      setCustomers(customersData)
      setRawSales(sales || [])
      setMetrics({
        totalClients: customersData.length,
        totalRevenue,
        totalPending
      })
      setLoading(false)
    }

    fetchData()
  }, [router])

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.business_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filter === 'Con deuda') return matchesSearch && c.pending_total > 0
    if (filter === 'Sin actividad') return matchesSearch && !c.has_activity
    return matchesSearch
  })

  // Selection Helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id))
    }
  }

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Don't trigger row click
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Export Logic
  const handleExportCSV = () => {
    const targets = selectedIds.length > 0 
      ? customers.filter(c => selectedIds.includes(c.id))
      : customers

    const headers = ["ID Cliente", "Negocio", "Contacto", "Email", "Venta/Paquete", "Monto Total", "Pagado", "Pendiente", "Estado Pago", "Fecha Venta", "Asignado"]
    let csvContent = headers.join(",") + "\n"

    targets.forEach(c => {
      const cSales = rawSales.filter(s => s.lead_id === c.id)
      if (cSales.length === 0) {
        // Just the client info if no sales record (shouldn't happen in Customers list but for safety)
        csvContent += `${c.id},"${c.business_name}","${c.contact_name}","${c.email || ''}",N/A,0,0,0,N/A,N/A,"${c.assigned_name}"\n`
      } else {
        cSales.forEach(s => {
          csvContent += `${c.id},"${c.business_name}","${c.contact_name}","${c.email || ''}","${s.package}",${s.total_amount},${s.deposit_amount},${s.pending_amount},${s.status},${new Date(s.created_at).toLocaleDateString()},"${c.assigned_name}"\n`
        })
      }
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `reporte_ventas_stella_${new Date().toISOString().slice(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Bulk Reassign Logic
  const handleBulkReassign = async (newUserId: string) => {
    if (!selectedIds.length || isReassigning) return
    const newProfile = allProfiles.find(p => p.id === newUserId)
    if (!newProfile) return

    if (!confirm(`¿Estás seguro de reasignar ${selectedIds.length} clientes a ${newProfile.name}?`)) return

    setIsReassigning(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: newUserId })
        .in('id', selectedIds)

      if (error) throw error

      // Audit Log
      await supabase.from('activities').insert({
        description: `ADMIN: Reasignación masiva de ${selectedIds.length} clientes a ${newProfile.name}`,
        type: 'admin_audit'
      })

      alert('Clientes reasignados exitosamente')
      setSelectedIds([])
      // Refresh
      window.location.reload()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsReassigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold text-on-surface-variant animate-pulse lowercase tracking-[0.2em]">Cargando cartera de clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-end justify-between mb-2">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-background tracking-tight">Cartera de Clientes</h1>
          <p className="text-on-surface-variant font-medium text-sm mt-1">Gestión financiera y fidelización de clientes activos.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => router.push('/sales')}
             className="bg-surface-container-lowest text-on-surface font-semibold text-sm px-5 py-2.5 rounded-xl border border-outline-variant/10 hover:bg-surface-container-low transition-all flex items-center gap-2"
           >
             <CreditCard size={16} /> Ver Ventas
           </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest rounded-3xl p-6 ambient-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-primary/20 transition-all">
          <div className="absolute right-[-10%] top-[-20%] w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60 mb-0.5">Total Clientes</p>
              <h3 className="font-headline text-3xl font-extrabold text-on-background">{metrics.totalClients}</h3>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 ambient-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-green-500/20 transition-all">
          <div className="absolute right-[-10%] top-[-20%] w-32 h-32 bg-green-500/5 rounded-full blur-3xl group-hover:bg-green-500/10 transition-all" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60 mb-0.5">Ingresos Totales (LTV)</p>
              <h3 className="font-headline text-3xl font-extrabold text-on-background">${metrics.totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 ambient-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-amber-500/20 transition-all">
          <div className="absolute right-[-10%] top-[-20%] w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60 mb-0.5">Pendiente por Cobrar</p>
              <h3 className="font-headline text-3xl font-extrabold text-on-background">${metrics.totalPending.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS & LIST */}
      <div className="bg-surface-container-low rounded-[32px] p-2 border border-outline-variant/10 shadow-sm relative overflow-visible">
        <div className="px-6 py-6 flex flex-col sm:flex-row gap-6 justify-between items-center border-b border-outline-variant/10 bg-surface-container-low/50 rounded-t-[30px]">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Filter size={18} />
            </div>
            {['Todos', 'Con deuda', 'Sin actividad'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  filter === f 
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' 
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {(userRole === 'admin' || permissions.includes('export_leads_csv')) && (
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-3 bg-surface-container-highest text-on-surface rounded-2xl text-xs font-bold hover:bg-primary/10 hover:text-primary transition-all border border-outline-variant/10 ambient-shadow"
              >
                <Download size={16} />
                Exportar Todo
              </button>
            )}
            
            <div className="relative w-full sm:w-80 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" size={18} />
             <input 
               type="text" 
               placeholder="Buscar cliente por negocio o contacto..." 
               className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-medium ambient-shadow transition-all"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant/5">
                <th className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                    <span>Negocio / Salud</span>
                  </div>
                </th>
                <th className="px-6 py-5">Inversión Total</th>
                <th className="px-6 py-5">Pendiente</th>
                <th className="px-6 py-5">Cliente desde</th>
                <th className="px-6 py-5">Última Compra</th>
                <th className="px-6 py-5">Sugerencia Upsell</th>
                <th className="px-6 py-5">Asignado</th>
                <th className="px-8 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredCustomers.map((customer) => (
                <tr 
                  key={customer.id} 
                  onClick={() => router.push(`/leads/${customer.id}`)}
                  className={`group transition-all cursor-pointer relative ${selectedIds.includes(customer.id) ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-container-highest/30'}`}
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onClick={(e) => toggleSelectOne(customer.id, e)}
                        onChange={() => {}} // Controlled by onClick to avoid conflicts
                        className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-surface-container-highest to-surface-container-low flex items-center justify-center font-bold text-primary shadow-inner shrink-0 text-xs">
                        {customer.business_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-headline text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                            {customer.business_name}
                          </p>
                          {/* Health Badges */}
                          {customer.health === 'VIP' && (
                            <span className="text-[8px] font-black bg-primary text-on-primary px-1.5 py-0.5 rounded uppercase tracking-widest shadow-sm shadow-primary/20">VIP</span>
                          )}
                          {customer.health === 'Riesgo' && (
                            <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-widest animate-pulse">Riesgo</span>
                          )}
                          {customer.health === 'Dormido' && (
                            <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-widest">Dormido</span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 tracking-tight flex items-center gap-1.5">
                          {customer.contact_name}
                          {!customer.has_activity && customer.pending_total > 0 && <span className="w-1 h-1 rounded-full bg-red-400" />}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 font-headline font-bold text-sm text-on-surface">
                    ${customer.total_spent.toLocaleString()}
                  </td>
                  <td className="px-6 py-6">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      customer.pending_total > 0 
                        ? 'bg-amber-500/10 text-amber-700' 
                        : 'bg-green-500/10 text-green-700'
                    }`}>
                      {customer.pending_total > 0 ? `$${customer.pending_total.toLocaleString()}` : 'Al día'}
                    </span>
                  </td>
                  <td className="px-6 py-6 font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                    {customer.client_since ? new Date(customer.client_since).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-6 text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                    {customer.last_purchase ? new Date(customer.last_purchase).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-6">
                    {customer.upsell_suggestion && (
                      <div className="flex items-center gap-1.5 group/tip relative">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest leading-none mb-1">Oportunidad</span>
                          <span className="text-[10px] font-bold text-on-surface bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">{customer.upsell_suggestion}</span>
                        </div>
                        <TrendingUp size={12} className="text-primary animate-bounce-slow" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                       <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary uppercase">
                         {customer.assigned_name.charAt(0)}
                       </div>
                       <span className="text-[10px] font-bold text-on-surface-variant uppercase">{customer.assigned_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="p-2 rounded-xl text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <div className="py-24 text-center">
              <div className="bg-surface-container w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 text-on-surface-variant/20">
                <Users size={32} />
              </div>
              <p className="text-on-surface-variant font-bold text-sm">No se encontraron clientes.</p>
              <p className="text-[10px] text-on-surface-variant/60 mt-1 uppercase tracking-widest">Intenta ajustar los filtros de búsqueda</p>
            </div>
          )}
        </div>
      </div>

      {/* FIXED BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-surface-container-highest rounded-[28px] p-4 ambient-shadow border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 px-2">
              <div className="bg-primary text-on-primary w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-primary/20">
                {selectedIds.length}
              </div>
              <div>
                <p className="text-xs font-black text-on-surface uppercase tracking-widest">Clientes seleccionados</p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Gestión Administrativa Masiva</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-6 py-3 bg-surface-container-low text-on-surface rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all border border-outline-variant/10"
              >
                <Download size={14} />
                Exportar Detalle
              </button>

              {userRole === 'admin' && allProfiles.length > 0 && (
                <div className="relative group">
                  <select 
                    className="appearance-none bg-primary text-on-primary pl-4 pr-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:outline-none hover:bg-primary-dark transition-all cursor-pointer shadow-lg shadow-primary/20 border-none"
                    disabled={isReassigning}
                    onChange={(e) => handleBulkReassign(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Reasignar a...</option>
                    {allProfiles.map(p => (
                      <option key={p.id} value={p.id} className="text-on-surface bg-white uppercase font-bold">{p.name}</option>
                    ))}
                  </select>
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" size={14} />
                </div>
              )}

              <button 
                onClick={() => setSelectedIds([])}
                className="p-3 text-on-surface hover:bg-surface-container-low rounded-2xl transition-all"
                title="Limpiar selección"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
