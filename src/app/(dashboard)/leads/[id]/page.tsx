"use client"

import { useEffect, useState, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { createNotification } from "@/lib/notifications"
import type { User } from "@supabase/supabase-js"
import { 
  ArrowLeft, 
  Loader2, 
  Phone, 
  Mail, 
  Building2, 
  User as UserIcon, 
  Clock, 
  FileText, 
  History, 
  Upload, 
  File as FileIcon, 
  Plus,
  Send,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Pencil,
  X,
  DollarSign,
  Calendar,
  AtSign,
  Trash2,
  TrendingUp,
  RotateCcw,
  Video
} from "lucide-react"

type PageProps = {
  params: Promise<{ id: string }>
}

type Lead = {
  id: string
  business_name: string
  contact_name: string
  phone: string | null
  email: string | null
  source: string | null
  status: string
  package: string | null
  sale_price: number | null
  deposit_amount: number | null
  pending_amount: number | null
  payment_status: string | null
  assigned_to: string
  created_by: string
  created_at: string
  creator?: { name: string } | null
  assigned_user?: { id: string, name: string } | null
  reminder_date: string | null
  reminder_note: string | null
  reminder_time: string | null
  closed_at: string | null
  industry: string | null
  notes: string | null
}

type Sale = {
  id: string
  lead_id: string
  package: string
  custom_name: string | null
  custom_description: string | null
  total_amount: number
  deposit_amount: number
  pending_amount: number
  status: 'pendiente' | 'pagado'
  created_by: string
  created_at: string
  creator?: { name: string } | null
}

type Note = {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
}

type Activity = {
  id: string
  lead_id: string
  type: string
  description: string
  created_at: string
  creator?: { name: string } | null
  profiles?: { name: string } | null
}

type FileRecord = {
  id: string
  lead_id: string
  file_url: string
  file_name: string
  uploaded_by: string
  created_at: string
  uploader?: { name: string } | null
  profiles?: { name: string } | null
}

type Meeting = {
  id: string
  lead_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  meet_link: string | null
  google_event_id: string | null
  created_by: string
  created_at: string
}

type Reminder = {
  id: string
  lead_id: string
  date: string
  time: string | null
  note: string | null
  is_completed: boolean
  created_by: string
  created_at: string
}

export default function LeadDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  
  // Reminder State
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderForm, setReminderForm] = useState({ date: '', time: '', note: '' })
  const [savingReminder, setSavingReminder] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  
  // UI State
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showLossReasonModal, setShowLossReasonModal] = useState(false)
  const [lossReason, setLossReason] = useState('')
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  
  // Meeting Modal State
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [schedulingMeeting, setSchedulingMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: '30',
    description: '',
    email: ''
  })
  
  // Refs for scrolling and focus
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notesSectionRef = useRef<HTMLDivElement>(null)
  const notesInputRef = useRef<HTMLTextAreaElement>(null)
  const activitySectionRef = useRef<HTMLDivElement>(null)
  const filesSectionRef = useRef<HTMLDivElement>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ business_name: '', contact_name: '', phone: '', email: '', source: '', industry: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Sale modal state
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [salePackage, setSalePackage] = useState('')
  const [saleCustomName, setSaleCustomName] = useState('')
  const [saleCustomDescription, setSaleCustomDescription] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleDeposit, setSaleDeposit] = useState('')
  const [isFullPayment, setIsFullPayment] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  
  // Sales History & Summary
  const [sales, setSales] = useState<Sale[]>([])
  const [fetchingSales, setFetchingSales] = useState(true)
  const [showSalesSummaryModal, setShowSalesSummaryModal] = useState(false)
  const [confirmingSalePayment, setConfirmingSalePayment] = useState<string | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  // Full List Modals
  const [showFullActivityModal, setShowFullActivityModal] = useState(false)
  const [showFullFilesModal, setShowFullFilesModal] = useState(false)
  const [showFullMeetingsModal, setShowFullMeetingsModal] = useState(false)

  // Role & Profile State
  const [userRole, setUserRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [userProfileName, setUserProfileName] = useState<string | null>(null)
  const [allProfiles, setAllProfiles] = useState<{id: string, name: string}[]>([])
  const [isReassigning, setIsReassigning] = useState(false)

  // Delete Note State
  const [confirmingDeleteNote, setConfirmingDeleteNote] = useState<Note | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState(false)

  // Delete File State
  const [confirmingDeleteFile, setConfirmingDeleteFile] = useState<FileRecord | null>(null)
  const [isDeletingFile, setIsDeletingFile] = useState(false)

  // Delete Sale State
  const [confirmingDeleteSale, setConfirmingDeleteSale] = useState<Sale | null>(null)
  const [isDeletingSale, setIsDeletingSale] = useState(false)

  const PACKAGES = [
    { name: 'Landing Page', price: 400 },
    { name: 'Sitio Web Empresarial', price: 650 },
    { name: 'Sitio Web para Generación de Clientes', price: 900 },
    { name: 'Sitio Web con Ecommerce', price: 1100 },
    { name: 'Sitio Web Interactivo con Reservas', price: 1300 },
    { name: 'Otro', price: 0 },
  ]

  const router = useRouter()
  const statusOptions = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta', 'venta', 'perdido']

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/login")
        return
      }
      setUser(user)

      // Use consistent helper for role check
      const { role, permissions } = await getUserRole()
      setUserRole(role)
      setPermissions(permissions)

      // Fetch profile for name (used in activity logging)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setUserProfileName(profile.name || null)
      }

      // Fetch all profiles if admin or has reassignment permission
      if (role === 'admin' || permissions.includes('reassign_leads')) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .order('name')
        if (profiles) setAllProfiles(profiles)
      }

      await Promise.all([
        fetchLead(),
        fetchNotes(),
        fetchActivities(),
        fetchFiles(),
        fetchMeetings(),
        fetchSales(),
        fetchReminders()
      ])
      setLoading(false)
    }
    init()
  }, [id, router])

  const fetchLead = async () => {
    // Step 1: Fetch the lead data
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    
    if (leadError || !leadData) {
      console.error('Error fetching lead:', leadError)
      return
    }

    // Step 2: Fetch assigned user profile separately (avoids needing FK in DB)
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

    setLead({
      ...leadData,
      assigned_user: assignedUser,
      creator: creator,
    } as Lead)
  }

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    
    if (!error && data) setNotes(data)
  }

  const fetchActivities = async () => {
    // Attempt with join
    const { data: joinData, error: joinError } = await supabase
      .from('activities')
      .select(`
        *,
        creator:profiles!created_by ( name )
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    
    if (!joinError && joinData) {
      const normalized = joinData.map((a: any) => ({
        ...a,
        creator: Array.isArray(a.creator) ? a.creator[0] : a.creator
      }))
      setActivities(normalized as Activity[])
      return
    }

    if (joinError) {
      console.warn('Initial fetchActivities with join failed, trying fallback:', joinError.message)
    }

    // Fallback
    const { data: plainData, error: plainError } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    
    if (plainError) {
      if (plainError.message?.includes('relation') && plainError.message?.includes('does not exist')) {
        console.warn('The "activities" table does not exist in Supabase. Activity tracking will be disabled until the table is created.')
      } else {
        console.error('Error fetching activities (fallback):', plainError.message, plainError.code)
      }
    } else if (plainData) {
      setActivities(plainData as Activity[])
    }
  }

  const fetchFiles = async () => {
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
    
    if (error) {
      console.error('Error fetching files:', error)
    } else if (data) {
      const normalized = data.map((f: any) => ({
        ...f,
        uploader: Array.isArray(f.uploader) ? f.uploader[0] : f.uploader
      }))
      setFiles(normalized as FileRecord[])
    }
  }

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('lead_id', id)
      .order('start_time', { ascending: true })
    
    if (!error && data) setMeetings(data)
  }

  const fetchReminders = async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('lead_id', id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    
    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.warn('The "reminders" table does not exist yet.')
      } else {
        console.error('Error fetching reminders:', error)
      }
    } else if (data) {
      setReminders(data)
    }
  }

  useEffect(() => {
    // AUTO-MIGRATION LOGIC: 
    // If lead is loaded, isn't being fetched, is marked as 'venta' but has NO sales records, migrate the legacy data.
    if (!fetchingSales && lead?.status === 'venta' && sales.length === 0 && lead?.sale_price) {
      console.log('Migrating legacy sale data for lead:', id)
      handleAutoMigrate(lead)
    }
  }, [lead, sales, fetchingSales])

  const fetchSales = async () => {
    setFetchingSales(true)
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        creator:profiles!created_by ( name )
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching sales:', error)
      setFetchingSales(false)
      return
    }

    if (data) {
      const normalized = data.map((s: any) => ({
        ...s,
        creator: Array.isArray(s.creator) ? s.creator[0] : s.creator
      }))
      setSales(normalized as Sale[])
    }
    setFetchingSales(false)
  }

  const handleAutoMigrate = async (legacyLead: Lead) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return

    const { data: newSale, error } = await supabase
      .from('sales')
      .insert({
        lead_id: id,
        package: legacyLead.package || 'Paquete anterior',
        total_amount: legacyLead.sale_price || 0,
        deposit_amount: legacyLead.deposit_amount || 0,
        pending_amount: legacyLead.pending_amount || 0,
        status: legacyLead.payment_status === 'pagado' ? 'pagado' : 'pendiente',
        created_by: currentUser.id,
        created_at: legacyLead.created_at // Keep original timestamp if possible
      })
      .select()
      .single()

    if (!error && newSale) {
      setSales([newSale as Sale])
      await insertActivity('system', 'Venta heredada migrada automáticamente a la nueva tabla')
    }
  }

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !lead || schedulingMeeting) return
    setSchedulingMeeting(true)

    try {
      const startDateTime = new Date(`${meetingForm.date}T${meetingForm.time}`)
      const endDateTime = new Date(startDateTime.getTime() + parseInt(meetingForm.duration) * 60000)

      if (editingMeeting) {
        // UPDATE MODE
        const res = await fetch('/api/update-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: editingMeeting.google_event_id,
            lead_name: lead.contact_name,
            lead_email: meetingForm.email || lead.email,
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            meet_link: editingMeeting.meet_link
          })
        })
        const apiResult = await res.json()
        if (!apiResult.success) throw new Error(apiResult.error || 'Error al actualizar en Google Calendar')

        const { data: mtData, error: mtError } = await supabase
          .from('meetings')
          .update({
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString()
          })
          .eq('id', editingMeeting.id)
          .select()
          .single()

        if (mtError) throw mtError

        await insertActivity('update', `Reunión actualizada: ${meetingForm.title} (${startDateTime.toLocaleDateString('es-ES')} ${meetingForm.time})`)
        if (meetingForm.email || lead.email) {
          await insertActivity('system', 'Correo de actualización de reunión enviado')
        }

        setMeetings(prev => prev.map(m => m.id === editingMeeting.id ? mtData : m))
        
        // NOTIFICATION: Meeting Updated
        await createNotification({
          user_id: user.id,
          title: 'Cita Actualizada',
          message: `Has actualizado la cita: ${meetingForm.title}`,
          type: 'meeting',
          related_id: id
        });

        if (lead?.assigned_to && user && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Cita Modificada',
            message: `[${user.email || 'Un compañero'}] actualizó la cita: ${meetingForm.title}`,
            type: 'meeting',
            related_id: id
          });
        }

        alert('Reunión actualizada exitosamente')
      } else {
        // CREATE MODE
        const response = await fetch('/api/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: id,
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            created_by: user?.id || '',
            lead_email: meetingForm.email || lead?.email,
            lead_name: lead?.contact_name
          })
        })

        const apiResult = await response.json()
        if (!apiResult.success) throw new Error(apiResult.error || 'Error al agendar en Google Calendar')

        const { data: mtData, error: mtError } = await supabase
          .from('meetings')
          .insert({
            lead_id: id,
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            google_event_id: apiResult.google_event_id,
            meet_link: apiResult.meet_link,
            created_by: user.id
          })
          .select()
          .single()

        if (mtError) throw mtError

        await insertActivity('meeting', `Reunión agendada: ${meetingForm.title} (${startDateTime.toLocaleDateString('es-ES')} ${meetingForm.time})`)
        
        if (apiResult.email_sent) {
          await insertActivity('system', 'Correo de confirmación de reunión enviado')
        }

        // NOTIFICATION: Meeting Scheduled
        // 1. Confirm to current user
        if (user) {
          await createNotification({
            user_id: user.id,
            title: 'Cita Agendada',
            message: `Has agendado una cita para ${lead?.business_name || 'un lead'}: ${meetingForm.title}`,
            type: 'meeting',
            related_id: id
          });
        }

        // 2. Notify assigned user if different
        if (lead?.assigned_to && user && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Nueva Cita Agendada',
            message: `Se ha agendado una cita para ${lead.business_name}: ${meetingForm.title}`,
            type: 'meeting',
            related_id: id
          });
        }

        setMeetings(prev => [...prev, mtData])
        setShowMeetingModal(false)
        setMeetingForm({ title: '', date: '', time: '', duration: '30', description: '', email: '' })
        alert('Reunión agendada exitosamente');
      }
    } catch (err: any) {
      console.error('Error handling meeting submission:', err)
      alert(err.message || 'Error inesperado')
    } finally {
      setSchedulingMeeting(false)
    }
  }

  const handleCancelMeeting = async (meeting: Meeting) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar esta reunión? Se notificará al cliente por correo.')) return
    
    try {
      // 1. Cancel in Google Calendar & Send Email
      const response = await fetch('/api/delete-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: meeting.google_event_id,
          lead_name: lead?.contact_name,
          lead_email: lead?.email,
          title: meeting.title
        })
      })

      const result = await response.json()
      if (!result.success) {
        // Log error but continue with DB deletion? 
        // Better to warn user.
        if (!window.confirm('Hubo un error al cancelar en Google Calendar/Email. ¿Deseas eliminar el registro local igualmente?')) return
      }

      // 2. Delete from Supabase
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id)

      if (error) throw error

      await insertActivity('meeting_canceled', `Reunión cancelada: ${meeting.title}`)
      if (lead?.email) {
        await insertActivity('system', 'Correo de cancelación de reunión enviado')
      }

      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
      
      // NOTIFICATION: Meeting Canceled
      if (user) {
        await createNotification({
          user_id: user.id,
          title: 'Cita Cancelada',
          message: `Has cancelado la cita: ${meeting.title}`,
          type: 'meeting',
          related_id: id
        });
      }

      if (lead?.assigned_to && user && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Cita Cancelada',
          message: `[${user.email || 'Un compañero'}] canceló la cita: ${meeting.title}`,
          type: 'meeting',
          related_id: id
        });
      }

      alert('Reunión cancelada correctamente')
    } catch (err: any) {
      console.error('Error canceling meeting:', err)
      alert('Error al cancelar la reunión: ' + err.message)
    }
  }

  const insertActivity = async (type: string, description: string) => {
    if (!user) return
    await supabase.from('activities').insert({
      lead_id: id,
      type,
      description,
      created_by: user.id
    })
    await fetchActivities()
  }

  const handleStatusChange = async (newStatus: string, reason?: string) => {
    if (!lead || updatingStatus || !user) return
    
    if (newStatus === 'perdido' && !reason) {
      setShowLossReasonModal(true)
      return
    }

    setUpdatingStatus(true)
    
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (!error) {
      setLead({ ...lead, status: newStatus })
      const activityDesc = reason 
        ? `Estado cambiado a Perdido. Motivo: ${reason}` 
        : `Estado cambiado a ${newStatus}`
        
      await insertActivity('status_change', activityDesc)

      await createNotification({
        user_id: user.id,
        title: 'Estado Actualizado',
        message: `Has cambiado el estado a: ${newStatus}`,
        type: 'update',
        related_id: id
      });

      if (lead?.assigned_to && user && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Cambio de Estado',
          message: `[${user.email || 'Un compañero'}] cambió el estado a: ${newStatus}`,
          type: 'update',
          related_id: id
        });
      }
      
      setShowLossReasonModal(false)
      setLossReason('')
    }
    setUpdatingStatus(false)
  }

  const handleReopenLead = async () => {
    if (!lead || updatingStatus || !user) return
    if (userRole !== 'admin') return
    
    setUpdatingStatus(true)
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'contactado' })
        .eq('id', id)
      
      if (error) throw error

      setLead({ ...lead, status: 'contactado' })
      await insertActivity('reopen', 'Lead reabierta')
      alert('Lead reabierta exitosamente')
    } catch (err: any) {
      console.error('Error reopening lead:', err)
      alert('Error al reabrir el lead: ' + err.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleOpenSaleModal = () => {
    setEditingSale(null)
    setSalePackage(lead?.package || '')
    setSalePrice(lead?.sale_price ? String(lead.sale_price) : '')
    setSaleDeposit(lead?.deposit_amount ? String(lead.deposit_amount) : '')
    setIsFullPayment(false)
    setShowSaleModal(true)
  }

  const handleOpenEditSaleModal = (sale: Sale) => {
    setEditingSale(sale)
    setSalePackage(sale.package)
    setSaleCustomName(sale.custom_name || '')
    setSaleCustomDescription(sale.custom_description || '')
    setSalePrice(String(sale.total_amount))
    setSaleDeposit(String(sale.deposit_amount))
    setIsFullPayment(sale.total_amount === sale.deposit_amount)
    setShowSaleModal(true)
  }

  const handleSaleSubmit = async () => {
    if (!lead || savingSale || !salePackage) return
    
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

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return

    if (editingSale) {
      // UPDATE MODE
      const { data: updatedSale, error: saleError } = await supabase
        .from('sales')
        .update({
          package: salePackage,
          custom_name: isOther ? saleCustomName.trim() : null,
          custom_description: isOther ? saleCustomDescription.trim() : null,
          total_amount: total,
          deposit_amount: deposit,
          pending_amount: pending,
          status: pStatus
        })
        .eq('id', editingSale.id)
        .select()
        .single()

      if (saleError) {
        alert('Error al actualizar la venta: ' + saleError.message)
        setSavingSale(false)
        return
      }

      setSales(sales.map(s => s.id === editingSale.id ? (updatedSale as Sale) : s))
      await insertActivity('update', `Venta actualizada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Nuevo Total: $${total.toLocaleString()}`)

      if (user) {
        await createNotification({
          user_id: user.id,
          title: 'Venta Actualizada',
          message: `Actualizaste la venta: ${salePackage}`,
          type: 'payment',
          related_id: id
        });
      }
      
      if (lead?.assigned_to && user && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Venta Modificada',
          message: `[${user.email || 'Un compañero'}] actualizó una venta: ${salePackage}`,
          type: 'payment',
          related_id: id
        });
      }
    } else {
      // CREATE MODE
      const { data: newSale, error: saleError } = await supabase
        .from('sales')
        .insert({
          lead_id: id,
          package: salePackage,
          custom_name: isOther ? saleCustomName.trim() : null,
          custom_description: isOther ? saleCustomDescription.trim() : null,
          total_amount: total,
          deposit_amount: deposit,
          pending_amount: pending,
          status: pStatus,
          created_by: currentUser.id
        })
        .select()
        .single()

      if (saleError) {
        alert('Error al registrar la venta: ' + saleError.message)
        setSavingSale(false)
        return
      }

      // 2. Update Lead status to 'venta' (Legacy support & general status)
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'venta',
          closed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (leadError) {
        console.warn('Lead status update failed, but sale was recorded:', leadError.message)
      }

      // NOTIFICATION: Sale created
      if (lead.assigned_to && lead.assigned_to !== currentUser.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Nueva Venta Registrada',
          message: `Se ha registrado una venta para ${lead.business_name}: ${salePackage}`,
          type: 'sale',
          related_id: id
        });
      }

      setSales([newSale as Sale, ...sales])
      
      // NOTIFICATION: Sale Created (Self)
      await createNotification({
        user_id: currentUser.id,
        title: 'Nueva Venta',
        message: `Has registrado una venta: ${salePackage}`,
        type: 'sale',
        related_id: id
      });

      setLead({ ...lead, status: 'venta' })
      
      if (isFullPayment) {
        await insertActivity('sale', `Venta registrada (Pago Completo): ${salePackage}${isOther ? ` (${saleCustomName})` : ''} por $${total.toLocaleString()}`)
      } else {
        await insertActivity('sale', `Venta registrada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Total: $${total.toLocaleString()}, Anticipo: $${deposit.toLocaleString()}, Pendiente: $${pending.toLocaleString()}`)
      }
    }
    
    setShowSaleModal(false)
    setEditingSale(null)
    setSalePackage('')
    setSaleCustomName('')
    setSaleCustomDescription('')
    setSalePrice('')
    setSaleDeposit('')
    setSavingSale(false)
  }

  const handleDeleteSale = async () => {
    if (!confirmingDeleteSale || !id) return
    setIsDeletingSale(true)

    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', confirmingDeleteSale.id)

      if (error) throw error

      setSales(sales.filter(s => s.id !== confirmingDeleteSale.id))
      await insertActivity('status_change', `Venta eliminada: ${confirmingDeleteSale.package}${confirmingDeleteSale.custom_name ? ` (${confirmingDeleteSale.custom_name})` : ''}`)
      
      setConfirmingDeleteSale(null)
    } catch (error: any) {
      alert('Error al eliminar la venta: ' + error.message)
    } finally {
      setIsDeletingSale(false)
    }
  }

  const handleOpenReminderModal = () => {
    setReminderForm({
      date: '',
      time: '',
      note: ''
    })
    setShowReminderModal(true)
  }

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lead || !id || savingReminder) return
    setSavingReminder(true)

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('No user found')

      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert({
          lead_id: id,
          date: reminderForm.date,
          time: reminderForm.time || null,
          note: reminderForm.note || null,
          created_by: currentUser.id
        })
        .select()
        .single()

      if (error) throw error

      setReminders([newReminder as Reminder, ...reminders])

      // NOTIFICATION: Reminder created
      await createNotification({
        user_id: currentUser.id,
        title: 'Recordatorio Agregado',
        message: `Se ha programado un seguimiento para ${lead.business_name}: ${reminderForm.note || 'Sin nota'}`,
        type: 'reminder',
        related_id: id
      });

      if (reminderForm.date) {
        const timeStr = reminderForm.time ? ` a las ${reminderForm.time}` : ''
        await insertActivity('meeting', `Recordatorio agregado para ${new Date(reminderForm.date + 'T00:00:00').toLocaleDateString('es-ES')}${timeStr}`)
      }
      
      setShowReminderModal(false)
    } catch (error: any) {
      alert('Error al guardar recordatorio: ' + error.message)
    } finally {
      setSavingReminder(false)
    }
  }

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('¿Estás seguro de eliminar este recordatorio?')) return
    
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId)

      if (error) throw error
      setReminders(reminders.filter(r => r.id !== reminderId))
    } catch (error: any) {
      alert('Error al eliminar recordatorio: ' + error.message)
    }
  }

  const handleToggleReminderCompletion = async (reminder: Reminder) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !reminder.is_completed })
        .eq('id', reminder.id)

      if (error) throw error
      setReminders(reminders.map(r => r.id === reminder.id ? { ...r, is_completed: !r.is_completed } : r))

      // NOTIFICATION: Reminder Handled
      if (!reminder.is_completed && user) {
        await createNotification({
          user_id: user.id,
          title: 'Recordatorio completado',
          message: `Has marcado como completado un recordatorio para ${lead?.business_name || 'un lead'}`,
          type: 'reminder',
          related_id: id
        });
      }
    } catch (error: any) {
      alert('Error al actualizar recordatorio: ' + error.message)
    }
  }

  const handleConfirmSalePayment = async (sale: Sale) => {
    if (!lead || confirmingSalePayment) return
    if (!confirm(`¿Estás seguro de confirmar el pago total de la venta "${sale.custom_name || sale.package}"?`)) return
    
    setConfirmingSalePayment(sale.id)
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('sales')
      .update({
        pending_amount: 0,
        status: 'pagado'
      })
      .eq('id', sale.id)

    if (error) {
      alert('Error al confirmar pago: ' + error.message)
    } else {
      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, pending_amount: 0, status: 'pagado' } : s))
      
      // NOTIFICATION: Payment Confirmed (Self)
      if (currentUser) {
        await createNotification({
          user_id: currentUser.id,
          title: 'Pago Liquidado',
          message: `Has confirmado el pago final de: ${sale.custom_name || sale.package}`,
          type: 'payment',
          related_id: id
        });
      }
      
      // NOTIFICATION: Payment Confirmed
      if (lead.assigned_to && lead.assigned_to !== currentUser?.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Pago Confirmado',
          message: `Se ha confirmado el pago total de la venta "${sale.custom_name || sale.package}" para ${lead.business_name}`,
          type: 'payment',
          related_id: id
        });
      }

      if (currentUser) {
        await insertActivity('payment_confirmation', `Pago final liquidado para: ${sale.custom_name || sale.package}. Monto del pago: $${sale.pending_amount.toLocaleString()}`)
      }
    }
    setConfirmingSalePayment(null)
  }

  const handleReassignLead = async (newUserId: string) => {
    if (!lead || !user || isReassigning) return
    if (newUserId === lead.assigned_to) return
    
    setIsReassigning(true)
    
    try {
      // Find old and new names for logging
      const oldName = lead.assigned_user?.name || 'Sin asignar'
      const newProfile = allProfiles.find(p => p.id === newUserId)
      const newName = newProfile?.name || 'Usuario desconocido'

      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: newUserId })
        .eq('id', id)
      
      if (error) throw error

      // Update local state
      setLead({
        ...lead,
        assigned_to: newUserId,
        assigned_user: { id: newUserId, name: newName }
      })

      // Log: "Lead reasignada de {old} a {new}"
      await insertActivity('reassignment', `Lead reasignada de ${oldName} a ${newName}`)
      
      // NOTIFICATION: Reassignment
      if (newUserId !== user.id) {
        await createNotification({
          user_id: newUserId,
          title: 'Nuevo Lead Asignado',
          message: `Se te ha reasignado el lead: ${lead.business_name} (Anteriormente de ${oldName})`,
          type: 'assignment',
          related_id: id
        });
      }

      alert('Lead reasignada exitosamente')
    } catch (err: any) {
      console.error('Error reassigning lead:', err)
      alert('Error al reasignar: ' + err.message)
    } finally {
      setIsReassigning(false)
    }
  }

  const handleEditStart = () => {
    if (!lead) return
    setEditForm({
      business_name: lead.business_name || '',
      contact_name: lead.contact_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      industry: lead.industry || '',
      notes: lead.notes || ''
    })
    setEditMsg(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditMsg(null)
  }

  const handleSaveLead = async () => {
    if (!lead || savingEdit) return
    
    // Everyone can edit lead info now as per open access policy
    /*
    if (userRole !== 'admin') {
      alert('Solo los administradores pueden editar la información del lead.')
      return
    }
    */

    setSavingEdit(true)
    setEditMsg(null)

    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('leads')
      .update({
        business_name: editForm.business_name.trim(),
        contact_name: editForm.contact_name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        source: editForm.source.trim() || null,
        industry: editForm.industry || null,
        notes: editForm.notes.trim() || null
      })
      .eq('id', id)

    if (error) {
      setEditMsg({ type: 'error', text: 'Error al guardar: ' + error.message })
    } else {
      setLead({
        ...lead,
        business_name: editForm.business_name.trim(),
        contact_name: editForm.contact_name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        source: editForm.source.trim() || null,
        industry: editForm.industry || null,
        notes: editForm.notes.trim() || null
      })
      setEditMsg({ type: 'success', text: 'Lead actualizada correctamente' })
      
      // NOTIFICATION: Lead Updated (Notify assigned user if someone else updated it)
      if (lead.assigned_to && lead.assigned_to !== currentUser?.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Lead Actualizado',
          message: `Se ha actualizado la información del lead: ${lead.business_name}`,
          type: 'update',
          related_id: id
        });
      }

      if (currentUser) await insertActivity('update', 'Información de lead actualizada')
      setTimeout(() => {
        setIsEditing(false)
        setEditMsg(null)
      }, 1500)
    }
    setSavingEdit(false)
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return
    setSavingNote(true)
    
    // Re-check auth in case user state is stale
    let currentUser = user
    if (!currentUser) {
      const { data } = await supabase.auth.getUser()
      currentUser = data?.user ?? null
      if (currentUser) setUser(currentUser)
    }

    if (!currentUser) {
      alert('Debes estar autenticado para agregar notas.')
      setSavingNote(false)
      return
    }
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        lead_id: id,
        content: newNote.trim(),
        created_by: currentUser.id
      })
      .select()
    
    if (error) {
      console.error('Error adding note:', error)
      alert('Error al guardar la nota: ' + error.message)
    } else if (data) {
      setNotes([data[0], ...notes])
      setNewNote('')
      await insertActivity('note', 'Nota agregada')

      // NOTIFICATION: Note Added
      if (currentUser) {
        await createNotification({
          user_id: currentUser.id,
          title: 'Nota Guardada',
          message: `Has agregado una nueva nota en ${lead?.business_name || 'un lead'}`,
          type: 'update',
          related_id: id
        });
      }

      if (lead?.assigned_to && currentUser && lead.assigned_to !== currentUser.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Nueva Nota de Equipo',
          message: `[${currentUser.email || 'Un compañero'}] agregó una nota en su lead.`,
          type: 'update',
          related_id: id
        });
      }
    }
    setSavingNote(false)
  }

  const handleDeleteFile = async () => {
    if (!confirmingDeleteFile || isDeletingFile || !user) return
    setIsDeletingFile(true)

    try {
      // 1. Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('lead-files')
        .remove([confirmingDeleteFile.file_url])

      if (storageError) {
        console.error('Error deleting from storage:', storageError)
        // We continue anyway to try and clean up the DB record if storage fails (e.g. file already gone)
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', confirmingDeleteFile.id)

      if (dbError) throw dbError

      // 3. Update local state
      setFiles(prev => prev.filter(f => f.id !== confirmingDeleteFile.id))
      
      // 4. Log activity
      await insertActivity('file_deleted', `Archivo eliminado por ${userProfileName || user.email || 'Admin'}: ${confirmingDeleteFile.file_name}`)
      
      setConfirmingDeleteFile(null)
    } catch (err: any) {
      console.error('Error deleting file:', err)
      alert('Error al eliminar el archivo: ' + err.message)
    } finally {
      setIsDeletingFile(false)
    }
  }

  const handleDeleteNote = async () => {
    if (!confirmingDeleteNote || isDeletingNote || !user) return
    setIsDeletingNote(true)

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', confirmingDeleteNote.id)

      if (error) throw error

      setNotes(prev => prev.filter(n => n.id !== confirmingDeleteNote.id))
      
      // Activity log: "Nota eliminada por {user.name}"
      await insertActivity('note_deleted', `Nota eliminada por ${userProfileName || user.email || 'Admin'}`)
      
      setConfirmingDeleteNote(null)
    } catch (err: any) {
      console.error('Error deleting note:', err)
      alert('Error al eliminar la nota: ' + err.message)
    } finally {
      setIsDeletingNote(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadingFile) return

    setUploadingFile(true)
    setUploadStatus(null)

    // Get current authenticated user
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !currentUser) {
      alert('Debes estar autenticado para subir archivos.')
      setUploadingFile(false)
      return
    }

    // Generate unique storage path
    const filePath = `${currentUser.id}/${Date.now()}-${file.name}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      alert('Error al subir el archivo: ' + uploadError.message)
      setUploadingFile(false)
      return
    }

    // Validate all required fields before insert
    if (!currentUser.id || !uploadData.path || !id) {
      alert('Error de validación: faltan datos requeridos para guardar el archivo.')
      setUploadingFile(false)
      return
    }

    const insertPayload = {
      lead_id: id,
      file_name: file.name,
      file_url: uploadData.path,
      uploaded_by: currentUser.id
    }

    console.log('Inserting file record:', insertPayload)

    // Save file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()

    if (dbError) {
      console.error('DB error saving file (full):', JSON.stringify(dbError, null, 2))
      console.error('Payload used:', insertPayload)
      alert(
        'Error al guardar en la base de datos:\n' +
        (dbError.message || JSON.stringify(dbError)) +
        '\n\nVerifica que la política RLS del tabla "files" permite:\nauthenticated WITH CHECK (auth.uid() = uploaded_by)'
      )
    } else if (fileRecord) {
      // Refresh file list and show success
      await fetchFiles()
      setUploadStatus('Archivo subido correctamente')
      await insertActivity('file', `Archivo subido: ${file.name}`)

      // NOTIFICATION: File Uploaded
      await createNotification({
        user_id: currentUser.id,
        title: 'Archivo Guardado',
        message: `Has subido el archivo: ${file.name}`,
        type: 'update',
        related_id: id
      });

      if (lead?.assigned_to && currentUser && lead.assigned_to !== currentUser.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Nuevo Documento',
          message: `[${currentUser.email || 'Un compañero'}] subió un archivo: ${file.name}`,
          type: 'update',
          related_id: id
        });
      }
      // Clear the file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      // Clear success message after 3s
      setTimeout(() => setUploadStatus(null), 3000)
    }

    setUploadingFile(false)
  }

  const handleFileAction = async (file: FileRecord, mode: 'view' | 'download') => {
    if (generatingUrl) return
    setGeneratingUrl(file.id)

    // Fallback: If it's an old full URL, we extract the path
    // Assuming bucket name is 'lead-files'
    let filePath = file.file_url
    if (filePath.includes('/storage/v1/object/public/lead-files/')) {
      filePath = filePath.split('/storage/v1/object/public/lead-files/').pop() || filePath
    }

    const { data, error } = await supabase.storage
      .from('lead-files')
      .createSignedUrl(filePath, 60, {
        download: mode === 'download' ? file.file_name : false
      })

    if (error) {
      console.error("Error generating signed URL:", error)
      alert("Error al generar el acceso al archivo. Por favor reintenta.")
    } else if (data?.signedUrl) {
      if (mode === 'view') {
        window.open(data.signedUrl, '_blank')
      } else {
        // For download, we can use the signedUrl directly as it has the download header set by Supabase
        const link = document.createElement('a')
        link.href = data.signedUrl
        link.setAttribute('download', file.file_name)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }
    setGeneratingUrl(null)
  }

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'nuevo': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'venta': return 'bg-green-100 text-green-700 border-green-200'
      case 'perdido': return 'bg-red-100 text-red-700 border-red-200'
      case 'contactado': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'reunión': return 'bg-purple-100 text-purple-700 border-purple-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-500 mb-4">Lead no encontrado.</p>
        <button onClick={() => router.push('/leads')} className="text-blue-600 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Volver a Leads
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <button 
          onClick={() => router.push('/leads')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto justify-center sm:justify-start"
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lead.business_name}</h1>
        <div className="hidden sm:block w-20"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* TOP SECTION: INFO & MANAGEMENT */}
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT PANEL: INFO & ACTIONS */}
            <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

              {isEditing ? (
                /* ── EDIT FORM ── */
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900">Editar Lead</h3>
                    <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  {editMsg && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg font-medium ${
                      editMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {editMsg.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {editMsg.text}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Negocio *</label>
                      <input
                        type="text"
                        value={editForm.business_name}
                        onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                        placeholder="Nombre del negocio"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contacto *</label>
                      <input
                        type="text"
                        value={editForm.contact_name}
                        onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                        placeholder="+ 1 555 000 0000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                        placeholder="correo@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fuente</label>
                      <input
                        type="text"
                        value={editForm.source}
                        onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                        placeholder="Web, LinkedIn, Referido..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Rubro</label>
                      <select
                        value={editForm.industry}
                        onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors appearance-none"
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
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nota Principal (o Importada)</label>
                      <textarea
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors resize-none h-24"
                        placeholder="Nota principal del lead..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveLead}
                      disabled={savingEdit || !editForm.business_name.trim() || !editForm.contact_name.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {savingEdit ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Guardar cambios
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  <div className="p-8 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                          <Building2 size={28} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">{lead.business_name}</h2>
                          <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getStatusStyle(lead.status)}`}>
                            {lead.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleEditStart}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-gray-600">
                        <UserIcon size={18} className="text-gray-400 shrink-0" />
                        <span className="text-sm">{lead.contact_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <Phone size={18} className="text-gray-400 shrink-0" />
                        <span className="text-sm">{lead.phone || 'Sin teléfono'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <Mail size={18} className="text-gray-400 shrink-0" />
                        <span className="text-sm">{lead.email || 'Sin email'}</span>
                      </div>
                      {lead.source && (
                        <div className="flex items-center gap-3 text-gray-600">
                          <FileText size={18} className="text-gray-400 shrink-0" />
                          <span className="text-sm">{lead.source}</span>
                        </div>
                      )}
                      {lead.industry && (
                        <div className="flex items-center gap-3 text-gray-600">
                          <Building2 size={18} className="text-gray-400 shrink-0" />
                          <span className="text-sm">Rubro: <span className="font-bold text-gray-900 capitalize">{lead.industry}</span></span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-gray-400 text-xs pt-2 border-t border-gray-100 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>Creado el {new Date(lead.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                        {lead.status === 'venta' && lead.closed_at && (
                          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                            <CheckCircle size={14} className="text-green-500" />
                            <span className="text-green-700 font-semibold">Cliente desde: {new Date(lead.closed_at).toLocaleDateString('es-ES')}</span>
                          </div>
                        )}
                        {lead.creator?.name && (
                          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                            <UserIcon size={14} />
                            <span>Creado por: {lead.creator.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                          <UserIcon size={14} className="text-blue-500" />
                          <span>Asignado a: <strong className="text-gray-900">{lead.assigned_user?.name || 'Sin asignar'}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-4">
                    {lead.status !== 'venta' && (
                      <>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">Cambiar Estado</h3>
                        <select
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none capitalize disabled:opacity-50 text-black appearance-none"
                          value={lead.status}
                          disabled={updatingStatus}
                          onChange={(e) => handleStatusChange(e.target.value)}
                        >
                          {statusOptions.map(st => {
                            const isClosingStatus = st === 'venta' || st === 'perdido'
                            const isCurrentClosed = lead.status === 'venta' || lead.status === 'perdido'
                            
                            // Rule 1: No one can select 'venta' or 'perdido' from the dropdown 
                            // (they must use the dedicated buttons which handle special logic)
                            let isDisabled = isClosingStatus && st !== lead.status
                            
                            // Rule 2: Regular users cannot move a lead if it is already closed
                            if (!isDisabled && isCurrentClosed && userRole !== 'admin') {
                              isDisabled = true
                            }

                            return (
                              <option 
                                key={st} 
                                value={st} 
                                disabled={isDisabled}
                                className={isDisabled ? 'text-gray-400 italic' : ''}
                              >
                                {st}
                              </option>
                            )
                          })}
                        </select>
                      </>
                    )}

                    {/* Reassign (Admin ONLY) */}
                   {userRole === 'admin' && (
                      <div className="pt-2 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                         <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                                  <UserIcon size={24} />
                               </div>
                               <div>
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Responsable Actual</h4>
                                  <p className="text-sm font-black text-blue-600 italic">{lead.assigned_user?.name || 'Sin asignar'}</p>
                               </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                               <div className="relative group min-w-[220px] w-full md:w-auto">
                                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                     <History size={14} />
                                  </div>
                                  <select
                                     value={lead.assigned_to}
                                     onChange={(e) => handleReassignLead(e.target.value)}
                                     disabled={isReassigning}
                                     className="w-full pl-10 pr-10 py-2.5 bg-white rounded-xl text-[11px] font-black uppercase tracking-widest border border-gray-200 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer hover:bg-gray-50 shadow-sm"
                                  >
                                     <option value="">Sin Asignar</option>
                                     {allProfiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} {p.id === user?.id ? '(Yo)' : ''}</option>
                                     ))}
                                  </select>
                               </div>
                            </div>
                         </div>
                      </div>
                   )}



                      <div className="space-y-3 pt-4">
                        <button
                          onClick={() => {
                            setMeetingForm({ ...meetingForm, email: lead?.email || '' });
                            setShowMeetingModal(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm shadow-purple-100"
                        >
                          <Calendar size={18} /> Agendar Cita
                        </button>

                        <div className={lead.status === 'venta' ? 'w-full' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                          <button
                            onClick={handleOpenSaleModal}
                            disabled={updatingStatus}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all shadow-sm shadow-green-100 disabled:opacity-50"
                          >
                            <CheckCircle size={18} /> {lead.status === 'venta' ? 'Registrar Venta Adicional' : 'Agregar Venta'}
                          </button>
                          
                          {lead.status !== 'venta' && (
                            <button
                              onClick={() => handleStatusChange('perdido')}
                              disabled={updatingStatus}
                              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50"
                            >
                              <XCircle size={18} /> Perdido
                            </button>
                          )}
                        </div>

                        {userRole === 'admin' && (lead.status === 'venta' || lead.status === 'perdido') && (
                          <div className="pt-4 border-t border-gray-100 mt-2">
                            <button
                              onClick={handleReopenLead}
                              disabled={updatingStatus}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-all shadow-sm shadow-blue-100/50 disabled:opacity-50"
                            >
                              <RotateCcw size={18} /> Reabrir Lead
                            </button>
                          </div>
                        )}
                      </div>
                  </div>
                </>
              )}
            </div>

            {/* REUNIONES CARD (Filling the space between Info and Notes) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900">Reuniones</h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                    Historial de Eventos
                  </span>
                </div>
              </div>
              <div className="p-6">
                {meetings.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 flex flex-col items-center justify-center min-h-[140px]">
                    <p className="text-sm">No hay reuniones programadas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meetings.map((meeting) => {
                      const isUpcoming = new Date(meeting.start_time) > new Date();
                      return (
                        <div key={meeting.id} className={`p-4 rounded-2xl border transition-all group relative ${
                          isUpcoming ? 'bg-purple-50/30 border-purple-100 hover:border-purple-200' : 'bg-gray-50 border-gray-100 opacity-60'
                        }`}>
                          <div className="flex items-start justify-between mb-3 pr-8">
                            <h4 className="font-bold text-gray-900 text-sm truncate pr-2">{meeting.title}</h4>
                            <div className={`p-1.5 rounded-lg ${isUpcoming ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'}`}>
                              <Calendar size={14} />
                            </div>
                          </div>

                          {/* Quick Actions for meeting */}
                          <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                const startDate = new Date(meeting.start_time);
                                setEditingMeeting(meeting);
                                setMeetingForm({
                                  title: meeting.title,
                                  date: startDate.toISOString().split('T')[0],
                                  time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
                                  duration: '30', // Default or calculate from meeting
                                  description: meeting.description || '',
                                  email: lead?.email || ''
                                });
                                setShowMeetingModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar reunión"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={() => handleCancelMeeting(meeting)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancelar reunión"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Calendar size={12} className="opacity-50" />
                              <span>{new Date(meeting.start_time).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Clock size={12} className="opacity-50" />
                              <span>{new Date(meeting.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          {meeting.meet_link && isUpcoming && (
                            <div className="mt-3 pt-3 border-t border-purple-100">
                              <a 
                                href={meeting.meet_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:bg-purple-700 transition-all"
                              >
                                Unirse a Google Meet
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* LEAD MANAGEMENT PANEL — always visible */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* RESUMEN FINANCIERO CARD */}
              <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Resumen Financiero</h3>
                  </div>
                </div>
                
                <div className="p-8 space-y-8">
                  {/* Main Metric */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Vendido</span>
                    <span className="text-4xl font-black text-gray-900 tracking-tight">
                      ${sales.reduce((acc, s) => acc + s.total_amount, 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-y border-gray-50 py-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Pagado</span>
                      <span className="text-xl font-bold text-green-600">
                        ${sales.reduce((acc, s) => acc + (s.status === 'pagado' ? s.total_amount : s.deposit_amount), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Saldo Pendiente</span>
                      <span className={`text-xl font-bold ${
                        sales.reduce((acc, s) => acc + s.pending_amount, 0) > 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        ${sales.reduce((acc, s) => acc + s.pending_amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                    <div className="flex justify-between">
                      <span>Número de Ventas:</span>
                      <span className="text-gray-600">{sales.length} transacciones</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Última Venta:</span>
                      <span className="text-gray-600 truncate max-w-[120px]">
                        {sales.length > 0 ? (sales[0].custom_name || sales[0].package) : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {sales.length > 0 && (
                    <button
                      onClick={() => setShowSalesSummaryModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
                    >
                      Ver historial de ventas
                    </button>
                  )}
                </div>
              </div>

              {/* RECORDATORIOS CARD */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${reminders.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Calendar size={14} />
                    </div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Recordatorios</h3>
                    {reminders.length > 0 && (
                      <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-100">
                        {reminders.filter(r => !r.is_completed).length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleOpenReminderModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors border border-amber-100"
                  >
                    <Plus size={10} /> Nuevo
                  </button>
                </div>
                <div className="p-5">
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {reminders.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-50 rounded-2xl">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sin pendientes</p>
                      </div>
                    ) : (
                      reminders.map((rem) => {
                        const isToday = new Date(rem.date + 'T00:00:00').toDateString() === new Date().toDateString();
                        const isPast = new Date(rem.date + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
                        
                        return (
                          <div 
                            key={rem.id}
                            className={`group relative p-3 rounded-xl border transition-all ${
                              rem.is_completed 
                                ? 'bg-gray-50/50 border-gray-100 opacity-60' 
                                : isToday
                                ? 'bg-amber-50 border-amber-200 shadow-sm'
                                : isPast
                                ? 'bg-red-50 border-red-200'
                                : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggleReminderCompletion(rem)}
                                className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-all flex items-center justify-center ${
                                  rem.is_completed 
                                    ? 'bg-green-500 border-green-500 text-white shadow-sm' 
                                    : 'bg-white border-gray-300 hover:border-amber-500'
                                }`}
                              >
                                {rem.is_completed && <CheckCircle size={10} />}
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`text-[11px] font-bold ${rem.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    {new Date(rem.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {!rem.is_completed && isToday && (
                                      <span className="text-[7px] font-black bg-amber-200 text-amber-800 px-1 rounded uppercase">Hoy</span>
                                    )}
                                    <button 
                                      onClick={() => handleDeleteReminder(rem.id)}
                                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                                
                                {(rem.time || rem.note) && (
                                  <div className="flex flex-col gap-1">
                                    {rem.time && (
                                      <span className={`text-[9px] font-bold flex items-center gap-1 ${rem.is_completed ? 'text-gray-400' : 'text-amber-700'}`}>
                                        <Clock size={9} strokeWidth={3} /> {rem.time.slice(0, 5)}
                                      </span>
                                    )}
                                    {rem.note && (
                                      <p className={`text-[10px] leading-relaxed italic ${rem.is_completed ? 'text-gray-400' : 'text-gray-600'}`}>
                                        "{rem.note}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Legacy Reminder Fallback */}
                    {!reminders.some(r => r.date === lead?.reminder_date) && lead?.reminder_date && (
                      <div className="p-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/20 flex items-center justify-between group">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-amber-800 flex items-center gap-1">
                            <History size={10} /> Recordatorio anterior
                          </span>
                          <span className="text-[8px] text-amber-600">
                            {new Date(lead.reminder_date + 'T00:00:00').toLocaleDateString('es-ES')} {lead.reminder_time}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <History size={14} className="text-purple-500" />
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Actividad</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { icon: FileText, label: 'Notas', count: notes.length, color: 'text-blue-500', 
                      onClick: () => {
                        notesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        setTimeout(() => notesInputRef.current?.focus(), 500);
                      }
                    },
                    { icon: FileIcon, label: 'Archivos', count: files.length, color: 'text-orange-500',
                      onClick: () => setShowFullFilesModal(true)
                    },
                    { icon: Calendar, label: 'Reuniones', count: meetings.length, color: 'text-purple-500',
                      onClick: () => {
                        // For consistency, we scroll to the Reuniones section on the left
                        activitySectionRef.current?.parentElement?.parentElement?.querySelector('.text-purple-600')?.parentElement?.parentElement?.scrollIntoView({ behavior: 'smooth' });
                        // Better yet, I'll just scroll to the activitySectionRef which is near it, 
                        // or I'll just scroll to the actual Reuniones card if I can find it.
                        // For now, let's open the Modal if we have one, or scroll.
                        // I'll create a FullMeetingsModal below.
                        setShowFullMeetingsModal(true);
                      }
                    },
                  ].map(({ icon: Icon, label, count, color, onClick }) => (
                    <button 
                      key={label} 
                      onClick={onClick}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg group-hover:bg-white transition-colors ${color.replace('text-', 'bg-').replace('500', '100')} ${color}`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${ count > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{count}</span>
                        <div className="w-1 h-1 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Plus size={14} className="text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones rápidas</h3>
                </div>
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => {
                      notesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                      setTimeout(() => notesInputRef.current?.focus(), 500);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all"
                  >
                    <FileText size={14} className="text-blue-400" /> Agregar nota
                  </button>
                  <button
                    onClick={() => {
                      filesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                      setTimeout(() => fileInputRef.current?.click(), 500);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-xl transition-all"
                  >
                    <Upload size={14} className="text-orange-400" /> Subir archivo
                  </button>
                  <button
                    onClick={() => {
                      setMeetingForm({ ...meetingForm, email: lead?.email || '' });
                      setShowMeetingModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-all"
                  >
                    <Calendar size={14} className="text-purple-400" /> Agendar reunión
                  </button>
                </div>
              </div>
            </div>
          </div>


          {/* PRIMARY SECTION: NOTAS (Full Width) */}
          <div ref={notesSectionRef} className="lg:col-span-12 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Notas</h3>
            </div>
            <div className="p-6">
              <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="relative">
                  <textarea
                    ref={notesInputRef}
                    placeholder="Escribe una nota interna para este lead..."
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-black min-h-[100px]"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {newNote.trim() && (
                      <span className="text-[10px] text-gray-400 font-medium pr-2">Presiona el botón para guardar</span>
                    )}
                    <button 
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                      className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 px-4 py-2"
                    >
                      {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      <span className="text-sm font-semibold">Guardar Nota</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Nota principal del Lead (Importada o del registro inicial) */}
                {lead.notes && (
                  <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100/50 group relative">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <History size={14} />
                      </div>
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Nota del Registro Principal</span>
                    </div>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
                    <div className="mt-4 pt-3 border-t border-blue-100/30 text-[10px] text-blue-400 font-medium italic">
                      Esta nota fue guardada al momento de crear o importar el lead.
                    </div>
                  </div>
                )}

                {notes.length === 0 && !lead.notes ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <FileText size={32} className="opacity-20" />
                    </div>
                    <p className="text-sm font-medium">No hay notas registradas para este lead.</p>
                  </div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 group hover:border-blue-100 hover:bg-blue-50/10 transition-all relative">
                                     {(userRole === 'admin' || permissions.includes('manage_lead_content') || note.created_by === user?.id) && (
                                        <button 
                                           onClick={() => setConfirmingDeleteNote(note)}
                                           className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-40 group-hover:opacity-100"
                                           title="Eliminar nota"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     )}
                      <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed pr-8">{note.content}</p>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                         <div className="flex items-center gap-2">
                            <Clock size={12} />
                            <span>{new Date(note.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECONDARY SECTION: ACTIVIDAD & ARCHIVOS */}
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* ACTIVITY CARD */}
            <div ref={activitySectionRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-purple-600" />
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">Actividad</h3>
                </div>
                <button 
                  onClick={async () => {
                    await fetchActivities();
                    setShowFullActivityModal(true);
                  }}
                  className="text-[10px] font-black text-purple-600 hover:text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg transition-colors border border-purple-100 uppercase tracking-widest"
                >
                  Ver todo
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto max-h-[450px] space-y-6 relative before:absolute before:inset-0 before:ml-9 before:w-0.5 before:bg-gray-50 before:pointer-events-none">
                {activities.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 relative z-10 bg-white">
                    <History size={48} className="mx-auto mb-4 opacity-10" />
                    <p>No hay historial de actividad aún.</p>
                  </div>
                ) : (
                  activities.map((activity, index) => (
                    <div key={activity.id} className="relative flex items-start gap-3 z-10 mx-4">
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0 ${
                        activity.type === 'status_change' ? 'bg-purple-100 text-purple-600' :
                        activity.type === 'note_added' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {activity.type === 'status_change' ? <Clock size={12} /> : 
                         activity.type === 'note_added' ? <FileText size={12} /> : <FileIcon size={12} />}
                      </div>
                      <div className="flex-1 pt-0.5 ml-1">
                        <p className="text-[11px] font-bold text-gray-800 leading-tight">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">{new Date(activity.created_at).toLocaleString('es-ES')}</p>
                          {activity.profiles?.name && (
                            <>
                              <span className="text-gray-300">·</span>
                              <p className="text-xs text-gray-400 font-medium">{activity.profiles.name}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FILES CARD */}
            <div ref={filesSectionRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <FileIcon size={16} className="text-orange-600" />
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">Archivos</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async () => {
                      await fetchFiles();
                      setShowFullFilesModal(true);
                    }}
                    className="text-[10px] font-black text-orange-600 hover:text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg transition-colors border border-orange-100 uppercase tracking-widest"
                  >
                    Ver todo
                  </button>
                  <label className="cursor-pointer bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 border border-blue-500">
                    {uploadingFile ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    <span>Subir</span>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                </label>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-[450px] space-y-3">
                {uploadStatus && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-xs font-medium rounded-xl border border-green-100 mb-4 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle size={14} /> {uploadStatus}
                  </div>
                )}
                
                {files.length === 0 ? (
                  <div className="text-center py-14 text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <FileIcon size={32} className="opacity-20" />
                    </div>
                    <p className="text-sm font-medium">No hay archivos aún</p>
                    <p className="text-xs mt-1">Sube propuestas o contratos relevantes.</p>
                  </div>
                ) : (
                  files.map(file => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                      <div className="w-8 h-8 shrink-0 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-blue-500 shadow-sm group-hover:border-blue-300 transition-colors text-xs font-bold">
                        <FileIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-800 truncate" title={file.file_name}>{file.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 whitespace-nowrap">
                          <span className="text-[10px] text-gray-500 font-medium truncate max-w-[100px]">{file.uploader?.name || 'Usuario'}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{new Date(file.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleFileAction(file, 'view')} disabled={!!generatingUrl} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all disabled:opacity-50">
                          {generatingUrl === file.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                        </button>
                        <button onClick={() => handleFileAction(file, 'download')} disabled={!!generatingUrl} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50">
                          <Download size={16} />
                        </button>
                                     {(userRole === 'admin' || permissions.includes('manage_lead_content') || file.uploaded_by === user?.id) && (
                                        <button 
                                           onClick={() => setConfirmingDeleteFile(file)}
                                           className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      {/* DELETE FILE CONFIRMATION MODAL */}
      {confirmingDeleteFile && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmingDeleteFile(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <FileIcon size={32} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">¿Eliminar archivo?</h3>
                <p className="text-sm text-gray-500 mt-1">¿Seguro que deseas eliminar <strong>{confirmingDeleteFile.file_name}</strong>? Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setConfirmingDeleteFile(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteFile}
                  disabled={isDeletingFile}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isDeletingFile ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE NOTE CONFIRMATION MODAL */}
      {confirmingDeleteNote && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmingDeleteNote(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">¿Eliminar nota?</h3>
                <p className="text-sm text-gray-500 mt-1">¿Seguro que deseas eliminar esta nota? Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setConfirmingDeleteNote(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteNote}
                  disabled={isDeletingNote}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isDeletingNote ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SALE CONFIRMATION MODAL */}
      {confirmingDeleteSale && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmingDeleteSale(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <DollarSign size={32} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">¿Eliminar registro de venta?</h3>
                <p className="text-sm text-gray-500 mt-1">¿Seguro que deseas eliminar el registro de <strong>{confirmingDeleteSale.custom_name || confirmingDeleteSale.package}</strong>? Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setConfirmingDeleteSale(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSale}
                  disabled={isDeletingSale}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {isDeletingSale ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALE MODAL */}
      {showSaleModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSaleModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{editingSale ? 'Editar Venta' : 'Registrar Venta'}</h3>
                  <p className="text-xs text-gray-500">{lead?.business_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaleModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Package Select */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Paquete *
                </label>
                <select
                  value={salePackage}
                  onChange={e => {
                    setSalePackage(e.target.value)
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                >
                  <option value="" disabled>Seleccionar paquete</option>
                  {PACKAGES.map(pkg => (
                    <option key={pkg.name} value={pkg.name}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>

              {salePackage === 'Otro' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Nombre del Paquete *
                    </label>
                    <input
                      type="text"
                      value={saleCustomName}
                      onChange={e => setSaleCustomName(e.target.value)}
                      placeholder="Ej. Plan Mantenimiento Anual"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Descripción (Opcional)
                    </label>
                    <textarea
                      value={saleCustomDescription}
                      onChange={e => setSaleCustomDescription(e.target.value)}
                      placeholder="Detalles adicionales de la venta..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors resize-none h-20"
                    />
                  </div>
                </div>
              )}

              {/* Price Input Area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Detalles del cobro
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isFullPayment}
                      onChange={(e) => {
                        setIsFullPayment(e.target.checked)
                        if (e.target.checked) setSaleDeposit(salePrice)
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-xs font-bold text-gray-600 group-hover:text-green-600 transition-colors">Pago completo</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">
                    Precio total *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      value={salePrice}
                      onChange={e => {
                        setSalePrice(e.target.value)
                        if (isFullPayment) setSaleDeposit(e.target.value)
                      }}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">
                    Monto a pagar hoy
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      value={saleDeposit}
                      disabled={isFullPayment}
                      onChange={e => setSaleDeposit(e.target.value)}
                      placeholder="0"
                      className={`w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none transition-colors ${
                        isFullPayment 
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-100' 
                        : 'bg-gray-50 text-gray-900 focus:ring-2 focus:ring-green-500 focus:bg-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {salePrice && Number(salePrice) > 0 && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-500">Saldo pendiente:</span>
                    <span className="font-bold text-green-700">
                      ${(Number(salePrice) - (Number(saleDeposit) || 0)).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-green-600 font-medium">
                    {Number(saleDeposit) >= Number(salePrice) 
                      ? 'Venta liquidada totalmente.' 
                      : `Se registrará un pago inicial de $${(Number(saleDeposit) || 0).toLocaleString()}`}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaleSubmit}
                disabled={savingSale || !salePackage || !salePrice || Number(salePrice) <= 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm shadow-green-200 disabled:opacity-50"
              >
                {savingSale ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Guardar venta
              </button>
              <button
                onClick={() => setShowSaleModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALES SUMMARY MODAL */}
      {showSalesSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSalesSummaryModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Historial de Ventas</h3>
                <p className="text-blue-100 text-sm mt-1">{lead?.business_name}</p>
              </div>
              <button
                onClick={() => setShowSalesSummaryModal(false)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
              {sales.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign size={32} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">No hay registros de venta aún.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-6 hover:border-blue-200 transition-all group">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{sale.custom_name || sale.package}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              sale.status === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {sale.status}
                            </span>
                          </div>
                          {sale.custom_description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{sale.custom_description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                                           {(userRole === 'admin' || permissions.includes('manage_sales_records')) && (
                                              <div className="flex gap-1.5 pt-0.5">
                                                 <button 
                                                    onClick={() => handleOpenEditSaleModal(sale)}
                                                    className="p-2 hover:bg-blue-50 text-on-surface-variant hover:text-blue-600 rounded-lg transition-colors"
                                                 >
                                                    <Pencil size={14} />
                                                 </button>
                                                 <button 
                                                    onClick={() => setConfirmingDeleteSale(sale)}
                                                    className="p-2 hover:bg-red-50 text-on-surface-variant hover:text-red-600 rounded-lg transition-colors"
                                                 >
                                                    <Trash2 size={14} />
                                                 </button>
                                              </div>
                                           )}
                            <p className="text-lg font-black text-gray-900">${sale.total_amount.toLocaleString()}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {new Date(sale.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-200/60 transition-colors group-hover:border-blue-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Anticipo</span>
                          <span className="text-sm font-bold text-gray-700">${sale.deposit_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Saldo Pendiente</span>
                          <span className={`text-sm font-bold ${sale.pending_amount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            ${sale.pending_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {sale.status !== 'pagado' && (
                        <button
                          onClick={() => handleConfirmSalePayment(sale)}
                          disabled={!!confirmingSalePayment}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
                        >
                          {confirmingSalePayment === sale.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Confirmar Pago Final
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer with totals */}
            <div className="p-8 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Acumulado</span>
                <span className="text-xl font-black text-gray-900">
                  ${sales.reduce((acc, s) => acc + s.total_amount, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Recaudado</span>
                <span className="text-xl font-black text-green-600">
                  ${sales.reduce((acc, s) => acc + (s.status === 'pagado' ? s.total_amount : s.deposit_amount), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Deuda</span>
                <span className="text-xl font-black text-red-500">
                  ${sales.reduce((acc, s) => acc + s.pending_amount, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEETING MODAL */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMeetingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{editingMeeting ? 'Editar Reunión' : 'Agendar Reunión'}</h3>
                  <p className="text-xs text-gray-500">{lead?.business_name}</p>
                </div>
              </div>
              <button onClick={() => setShowMeetingModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Título de la reunión *</label>
                <input 
                  required
                  type="text"
                  placeholder="Ej. Presentación de Propuesta"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  value={meetingForm.title}
                  onChange={e => setMeetingForm({...meetingForm, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Correo de Confirmación *</label>
                <input 
                  required
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  value={meetingForm.email}
                  onChange={e => setMeetingForm({...meetingForm, email: e.target.value})}
                />
                <p className="text-[10px] text-gray-400 mt-1">A esta dirección se enviarán los detalles de la reunión.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha *</label>
                  <input 
                    required
                    type="date"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                    value={meetingForm.date}
                    onChange={e => setMeetingForm({...meetingForm, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hora *</label>
                  <input 
                    required
                    type="time"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                    value={meetingForm.time}
                    onChange={e => setMeetingForm({...meetingForm, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Duración (minutos)</label>
                <select 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  value={meetingForm.duration}
                  onChange={e => setMeetingForm({...meetingForm, duration: e.target.value})}
                >
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1.5 horas</option>
                  <option value="120">2 horas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Descripción (Opcional)</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  value={meetingForm.description}
                  onChange={e => setMeetingForm({...meetingForm, description: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowMeetingModal(false);
                    setEditingMeeting(null);
                    setMeetingForm({ title: '', date: '', time: '', duration: '30', description: '', email: '' });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={schedulingMeeting}
                  className="flex-[2] px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {schedulingMeeting ? <Loader2 size={18} className="animate-spin" /> : editingMeeting ? <Pencil size={18} /> : <Calendar size={18} />}
                  <span>{editingMeeting ? 'Guardar Cambios' : 'Agendar Reunión'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ACTIVITY MODAL */}
      {showFullActivityModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowFullActivityModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Historial de Actividad Completo</h3>
                  <p className="text-sm text-gray-500">Cronología detallada de interacciones con {lead?.business_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFullActivityModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 relative before:absolute before:inset-0 before:ml-[51px] before:w-0.5 before:bg-gray-100 before:pointer-events-none">
              {activities.length === 0 ? (
                <div className="text-center py-20 text-gray-400 relative z-10 bg-white">
                  <History size={64} className="mx-auto mb-6 opacity-10" />
                  <p className="text-lg font-medium">No hay historial de actividad registrado.</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="relative flex items-start gap-8 z-10 max-w-3xl mx-auto md:mx-6">
                    <div className={`mt-1 w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-md shrink-0 ${
                      activity.type === 'status_change' ? 'bg-purple-100 text-purple-600' :
                      activity.type === 'note_added' ? 'bg-blue-100 text-blue-600' :
                      activity.type === 'meeting' ? 'bg-indigo-100 text-indigo-600' :
                      activity.type === 'sale' ? 'bg-green-100 text-green-600' :
                      activity.type === 'update' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {activity.type === 'status_change' ? <Clock size={20} /> : 
                       activity.type === 'note_added' ? <FileText size={20} /> : 
                       activity.type === 'meeting' ? <Calendar size={20} /> :
                       activity.type === 'sale' ? <DollarSign size={20} /> :
                       activity.type === 'update' ? <Pencil size={20} /> :
                       <FileIcon size={20} />}
                    </div>
                    <div className="flex-1 pt-2">
                      <p className="text-base font-bold text-gray-900 mb-1">{activity.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                          <Clock size={14} />
                          {new Date(activity.created_at).toLocaleString('es-ES', { 
                            day: '2-digit', month: 'long', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit' 
                          })}
                        </span>
                        {activity.profiles?.name && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm text-gray-600 flex items-center gap-1.5 font-semibold bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                              <UserIcon size={14} />
                              {activity.profiles.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL FILES MODAL */}
      {showFullFilesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowFullFilesModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <FileIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Repositorio de Archivos</h3>
                  <p className="text-sm text-gray-500">Documentos, contratos y propuestas asociadas a {lead?.business_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2">
                  {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  <span>Subir Nuevo</span>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                </label>
                <button 
                  onClick={() => setShowFullFilesModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-4 h-full align-top">
              {files.length === 0 ? (
                <div className="col-span-full text-center py-24 text-gray-400">
                  <FileIcon size={80} className="mx-auto mb-6 opacity-10" />
                  <p className="text-lg font-medium text-gray-500">El repositorio está vacío.</p>
                  <p className="text-sm mt-1">Utiliza el botón superior para subir documentos.</p>
                </div>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="flex items-center gap-5 p-5 bg-white border border-gray-200 rounded-[2rem] hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50/50 transition-all group h-fit">
                    <div className="w-16 h-16 shrink-0 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <FileIcon size={30} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-gray-900 truncate mb-1" title={file.file_name}>{file.file_name}</p>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                        <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                          <UserIcon size={12} />
                          {file.profiles?.name || 'Sistema'}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium italic">
                          <Clock size={12} />
                          {new Date(file.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => handleFileAction(file, 'view')} 
                        disabled={!!generatingUrl} 
                        className="p-3 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-2xl transition-all disabled:opacity-50"
                        title="Ver online"
                      >
                        {generatingUrl === file.id ? <Loader2 size={20} className="animate-spin" /> : <Eye size={20} />}
                      </button>
                      <button 
                        onClick={() => handleFileAction(file, 'download')} 
                        disabled={!!generatingUrl} 
                        className="p-3 text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-2xl transition-all disabled:opacity-50"
                        title="Descargar"
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* FULL MEETINGS MODAL */}
      {showFullMeetingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowFullMeetingsModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Agenda de Reuniones</h3>
                  <p className="text-sm text-gray-500">Historial completo y compromisos futuros con {lead?.business_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setMeetingForm({ ...meetingForm, email: lead?.email || '' });
                    setShowMeetingModal(true);
                  }}
                  className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2"
                >
                  <Plus size={18} /> Nueva Reunión
                </button>
                <button 
                  onClick={() => setShowFullMeetingsModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-4 h-full align-top">
              {meetings.length === 0 ? (
                <div className="col-span-full text-center py-24 text-gray-400">
                  <Calendar size={80} className="mx-auto mb-6 opacity-10" />
                  <p className="text-lg font-medium text-gray-500">No hay reuniones registradas.</p>
                  <p className="text-sm mt-1">Utiliza el botón de agendar para comenzar.</p>
                </div>
              ) : (
                meetings.map((meeting) => {
                  const isUpcoming = new Date(meeting.start_time) > new Date();
                  return (
                    <div key={meeting.id} className={`flex items-center gap-5 p-5 border rounded-[2rem] transition-all group h-fit relative ${
                      isUpcoming ? 'bg-purple-50/30 border-purple-100 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-50' : 'bg-gray-50 border-gray-200 opacity-80'
                    }`}>
                      {/* Sidebar Actions for modal cards */}
                      <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {meeting.meet_link && isUpcoming && (
                          <a 
                            href={meeting.meet_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 text-purple-600 bg-purple-50 hover:bg-purple-600 hover:text-white rounded-lg transition-all"
                            title="Unirse a reunión"
                          >
                            <Video size={14} />
                          </a>
                        )}
                        <button 
                          onClick={() => {
                            const startDate = new Date(meeting.start_time);
                            setEditingMeeting(meeting);
                            setMeetingForm({
                              title: meeting.title,
                              date: startDate.toISOString().split('T')[0],
                              time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
                              duration: '30',
                              description: meeting.description || '',
                              email: lead?.email || ''
                            });
                            setShowMeetingModal(true);
                          }}
                          className="p-2 text-gray-400 bg-gray-50 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleCancelMeeting(meeting)}
                          className="p-2 text-red-500 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                          title="Cancelar"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>

                      <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
                        isUpcoming ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                        <Calendar size={30} />
                      </div>
                      <div className="flex-1 min-w-0 pr-20">
                        <p className="text-base font-bold text-gray-900 truncate mb-1">{meeting.title}</p>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                            isUpcoming ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'
                          }`}>
                            <Clock size={12} />
                            {new Date(meeting.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium italic">
                            <History size={12} />
                            {new Date(meeting.start_time).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* REMINDER MODAL */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReminderModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calendar size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Configurar Recordatorio</h3>
                  <p className="text-xs text-gray-500">{lead?.business_name}</p>
                </div>
              </div>
              <button onClick={() => setShowReminderModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha *</label>
                  <input 
                    required
                    type="date"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none text-black"
                    value={reminderForm.date}
                    onChange={e => setReminderForm({...reminderForm, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hora (Opcional)</label>
                  <input 
                    type="time"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none text-black"
                    value={reminderForm.time}
                    onChange={e => setReminderForm({...reminderForm, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nota del recordatorio</label>
                <textarea 
                  rows={3}
                  placeholder="Ej. Llamar para confirmar presupuesto..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none text-black resize-none"
                  value={reminderForm.note}
                  onChange={e => setReminderForm({...reminderForm, note: e.target.value})}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  type="submit"
                  disabled={savingReminder || !reminderForm.date}
                  className="w-full py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingReminder ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  <span>Agregar Recordatorio</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="w-full py-3 text-gray-500 text-xs font-bold hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* LOSS REASON MODAL */}
      {showLossReasonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md overflow-hidden ambient-shadow border border-outline-variant/10">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low">
              <h3 className="font-headline font-bold text-on-background">Motivo de Pérdida</h3>
              <button 
                onClick={() => setShowLossReasonModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Para mejorar nuestra estrategia de ventas, por favor indica por qué se perdió esta oportunidad.
              </p>
              
              <div className="space-y-2">
                {[
                  'Precio demasiado elevado', 
                  'Ya tiene sitio web / servicio', 
                  'No responde (Ghosting)', 
                  'Proyecto pospuesto', 
                  'Prefirió a la competencia', 
                  'Falta de funcionalidades',
                  'No es el perfil / Mala calificación',
                  'Otro'
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setLossReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      lossReason === reason 
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' 
                        : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/20 text-on-surface'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {lossReason === 'Otro' && (
                <textarea 
                  placeholder="Detalla el motivo..."
                  className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant/50 focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                  rows={3}
                  onChange={(e) => setLossReason(e.target.value)}
                />
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowLossReasonModal(false)}
                  className="flex-1 py-3 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={!lossReason || updatingStatus}
                  onClick={() => handleStatusChange('perdido', lossReason)}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingStatus ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  Confirmar Pérdida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
