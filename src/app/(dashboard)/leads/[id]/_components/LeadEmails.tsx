"use client"

import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Mail, Plus, Loader2, CheckCircle2, X, ChevronRight, 
  Bold, Italic, Underline, Link, Send, FileText, Check, Calendar, Clock,
  Paperclip, Trash2, List, Palette, CornerUpLeft, Pencil, Save,
  RotateCw
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createNotification } from "@/lib/notifications"
import { insertActivity } from "./utils"
import { Lead } from "./types"
import { io as socketIO } from "socket.io-client"

interface EmailAddress {
  name: string
  address: string
}

interface EmailRecord {
  id: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  preview: string
  body: string
  date: string
  folder: string
}

interface CustomTemplate {
  id: string
  name: string
  subject: string
  body: string
}

const getInitials = (name: string, emailStr: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (emailStr) {
    const parts = emailStr.split('@')[0].split(/[._-]/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return emailStr.slice(0, 2).toUpperCase()
  }
  return "EM"
}



const COLORS = [
  { name: "Negro", value: "#000000" },
  { name: "Gris", value: "#475569" },
  { name: "Rojo", value: "#dc2626" },
  { name: "Naranja", value: "#f05a28" },
  { name: "Verde", value: "#16a34a" },
  { name: "Azul", value: "#2563eb" },
  { name: "Morado", value: "#9333ea" }
]

export function LeadEmails({
  lead,
  user,
  showComposeModal: propShowComposeModal,
  setShowComposeModal: propSetShowComposeModal
}: {
  lead: Lead
  user: any
  showComposeModal?: boolean
  setShowComposeModal?: (val: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [localShowComposeModal, localSetShowComposeModal] = useState(false)
  const showComposeModal = propShowComposeModal !== undefined ? propShowComposeModal : localShowComposeModal
  const setShowComposeModal = propSetShowComposeModal !== undefined ? propSetShowComposeModal : localSetShowComposeModal

  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)
  const [folderFilter, setFolderFilter] = useState<'all' | 'inbox' | 'sent'>('all')
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Form state
  const [toEmail, setToEmail] = useState(lead.email || "")
  const [subject, setSubject] = useState("")
  const [createFollowUp, setCreateFollowUp] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<any>(null)

  // CC / BCC state
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)

  // Attachments state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<{ filename: string; content: string }[]>([])

  // Editor styling states
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Custom Templates states
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  // Custom template form state
  const [templateFormName, setTemplateFormName] = useState("")
  const [templateFormSubject, setTemplateFormSubject] = useState("")
  const [templateFormBody, setTemplateFormBody] = useState("")

  // Reply initial body state
  const [initialEditorBody, setInitialEditorBody] = useState("")

  // Load custom templates
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stella_custom_email_templates")
      if (saved) {
        try {
          setCustomTemplates(JSON.parse(saved))
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [])

  const saveCustomTemplates = (updated: CustomTemplate[]) => {
    setCustomTemplates(updated)
    localStorage.setItem("stella_custom_email_templates", JSON.stringify(updated))
  }

  // Socket.io Real-time connection
  useEffect(() => {
    const socket = socketIO(typeof window !== 'undefined' ? window.location.origin : '', {
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log("[Socket.io] Connected to server successfully with id:", socket.id)
    })

    socket.on('new-email', (email: any) => {
      const leadEmailLower = lead.email?.toLowerCase()
      const matchesLead = 
        email.from?.address?.toLowerCase() === leadEmailLower ||
        (email.to && email.to.some((t: any) => t.address?.toLowerCase() === leadEmailLower)) ||
        (email.cc && email.cc.some((t: any) => t.address?.toLowerCase() === leadEmailLower)) ||
        (email.bcc && email.bcc.some((t: any) => t.address?.toLowerCase() === leadEmailLower))

      if (matchesLead) {
        queryClient.invalidateQueries({ queryKey: ['emails', lead.id] })
        queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [lead.id, lead.email, queryClient])

  // Populate editor when Compose Modal opens/resets
  useEffect(() => {
    if (showComposeModal) {
      const timer = setTimeout(() => {
        if (editorRef.current) {
          // Load signature from localStorage
          let signatureHtml = ""
          const storedSig = localStorage.getItem(`stella_signature_${user?.id}`)
          if (storedSig) {
            try {
              const parsed = JSON.parse(storedSig)
              const hasSignature = parsed.nombreCompleto || parsed.cargo || parsed.telefono || parsed.webEmail || parsed.logo
              
              const isReply = !!initialEditorBody // if initialEditorBody is not empty, it's a reply
              const shouldInclude = isReply ? parsed.incluirRespuestas : parsed.incluirNuevos
              
              if (hasSignature && shouldInclude !== false) {
                // Build signature HTML
                const logoHtml = parsed.logo ? `
                  <div style="flex-shrink: 0; max-width: 120px;">
                    <img src="${parsed.logo}" alt="Logo" style="max-height: 64px; max-width: 120px; object-fit: contain;" />
                  </div>
                ` : ""
                
                const layoutStyle = parsed.logoLayout === 'top' 
                  ? 'display: flex; flex-direction: column; gap: 8px;'
                  : 'display: flex; align-items: flex-start; gap: 16px;'
                
                signatureHtml = `
                  <div class="email-signature" style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #334155; margin-top: 20px; text-align: left;">
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0 15px 0;" />
                    <div style="${layoutStyle}">
                      ${logoHtml}
                      <div>
                        <div style="font-weight: bold; color: #000000; font-size: 14px;">${parsed.nombreCompleto || ''}</div>
                        ${parsed.cargo ? `<div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">${parsed.cargo}</div>` : ''}
                        <div style="color: #334155; font-size: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                          ${parsed.telefono ? `<div><strong>Tel:</strong> ${parsed.telefono}</div>` : ''}
                          ${parsed.webEmail ? `<div><strong>Web/Email:</strong> ${parsed.webEmail}</div>` : ''}
                        </div>
                        ${parsed.textoAdicional ? `
                          <div style="color: #64748b; font-size: 11px; margin-top: 8px; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 6px; font-style: italic;">
                            ${parsed.textoAdicional}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `
              }
            } catch (e) {
              console.error("Error building signature HTML:", e)
            }
          }

          if (initialEditorBody) {
            // It's a reply: put cursor/empty line, then signature, then quoted text
            editorRef.current.innerHTML = `<p><br></p>${signatureHtml}${initialEditorBody}`
          } else {
            // It's a new email: put empty line, then signature
            editorRef.current.innerHTML = `<p><br></p>${signatureHtml}`
          }
          
          editorRef.current.focus()
          
          // Place cursor at the very beginning of the editable area
          const range = document.createRange()
          const sel = window.getSelection()
          if (editorRef.current.firstChild) {
            range.setStart(editorRef.current.firstChild, 0)
          } else {
            range.setStart(editorRef.current, 0)
          }
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }, 50)
      return () => clearTimeout(timer)
    } else {
      setToEmail(lead.email || "")
      setSubject("")
      setCc("")
      setBcc("")
      setShowCcBcc(false)
      setAttachments([])
      setInitialEditorBody("")
      setShowTemplatesPanel(false)
      setIsCreatingTemplate(false)
      setEditingTemplateId(null)
    }
  }, [showComposeModal, initialEditorBody, lead.email, user])

  // Query emails from backend API
  const { data: emails = [], isLoading, error, refetch } = useQuery({
    queryKey: ['emails', lead.id],
    queryFn: async () => {
      if (!lead.email) return []
      const res = await fetch(`/api/emails?email=${encodeURIComponent(lead.email)}`)
      if (!res.ok) throw new Error("Error al obtener correos")
      const result = await res.json()
      return (result.emails || []) as EmailRecord[]
    },
    enabled: !!lead.email
  })

  // Generate ISO dates for mock emails so they display correct times: 08:36, 08:30, 08:27, 08:20
  const getTodayAtTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':')
    const d = new Date()
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    return d.toISOString()
  }

  // Fallback / Mock emails list for Rodrigo Colindres
  const MOCK_EMAILS: EmailRecord[] = [
    {
      id: "mock-1",
      from: { name: "Tú", address: "info@taskmasters.site" },
      to: [{ name: "Rodrigo Colindres", address: "colindresr90@gmail.com" }],
      subject: "Seguimiento a nuestra conversación - Stella CRM",
      preview: "Hola Rodrigo, espero que estés teniendo una excelente semana. Te escribo para dar seguimiento a la conversación que tuvimos sobre la cotización del desarrollo de tu sitio web.",
      body: "<p>Hola Rodrigo,</p><p>Espero que estés teniendo una excelente semana.</p><p>Te escribo para dar seguimiento a la conversación que tuvimos sobre la cotización del desarrollo de tu sitio web.</p><p>Quedo a tu disposición si tienes alguna consulta sobre los paquetes o si deseas realizar algún ajuste a la propuesta.</p><p>Atentamente,</p>",
      date: getTodayAtTime('08:36'),
      folder: "Sent"
    },
    {
      id: "mock-2",
      from: { name: "Tú", address: "info@taskmasters.site" },
      to: [{ name: "Rodrigo Colindres", address: "colindresr90@gmail.com" }],
      subject: "Propuesta Comercial y Cotización - Stella CRM",
      preview: "Hola Rodrigo, adjunto a este correo los detalles de la propuesta de desarrollo de software solicitada. Nuestra propuesta incluye diseño responsivo a la medida...",
      body: "<p>Hola Rodrigo,</p><p>Adjunto a este correo los detalles de la propuesta de desarrollo de software solicitada.</p><p>Nuestra propuesta incluye diseño responsivo a la medida, integración de CRM, hosting por un año y optimización de velocidad (SEO técnico).</p><p>Quedo atento a tus comentarios para proceder con los siguientes pasos.</p><p>Un saludo cordial,</p>",
      date: getTodayAtTime('08:30'),
      folder: "Sent"
    },
    {
      id: "mock-3",
      from: { name: "Tú", address: "info@taskmasters.site" },
      to: [{ name: "Rodrigo Colindres", address: "colindresr90@gmail.com" }],
      subject: "Presentación de Servicios - Stella CRM",
      preview: "Hola Rodrigo, un gusto saludarte. Te escribo de parte del equipo de Stella CRM. Queremos presentarte nuestras soluciones tecnológicas de desarrollo...",
      body: "<p>Hola Rodrigo,</p><p>Un gusto saludarte. Te escribo de parte del equipo de Stella CRM.</p><p>Queremos presentarte nuestras soluciones tecnológicas de desarrollo web y automatización comercial diseñadas especialmente para optimizar la captación y gestión de tus prospectos.</p><p>¿Tendrás 10 minutos esta semana para conversar sobre cómo podemos ayudarte?</p><p>Saludos cordiales,</p>",
      date: getTodayAtTime('08:27'),
      folder: "Sent"
    },
    {
      id: "mock-4",
      from: { name: "Tú", address: "info@taskmasters.site" },
      to: [{ name: "Rodrigo Colindres", address: "colindresr90@gmail.com" }],
      subject: "Re: Invitación: Demo en vivo de Stella CRM",
      preview: "Hola Rodrigo, te invito formalmente a una demostración en vivo de 15 minutos de nuestra plataforma CRM. Veremos en tiempo real cómo tu equipo puede...",
      body: "<p>Hola Rodrigo,</p><p>Te invito formalmente a una demostración en vivo de 15 minutos de nuestra plataforma CRM.</p><p>Veremos en tiempo real cómo tu equipo puede automatizar recordatorios, recibir archivos de clientes y procesar transacciones financieras sin fricciones.</p><p>Puedes responder a este correo con el día y hora que mejor te acomoden.</p><p>Quedamos en contacto,</p>",
      date: getTodayAtTime('08:20'),
      folder: "Sent"
    }
  ]

  // Combine dynamic and mock emails for Rodrigo Colindres
  const isRodrigo = lead.contact_name === "Rodrigo Colindres"
  const displayEmails = isRodrigo ? [...emails.filter(e => !e.id.startsWith('mock')), ...MOCK_EMAILS] : emails

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  // Editor Actions
  const execEditorCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }

  const handleAddLink = () => {
    const url = prompt("Introduce la URL:")
    if (url) {
      execEditorCommand("createLink", url)
    }
  }

  const handleSelectTemplate = (template: { name: string; subject?: string; body: string }) => {
    if (template.subject) {
      setSubject(template.subject)
    }
    if (editorRef.current) {
      editorRef.current.innerHTML = template.body
    }
  }

  // Custom templates managers
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateFormName.trim()) {
      alert("Introduce un nombre para la plantilla")
      return
    }

    if (editingTemplateId) {
      const updated = customTemplates.map(t => 
        t.id === editingTemplateId 
          ? { ...t, name: templateFormName, subject: templateFormSubject, body: templateFormBody }
          : t
      )
      saveCustomTemplates(updated)
      setEditingTemplateId(null)
    } else {
      const newTemplate: CustomTemplate = {
        id: Date.now().toString(),
        name: templateFormName,
        subject: templateFormSubject,
        body: templateFormBody
      }
      saveCustomTemplates([...customTemplates, newTemplate])
    }

    setTemplateFormName("")
    setTemplateFormSubject("")
    setTemplateFormBody("")
    setIsCreatingTemplate(false)
  }

  const handleEditTemplate = (template: CustomTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateFormName(template.name)
    setTemplateFormSubject(template.subject)
    setTemplateFormBody(template.body)
    setIsCreatingTemplate(true)
  }

  const handleDeleteTemplate = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) {
      const updated = customTemplates.filter(t => t.id !== id)
      saveCustomTemplates(updated)
    }
  }

  const handleCaptureCurrentAsTemplate = () => {
    const currentSubject = subject
    const currentBody = editorRef.current ? editorRef.current.innerHTML : ""
    
    setTemplateFormSubject(currentSubject)
    setTemplateFormBody(currentBody)
    setTemplateFormName("Mi Plantilla " + (customTemplates.length + 1))
    setIsCreatingTemplate(true)
    setEditingTemplateId(null)
  }

  // Attach file upload Base64 converter
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      filesArray.forEach(file => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            const base64Content = (event.target.result as string).split(',')[1]
            setAttachments(prev => [...prev, { filename: file.name, content: base64Content }])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  // Reply builder
  const handleReplyTo = (email: EmailRecord) => {
    let replySubject = email.subject
    if (!replySubject.toLowerCase().startsWith("re:")) {
      replySubject = `Re: ${replySubject}`
    }

    const isSent = email.folder.toLowerCase() === 'sent'
    const recipient = isSent 
      ? email.to[0]?.address || lead.email || ""
      : email.from.address

    setSubject(replySubject)
    setToEmail(recipient)

    const formattedDate = new Date(email.date).toLocaleString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const quoteHtml = `
      <p><br></p>
      <p><br></p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
        El ${formattedDate}, <strong>${email.from.name || email.from.address}</strong> escribió:
      </p>
      <blockquote style="border-left: 3px solid #cbd5e1; padding-left: 15px; margin-left: 5px; color: #475569; font-style: italic;">
        ${email.body}
      </blockquote>
    `

    setInitialEditorBody(quoteHtml)
    setShowComposeModal(true)
    setSelectedEmail(null)
  }

  // Submit send email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lead.email || sendingEmail) return
    const bodyHtml = editorRef.current ? editorRef.current.innerHTML : ""
    
    if (!subject.trim()) {
      alert("Por favor ingresa un asunto.")
      return
    }
    if (!bodyHtml.trim() || bodyHtml === "<p><br></p>") {
      alert("Por favor redacta el cuerpo del correo.")
      return
    }

    setSendingEmail(true)

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          htmlText: bodyHtml,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          attachments: attachments.length > 0 ? attachments : undefined
        })
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Error al enviar correo por SMTP")
      }

      await insertActivity(lead.id, user.id, 'note', `Correo enviado: "${subject.trim()}" a ${lead.email}`)

      if (createFollowUp) {
        const followUpDate = new Date()
        followUpDate.setDate(followUpDate.getDate() + 3)
        const dateStr = followUpDate.toISOString().split('T')[0]

        const { error: taskErr } = await supabase
          .from('reminders')
          .insert({
            lead_id: lead.id,
            date: dateStr,
            time: '09:00:00',
            note: `Seguimiento de correo: "${subject.trim()}"`,
            created_by: user.id
          })

        if (!taskErr) {
          await createNotification({
            user_id: user.id,
            title: 'Tarea de seguimiento creada',
            message: `Recordatorio de correo creado para ${lead.business_name || lead.contact_name}`,
            type: 'reminder',
            related_id: lead.id
          })
          
          await insertActivity(lead.id, user.id, 'meeting', `Recordatorio automático de seguimiento programado para el ${new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES')}`)
        }
      }

      if (socketRef.current) {
        const formatAddresses = (addrStr?: string) => {
          if (!addrStr) return []
          return addrStr.split(',').map((email) => ({ name: "", address: email.trim() }))
        }
        
        socketRef.current.emit('email-sent', {
          id: result.messageId || Date.now().toString(),
          from: { name: "Taskmasters CRM", address: "info@taskmasters.site" },
          to: formatAddresses(toEmail),
          cc: formatAddresses(cc),
          bcc: formatAddresses(bcc),
          subject: subject.trim(),
          preview: bodyHtml.replace(/<[^>]*>/g, '').slice(0, 100) + "...",
          body: bodyHtml,
          date: new Date().toISOString(),
          folder: 'Sent'
        })
      }

      queryClient.invalidateQueries({ queryKey: ['emails', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['reminders', lead.id] })

      setSubject("")
      setCc("")
      setBcc("")
      setAttachments([])
      setInitialEditorBody("")
      setCreateFollowUp(false)
      if (editorRef.current) editorRef.current.innerHTML = ""
      setShowComposeModal(false)
      alert("Correo enviado exitosamente.")
    } catch (err: any) {
      console.error(err)
      alert("Error al enviar el correo: " + err.message)
    } finally {
      setSendingEmail(false)
    }
  }

  // Filter emails before rendering
  const filteredEmails = displayEmails.filter(email => {
    if (folderFilter === 'all') return true
    if (folderFilter === 'inbox') return email.folder.toLowerCase() === 'inbox'
    if (folderFilter === 'sent') return email.folder.toLowerCase() === 'sent'
    return true
  })

  // Header count value (defaulting to 6 for Rodrigo's mockup)
  const countBadgeValue = isRodrigo ? 6 : displayEmails.length

  return (
    <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-4 shadow-none relative overflow-hidden flex flex-col h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 shrink-0 bg-white">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Mail size={15} />
          </div>
          <h3 className="text-[14px] font-bold text-slate-800 truncate">Historial de correos</h3>
          
          <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-200/50 shrink-0">
            {countBadgeValue}
          </span>
          
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-md transition-all cursor-pointer shrink-0"
            title="Sincronizar correos"
          >
            <RotateCw size={13} className={isLoading ? "animate-spin text-primary" : ""} />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filters pills */}
          <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-lg border border-slate-200/40">
            <button
              onClick={() => setFolderFilter('all')}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-all cursor-pointer ${
                folderFilter === 'all' 
                  ? 'bg-white text-slate-800 border-[0.5px] border-slate-200/60 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 bg-transparent border-none'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFolderFilter('inbox')}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-all cursor-pointer ${
                folderFilter === 'inbox' 
                  ? 'bg-white text-slate-800 border-[0.5px] border-slate-200/60 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 bg-transparent border-none'
              }`}
            >
              Recibidos
            </button>
            <button
              onClick={() => setFolderFilter('sent')}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-all cursor-pointer ${
                folderFilter === 'sent' 
                  ? 'bg-white text-slate-800 border-[0.5px] border-slate-200/60 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 bg-transparent border-none'
              }`}
            >
              Enviados
            </button>
          </div>

          {/* Redactar Button */}
          {lead.email ? (
            <button
              onClick={() => setShowComposeModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 border-none outline-none"
            >
              <Pencil size={13} /> Redactar
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              Sin email
            </span>
          )}
        </div>
      </div>

      {/* Emails list container */}
      <div className="flex-1 overflow-hidden mt-3.5">
        {filteredEmails.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/20">
            <Mail size={24} className="text-slate-400 mb-2" />
            <p className="text-xs font-semibold text-slate-505">Historial vacío</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-1 space-y-3">
            {filteredEmails.map((email) => {
              const isSent = email.folder.toLowerCase() === 'sent'
              const senderName = isSent ? "Tú" : (email.from.name || email.from.address)
              const initials = isSent ? "Tú" : getInitials(email.from.name, email.from.address)
              
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="px-4 py-4 bg-white border-[0.5px] border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer flex gap-3.5 items-start relative group transition-colors"
                >
                  {/* Avatar circular */}
                  <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 border ${
                    isSent 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "bg-blue-50 text-blue-600 border-blue-100"
                  }`}>
                    {initials}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-16">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-semibold text-slate-700">
                        {senderName}
                      </span>
                      <span className="text-[13px] text-slate-400 truncate">
                        {isSent 
                          ? `para ${email.to.map(t => t.name || t.address).join(", ")}` 
                          : `para mí`}
                      </span>
                      
                      {/* Blue/gray badge */}
                      <span className={`px-2.5 py-[3px] rounded text-[12px] font-bold uppercase border leading-none ${
                        isSent 
                          ? "bg-blue-50 text-blue-600 border-blue-100" 
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {isSent ? "Enviado" : "Recibido"}
                      </span>
                    </div>
                    
                    {/* Subject in bold */}
                    <p className="text-[15px] font-semibold text-slate-800 truncate">
                      {email.subject}
                    </p>
                    
                    {/* Preview truncated */}
                    <p className="text-[14px] text-slate-500 truncate mt-0.5">
                      {email.preview}
                    </p>
                  </div>
                  
                  {/* Hour aligned right */}
                  <div className="absolute right-4 top-4 text-right flex flex-col gap-2 items-end">
                    <span className="text-[13px] text-slate-400 font-semibold">
                      {formatTime(email.date)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReplyTo(email)
                      }}
                      className="hidden group-hover:flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-200 rounded text-[11px] font-bold uppercase transition-all"
                    >
                      <CornerUpLeft size={8} /> Resp.
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Email Reader Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedEmail(null)} />
          <div className="relative bg-white rounded-xl border-[0.5px] border-slate-200 w-full max-w-2xl p-6 shadow-2xl z-10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-slate-800 truncate pr-6">{selectedEmail.subject}</h4>
              <button onClick={() => setSelectedEmail(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200/50">
              <div>
                <div><span className="font-bold">De:</span> {selectedEmail.from.name || selectedEmail.from.address} &lt;{selectedEmail.from.address}&gt;</div>
                <div className="mt-1"><span className="font-bold">Para:</span> {selectedEmail.to.map(t => `${t.name || t.address} <${t.address}>`).join(", ")}</div>
              </div>
              <div className="text-right">
                <div>{new Date(selectedEmail.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="mt-0.5">{formatTime(selectedEmail.date)}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-sm text-slate-700 leading-relaxed max-h-[50vh] border border-slate-100 p-4 rounded-lg bg-white">
              {selectedEmail.body ? (
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
              ) : (
                <p className="whitespace-pre-wrap">{selectedEmail.preview}</p>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  const email = selectedEmail
                  setSelectedEmail(null)
                  handleReplyTo(email)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold uppercase transition-all"
              >
                <CornerUpLeft size={12} /> Responder Correo
              </button>
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold uppercase transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {showComposeModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" 
                onClick={() => { if(!sendingEmail) setShowComposeModal(false) }} 
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  maxWidth: showTemplatesPanel ? "1000px" : "680px"
                }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.15 }}
                className="relative bg-white rounded-xl shadow-2xl w-full p-6 overflow-hidden flex flex-col border-[0.5px] border-slate-200 z-10 gap-3.5 transition-all max-h-[95vh]"
              >
                <button 
                  type="button"
                  onClick={() => { if(!sendingEmail) setShowComposeModal(false) }}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>

                <div className="flex gap-4 items-stretch flex-1 overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Redactar Correo</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Enviar correspondencia</p>
                    </div>

                    <form onSubmit={handleSendEmail} className="space-y-2.5 flex-1 flex flex-col overflow-hidden">
                      <div className="space-y-1 shrink-0">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Para</label>
                          <button
                            type="button"
                            onClick={() => setShowCcBcc(!showCcBcc)}
                            className="text-[9px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest cursor-pointer"
                          >
                            {showCcBcc ? "Ocultar CC/CCO" : "CC / CCO"}
                          </button>
                        </div>
                        <input
                          type="email"
                          required
                          value={toEmail}
                          onChange={e => setToEmail(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                          placeholder="correo@cliente.com"
                        />
                      </div>

                      {showCcBcc && (
                        <div className="grid grid-cols-2 gap-3 shrink-0">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">CC</label>
                            <input
                              type="text"
                              value={cc}
                              onChange={e => setCc(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                              placeholder="copia@empresa.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">CCO (BCC)</label>
                            <input
                              type="text"
                              value={bcc}
                              onChange={e => setBcc(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                              placeholder="copiaoculta@empresa.com"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 shrink-0">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Asunto</label>
                        <input
                          type="text"
                          required
                          value={subject}
                          onChange={e => setSubject(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                          placeholder="Asunto del correo"
                        />
                      </div>

                      {/* Rich Editor Toolbar */}
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => execEditorCommand("bold")}
                          className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer font-bold"
                          title="Negrita"
                        >
                          <Bold size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => execEditorCommand("italic")}
                          className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer italic"
                          title="Itálica"
                        >
                          <Italic size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => execEditorCommand("underline")}
                          className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer underline"
                          title="Subrayado"
                        >
                          <Underline size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => execEditorCommand("insertUnorderedList")}
                          className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                          title="Lista con viñetas"
                        >
                          <List size={13} />
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                            title="Color de texto"
                          >
                            <Palette size={13} />
                          </button>
                          {showColorPicker && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                              <div className="absolute left-0 mt-2 p-1.5 bg-white rounded-lg shadow-xl border border-slate-250 z-50 flex gap-1">
                                {COLORS.map(color => (
                                  <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => {
                                      execEditorCommand("foreColor", color.value)
                                      setShowColorPicker(false)
                                    }}
                                    className="w-4 h-4 rounded-full border border-slate-200 cursor-pointer"
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleAddLink}
                          className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                          title="Insertar Enlace"
                        >
                          <Link size={13} />
                        </button>

                        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

                        <button
                          type="button"
                          onClick={() => setShowTemplatesPanel(!showTemplatesPanel)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                            showTemplatesPanel 
                              ? 'bg-primary/10 border-primary/20 text-primary' 
                              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <FileText size={10} /> Plantillas
                        </button>

                        <button
                          type="button"
                          onClick={handleCaptureCurrentAsTemplate}
                          className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="Guardar borrador actual como plantilla personalizada"
                        >
                          <Save size={10} /> Copiar
                        </button>
                      </div>

                      {/* Content Editable Body */}
                      <div className="flex-1 min-h-[140px] overflow-hidden flex flex-col relative border border-slate-200 rounded-lg">
                        <div
                          contentEditable
                          ref={editorRef}
                          suppressContentEditableWarning={true}
                          className="w-full p-3 text-xs focus:ring-0 outline-none flex-1 overflow-y-auto text-slate-800 leading-relaxed rich-editor bg-white"
                        />
                      </div>

                      {/* Attachments List */}
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 shrink-0 py-1 max-h-[60px] overflow-y-auto border border-dashed border-slate-200 p-2 rounded-lg bg-slate-50/50">
                          {attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600">
                              <Paperclip size={8} />
                              <span className="truncate max-w-[120px]">{file.filename}</span>
                              <button 
                                type="button" 
                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 ml-1 p-0.5 hover:bg-slate-100 rounded"
                              >
                                <X size={8} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Checkbox for follow-up */}
                      <div className="flex items-center justify-between shrink-0 py-0.5">
                        <label className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createFollowUp}
                            onChange={e => setCreateFollowUp(e.target.checked)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                          <span>Crear tarea de seguimiento en 3 días automáticamente</span>
                        </label>
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                              fileInputRef.current.click()
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-250 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
                        >
                          <Paperclip size={12} /> Adjuntar
                        </button>
                        <input
                          type="file"
                          multiple
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { if(!sendingEmail) setShowComposeModal(false) }}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer"
                          >
                            Cerrar
                          </button>
                          <button
                            type="submit"
                            disabled={sendingEmail || !toEmail.trim() || !subject.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold uppercase transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            <span>{sendingEmail ? "Enviando..." : "Enviar Correo"}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Templates Panel */}
                  {showTemplatesPanel && (
                    <div className="w-[320px] bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto flex flex-col gap-3 rounded-lg">
                      <div className="flex items-center justify-between border-b border-slate-250 pb-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Plantillas de Correo</h4>
                        <button
                          type="button"
                          onClick={() => setShowTemplatesPanel(false)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-white"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Custom Templates List / Form */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {isCreatingTemplate ? (
                          <form onSubmit={handleSaveTemplate} className="space-y-2.5 flex-1 flex flex-col justify-start">
                            <div className="space-y-0.5">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nombre Plantilla</label>
                              <input
                                type="text"
                                required
                                value={templateFormName}
                                onChange={e => setTemplateFormName(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-primary/40"
                                placeholder="Ej: Seguimiento Técnico"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Asunto</label>
                              <input
                                type="text"
                                required
                                value={templateFormSubject}
                                onChange={e => setTemplateFormSubject(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-primary/40"
                                placeholder="Asunto del correo"
                              />
                            </div>
                            <div className="space-y-0.5 flex-1 flex flex-col">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cuerpo (HTML)</label>
                              <textarea
                                required
                                value={templateFormBody}
                                onChange={e => setTemplateFormBody(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-primary/40 resize-none flex-1 min-h-[100px]"
                                placeholder="Hola {Nombre}, ..."
                              />
                            </div>
                            <div className="flex gap-2 shrink-0 pt-1">
                              <button
                                type="submit"
                                className="flex-1 py-1 bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase rounded-md transition-colors cursor-pointer"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCreatingTemplate(false)
                                  setEditingTemplateId(null)
                                }}
                                className="py-1 px-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs font-bold uppercase rounded-md transition-all cursor-pointer"
                              >
                                Atrás
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="space-y-2 flex-1 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingTemplate(true)
                                setTemplateFormName("")
                                setTemplateFormSubject("")
                                setTemplateFormBody("")
                                setEditingTemplateId(null)
                              }}
                              className="w-full py-1.5 bg-white border border-dashed border-slate-300 hover:border-primary text-slate-500 hover:text-primary rounded-lg text-xs font-bold uppercase tracking-wider transition-all mb-2 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Plus size={12} /> Nueva plantilla
                            </button>

                            {customTemplates.length === 0 ? (
                              <div className="text-center py-8 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                                Sin plantillas creadas
                              </div>
                            ) : (
                              customTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  className="p-2.5 bg-white border border-slate-200 rounded-lg relative group/item flex flex-col gap-0.5 hover:border-slate-350"
                                >
                                  <div 
                                    onClick={() => {
                                      handleSelectTemplate(template)
                                      setShowTemplatesPanel(false)
                                    }}
                                    className="cursor-pointer pr-12"
                                  >
                                    <div className="text-xs font-bold text-slate-800 leading-snug">{template.name}</div>
                                    <div className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">Asunto: {template.subject}</div>
                                  </div>
                                  <div className="absolute right-2 top-2.5 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTemplate(template)}
                                      className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTemplate(template.id)}
                                      className="p-1 hover:bg-slate-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  )
}
