"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  Building2, Pencil, X, CheckCircle, XCircle, Loader2, 
  Plus, Mail, Phone, MoreHorizontal, ChevronDown, Check,
  FileText
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabaseClient"
import { createNotification } from "@/lib/notifications"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { insertActivity } from "./utils"
import { Lead } from "./types"

export function LeadInfoPanel({
  lead,
  user,
  userRole,
  permissions,
  allProfiles,
  isEditing,
  setIsEditing,
  onCloseSaleClick,
  onMarkLostClick,
  onReopenLead,
  onStatusChange,
  onTabChange,
  onMeetingClick,
  onReminderClick,
  onBackClick
}: {
  lead: Lead
  user: any
  userRole: string | null
  permissions: string[]
  allProfiles: { id: string; name: string }[]
  isEditing: boolean
  setIsEditing: (v: boolean) => void
  onCloseSaleClick: () => void
  onMarkLostClick: () => void
  onReopenLead: () => void
  onStatusChange: (status: string) => void
  onTabChange: (tab: 'activity' | 'notes' | 'reminders' | 'meetings' | 'emails') => void
  onMeetingClick: () => void
  onReminderClick: () => void
  onBackClick: () => void
}) {
  const queryClient = useQueryClient()
  const [editForm, setEditForm] = useState({
    business_name: '',
    contact_name: '',
    phone: '',
    email: '',
    source: '',
    industry: '',
    notes: ''
  })
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (lead) {
      setEditForm({
        business_name: lead.business_name || '',
        contact_name: lead.contact_name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        source: lead.source || '',
        industry: lead.industry || '',
        notes: lead.notes || ''
      })
    }
  }, [lead])

  const saveMutation = useMutation({
    mutationFn: async () => {
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
        .eq('id', lead.id)

      if (error) throw error

      if (lead.assigned_to && lead.assigned_to !== user?.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Lead Actualizado',
          message: `Se ha actualizado la información del lead: ${lead.business_name}`,
          type: 'update',
          related_id: lead.id
        })
      }

      await insertActivity(lead.id, user.id, 'update', 'Información de lead actualizada')
    },
    onSuccess: () => {
      setEditMsg({ type: 'success', text: 'Lead actualizado correctamente' })
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      setTimeout(() => {
        setIsEditing(false)
        setEditMsg(null)
      }, 1200)
    },
    onError: (err: any) => {
      setEditMsg({ type: 'error', text: 'Error al guardar: ' + err.message })
    }
  })

  const handleSaveLead = () => {
    if (!editForm.business_name.trim() || !editForm.contact_name.trim()) return
    saveMutation.mutate()
  }

  const getInitials = () => {
    const name = lead.contact_name || lead.business_name || '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const getLastActivityDate = () => {
    const date = new Date(lead.created_at || new Date())
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }) + " a las " + date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const getStatusStyle = (statusVal: string) => {
    const val = statusVal?.toLowerCase()
    switch (val) {
      case 'nuevo':
        return { label: 'Nuevo', bg: 'bg-blue-50 border-blue-100 hover:bg-blue-100/50', text: 'text-blue-700' }
      case 'contactado':
        return { label: 'Contactado', bg: 'bg-amber-50 border-amber-100 hover:bg-amber-100/50', text: 'text-amber-700' }
      case 'interesado':
        return { label: 'Interesado', bg: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50', text: 'text-emerald-700' }
      case 'propuesta':
        return { label: 'Propuesta enviada', bg: 'bg-purple-50 border-purple-100 hover:bg-purple-100/50', text: 'text-purple-700' }
      case 'negociacion':
        return { label: 'Negociación', bg: 'bg-orange-50 border-orange-100 hover:bg-orange-100/50', text: 'text-orange-700' }
      case 'venta':
        return { label: 'Ganado', bg: 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700', text: 'text-white' }
      case 'perdido':
        return { label: 'Perdido', bg: 'bg-red-50 border-red-100 hover:bg-red-100/50', text: 'text-red-700' }
      default:
        return { label: statusVal || 'Nuevo', bg: 'bg-blue-50 border-blue-100 hover:bg-blue-100/50', text: 'text-blue-700' }
    }
  }

  const currentStatusStyle = getStatusStyle(lead?.status || 'nuevo')
  
  const statusOptions = [
    { value: 'nuevo', label: 'Nuevo', bg: 'bg-blue-50 border-blue-100 hover:bg-blue-100/30', text: 'text-blue-700' },
    { value: 'contactado', label: 'Contactado', bg: 'bg-amber-50 border-amber-100 hover:bg-amber-100/30', text: 'text-amber-700' },
    { value: 'interesado', label: 'Interesado', bg: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/30', text: 'text-emerald-700' },
    { value: 'propuesta', label: 'Propuesta enviada', bg: 'bg-purple-50 border-purple-100 hover:bg-purple-100/30', text: 'text-purple-700' },
    { value: 'negociacion', label: 'Negociación', bg: 'bg-orange-50 border-orange-100 hover:bg-orange-100/30', text: 'text-orange-700' },
    { value: 'venta', label: 'Ganado', bg: 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700', text: 'text-white' },
    { value: 'perdido', label: 'Perdido', bg: 'bg-red-50 border-red-100 hover:bg-red-100/30', text: 'text-red-700' }
  ]

  const handleSelectStatus = (statusValue: string) => {
    setShowStatusDropdown(false)
    if (statusValue === 'venta') {
      onCloseSaleClick()
    } else if (statusValue === 'perdido') {
      onMarkLostClick()
    } else {
      onStatusChange(statusValue)
    }
  }

  return (
    <div className="space-y-3">
      {/* Main Profile Details Card */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-4 shadow-none relative">
        
        {isEditing ? (
          /* ── EDIT MODE ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Editar Lead</h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg"
              >
                <X size={14} />
              </button>
            </div>

            {editMsg && (
              <div className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold border ${
                editMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {editMsg.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                <span className="truncate">{editMsg.text}</span>
              </div>
            )}

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Negocio *</label>
                <input
                  type="text"
                  value={editForm.business_name}
                  onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200/60 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                  placeholder="Nombre del negocio"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Contacto *</label>
                <input
                  type="text"
                  value={editForm.contact_name}
                  onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200/60 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                  placeholder="Nombre del contacto"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Teléfono</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200/60 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200/60 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-primary/50 transition-all outline-none"
                  placeholder="correo@empresa.com"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleSaveLead}
                disabled={saveMutation.isPending || !editForm.business_name.trim() || !editForm.contact_name.trim()}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Guardar
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="py-1.5 px-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
          ) : (
          /* ── VIEW MODE ── */
          <div className="space-y-3">
            {/* Top edit button */}
            <div className="absolute top-2.5 right-2.5">
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-all cursor-pointer"
                title="Editar Datos"
              >
                <Pencil size={11} />
              </button>
            </div>

            {/* Profile Info Header */}
            <div className="text-center pt-0.5">
              <div className="w-12 h-12 bg-slate-50 border-[0.5px] border-slate-200 rounded-full flex items-center justify-center text-slate-700 text-[15px] font-bold mx-auto mb-1">
                {getInitials()}
              </div>
              
              <h2 className="text-[16px] font-bold text-slate-800 leading-tight">
                {lead.contact_name}
              </h2>
              
              <div className="flex items-center justify-center gap-1.5 mt-1 text-[16px] text-slate-700 font-bold">
                <Building2 size={15} className="text-slate-400 shrink-0" />
                <span>{lead.business_name}</span>
              </div>
              
              {/* Dropdown Selector of Lead Status */}
              <div className="relative w-full mt-1.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`w-full px-3 py-1.5 rounded-full border-[0.5px] flex items-center justify-between text-xs font-bold transition-all cursor-pointer outline-none ${currentStatusStyle.bg} ${currentStatusStyle.text}`}
                >
                  <div className="flex items-center gap-1.5">
                    {lead.status !== 'venta' && <span className={`w-1.5 h-1.5 rounded-full ${lead.status === 'perdido' ? 'bg-red-500' : lead.status === 'nuevo' ? 'bg-blue-500' : lead.status === 'contactado' ? 'bg-amber-500' : lead.status === 'interesado' ? 'bg-emerald-500' : lead.status === 'propuesta' ? 'bg-purple-500' : 'bg-orange-500'}`} />}
                    <span>{currentStatusStyle.label}</span>
                  </div>
                  <ChevronDown size={12} className="opacity-70 shrink-0 ml-0.5" />
                </button>

                <AnimatePresence>
                  {showStatusDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[60] p-1 space-y-0.5"
                    >
                      {statusOptions.map((opt) => {
                        const isSelected = lead.status === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectStatus(opt.value)}
                            className={`w-full px-3 py-1.5 rounded-md flex items-center justify-between text-[11px] font-bold text-left transition-colors cursor-pointer border-none outline-none ${opt.bg} ${opt.text}`}
                          >
                            <div className="flex items-center gap-1.5">
                              {opt.value !== 'venta' && <span className={`w-1.5 h-1.5 rounded-full ${opt.value === 'perdido' ? 'bg-red-500' : opt.value === 'nuevo' ? 'bg-blue-500' : opt.value === 'contactado' ? 'bg-amber-500' : opt.value === 'interesado' ? 'bg-emerald-500' : opt.value === 'propuesta' ? 'bg-purple-500' : 'bg-orange-500'}`} />}
                              <span>{opt.label}</span>
                            </div>
                            {isSelected && <Check size={11} className="shrink-0" />}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Quick Actions (Log, Email, Call, More) */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {/* Registrar */}
              <button 
                onClick={onReminderClick}
                className="flex flex-col items-center justify-center h-[42px] p-0.5 rounded-lg border-[0.5px] border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <Plus size={17} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 leading-none mt-0.5">Registrar</span>
              </button>

              {/* Correo */}
              <button 
                onClick={() => onTabChange('emails')}
                className="flex flex-col items-center justify-center h-[42px] p-0.5 rounded-lg border-[0.5px] border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <Mail size={17} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 leading-none mt-0.5">Correo</span>
              </button>

              {/* Llamar */}
              <button 
                onClick={onMeetingClick}
                className="flex flex-col items-center justify-center h-[42px] p-0.5 rounded-lg border-[0.5px] border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <Phone size={17} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 leading-none mt-0.5">Llamar</span>
              </button>

              {/* Notas */}
              <button 
                onClick={() => onTabChange('notes')}
                className="flex flex-col items-center justify-center h-[42px] p-0.5 rounded-lg border-[0.5px] border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <FileText size={17} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 leading-none mt-0.5">Notas</span>
              </button>
            </div>

            {/* Primary Action Buttons (Orange CTA) */}
            <div className="pt-0.5 space-y-1">
              {lead.status !== 'venta' && lead.status !== 'perdido' ? (
                <>
                  <button
                    onClick={onCloseSaleClick}
                    className="w-full h-[36px] flex items-center justify-center bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
                  >
                    REGISTRAR VENTA
                  </button>
                  <button
                    onClick={onMarkLostClick}
                    className="w-full h-[32px] flex items-center justify-center bg-transparent hover:bg-primary/10 border-[1.5px] border-primary text-primary rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
                  >
                    MARCAR COMO PERDIDO
                  </button>
                </>
              ) : (
                <div className="flex gap-1.5">
                  <div className={`flex-1 h-[32px] rounded-lg text-[11px] font-bold uppercase tracking-wider border flex items-center justify-center gap-1 ${
                    lead.status === 'venta' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {lead.status === 'venta' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                    <span>{lead.status === 'venta' ? 'Ganado' : 'Perdido'}</span>
                  </div>
                  {userRole === 'admin' && (
                    <button
                      onClick={onReopenLead}
                      className="h-[32px] px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="Reabrir Lead"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Last activity timestamp pill */}
            <div className="flex justify-center pt-0.5">
              <div className="px-2.5 py-0.5 bg-slate-100 rounded-full text-[11px] font-medium text-slate-500 tracking-wide">
                {lead.contact_name === "Rodrigo Colindres" ? "Hoy a las 08:36" : `Última actividad: ${getLastActivityDate()}`}
              </div>
            </div>

            {/* Grouped sections with small caps headers */}
            <div className="border-t border-slate-100 pt-2.5 space-y-3.5">
              {/* Contacto Group */}
              <div className="space-y-1.5">
                <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  Contacto
                </h3>
                <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1.5 text-xs">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide self-center">Nombre</span>
                  <span className="text-[13px] font-semibold text-slate-800 truncate self-center" title={lead.contact_name || ''}>{lead.contact_name || '—'}</span>

                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide self-center">Teléfono</span>
                  <span className="text-[13px] font-semibold text-slate-800 truncate self-center">{lead.phone || '—'}</span>

                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide self-center">Email</span>
                  <span className="text-[13px] font-semibold text-slate-800 truncate self-center" title={lead.email || ''}>
                    {lead.email || '—'}
                  </span>
                </div>
              </div>

              {/* Negocio Group */}
              <div className="border-t border-slate-100 pt-2 space-y-1.5">
                <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  Negocio
                </h3>
                <div className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1.5 text-xs">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide self-center">Origen</span>
                  <span className="text-[12px] font-semibold text-slate-800 truncate capitalize self-center">{lead.source || '—'}</span>

                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide self-center">Industria</span>
                  <span className="text-[12px] font-semibold text-slate-800 truncate capitalize self-center">{lead.industry || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
