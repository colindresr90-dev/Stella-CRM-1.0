"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { createNotification } from "@/lib/notifications"
import type { User } from "@supabase/supabase-js"
import { Loader2, Plus, Trash2, Clock, CheckCircle, TrendingUp, Calendar, FileText, Upload, ChevronRight, ClipboardList, Check, Pencil, User as UserIcon, ArrowLeft, RotateCcw, Search, Mail, Phone, MoreHorizontal, Building2, CheckSquare } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Import subcomponents
import { LeadHeader } from "./_components/LeadHeader"
import { LeadInfoPanel } from "./_components/LeadInfoPanel"
import { LeadNotes } from "./_components/LeadNotes"
import { LeadActivities } from "./_components/LeadActivities"
import { LeadFiles } from "./_components/LeadFiles"
import { LeadMeetings } from "./_components/LeadMeetings"
import { LeadEmails } from "./_components/LeadEmails"
import { LeadCompanyCard } from "./_components/LeadCompanyCard"
import { LeadStatusPath } from "./_components/LeadStatusPath"
import { insertActivity } from "./_components/utils"
import { Lead, Note, Activity, FileRecord, Meeting, Reminder, Sale } from "./_components/types"

import {
  DeleteConfirmModal,
  SaleModal,
  SalesSummaryModal,
  MeetingModal,
  ReminderModal,
  LossReasonModal,
  FullActivityModal,
  FullFilesModal,
  FullMeetingsModal
} from "./_components/Modals"

type PageProps = {
  params: Promise<{ id: string }>
}

export default function LeadDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // User auth state
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [userProfileName, setUserProfileName] = useState<string | null>(null)
  const [allProfiles, setAllProfiles] = useState<{ id: string, name: string }[]>([])
  
  // Accordion expanded states for Reminders
  const [expandedReminderIds, setExpandedReminderIds] = useState<Record<string, boolean>>({})
  
  // Active Tab state for Middle Column
  const [activeTab, setActiveTab] = useState<'activity' | 'notes' | 'reminders' | 'meetings' | 'emails' | 'files'>('activity')

  const toggleReminderExpanded = (reminderId: string) => {
    setExpandedReminderIds(prev => ({
      ...prev,
      [reminderId]: !prev[reminderId]
    }))
  }

  // Modal open states
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showSalesSummaryModal, setShowSalesSummaryModal] = useState(false)
  const [showLossReasonModal, setShowLossReasonModal] = useState(false)
  const [showFullActivityModal, setShowFullActivityModal] = useState(false)
  const [showFullFilesModal, setShowFullFilesModal] = useState(false)
  const [showFullMeetingsModal, setShowFullMeetingsModal] = useState(false)

  // Selected entities for actions
  const [confirmingDeleteNote, setConfirmingDeleteNote] = useState<Note | null>(null)
  const [confirmingDeleteFile, setConfirmingDeleteFile] = useState<FileRecord | null>(null)
  const [confirmingDeleteSale, setConfirmingDeleteSale] = useState<Sale | null>(null)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  // Inline Note States & Mutation
  const [showAddNoteInline, setShowAddNoteInline] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [showComposeModal, setShowComposeModal] = useState(false)

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Debes estar autenticado")
      const { data, error } = await supabase
        .from('notes')
        .insert({
          lead_id: id,
          content,
          created_by: user.id
        })
        .select()
        .single()
      if (error) throw error

      await insertActivity(id, user.id, 'note', 'Nota agregada')
      await createNotification({
        user_id: user.id,
        title: 'Nota Guardada',
        message: `Has agregado una nueva nota en ${lead?.business_name}`,
        type: 'update',
        related_id: id
      })
      return data
    },
    onSuccess: () => {
      setNewNoteContent("")
      setShowAddNoteInline(false)
      queryClient.invalidateQueries({ queryKey: ['notes', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
    },
    onError: (err: any) => {
      alert('Error al guardar la nota: ' + err.message)
    }
  })

  // Forms
  const [isEditing, setIsEditing] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: '30',
    description: '',
    email: ''
  })

  // Queries using TanStack Query
  const { data: lead, isLoading: isLoadingLead } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()
      
      if (leadError) throw leadError
      if (!leadData) throw new Error('Lead no encontrado')

      let assignedUser = null
      let creator = null

      if (leadData.assigned_to) {
        const { data: assignedProfile } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', leadData.assigned_to)
          .single()
        assignedUser = assignedProfile || null
      }

      if (leadData.created_by) {
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', leadData.created_by)
          .single()
        creator = creatorProfile || null
      }

      return {
        ...leadData,
        assigned_user: assignedUser,
        creator: creator,
      } as Lead
    }
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Note[]
    }
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', id],
    queryFn: async () => {
      const { data: joinData, error: joinError } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!created_by ( name )
        `)
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
      
      if (!joinError && joinData) {
        return joinData.map((a: any) => ({
          ...a,
          creator: Array.isArray(a.creator) ? a.creator[0] : a.creator
        })) as Activity[]
      }

      const { data: plainData, error: plainError } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
      
      if (plainError) throw plainError
      return (plainData || []) as Activity[]
    }
  })

  const { data: files = [] } = useQuery({
    queryKey: ['files', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select(`
          id,
          file_name,
          file_url,
          created_at,
          uploaded_by,
          uploader:profiles ( name )
        `)
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data.map((f: any) => ({
        ...f,
        uploader: Array.isArray(f.uploader) ? f.uploader[0] : f.uploader
      })) as FileRecord[]
    }
  })

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', id)
        .order('start_time', { ascending: true })
      if (error) throw error
      return (data || []) as Meeting[]
    }
  })

  const { data: sales = [], isFetched: isSalesFetched } = useQuery({
    queryKey: ['sales', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          creator:profiles!created_by ( name )
        `)
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data.map((s: any) => ({
        ...s,
        creator: Array.isArray(s.creator) ? s.creator[0] : s.creator
      })) as Sale[]
    }
  })

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('lead_id', id)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      
      if (error) throw error
      return data as Reminder[]
    }
  })

  // Init auth & profiles
  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/login")
        return
      }
      setUser(user)

      const { role, permissions } = await getUserRole()
      setUserRole(role)
      setPermissions(permissions)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setUserProfileName(profile.name || null)
      }

      if (role === 'admin' || permissions.includes('reassign_leads')) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .order('name')
        if (profiles) setAllProfiles(profiles)
      }
    }
    init()
  }, [id, router])

  // Legacy auto-migration hook
  useEffect(() => {
    if (user && isSalesFetched && lead?.status === 'venta' && sales.length === 0 && lead?.sale_price) {
      console.log('Migrating legacy sale data for lead:', id)
      handleAutoMigrate(lead)
    }
  }, [lead, sales, isSalesFetched, user])

  const handleAutoMigrate = async (legacyLead: Lead) => {
    if (!user) return
    const { data: newSale, error } = await supabase
      .from('sales')
      .insert({
        lead_id: id,
        package: legacyLead.package || 'Paquete anterior',
        total_amount: legacyLead.sale_price || 0,
        deposit_amount: legacyLead.deposit_amount || 0,
        pending_amount: legacyLead.pending_amount || 0,
        status: legacyLead.payment_status === 'pagado' ? 'pagado' : 'pendiente',
        created_by: user.id,
        created_at: legacyLead.created_at
      })
      .select()
      .single()

    if (!error && newSale) {
      await insertActivity(id, user.id, 'system', 'Venta heredada migrada automáticamente a la nueva tabla')
      queryClient.invalidateQueries({ queryKey: ['sales', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
    }
  }

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string, reason?: string }) => {
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error

      const activityDesc = reason 
        ? `Estado cambiado a Perdido. Motivo: ${reason}` 
        : `Estado cambiado a ${status}`
        
      await insertActivity(id, user.id, 'status_change', activityDesc)

      await createNotification({
        user_id: user.id,
        title: 'Estado Actualizado',
        message: `Has cambiado el estado a: ${status}`,
        type: 'update',
        related_id: id
      })

      if (lead?.assigned_to && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Cambio de Estado',
          message: `[${user.email || 'Un compañero'}] cambió el estado a: ${status}`,
          type: 'update',
          related_id: id
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setShowLossReasonModal(false)
    },
    onError: (err: any) => {
      alert('Error al actualizar el estado: ' + err.message)
    }
  })

  const reopenLeadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from('leads')
        .update({ status: 'contactado' })
        .eq('id', id)
      
      if (error) throw error

      await insertActivity(id, user.id, 'reopen', 'Lead reabierta')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      alert('Lead reabierta exitosamente')
    },
    onError: (err: any) => {
      alert('Error al reabrir el lead: ' + err.message)
    }
  })

  const toggleReminderMutation = useMutation({
    mutationFn: async (reminder: Reminder) => {
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !reminder.is_completed })
        .eq('id', reminder.id)
      
      if (error) throw error

      if (!reminder.is_completed) {
        await createNotification({
          user_id: user.id,
          title: 'Recordatorio completado',
          message: `Has marcado como completado un recordatorio para ${lead?.business_name || 'un lead'}`,
          type: 'reminder',
          related_id: id
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', id] })
    },
    onError: (err: any) => {
      alert('Error al actualizar recordatorio: ' + err.message)
    }
  })

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', id] })
    },
    onError: (err: any) => {
      alert('Error al eliminar recordatorio: ' + err.message)
    }
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (note: Note) => {
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', note.id)

      if (error) throw error

      await insertActivity(id, user.id, 'note_deleted', `Nota eliminada por ${userProfileName || user.email || 'Admin'}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setConfirmingDeleteNote(null)
    },
    onError: (err: any) => {
      alert('Error al eliminar la nota: ' + err.message)
    }
  })

  const deleteFileMutation = useMutation({
    mutationFn: async (file: FileRecord) => {
      if (!user) throw new Error("No autenticado")
      const { error: storageError } = await supabase.storage
        .from('lead-files')
        .remove([file.file_url])

      if (storageError) {
        console.error('Error deleting from storage:', storageError)
      }

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id)

      if (dbError) throw dbError

      await insertActivity(id, user.id, 'file_deleted', `Archivo eliminado por ${userProfileName || user.email || 'Admin'}: ${file.file_name}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setConfirmingDeleteFile(null)
    },
    onError: (err: any) => {
      alert('Error al eliminar el archivo: ' + err.message)
    }
  })

  const cancelMeetingMutation = useMutation({
    mutationFn: async (meeting: Meeting) => {
      if (!user) throw new Error("No autenticado")
      const response = await fetch('/api/delete-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: meeting.google_event_id,
          lead_email: lead?.email || '',
          lead_name: lead?.contact_name || '',
          title: meeting.title
        })
      })

      const result = await response.json()
      if (!result.success) {
        if (!window.confirm('Hubo un error al cancelar en Google Calendar/Email. ¿Deseas eliminar el registro local igualmente?')) {
          throw new Error('Cancelación abortada por el usuario')
        }
      }

      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id)

      if (error) throw error

      await insertActivity(id, user.id, 'meeting_canceled', `Reunión cancelada: ${meeting.title}`)
      if (lead?.email) {
        await insertActivity(id, user.id, 'system', 'Correo de cancelación de reunión enviado')
      }

      await createNotification({
        user_id: user.id,
        title: 'Cita Cancelada',
        message: `Has cancelado la cita: ${meeting.title}`,
        type: 'meeting',
        related_id: id
      })

      if (lead?.assigned_to && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Cita Cancelada',
          message: `[${user.email || 'Un compañero'}] canceló la cita: ${meeting.title}`,
          type: 'meeting',
          related_id: id
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      alert('Reunión cancelada correctamente')
    },
    onError: (err: any) => {
      if (err.message !== 'Cancelación abortada por el usuario') {
        alert('Error al cancelar la reunión: ' + err.message)
      }
    }
  })

  const deleteSaleMutation = useMutation({
    mutationFn: async (sale: Sale) => {
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', sale.id)

      if (error) throw error

      await insertActivity(id, user.id, 'status_change', `Venta eliminada: ${sale.package}${sale.custom_name ? ` (${sale.custom_name})` : ''}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', id] })
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setConfirmingDeleteSale(null)
    },
    onError: (err: any) => {
      alert('Error al eliminar la venta: ' + err.message)
    }
  })

  if (!user || isLoadingLead || !lead) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="bg-[#F5F5F5] -mx-4 md:-mx-8 -my-4 md:-my-8 px-4 h-[calc(100vh-80px)] overflow-hidden font-sans antialiased text-slate-800 flex flex-col py-3">
      {/* Back Link */}
      <button 
        onClick={() => router.push('/leads')}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider cursor-pointer mb-3 pl-1 border-none bg-transparent shrink-0"
      >
        <ArrowLeft size={14} /> Volver a Leads
      </button>

      {/* 3-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full flex-1 min-h-0">
        
        {/* Column 1 (Left) */}
        <div className="w-full lg:w-[280px] shrink-0 h-full overflow-y-auto pr-1 pt-[20px] pb-4">
          <LeadInfoPanel
            lead={lead}
            user={user}
            userRole={userRole}
            permissions={permissions}
            allProfiles={allProfiles}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onCloseSaleClick={() => setShowSaleModal(true)}
            onMarkLostClick={() => setShowLossReasonModal(true)}
            onReopenLead={() => reopenLeadMutation.mutate()}
            onStatusChange={(status) => updateStatusMutation.mutate({ status })}
            onTabChange={(tab) => {
              setActiveTab(tab)
              if (tab === 'emails') {
                setShowComposeModal(true)
              } else if (tab === 'notes') {
                setShowAddNoteInline(true)
              }
            }}
            onMeetingClick={() => {
              setEditingMeeting(null)
              setMeetingForm({ title: '', date: '', time: '', duration: '30', description: '', email: lead?.email || '' })
              setShowMeetingModal(true)
            }}
            onReminderClick={() => setShowReminderModal(true)}
            onBackClick={() => router.push('/leads')}
          />
        </div>

        {/* Column 2 (Center, Flexible) - Tabbed Content */}
        <div className="w-full lg:flex-1 min-w-0 h-full flex flex-col gap-3">
          {/* Tabs Switcher */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-1.5 flex gap-1 overflow-x-auto shrink-0 select-none">
            {[
              { id: 'activity', label: 'Actividades', icon: ClipboardList },
              { id: 'notes', label: 'Notas', icon: FileText },
              { id: 'reminders', label: 'Tareas', icon: Clock },
              { id: 'meetings', label: 'Reuniones', icon: Calendar },
              { id: 'emails', label: 'Correos', icon: Mail },
              { id: 'files', label: 'Archivos', icon: Upload }
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none outline-none ${
                    isActive 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 bg-transparent'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab Content Container */}
          <div className={`flex-1 min-h-0 ${activeTab === 'emails' ? 'h-full' : 'h-full overflow-y-auto pb-2 pr-0.5'}`}>
            {activeTab === 'activity' && (
              <LeadActivities
                lead={lead}
                onViewAllClick={() => setShowFullActivityModal(true)}
              />
            )}
            {activeTab === 'notes' && (
              <LeadNotes
                lead={lead}
                user={user}
                userRole={userRole}
                permissions={permissions}
                onDeleteNoteClick={setConfirmingDeleteNote}
              />
            )}
            {activeTab === 'reminders' && (
              <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-5 shadow-none relative overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 shrink-0 bg-white">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                      <Clock size={14} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 truncate">Tareas y Recordatorios</h3>
                    <span className="bg-slate-100 text-slate-650 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200/50 shrink-0">
                      {reminders.filter(r => !r.is_completed).length} pendientes
                    </span>
                  </div>
                  <button
                    onClick={() => setShowReminderModal(true)}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer border-none"
                  >
                    ＋ Crear tarea
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
                  {reminders.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center min-h-[140px] border border-dashed border-slate-200/60 rounded-2xl bg-white/30">
                      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Sin tareas programadas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reminders.map(rem => (
                        <div 
                          key={rem.id} 
                          className={`p-3 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl text-[14px] flex items-center justify-between gap-3 hover:border-slate-300 transition-all ${
                            rem.is_completed ? 'opacity-60 bg-slate-50/55' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button 
                              onClick={() => toggleReminderMutation.mutate(rem)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                rem.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 hover:border-primary'
                              }`}
                            >
                              {rem.is_completed && <Check size={10} strokeWidth={3} />}
                            </button>
                            <span className={`truncate leading-snug ${rem.is_completed ? 'text-slate-400 line-through' : 'text-slate-700 font-semibold'}`}>
                              {rem.note || 'Tarea'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] font-bold text-slate-400 uppercase">
                              {new Date(rem.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {rem.time && ` a las ${rem.time.slice(0, 5)}`}
                            </span>
                            <button 
                              onClick={() => {
                                if (confirm('¿Estás seguro de eliminar este recordatorio?')) {
                                  deleteReminderMutation.mutate(rem.id)
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'meetings' && (
              <LeadMeetings
                lead={lead}
                user={user}
                userRole={userRole}
                permissions={permissions}
                onEditMeetingClick={(meeting) => {
                  const startDate = new Date(meeting.start_time)
                  setEditingMeeting(meeting)
                  setMeetingForm({
                    title: meeting.title,
                    date: startDate.toISOString().split('T')[0],
                    time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    duration: '30',
                    description: meeting.description || '',
                    email: lead.email || ''
                  })
                  setShowMeetingModal(true)
                }}
                onCancelMeetingClick={(meeting) => cancelMeetingMutation.mutate(meeting)}
              />
            )}
            {activeTab === 'emails' && (
              <LeadEmails
                lead={lead}
                user={user}
                showComposeModal={showComposeModal}
                setShowComposeModal={setShowComposeModal}
              />
            )}
            {activeTab === 'files' && (
              <LeadFiles
                lead={lead}
                user={user}
                userRole={userRole}
                permissions={permissions}
                onViewAllClick={() => setShowFullFilesModal(true)}
                onDeleteFileClick={setConfirmingDeleteFile}
              />
            )}
          </div>
        </div>

        {/* Column 3 (Right) */}
        <div className="w-full lg:w-[280px] shrink-0 h-full overflow-y-auto pr-1 pt-2 pb-4 space-y-4">
          {/* Ventas Module */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-4 shadow-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h4 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Ventas</h4>
                {sales.length > 0 && (
                  <span className="bg-slate-100 text-slate-650 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200/50">
                    {sales.length}
                  </span>
                )}
              </div>
              
              {sales.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center">
                  <TrendingUp size={20} className="text-slate-350 mb-1.5" />
                  <p className="text-[14px] font-medium text-slate-400">Sin ventas registradas aún</p>
                </div>
              ) : (
                <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto pr-1">
                  {sales.map(sale => (
                    <div key={sale.id} className="p-2.5 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg text-[14px] flex flex-col gap-0.5 relative group">
                      <span className="font-bold text-slate-700 truncate pr-4">{sale.custom_name || sale.package}</span>
                      <span className="text-[12px] text-slate-500 font-semibold">${sale.total_amount.toLocaleString()}</span>
                      <button 
                        onClick={() => setConfirmingDeleteSale(sale)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setEditingSale(null)
                  setShowSaleModal(true)
                }}
                className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[14px] font-bold uppercase text-primary hover:text-primary/80 transition-colors cursor-pointer bg-transparent border-none outline-none"
              >
                ＋ Crear venta
              </button>
            </div>

            {/* Notas Module */}
            <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-4 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h4 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">NOTAS</h4>
              </div>
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <FileText size={20} className="text-slate-350 mb-1.5" />
                <p className="text-[14px] font-medium text-slate-400">Sin notas guardadas aún</p>
              </div>
              <button
                onClick={() => {
                  setActiveTab('notes')
                  setShowAddNoteInline(true)
                }}
                className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[14px] font-bold uppercase transition-colors cursor-pointer bg-transparent border-none outline-none"
                style={{ color: '#006C49' }}
              >
                + AGREGAR NOTA
              </button>
            </div>

            {/* Tareas Module */}
            <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-4 shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h4 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">TAREAS</h4>
              </div>
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <CheckSquare size={20} className="text-slate-350 mb-1.5" />
                <p className="text-[14px] font-medium text-slate-400">Sin tareas creadas</p>
              </div>
              <button
                onClick={() => setShowReminderModal(true)}
                className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[14px] font-bold uppercase transition-colors cursor-pointer bg-transparent border-none outline-none"
                style={{ color: '#006C49' }}
              >
                + CREAR TAREA
              </button>
            </div>



          </div>

        </div>

      {/* ─── MODALS CONTAINER ─── */}
      
      {showReminderModal && (
        <ReminderModal
          lead={lead}
          user={user}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      {showMeetingModal && (
        <MeetingModal
          lead={lead}
          user={user}
          editingMeeting={editingMeeting}
          meetingForm={meetingForm}
          setMeetingForm={setMeetingForm}
          onClose={() => {
            setShowMeetingModal(false)
            setEditingMeeting(null)
          }}
        />
      )}

      {showSaleModal && (
        <SaleModal
          lead={lead}
          user={user}
          userRole={userRole}
          editingSale={editingSale}
          onClose={() => {
            setShowSaleModal(false)
            setEditingSale(null)
          }}
        />
      )}

      {showSalesSummaryModal && (
        <SalesSummaryModal
          lead={lead}
          sales={sales}
          user={user}
          userRole={userRole}
          permissions={permissions}
          onClose={() => setShowSalesSummaryModal(false)}
          onEditSale={(sale) => {
            setEditingSale(sale)
            setShowSaleModal(true)
          }}
          onDeleteSale={(sale) => setConfirmingDeleteSale(sale)}
        />
      )}

      {showLossReasonModal && (
        <LossReasonModal
          lead={lead}
          user={user}
          updatingStatus={updateStatusMutation.isPending}
          onStatusChange={(status, reason) => updateStatusMutation.mutate({ status, reason })}
          onClose={() => setShowLossReasonModal(false)}
        />
      )}

      {showFullActivityModal && (
        <FullActivityModal
          lead={lead}
          activities={activities}
          onClose={() => setShowFullActivityModal(false)}
        />
      )}

      {showFullFilesModal && (
        <FullFilesModal
          lead={lead}
          files={files}
          uploadingFile={false}
          fileInputRef={null as any}
          generatingUrl={null}
          user={user}
          userRole={userRole}
          permissions={permissions}
          onFileUpload={() => {}}
          onFileAction={async (file, mode) => {
            let filePath = file.file_url
            if (filePath.includes('/storage/v1/object/public/lead-files/')) {
              filePath = filePath.split('/storage/v1/object/public/lead-files/').pop() || filePath
            }
            const { data } = await supabase.storage
              .from('lead-files')
              .createSignedUrl(filePath, 60, { download: mode === 'download' ? file.file_name : false })
            if (data?.signedUrl) {
              window.open(data.signedUrl, '_blank')
            }
          }}
          onDeleteFile={(file) => setConfirmingDeleteFile(file)}
          onClose={() => setShowFullFilesModal(false)}
        />
      )}

      {showFullMeetingsModal && (
        <FullMeetingsModal
          lead={lead}
          meetings={meetings}
          meetingForm={meetingForm}
          setMeetingForm={setMeetingForm}
          user={user}
          onCancelMeeting={(meeting) => cancelMeetingMutation.mutate(meeting)}
          onOpenMeetingModal={(meeting) => {
            if (meeting) {
              const startDate = new Date(meeting.start_time)
              setEditingMeeting(meeting)
              setMeetingForm({
                title: meeting.title,
                date: startDate.toISOString().split('T')[0],
                time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
                duration: '30',
                description: meeting.description || '',
                email: lead.email || ''
              })
            } else {
              setEditingMeeting(null)
              setMeetingForm({ title: '', date: '', time: '', duration: '30', description: '', email: lead.email || '' })
            }
            setShowMeetingModal(true)
          }}
          onClose={() => setShowFullMeetingsModal(false)}
        />
      )}

      {/* Delete Confirmation Modals */}
      {confirmingDeleteNote && (
        <DeleteConfirmModal
          title="¿Eliminar nota?"
          message={<>¿Seguro que deseas eliminar esta nota? Esta acción no se puede deshacer.</>}
          onConfirm={() => deleteNoteMutation.mutate(confirmingDeleteNote)}
          onClose={() => setConfirmingDeleteNote(null)}
          isDeleting={deleteNoteMutation.isPending}
        />
      )}

      {confirmingDeleteFile && (
        <DeleteConfirmModal
          title="¿Eliminar archivo?"
          message={<>¿Seguro que deseas eliminar <strong>{confirmingDeleteFile.file_name}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={() => deleteFileMutation.mutate(confirmingDeleteFile)}
          onClose={() => setConfirmingDeleteFile(null)}
          isDeleting={deleteFileMutation.isPending}
        />
      )}

      {confirmingDeleteSale && (
        <DeleteConfirmModal
          title="¿Eliminar registro de venta?"
          message={<>¿Seguro que deseas eliminar el registro de <strong>{confirmingDeleteSale.custom_name || confirmingDeleteSale.package}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={() => deleteSaleMutation.mutate(confirmingDeleteSale)}
          onClose={() => setConfirmingDeleteSale(null)}
          isDeleting={deleteSaleMutation.isPending}
        />
      )}

    </div>
  )
}
