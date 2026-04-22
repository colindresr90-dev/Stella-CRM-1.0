"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { createNotification } from "@/lib/notifications"
import type { User } from "@supabase/supabase-js"
import { Plus, Loader2, AlertCircle, CheckCircle2, LayoutDashboard, Search, MoreVertical, Eye, Trash2, CheckCircle, XCircle, ExternalLink, Download, FileSpreadsheet, X, Calendar, Edit2, MessageSquare, UserPlus } from "lucide-react"

type Lead = {
  id: string
  business_name: string
  contact_name: string
  phone: string | null
  email: string | null
  source: string | null
  notes: string | null
  status: string
  assigned_to: string
  created_at?: string
  assigned_user?: { name: string } | null
  deposit_amount?: number | null
  pending_amount?: number | null
  payment_status?: string | null
  package?: string | null
  sale_price?: number | null
  reminder_date?: string | null
  reminder_note?: string | null
  reminder_time?: string | null
  reminders?: Reminder[]
  industry?: string | null
}

type Reminder = {
  id: string
  lead_id: string
  date: string
  time: string | null
  is_completed: boolean
}

type Note = {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
}

export default function LeadsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingLeads, setFetchingLeads] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const router = useRouter()

  // Form State
  const [showForm, setShowForm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const [allProfiles, setAllProfiles] = useState<{id: string, name: string}[]>([])
  
  const [formData, setFormData] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
    assigned_to: "",
    industry: "",
    package: ""
  })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null)

  // Export State
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    fromDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], // Default 1 month ago
    toDate: new Date().toISOString().split('T')[0],
    fields: {
      business_name: true,
      contact_name: true,
      phone: true,
      email: true,
      status: true,
      source: true,
      assigned_to: true,
      created_at: true,
      sales_total: true
    }
  })

  // Quick Action State
  const [showQuickEditModal, setShowQuickEditModal] = useState(false)
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false)
  const [showQuickReminderModal, setShowQuickReminderModal] = useState(false)
  const [showQuickReassignModal, setShowQuickReassignModal] = useState(false)
  const [selectedLeadForAction, setSelectedLeadForAction] = useState<Lead | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  // Quick Action Form Data
  const [quickEditForm, setQuickEditForm] = useState({ business_name: '', contact_name: '', phone: '', email: '' })
  const [quickNote, setQuickNote] = useState('')
  const [quickReminder, setQuickReminder] = useState({ date: '', note: '' })
  const [quickReassignId, setQuickReassignId] = useState('')

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')

  // Actions Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const statusOptions = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta', 'perdido']

  // Auth & Fetch Leads
  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
         router.push("/login")
         return
      }
      setUser(user)
      
      // Default assignment to self
      setFormData(prev => ({ ...prev, assigned_to: user.id }))

      // Check role and permissions
      const { role, permissions } = await getUserRole()
      const isSystemAdmin = role === 'admin'
      setIsAdmin(isSystemAdmin)
      setPermissions(permissions)

      if (isSystemAdmin || permissions.includes('create_and_assign_leads') || permissions.includes('reassign_leads')) {
        // Fetch all profiles for assignment/reassignment
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .order('name')
        if (profiles) setAllProfiles(profiles)
      }

      setLoading(false)
      fetchLeads(user.id, role, permissions)
    }
    init()
  }, [router])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  const insertActivity = async (leadId: string, type: string, description: string) => {
    if (!user) return
    await supabase.from('activities').insert({
      lead_id: leadId,
      type,
      description,
      created_by: user.id
    })
  }

  const fetchLeads = async (userId: string = user?.id || "", role: string | null = null, currentPerms: string[] = permissions) => {
    setFetchingLeads(true)

    // Step 1: Build the query based on permissions
    let leadsQuery = supabase.from('leads').select('*')
    
    // Permission check for viewing all leads
    const canViewAll = true // Everyone can view all leads now
    if (!canViewAll && userId) {
      leadsQuery = leadsQuery.eq('assigned_to', userId)
    }

    const { data: leadsData, error } = await leadsQuery.order('created_at', { ascending: false })

    if (error || !leadsData) {
      console.error('Error fetching leads:', error)
      setFetchingLeads(false)
      return
    }

    // Step 2: Get unique assigned_to UUIDs and batch-fetch profiles
    const assignedIds = [...new Set(
      leadsData.map((l: any) => l.assigned_to).filter(Boolean)
    )]

    let profileMap: Record<string, string> = {}
    if (assignedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', assignedIds)
      
      if (profiles) {
        profiles.forEach((p: any) => { profileMap[p.id] = p.name })
      }
    }

    const leadWithProfiles = leadsData.map((lead: any) => ({
      ...lead,
      assigned_user: lead.assigned_to && profileMap[lead.assigned_to]
        ? { name: profileMap[lead.assigned_to] }
        : null
    }))

    // Step 4: Batch fetch uncompleted reminders for these leads
    const leadIds = leadsData.map((l: any) => l.id)
    const { data: remindersData, error: remindersError } = await supabase
      .from('reminders')
      .select('id, lead_id, date, time, is_completed')
      .in('lead_id', leadIds)
      .eq('is_completed', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    const remindersMap: Record<string, Reminder[]> = {}
    if (!remindersError && remindersData) {
      remindersData.forEach((r: any) => {
        if (!remindersMap[r.lead_id]) remindersMap[r.lead_id] = []
        remindersMap[r.lead_id].push(r)
      })
    }

    const finalLeads = leadWithProfiles.map((lead: any) => ({
      ...lead,
      reminders: remindersMap[lead.id] || []
    }))

    setLeads(finalLeads as Lead[])
    setFetchingLeads(false)
  }

  const handleExport = async () => {
    if (!isAdmin) return
    setExporting(true)

    try {
      // 1. Fetch filtered leads
      let query = supabase
        .from('leads')
        .select('*')
        .gte('created_at', `${exportOptions.fromDate}T00:00:00`)
        .lte('created_at', `${exportOptions.toDate}T23:59:59`)
      
      const { data: leadsToExport, error: leadsError } = await query
      
      if (leadsError) throw leadsError
      if (!leadsToExport || leadsToExport.length === 0) {
        alert('No hay leads en el rango de fechas seleccionado.')
        setExporting(false)
        return
      }

      // 2. Resolve Profile Names if assigned_to is selected
      const profileMap: Record<string, string> = {}
      if (exportOptions.fields.assigned_to) {
        allProfiles.forEach(p => {
          profileMap[p.id] = p.name
        })
      }

      // 3. Aggregate Sales if sales_total is selected
      const salesTotals: Record<string, number> = {}
      if (exportOptions.fields.sales_total) {
        const leadIds = leadsToExport.map(l => l.id)
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('lead_id, total_amount')
          .in('lead_id', leadIds)
        
        if (!salesError && salesData) {
          salesData.forEach(s => {
            salesTotals[s.lead_id] = (salesTotals[s.lead_id] || 0) + s.total_amount
          })
        }
      }

      // 4. Build CSV
      const fields = exportOptions.fields
      const headerMap: Record<string, string> = {
        business_name: 'Nombre del Negocio',
        contact_name: 'Nombre del Contacto',
        phone: 'Teléfono',
        email: 'Email',
        status: 'Estado',
        source: 'Fuente',
        assigned_to: 'Asignado a',
        created_at: 'Fecha de Creación',
        sales_total: 'Total en Ventas'
      }

      // Filter headers by selected fields
      const selectedFieldKeys = Object.keys(fields).filter(k => fields[k as keyof typeof fields])
      const csvHeaders = selectedFieldKeys.map(k => headerMap[k]).join(',')

      const csvRows = leadsToExport.map(lead => {
        return selectedFieldKeys.map(key => {
          let value: any = lead[key as keyof typeof lead]

          if (key === 'assigned_to') {
            value = profileMap[value] || 'Sin asignar'
          } else if (key === 'sales_total') {
            value = salesTotals[lead.id] || 0
          } else if (key === 'created_at') {
            const date = new Date(value)
            value = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
          }

          // Escape CSV
          const strValue = value === null || value === undefined ? '' : String(value)
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`
          }
          return strValue
        }).join(',')
      })

      const csvContent = [csvHeaders, ...csvRows].join('\n')
      
      // 5. Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `leads-export-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setShowExportModal(false)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('Error al exportar los datos: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleQuickEditLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAction || actionInProgress) return
    setActionInProgress(true)

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          business_name: quickEditForm.business_name,
          contact_name: quickEditForm.contact_name,
          phone: quickEditForm.phone || null,
          email: quickEditForm.email || null
        })
        .eq('id', selectedLeadForAction.id)

      if (error) throw error

      await insertActivity(selectedLeadForAction.id, 'update', 'Detalles del lead actualizados (Edición rápida)')
      await fetchLeads()
      setShowQuickEditModal(false)
      setSelectedLeadForAction(null)
    } catch (err: any) {
      alert('Error al actualizar lead: ' + err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleQuickNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAction || !quickNote.trim() || actionInProgress || !user) return
    setActionInProgress(true)

    try {
      const { error } = await supabase
        .from('notes')
        .insert({
          lead_id: selectedLeadForAction.id,
          content: quickNote.trim(),
          created_by: user.id
        })

      if (error) throw error

      await insertActivity(selectedLeadForAction.id, 'note', 'Nota rápida agregada')
      setQuickNote('')
      setShowQuickNoteModal(false)
      setSelectedLeadForAction(null)
    } catch (err: any) {
      alert('Error al guardar nota: ' + err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleQuickReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAction || !quickReminder.date || actionInProgress || !user) return
    setActionInProgress(true)

    try {
      const { error } = await supabase
        .from('reminders')
        .insert({
          lead_id: selectedLeadForAction.id,
          date: quickReminder.date,
          note: quickReminder.note || null,
          created_by: user.id,
          is_completed: false
        })

      if (error) throw error

      await insertActivity(selectedLeadForAction.id, 'meeting', `Seguimiento programado para ${new Date(quickReminder.date + 'T00:00:00').toLocaleDateString('es-ES')}`)
      
      await fetchLeads()
      
      setQuickReminder({ date: '', note: '' })
      setShowQuickReminderModal(false)
      setSelectedLeadForAction(null)
    } catch (err: any) {
      alert('Error al programar seguimiento: ' + err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleQuickReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadForAction || !quickReassignId || actionInProgress) return
    setActionInProgress(true)

    try {
      const oldReassignedTo = selectedLeadForAction.assigned_user?.name || 'Sin asignar'
      const newProfile = allProfiles.find(p => p.id === quickReassignId)
      const newName = newProfile?.name || 'Usuario desconocido'

      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: quickReassignId })
        .eq('id', selectedLeadForAction.id)

      if (error) throw error

      await insertActivity(selectedLeadForAction.id, 'reassignment', `Lead reasignado de ${oldReassignedTo} a ${newName}`)
      
      if (quickReassignId !== user?.id) {
        await createNotification({
          user_id: quickReassignId,
          title: 'Nuevo Lead Asignado',
          message: `Se te ha reasignado el lead: ${selectedLeadForAction.business_name} (Anteriormente de ${oldReassignedTo})`,
          type: 'assignment',
          related_id: selectedLeadForAction.id
        });
      }

      await fetchLeads()
      setShowQuickReassignModal(false)
      setSelectedLeadForAction(null)
      setQuickReassignId('')
    } catch (err: any) {
      alert('Error al reasignar: ' + err.message)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setSubmitting(true)
    setMsg(null)

    // Enforcement: Only admins can choose assignee
    const canAssignOthers = isAdmin
    const finalAssignment = canAssignOthers ? (formData.assigned_to || user.id) : user.id

    const industryLower = formData.industry.toLowerCase()

    const { data, error } = await supabase.from('leads').insert({
      business_name: formData.business_name,
      contact_name: formData.contact_name,
      phone: formData.phone || null,
      email: formData.email || null,
      source: formData.source || null,
      notes: formData.notes || null,
      industry: industryLower || null,
      package: formData.package || null,
      status: 'nuevo',
      assigned_to: finalAssignment,
      created_by: user.id
    }).select().single()

    if (error) {
      setMsg({ type: 'error', text: error.message || 'Error al crear el lead.' })
    } else {
      // NOTIFICATION: Assignment
      if (finalAssignment !== user.id && data) {
        await createNotification({
          user_id: finalAssignment,
          title: 'Nuevo Lead Asignado',
          message: `Se te ha asignado el lead: ${formData.business_name}`,
          type: 'assignment',
          related_id: data.id
        });
      }
      setMsg({ type: 'success', text: 'Lead creado exitosamente.' })
      setFormData({
        business_name: "",
        contact_name: "",
        phone: "",
        email: "",
        source: "",
        notes: "",
        industry: "",
        package: "",
        assigned_to: user.id
      })
      setShowForm(false)
      fetchLeads()
    }
    setSubmitting(false)
  }

  // Row actions
  const handleViewDetail = (lead: Lead) => {
    router.push(`/leads/${lead.id}`)
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer.")) return

    const { error } = await supabase.from('leads').delete().eq('id', leadId)
    if (error) {
      alert("Error al eliminar lead: " + error.message)
    } else {
      setLeads(prev => prev.filter(l => l.id !== leadId))
      if (leadId === leadId) {
        // Just refresh list
        fetchLeads()
      }
    }
    setOpenDropdownId(null)
  }

  const handleChangeStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    if (error) {
      alert("Error al actualizar el estado: " + error.message)
    } else {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
      // Just refresh list
    }
    setOpenDropdownId(null)
  }

  //   const statusOptions = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta', 'perdido']

  // Utilities
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'nuevo':
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'contactado': return 'bg-yellow-100 text-yellow-800'
      case 'meeting':
      case 'reunión': return 'bg-cyan-100 text-cyan-800'
      case 'demo': return 'bg-indigo-100 text-indigo-800'
      case 'propuesta': return 'bg-purple-100 text-purple-800'
      case 'venta': return 'bg-green-100 text-green-800'
      case 'perdido': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    // Exclude 'venta' from Leads page completely (they are in Customers now)
    if (lead.status === 'venta') return false;

    const matchesStatus = statusFilter === 'Todos' 
      ? lead.status !== 'perdido' // "Todos" in Leads page means active prospects
      : (lead.status || 'nuevo').toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Leads</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">Gestiona tus leads y oportunidades.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {(isAdmin || permissions.includes('export_leads_csv')) && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 border border-gray-300 text-xs sm:text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-all"
              >
                <Download size={14} className="sm:w-4 sm:h-4" /> <span className="whitespace-nowrap">Exportar CSV</span>
              </button>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-all"
            >
              <Plus size={14} className="sm:w-4 sm:h-4" /> <span className="whitespace-nowrap">{showForm ? 'Cancelar' : 'Nuevo Lead'}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK MESSAGES */}
        {msg && (
          <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
        )}

        {/* LEAD CREATION MODAL */}
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setShowForm(false)}
            />
            
            {/* Modal Container */}
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl p-0 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Crear Nuevo Lead</h2>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Información de Prospecto</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre del Negocio *</label>
                    <input
                      required
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleInputChange}
                      placeholder="Ej. Boutique Stella"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre del Contacto *</label>
                    <input
                      required
                      type="text"
                      name="contact_name"
                      value={formData.contact_name}
                      onChange={handleInputChange}
                      placeholder="Ej. Maria Lopez"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Teléfono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+504 0000-0000"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="contacto@negocio.com"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fuente (Opcional)</label>
                    <input
                      type="text"
                      name="source"
                      value={formData.source}
                      onChange={handleInputChange}
                      placeholder="Ej. Web, LinkedIn, Referido"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Rubro (Opcional)</label>
                    <select
                      name="industry"
                      value={formData.industry}
                      onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black appearance-none"
                    >
                      <option value="">Seleccionar rubro...</option>
                      <option value="barberia">Barbería</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="ecommerce">Ecommerce</option>
                      <option value="salud">Salud</option>
                      <option value="servicios">Servicios</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Paquete de Interés (Opcional)</label>
                    <select
                      name="package"
                      value={formData.package}
                      onChange={(e) => setFormData(prev => ({ ...prev, package: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black appearance-none"
                    >
                      <option value="">Seleccionar paquete...</option>
                      <option value="Landing Page">Landing Page</option>
                      <option value="Sitio Web Empresarial">Sitio Web Empresarial</option>
                      <option value="Sitio Web para Generación de Clientes">Sitio Web para Generación de Clientes</option>
                      <option value="Sitio Web con Ecommerce">Sitio Web con Ecommerce</option>
                      <option value="Sitio Web Interactivo con Reservas">Sitio Web Interactivo con Reservas</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  {(isAdmin || permissions.includes('create_and_assign_leads')) && (
                    <div className="flex-1">
                      <label className="block text-[10px] font-black uppercase text-on-surface-variant tracking-widest mb-1.5 ml-1">
                        Asignar A
                      </label>
                      <div className="relative group">
                         <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                           <UserPlus size={16} />
                         </div>
                         <select 
                           value={formData.assigned_to}
                           onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                           className="w-full pl-12 pr-4 py-3 bg-surface-container-high rounded-xl text-sm font-bold border border-outline-variant/10 focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer"
                         >
                           <option value="">Sin Asignar</option>
                           {allProfiles.map(p => (
                             <option key={p.id} value={p.id}>{p.name} {p.id === user?.id ? '(Yo)' : ''}</option>
                           ))}
                         </select>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notas Iniciales (Opcional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Agrega cualquier detalle importante..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-black resize-none"
                  ></textarea>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-inter"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-70 disabled:cursor-not-allowed font-inter"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Guardar Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LEADS LIST */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" ref={dropdownRef}>
          <div className="px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-lg font-medium text-gray-900 shrink-0">Leads Activos</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
               <div className="relative w-full sm:w-64">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input 
                   type="text" 
                   placeholder="Buscar por nombre..." 
                   className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
               </div>
               <select 
                 className="min-w-[140px] px-3 py-2 border border-gray-300 rounded-md text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full sm:w-auto"
                 value={statusFilter}
                 onChange={e => setStatusFilter(e.target.value)}
               >
                 <option value="Todos">Todos los Estados</option>
                 {statusOptions.map(st => (
                    <option key={st} value={st}>{st}</option>
                 ))}
               </select>
            </div>
          </div>
          
          {fetchingLeads ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : leads.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 text-sm">No hay leads encontrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative min-h-[300px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negocio</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignado a</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuente</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubro</th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLeads.map((lead) => (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => handleViewDetail(lead)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{lead.business_name}</div>
                          {(lead.reminders && lead.reminders.length > 0) ? (
                            (() => {
                              const nextRem = lead.reminders[0];
                              const isToday = new Date(nextRem.date + 'T00:00:00').toDateString() === new Date().toDateString();
                              const isPast = new Date(nextRem.date + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
                              
                              if (isToday) {
                                return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase tracking-tighter border border-amber-200" title={`Recordatorio Próximo`}>Hoy{nextRem.time ? ` ${nextRem.time.slice(0, 5)}` : ''}</span>
                              } else if (isPast) {
                                return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-black rounded uppercase tracking-tighter border border-red-200" title={`Recordatorio Vencido`}>Vencido</span>
                              }
                              return null;
                            })()
                          ) : lead.reminder_date ? (
                            <>
                              {new Date(lead.reminder_date + 'T00:00:00').toDateString() === new Date().toDateString() ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded uppercase tracking-tighter border border-amber-200" title={`Recordatorio: ${lead.reminder_time ? `[${lead.reminder_time.slice(0, 5)}] ` : ''}${lead.reminder_note || ''}`}>Hoy{lead.reminder_time ? ` ${lead.reminder_time.slice(0, 5)}` : ''}</span>
                              ) : new Date(lead.reminder_date + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0)) ? (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-black rounded uppercase tracking-tighter border border-red-200" title={`Recordatorio: ${lead.reminder_time ? `[${lead.reminder_time.slice(0, 5)}] ` : ''}${lead.reminder_note || ''}`}>Vencido</span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.contact_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{lead.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${getStatusColor(lead.status || 'nuevo')}`}>
                          {lead.status || 'nuevo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                            {lead.assigned_user?.name ? lead.assigned_user.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="text-sm text-gray-600 font-medium">
                            {lead.assigned_user?.name || 'Sin asignar'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.source || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {lead.industry ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md border border-blue-100 capitalize">
                            {lead.industry}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === lead.id ? null : lead.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                        >
                          <MoreVertical size={20} />
                        </button>

                        {/* Dropdown Menu */}
                        {openDropdownId === lead.id && (
                          <div className="absolute right-8 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1 overflow-hidden">
                            <button
                              onClick={() => handleViewDetail(lead)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ExternalLink size={14} className="text-gray-400" /> Ver detalles
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedLeadForAction(lead)
                                setQuickEditForm({
                                  business_name: lead.business_name,
                                  contact_name: lead.contact_name,
                                  phone: lead.phone || '',
                                  email: lead.email || ''
                                })
                                setShowQuickEditModal(true)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Edit2 size={14} className="text-gray-400" /> Editar
                            </button>

                            <button
                              onClick={() => {
                                setSelectedLeadForAction(lead)
                                setQuickNote('')
                                setShowQuickNoteModal(true)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <MessageSquare size={14} className="text-gray-400" /> Agregar nota
                            </button>

                            <button
                              onClick={() => {
                                setSelectedLeadForAction(lead)
                                setQuickReminder({ date: new Date().toISOString().split('T')[0], note: '' })
                                setShowQuickReminderModal(true)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Calendar size={14} className="text-gray-400" /> Seguimiento
                            </button>

                            <div className="border-t border-gray-100 my-1"></div>
                            {isAdmin && (
                           <button 
                              onClick={() => {
                                setSelectedLeadForAction(lead);
                                setQuickReassignId(lead.assigned_to || '');
                                setShowQuickReassignModal(true);
                                setOpenDropdownId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors text-left"
                           >
                              <UserPlus size={14} />
                              Reasignar Lead
                           </button>
                        )}

                        {(isAdmin || permissions.includes('delete_leads')) && (
                           <button 
                              onClick={() => handleDeleteLead(lead.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-error hover:bg-error/5 transition-colors text-left"
                           >
                              <Trash2 size={14} />
                              Eliminar Prospecto
                           </button>
                        )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* EXPORT MODAL */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-900">
                  <FileSpreadsheet className="text-blue-600" size={20} />
                  <h3 className="font-semibold">Exportar Leads a CSV</h3>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Desde (Fecha Creación)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input 
                        type="date"
                        value={exportOptions.fromDate}
                        onChange={e => setExportOptions(prev => ({ ...prev, fromDate: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Hasta (Fecha Creación)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input 
                        type="date"
                        value={exportOptions.toDate}
                        onChange={e => setExportOptions(prev => ({ ...prev, toDate: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Field Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-3">Campos a Incluir</label>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    {Object.entries({
                      business_name: 'Nombre del Negocio',
                      contact_name: 'Nombre del Contacto',
                      phone: 'Teléfono',
                      email: 'Email',
                      status: 'Estado',
                      source: 'Fuente',
                      assigned_to: 'Asignado a',
                      created_at: 'Fecha de Creación',
                      sales_total: 'Total en Ventas'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={exportOptions.fields[key as keyof typeof exportOptions.fields]}
                          onChange={(e) => {
                            setExportOptions(prev => ({
                              ...prev,
                              fields: { ...prev.fields, [key]: e.target.checked }
                            }))
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Download size={16} /> Generar CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUICK ACTION MODALS */}
        
        {/* EDIT MODAL */}
        {showQuickEditModal && selectedLeadForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-900">
                  <Edit2 className="text-blue-600" size={18} />
                  <h3 className="font-semibold text-sm">Editar Lead: {selectedLeadForAction.business_name}</h3>
                </div>
                <button onClick={() => setShowQuickEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleQuickEditLead}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nombre Negocio</label>
                    <input 
                      type="text" 
                      value={quickEditForm.business_name} 
                      onChange={e => setQuickEditForm(prev => ({ ...prev, business_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nombre Contacto</label>
                    <input 
                      type="text" 
                      value={quickEditForm.contact_name} 
                      onChange={e => setQuickEditForm(prev => ({ ...prev, contact_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Teléfono</label>
                    <input 
                      type="tel" 
                      value={quickEditForm.phone} 
                      onChange={e => setQuickEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
                    <input 
                      type="email" 
                      value={quickEditForm.email} 
                      onChange={e => setQuickEditForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowQuickEditModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={actionInProgress} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    {actionInProgress && <Loader2 size={14} className="animate-spin" />}Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NOTE MODAL */}
        {showQuickNoteModal && selectedLeadForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-900">
                  <MessageSquare className="text-blue-600" size={18} />
                  <h3 className="font-semibold text-sm">Agregar Nota: {selectedLeadForAction.business_name}</h3>
                </div>
                <button onClick={() => setShowQuickNoteModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleQuickNoteSubmit}>
                <div className="p-6">
                  <textarea 
                    rows={4}
                    placeholder="Escribe la nota aquí..."
                    value={quickNote}
                    onChange={e => setQuickNote(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowQuickNoteModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={actionInProgress} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    {actionInProgress && <Loader2 size={14} className="animate-spin" />}Guardar Nota
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REMINDER MODAL */}
        {showQuickReminderModal && selectedLeadForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-900">
                  <Calendar className="text-blue-600" size={18} />
                  <h3 className="font-semibold text-sm">Marcar Seguimiento: {selectedLeadForAction.business_name}</h3>
                </div>
                <button onClick={() => setShowQuickReminderModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleQuickReminderSubmit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Fecha</label>
                    <input 
                      type="date"
                      value={quickReminder.date}
                      onChange={e => setQuickReminder(prev => ({ ...prev, date: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nota del Seguimiento</label>
                    <input 
                      type="text"
                      placeholder="Ej. Llamar para confirmar demo"
                      value={quickReminder.note}
                      onChange={e => setQuickReminder(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowQuickReminderModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={actionInProgress} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    {actionInProgress && <Loader2 size={14} className="animate-spin" />}Programar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REASSIGN MODAL */}
        {showQuickReassignModal && selectedLeadForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-gray-900">
                  <UserPlus className="text-blue-600" size={18} />
                  <h3 className="font-semibold text-sm">Reasignar Lead: {selectedLeadForAction.business_name}</h3>
                </div>
                <button onClick={() => setShowQuickReassignModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleQuickReassignSubmit}>
                <div className="p-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Seleccionar Responsable</label>
                  <select
                    value={quickReassignId}
                    onChange={e => setQuickReassignId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Sin Asignar</option>
                    {allProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.id === user?.id ? '(Tú)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowQuickReassignModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={actionInProgress} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                    {actionInProgress && <Loader2 size={14} className="animate-spin" />}Confirmar Reasignación
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  )
}
