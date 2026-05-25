"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { createNotification } from "@/lib/notifications"
import type { User } from "@supabase/supabase-js"
import { 
  Plus, Loader2, AlertCircle, CheckCircle2, Search, MoreVertical, 
  Eye, Trash2, CheckCircle, XCircle, ExternalLink, Download, 
  FileSpreadsheet, X, Calendar, Edit2, MessageSquare, UserPlus, 
  TrendingUp, SlidersHorizontal, User as UserIcon, Clock, Phone, Mail, Building,
  ChevronLeft, ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

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
  const router = useRouter()
  const queryClient = useQueryClient()

  // Authenticated user state
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userProfileName, setUserProfileName] = useState<string | null>(null)

  // Drawer / Modal states
  const [showForm, setShowForm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showQuickEditModal, setShowQuickEditModal] = useState(false)
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false)
  const [showQuickReminderModal, setShowQuickReminderModal] = useState(false)
  const [showQuickReassignModal, setShowQuickReassignModal] = useState(false)
  
  // Selected Lead for Quick Actions
  const [selectedLeadForAction, setSelectedLeadForAction] = useState<Lead | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Quick Action Form states
  const [quickEditForm, setQuickEditForm] = useState({ business_name: '', contact_name: '', phone: '', email: '' })
  const [quickNote, setQuickNote] = useState('')
  const [quickReminder, setQuickReminder] = useState({ date: '', note: '' })
  const [quickReassignId, setQuickReassignId] = useState('')

  // Main Lead creation state
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

  // Export CSV options
  const [exportOptions, setExportOptions] = useState({
    fromDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
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

  // Filters State
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [agentFilter, setAgentFilter] = useState('Todos')
  const [sourceFilter, setSourceFilter] = useState('Todos')
  const [dateRangeType, setDateRangeType] = useState('Todos') // 'Todos', 'Hoy', 'Ayer', '7dias', 'esteMes', 'personalizado'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, agentFilter, sourceFilter, dateRangeType, dateFrom, dateTo])

  const statusOptions = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta', 'perdido']

  // Fetch Session & Roles
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        router.push("/login")
        return
      }
      setUser(authUser)
      setFormData(prev => ({ ...prev, assigned_to: authUser.id }))

      const { role, permissions: userPerms } = await getUserRole()
      setUserRole(role)
      setPermissions(userPerms)
      setIsAdmin(role === 'admin')

      // User profile details
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', authUser.id)
        .single()
      if (profile) setUserProfileName(profile.name || null)
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

  // TanStack Queries
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!leadsData) return []

      // Batch Profiles
      const assignedIds = [...new Set(leadsData.map((l: any) => l.assigned_to).filter(Boolean))]
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

      // Batch Uncompleted Reminders
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

      return leadsData.map((lead: any) => ({
        ...lead,
        assigned_user: lead.assigned_to && profileMap[lead.assigned_to]
          ? { name: profileMap[lead.assigned_to] }
          : null,
        reminders: remindersMap[lead.id] || []
      })) as Lead[]
    }
  })

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name')
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    }
  })

  // Dynamic list of unique sources
  const allSources = [...new Set(leads.map(l => l.source).filter(Boolean))] as string[]

  // Activity insertion helper
  const insertActivity = async (leadId: string, type: string, description: string) => {
    if (!user) return
    await supabase.from('activities').insert({
      lead_id: leadId,
      type,
      description,
      created_by: user.id
    })
  }

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: async (newLead: any) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(newLead)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async (data) => {
      if (data.assigned_to && user && data.assigned_to !== user.id) {
        await createNotification({
          user_id: data.assigned_to,
          title: 'Nuevo Lead Asignado',
          message: `Se te ha asignado el lead: ${data.business_name}`,
          type: 'assignment',
          related_id: data.id
        })
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowForm(false)
      setFormData({
        business_name: "",
        contact_name: "",
        phone: "",
        email: "",
        source: "",
        notes: "",
        industry: "",
        package: "",
        assigned_to: user?.id || ""
      })
    },
    onError: (err: any) => {
      alert("Error al crear lead: " + err.message)
    }
  })

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setOpenDropdownId(null)
    },
    onError: (err: any) => {
      alert("Error al eliminar lead: " + err.message)
    }
  })

  const quickEditMutation = useMutation({
    mutationFn: async ({ leadId, business_name, contact_name, phone, email }: any) => {
      const { error } = await supabase
        .from('leads')
        .update({ business_name, contact_name, phone: phone || null, email: email || null })
        .eq('id', leadId)
      if (error) throw error
      await insertActivity(leadId, 'update', 'Detalles del lead actualizados (Edición rápida)')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowQuickEditModal(false)
      setSelectedLeadForAction(null)
    },
    onError: (err: any) => {
      alert("Error al actualizar lead: " + err.message)
    }
  })

  const quickNoteMutation = useMutation({
    mutationFn: async ({ leadId, content }: { leadId: string; content: string }) => {
      const { error } = await supabase
        .from('notes')
        .insert({ lead_id: leadId, content, created_by: user!.id })
      if (error) throw error
      await insertActivity(leadId, 'note', 'Nota rápida agregada')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setQuickNote('')
      setShowQuickNoteModal(false)
      setSelectedLeadForAction(null)
    },
    onError: (err: any) => {
      alert("Error al guardar nota: " + err.message)
    }
  })

  const quickReminderMutation = useMutation({
    mutationFn: async ({ leadId, date, note }: { leadId: string; date: string; note: string }) => {
      const { error } = await supabase
        .from('reminders')
        .insert({ lead_id: leadId, date, note: note || null, created_by: user!.id, is_completed: false })
      if (error) throw error
      await insertActivity(leadId, 'meeting', `Seguimiento programado para ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES')}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setQuickReminder({ date: '', note: '' })
      setShowQuickReminderModal(false)
      setSelectedLeadForAction(null)
    },
    onError: (err: any) => {
      alert("Error al programar seguimiento: " + err.message)
    }
  })

  const quickReassignMutation = useMutation({
    mutationFn: async ({ lead, newUserId }: { lead: Lead; newUserId: string }) => {
      const oldReassignedTo = lead.assigned_user?.name || 'Sin asignar'
      const newProfile = allProfiles.find(p => p.id === newUserId)
      const newName = newProfile?.name || 'Usuario desconocido'

      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: newUserId })
        .eq('id', lead.id)

      if (error) throw error

      await insertActivity(lead.id, 'reassignment', `Lead reasignado de ${oldReassignedTo} a ${newName}`)
      
      if (newUserId !== user?.id) {
        await createNotification({
          user_id: newUserId,
          title: 'Nuevo Lead Asignado',
          message: `Se te ha reasignado el lead: ${lead.business_name} (Anteriormente de ${oldReassignedTo})`,
          type: 'assignment',
          related_id: lead.id
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowQuickReassignModal(false)
      setSelectedLeadForAction(null)
      setQuickReassignId('')
    },
    onError: (err: any) => {
      alert("Error al reasignar: " + err.message)
    }
  })

  // Managers Avatar Color Hash
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-50 text-indigo-700 border-indigo-100',
      'bg-purple-50 text-purple-700 border-purple-100',
      'bg-blue-50 text-blue-700 border-blue-100',
      'bg-emerald-50 text-emerald-700 border-emerald-100',
      'bg-teal-50 text-teal-700 border-teal-100',
      'bg-pink-50 text-pink-700 border-pink-100',
      'bg-amber-50 text-amber-700 border-amber-100'
    ]
    let sum = 0
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
    return colors[sum % colors.length]
  }

  // Status tag design tokens
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'nuevo': return { container: 'bg-blue-50/70 text-blue-700 border-blue-100', dot: 'bg-blue-500' }
      case 'contactado': return { container: 'bg-amber-50/70 text-amber-700 border-amber-100', dot: 'bg-amber-500' }
      case 'reunión': return { container: 'bg-cyan-50/70 text-cyan-700 border-cyan-100', dot: 'bg-cyan-500' }
      case 'demo': return { container: 'bg-indigo-50/70 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' }
      case 'propuesta': return { container: 'bg-purple-50/70 text-purple-700 border-purple-100', dot: 'bg-purple-500' }
      case 'perdido': return { container: 'bg-red-50/70 text-red-700 border-red-100', dot: 'bg-red-500' }
      default: return { container: 'bg-gray-50/70 text-gray-700 border-gray-100', dot: 'bg-gray-500' }
    }
  }

  // Export CSV Action
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    if (!isAdmin) return
    setExporting(true)
    try {
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

      const profileMap: Record<string, string> = {}
      allProfiles.forEach(p => { profileMap[p.id] = p.name })

      const salesTotals: Record<string, number> = {}
      if (exportOptions.fields.sales_total) {
        const leadIds = leadsToExport.map(l => l.id)
        const { data: salesData } = await supabase
          .from('sales')
          .select('lead_id, total_amount')
          .in('lead_id', leadIds)
        if (salesData) {
          salesData.forEach(s => {
            salesTotals[s.lead_id] = (salesTotals[s.lead_id] || 0) + s.total_amount
          })
        }
      }

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

      const selectedFieldKeys = Object.keys(exportOptions.fields).filter(k => exportOptions.fields[k as keyof typeof exportOptions.fields])
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
          const strValue = value === null || value === undefined ? '' : String(value)
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`
          }
          return strValue
        }).join(',')
      })

      const csvContent = [csvHeaders, ...csvRows].join('\n')
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
      alert('Error al exportar datos: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Handle Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const finalAssignment = isAdmin ? (formData.assigned_to || user.id) : user.id
    
    createLeadMutation.mutate({
      business_name: formData.business_name.trim(),
      contact_name: formData.contact_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      source: formData.source.trim() || null,
      notes: formData.notes.trim() || null,
      industry: formData.industry || null,
      package: formData.package || null,
      status: 'nuevo',
      assigned_to: finalAssignment,
      created_by: user.id
    })
  }

  // Handle Filter Reset
  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('Todos')
    setAgentFilter('Todos')
    setSourceFilter('Todos')
    setDateRangeType('Todos')
    setDateFrom('')
    setDateTo('')
  }

  // Filter Leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    if (lead.status === 'venta') return false;

    const matchesStatus = statusFilter === 'Todos' 
      ? lead.status !== 'perdido' 
      : (lead.status || 'nuevo').toLowerCase() === statusFilter.toLowerCase();
    
    const matchesAgent = agentFilter === 'Todos' || lead.assigned_to === agentFilter;
    const matchesSource = sourceFilter === 'Todos' || lead.source === sourceFilter;
    
    const matchesDate = (() => {
      if (dateRangeType === 'Todos') return true;
      if (!lead.created_at) return false;
      
      const leadDate = new Date(lead.created_at);
      const leadDateOnly = new Date(leadDate.getFullYear(), leadDate.getMonth(), leadDate.getDate());
      
      const today = new Date();
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      if (dateRangeType === 'Hoy') {
        return leadDateOnly.getTime() === todayOnly.getTime();
      }
      if (dateRangeType === 'Ayer') {
        const yesterdayOnly = new Date(todayOnly);
        yesterdayOnly.setDate(yesterdayOnly.getDate() - 1);
        return leadDateOnly.getTime() === yesterdayOnly.getTime();
      }
      if (dateRangeType === '7dias') {
        const sevenDaysAgo = new Date(todayOnly);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return leadDateOnly >= sevenDaysAgo && leadDateOnly <= todayOnly;
      }
      if (dateRangeType === 'esteMes') {
        const startOfMonth = new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 1);
        return leadDateOnly >= startOfMonth && leadDateOnly <= todayOnly;
      }
      if (dateRangeType === 'personalizado') {
        if (dateFrom) {
          const fromDateOnly = new Date(dateFrom + 'T00:00:00');
          if (leadDateOnly < fromDateOnly) return false;
        }
        if (dateTo) {
          const toDateOnly = new Date(dateTo + 'T23:59:59');
          if (leadDateOnly > toDateOnly) return false;
        }
        return true;
      }
      return true;
    })();
    
    return matchesSearch && matchesStatus && matchesAgent && matchesSource && matchesDate;
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const range = 1 // number of pages to show on either side of currentPage
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  const activeLeadsCount = leads.filter(l => l.status !== 'perdido' && l.status !== 'venta').length
  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'Todos' || agentFilter !== 'Todos' || sourceFilter !== 'Todos' || dateRangeType !== 'Todos'

  if (isLoadingLeads || !user) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[98%] mx-auto px-4 sm:px-6 py-8 space-y-8 relative">
      {/* BACKGROUND DECORATIVE GLOWS FOR PREMIUM GLASSMORPHISM */}
      <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute top-[35%] left-[-10%] w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[110px] -z-10 pointer-events-none" />
      
      {/* 1. Cabecera (Título y Botones de Acción) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Leads</h1>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-full border border-blue-100 uppercase tracking-wider">
              <TrendingUp size={12} strokeWidth={2.5} />
              {activeLeadsCount} Activos
            </span>
          </div>
          <p className="mt-1.5 text-sm text-gray-500 font-medium">Gestiona y califica prospectos en tu embudo de ventas.</p>
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || permissions.includes('export_leads_csv')) && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <FileSpreadsheet size={15} /> Exportar CSV
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={16} strokeWidth={2.5} /> Nuevo Lead
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros (Glassmorphism Style) */}
      <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-wrap items-center gap-4">
        
        {/* Barra de búsqueda */}
        <div className="flex flex-col gap-1.5 min-w-[220px]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Buscar</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar lead..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/40 border border-slate-200/70 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
            />
          </div>
        </div>

        {/* Filtro de Estado */}
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Estado</span>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/40 border border-slate-200/70 rounded-xl text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
          >
            <option value="Todos">Todos los Estados</option>
            {statusOptions.map(st => (
              <option key={st} value={st} className="capitalize">{st}</option>
            ))}
          </select>
        </div>

        {/* Filtro de Agente */}
        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Agente</span>
          <select 
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/40 border border-slate-200/70 rounded-xl text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
          >
            <option value="Todos">Todos los Agentes</option>
            {allProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Filtro de Fecha de Creación */}
        <div className="flex flex-col gap-1.5 min-w-[170px]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Fecha Creación</span>
          <select 
            value={dateRangeType}
            onChange={e => setDateRangeType(e.target.value)}
            className="w-full px-3 py-2 bg-white/40 border border-slate-200/70 rounded-xl text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
          >
            <option value="Todos">Cualquier fecha</option>
            <option value="Hoy">Hoy</option>
            <option value="Ayer">Ayer</option>
            <option value="7dias">Últimos 7 días</option>
            <option value="esteMes">Este mes</option>
            <option value="personalizado">Rango personalizado</option>
          </select>
        </div>

        {/* Rango de Fecha Personalizado */}
        {dateRangeType === 'personalizado' && (
          <div className="flex items-center gap-2 self-end">
            <div className="flex flex-col gap-1">
              <input 
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-white/40 border border-slate-200/70 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 outline-none"
              />
            </div>
            <span className="text-xs text-gray-400 font-bold">a</span>
            <div className="flex flex-col gap-1">
              <input 
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 bg-white/40 border border-slate-200/70 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 outline-none"
              />
            </div>
          </div>
        )}

        {/* Botón de Limpiar Filtros */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="self-end px-4 py-2 bg-white/30 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200/60 hover:bg-white/70 transition-all cursor-pointer"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* 3. Resultados de paginación */}
      <div className="flex justify-end pr-2">
        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
          Mostrando <span className="text-gray-800 font-black">{filteredLeads.length}</span> de <span className="text-gray-800 font-black">{activeLeadsCount}</span> resultados
        </div>
      </div>

      {/* 4. Tabla de Leads (Glassmorphism Style) */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-[0_12px_38px_rgba(0,0,0,0.02)] overflow-hidden" ref={dropdownRef}>
        <div className="overflow-x-auto relative min-h-[350px]">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Negocio</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Agente</th>
                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha Creación</th>
                <th scope="col" className="relative px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-transparent">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <SlidersHorizontal size={40} className="mx-auto mb-3 opacity-15" />
                    <p className="text-sm font-semibold">No se encontraron prospectos (leads) activos.</p>
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const statusInfo = getStatusStyle(lead.status || 'nuevo')
                  return (
                    <tr 
                      key={lead.id} 
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="hover:bg-blue-50/10 transition-colors cursor-pointer group"
                    >
                      {/* Nombre del Negocio y Correo */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{lead.business_name}</div>
                            {lead.email && <div className="text-xs text-gray-400 font-medium mt-0.5">{lead.email}</div>}
                          </div>
                          
                          {/* Insignias de alerta para recordatorios */}
                          {lead.reminders && lead.reminders.length > 0 && (
                            (() => {
                              const nextRem = lead.reminders[0]
                              const isToday = new Date(nextRem.date + 'T00:00:00').toDateString() === new Date().toDateString()
                              const isPast = new Date(nextRem.date + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))
                              
                              if (isToday) {
                                return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black rounded-md border border-amber-100 uppercase tracking-wide">Hoy</span>
                              } else if (isPast) {
                                return <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[8px] font-black rounded-md border border-red-100 uppercase tracking-wide">Vencido</span>
                              }
                              return null
                            })()
                          )}
                        </div>
                      </td>

                      {/* Nombre de Contacto */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <div className="text-sm text-gray-700 font-medium">{lead.contact_name}</div>
                      </td>

                      {/* Teléfono */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <div className="text-sm text-gray-500 font-medium">{lead.phone || '-'}</div>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize ${statusInfo.container}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          {lead.status || 'nuevo'}
                        </span>
                      </td>

                      {/* Agente Asignado (Avatar) */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-black uppercase ${
                            lead.assigned_user?.name ? getAvatarColor(lead.assigned_user.name) : 'bg-gray-100 text-gray-500 border-slate-200'
                          }`}>
                            {lead.assigned_user?.name ? lead.assigned_user.name.charAt(0) : '?'}
                          </div>
                          <span className="text-xs text-gray-600 font-bold">
                            {lead.assigned_user?.name || 'Sin asignar'}
                          </span>
                        </div>
                      </td>

                      {/* Fecha de Creación (Más Visible) */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-700">
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </span>
                      </td>

                      {/* Botón de acciones */}
                      <td className="px-6 py-4.5 whitespace-nowrap text-right text-sm font-medium relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === lead.id ? null : lead.id)}
                          className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Menú de Dropdown (Glassmorphism) */}
                        {openDropdownId === lead.id && (
                          <div className="absolute right-8 top-10 w-48 bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/60 z-50 py-1.5 overflow-hidden animate-in fade-in duration-100">
                            <button
                              onClick={() => {
                                router.push(`/leads/${lead.id}`)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
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
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 size={14} className="text-gray-400" /> Editar datos
                            </button>

                            <button
                              onClick={() => {
                                setSelectedLeadForAction(lead)
                                setQuickNote('')
                                setShowQuickNoteModal(true)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
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
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Calendar size={14} className="text-gray-400" /> Seguimiento
                            </button>

                            {(isAdmin || permissions.includes('reassign_leads')) && (
                              <button 
                                onClick={() => {
                                  setSelectedLeadForAction(lead)
                                  setQuickReassignId(lead.assigned_to || '')
                                  setShowQuickReassignModal(true)
                                  setOpenDropdownId(null)
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <UserPlus size={14} className="text-gray-400" /> Reasignar agente
                              </button>
                            )}

                            {(isAdmin || permissions.includes('delete_leads')) && (
                              <div className="border-t border-gray-100 my-1.5" />
                            )}
                            
                            {(isAdmin || permissions.includes('delete_leads')) && (
                              <button 
                                onClick={() => {
                                  if (confirm("¿Estás seguro de eliminar este lead?")) {
                                    deleteLeadMutation.mutate(lead.id)
                                  }
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={14} className="text-red-400" /> Eliminar Lead
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredLeads.length > 0 && (
          <div className="px-6 py-4 bg-white/50 border-t border-gray-100/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left side: Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mostrar</span>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 bg-white/60 border border-slate-200/70 rounded-xl text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 cursor-pointer appearance-none pr-8"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">por página</span>
            </div>

            {/* Middle/Right side: Descriptive text & navigation */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                {`Mostrando ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredLeads.length)} de ${filteredLeads.length} leads`}
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-xl border border-slate-200/60 bg-white/40 text-gray-500 hover:bg-white/80 transition-colors disabled:opacity-40 disabled:hover:bg-white/40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page numbers */}
                {getPageNumbers().map((page, index) => {
                  if (page === '...') {
                    return <span key={`ellipsis-${index}`} className="text-gray-400 px-1 text-xs">...</span>
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        currentPage === page
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "border border-slate-200/60 bg-white/40 text-gray-600 hover:bg-white/80"
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-xl border border-slate-200/60 bg-white/40 text-gray-500 hover:bg-white/80 transition-colors disabled:opacity-40 disabled:hover:bg-white/40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 5. PANEL LATERAL DESLIZABLE (Crear Nuevo Lead) ─── */}
      <AnimatePresence>
        {showForm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[120] border-l border-slate-100 flex flex-col"
            >
              
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Lead</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Llenar detalles de prospecto</p>
                </div>
                <button 
                  onClick={() => setShowForm(false)} 
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-50 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body (Scrollable) */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Nombre del Negocio */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Nombre *</label>
                  <div className="relative">
                    <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleInputChange}
                      placeholder="Nombre del lead o negocio"
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Nombre de Contacto */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Persona de Contacto *</label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      name="contact_name"
                      value={formData.contact_name}
                      onChange={handleInputChange}
                      placeholder="María López"
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Correo Electrónico */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Correo Electrónico</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Correo electrónico"
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Teléfono */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Teléfono</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Número de teléfono"
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Grid layout for Source and Industry */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Fuente */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Fuente</label>
                    <input
                      type="text"
                      name="source"
                      value={formData.source}
                      onChange={handleInputChange}
                      placeholder="Escribe la fuente (ej. Instagram)"
                      className="w-full px-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>

                  {/* Rubro / Industria */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Industria / Rubro</label>
                    <select
                      name="industry"
                      value={formData.industry}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Seleccionar industria / rubro</option>
                      <option value="barberia">Barbería</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="ecommerce">Ecommerce</option>
                      <option value="salud">Salud</option>
                      <option value="servicios">Servicios</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                </div>

                {/* Paquete */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Paquete de Interés</label>
                  <select
                    name="package"
                    value={formData.package}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
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

                {/* Agente (Admin only) */}
                {(isAdmin || permissions.includes('create_and_assign_leads')) && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Agente</label>
                    <select 
                      name="assigned_to"
                      value={formData.assigned_to}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Sin Asignar</option>
                      {allProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.id === user?.id ? '(Yo)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notas */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Información Adicional</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Comentarios o notas iniciales..."
                    className="w-full px-4 py-3 bg-gray-50/70 border border-slate-200 rounded-xl text-sm text-black focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none transition-all resize-none"
                  />
                </div>

              </form>

              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-all text-xs uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={createLeadMutation.isPending || !formData.business_name || !formData.contact_name}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-blue-100 disabled:opacity-55"
                >
                  {createLeadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── 6. MODAL EXPORTAR CSV ─── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2 text-gray-900">
                <FileSpreadsheet className="text-blue-600" size={20} />
                <h3 className="font-bold">Exportar Leads a CSV</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">Desde</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="date"
                      value={exportOptions.fromDate}
                      onChange={e => setExportOptions(prev => ({ ...prev, fromDate: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">Hasta</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="date"
                      value={exportOptions.toDate}
                      onChange={e => setExportOptions(prev => ({ ...prev, toDate: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 pl-1">Campos a Incluir</label>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  {Object.entries({
                    business_name: 'Nombre del Negocio',
                    contact_name: 'Nombre del Contacto',
                    phone: 'Teléfono',
                    email: 'Correo Electrónico',
                    status: 'Estado',
                    source: 'Fuente',
                    assigned_to: 'Agente Asignado',
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
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-600 transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Generar CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. MODALES DE ACCIÓN RÁPIDA ─── */}
      
      {/* MODAL EDICIÓN RÁPIDA */}
      {showQuickEditModal && selectedLeadForAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2 text-gray-900">
                <Edit2 className="text-blue-600" size={18} />
                <h3 className="font-bold text-sm">Editar Datos del Lead</h3>
              </div>
              <button onClick={() => setShowQuickEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              quickEditMutation.mutate({ leadId: selectedLeadForAction.id, ...quickEditForm })
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Nombre Negocio</label>
                  <input 
                    type="text" 
                    value={quickEditForm.business_name} 
                    onChange={e => setQuickEditForm(prev => ({ ...prev, business_name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Nombre Contacto</label>
                  <input 
                    type="text" 
                    value={quickEditForm.contact_name} 
                    onChange={e => setQuickEditForm(prev => ({ ...prev, contact_name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Teléfono</label>
                  <input 
                    type="tel" 
                    value={quickEditForm.phone} 
                    onChange={e => setQuickEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={quickEditForm.email} 
                    onChange={e => setQuickEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowQuickEditModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={quickEditMutation.isPending} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 shadow-md">
                  {quickEditMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOTA RÁPIDA */}
      {showQuickNoteModal && selectedLeadForAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2 text-gray-900">
                <MessageSquare className="text-blue-600" size={18} />
                <h3 className="font-bold text-sm">Agregar Nota</h3>
              </div>
              <button onClick={() => setShowQuickNoteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              quickNoteMutation.mutate({ leadId: selectedLeadForAction.id, content: quickNote })
            }}>
              <div className="p-6">
                <textarea 
                  rows={4}
                  placeholder="Escribe la nota interna para el lead..."
                  value={quickNote}
                  onChange={e => setQuickNote(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-black resize-none"
                />
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowQuickNoteModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={quickNoteMutation.isPending} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 shadow-md">
                  {quickNoteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Guardar Nota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SEGUIMIENTO RÁPIDO */}
      {showQuickReminderModal && selectedLeadForAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2 text-gray-900">
                <Calendar className="text-blue-600" size={18} />
                <h3 className="font-bold text-sm">Programar Seguimiento</h3>
              </div>
              <button onClick={() => setShowQuickReminderModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              quickReminderMutation.mutate({ leadId: selectedLeadForAction.id, date: quickReminder.date, note: quickReminder.note })
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Fecha</label>
                  <input 
                    type="date"
                    value={quickReminder.date}
                    onChange={e => setQuickReminder(prev => ({ ...prev, date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Nota de Seguimiento</label>
                  <input 
                    type="text"
                    placeholder="Ej. Llamar para confirmar demo"
                    value={quickReminder.note}
                    onChange={e => setQuickReminder(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowQuickReminderModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={quickReminderMutation.isPending} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 shadow-md">
                  {quickReminderMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REASIGNACIÓN RÁPIDA */}
      {showQuickReassignModal && selectedLeadForAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2 text-gray-900">
                <UserPlus className="text-blue-600" size={18} />
                <h3 className="font-bold text-sm">Reasignar Agente</h3>
              </div>
              <button onClick={() => setShowQuickReassignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              quickReassignMutation.mutate({ lead: selectedLeadForAction, newUserId: quickReassignId })
            }}>
              <div className="p-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">Seleccionar Agente</label>
                <select
                  value={quickReassignId}
                  onChange={e => setQuickReassignId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                >
                  <option value="">Sin Asignar</option>
                  {allProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.id === user?.id ? '(Tú)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowQuickReassignModal(false)} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={quickReassignMutation.isPending} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 shadow-md">
                  {quickReassignMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
