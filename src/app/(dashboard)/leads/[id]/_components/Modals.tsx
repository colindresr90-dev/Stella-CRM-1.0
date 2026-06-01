"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  X, DollarSign, Loader2, CheckCircle, Pencil, Trash2, Calendar, 
  Video, Play, Download, Eye, File as FileIcon, Clock, History, 
  User as UserIcon, Plus, Upload, XCircle, FileText
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { createNotification } from "@/lib/notifications"
import { insertActivity, PACKAGES, statusOptions, getStatusStyle } from "./utils"
import { Lead, Sale, Meeting, Reminder, FileRecord, Activity } from "./types"
import { useQueryClient, useMutation } from "@tanstack/react-query"

const parseDate = (str: string | null | undefined) => {
  if (!str) return new Date()
  const normalized = str.replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(normalized)
  }
  const hasTimezone = normalized.endsWith('Z') || 
                      normalized.includes('+') || 
                      (normalized.includes('T') && normalized.indexOf('-', normalized.indexOf('T')) !== -1)
  
  return new Date(hasTimezone ? normalized : `${normalized}Z`)
}

// ─── 1. DELETE CONFIRM MODAL ───
export function DeleteConfirmModal({
  title,
  message,
  onConfirm,
  onClose,
  isDeleting
}: {
  title: string
  message: React.ReactNode
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={32} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. SALE REGISTRY / EDIT MODAL ───
export function SaleModal({
  lead,
  user,
  userRole,
  editingSale,
  onClose
}: {
  lead: Lead
  user: any
  userRole: string | null
  editingSale: Sale | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [salePackage, setSalePackage] = useState(editingSale?.package || lead.package || '')
  const [saleCustomName, setSaleCustomName] = useState(editingSale?.custom_name || '')
  const [saleCustomDescription, setSaleCustomDescription] = useState(editingSale?.custom_description || '')
  const [salePrice, setSalePrice] = useState(editingSale ? String(editingSale.total_amount) : lead.sale_price ? String(lead.sale_price) : '')
  const [saleDeposit, setSaleDeposit] = useState(editingSale ? String(editingSale.deposit_amount) : lead.deposit_amount ? String(lead.deposit_amount) : '')
  const [isFullPayment, setIsFullPayment] = useState(editingSale ? editingSale.total_amount === editingSale.deposit_amount : false)
  const [savingSale, setSavingSale] = useState(false)

  const isOther = salePackage === 'Otro'

  const handleSubmit = async () => {
    if (savingSale || !salePackage) return
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
      if (editingSale) {
        // UPDATE MODE
        const { error: saleError } = await supabase
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

        if (saleError) throw saleError

        await insertActivity(lead.id, user.id, 'update', `Venta actualizada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Nuevo Total: $${total.toLocaleString()}`)

        if (lead.assigned_to && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Venta Modificada',
            message: `[${user.email || 'Un compañero'}] actualizó una venta: ${salePackage}`,
            type: 'payment',
            related_id: lead.id
          })
        }
      } else {
        // CREATE MODE
        const { data: newSale, error: saleError } = await supabase
          .from('sales')
          .insert({
            lead_id: lead.id,
            package: salePackage,
            custom_name: isOther ? saleCustomName.trim() : null,
            custom_description: isOther ? saleCustomDescription.trim() : null,
            total_amount: total,
            deposit_amount: deposit,
            pending_amount: pending,
            status: pStatus,
            created_by: user.id
          })
          .select()
          .single()

        if (saleError) throw saleError

        // Update Lead status to 'venta'
        const { error: leadError } = await supabase
          .from('leads')
          .update({
            status: 'venta',
            closed_at: new Date().toISOString()
          })
          .eq('id', lead.id)

        if (leadError) console.warn('Lead status update failed, but sale was recorded:', leadError.message)

        if (lead.assigned_to && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Nueva Venta Registrada',
            message: `Se ha registrado una venta para ${lead.business_name}: ${salePackage}`,
            type: 'sale',
            related_id: lead.id
          })
        }

        if (isFullPayment) {
          await insertActivity(lead.id, user.id, 'sale', `Venta registrada (Pago Completo): ${salePackage}${isOther ? ` (${saleCustomName})` : ''} por $${total.toLocaleString()}`)
        } else {
          await insertActivity(lead.id, user.id, 'sale', `Venta registrada: ${salePackage}${isOther ? ` (${saleCustomName})` : ''}. Total: $${total.toLocaleString()}, Anticipo: $${deposit.toLocaleString()}, Pendiente: $${pending.toLocaleString()}`)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['sales', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      onClose()
    } catch (error: any) {
      alert('Error al registrar la venta: ' + error.message)
    } finally {
      setSavingSale(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{editingSale ? 'Editar Venta' : 'Registrar Venta'}</h3>
              <p className="text-xs text-gray-500">{lead.business_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              onChange={e => setSalePackage(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 bg-gray-50 focus:bg-white transition-colors"
            >
              <option value="" disabled>Seleccionar paquete</option>
              {PACKAGES.map(pkg => (
                <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
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
            onClick={handleSubmit}
            disabled={savingSale || !salePackage || !salePrice || Number(salePrice) <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm shadow-green-200 disabled:opacity-50"
          >
            {savingSale ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Guardar venta
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 3. SALES SUMMARY MODAL ───
export function SalesSummaryModal({
  lead,
  sales,
  user,
  userRole,
  permissions,
  onClose,
  onEditSale,
  onDeleteSale
}: {
  lead: Lead
  sales: Sale[]
  user: any
  userRole: string | null
  permissions: string[]
  onClose: () => void
  onEditSale: (sale: Sale) => void
  onDeleteSale: (sale: Sale) => void
}) {
  const queryClient = useQueryClient()
  const [confirmingSalePayment, setConfirmingSalePayment] = useState<string | null>(null)

  const handleConfirmSalePayment = async (sale: Sale) => {
    if (confirmingSalePayment) return
    if (!confirm(`¿Estás seguro de confirmar el pago total de la venta "${sale.custom_name || sale.package}"?`)) return
    
    setConfirmingSalePayment(sale.id)

    try {
      const { error } = await supabase
        .from('sales')
        .update({
          pending_amount: 0,
          status: 'pagado'
        })
        .eq('id', sale.id)

      if (error) throw error
      
      if (lead.assigned_to && lead.assigned_to !== user?.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Pago Confirmado',
          message: `Se ha confirmado el pago total de la venta "${sale.custom_name || sale.package}" para ${lead.business_name}`,
          type: 'payment',
          related_id: lead.id
        })
      }

      await insertActivity(lead.id, user.id, 'payment_confirmation', `Pago final liquidado para: ${sale.custom_name || sale.package}. Monto del pago: $${sale.pending_amount.toLocaleString()}`)
      
      queryClient.invalidateQueries({ queryKey: ['sales', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
    } catch (error: any) {
      alert('Error al confirmar pago: ' + error.message)
    } finally {
      setConfirmingSalePayment(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight">Historial de Ventas</h3>
            <p className="text-blue-100 text-sm mt-1">{lead.business_name}</p>
          </div>
          <button
            onClick={onClose}
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
                              onClick={() => onEditSale(sale)}
                              className="p-2 hover:bg-blue-50 text-on-surface-variant hover:text-blue-600 rounded-lg transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={() => onDeleteSale(sale)}
                              className="p-2 hover:bg-red-50 text-on-surface-variant hover:text-red-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        <p className="text-lg font-black text-gray-900">${sale.total_amount.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {parseDate(sale.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
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
  )
}

// ─── 4. MEETING CREATION / EDIT MODAL ───
export function MeetingModal({
  lead,
  user,
  editingMeeting,
  meetingForm,
  setMeetingForm,
  onClose
}: {
  lead: Lead
  user: any
  editingMeeting: Meeting | null
  meetingForm: any
  setMeetingForm: React.Dispatch<React.SetStateAction<any>>
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [schedulingMeeting, setSchedulingMeeting] = useState(false)

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

        const { error: mtError } = await supabase
          .from('meetings')
          .update({
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString()
          })
          .eq('id', editingMeeting.id)

        if (mtError) throw mtError

        await insertActivity(lead.id, user.id, 'update', `Reunión actualizada: ${meetingForm.title} (${startDateTime.toLocaleDateString('es-ES')} ${meetingForm.time})`)
        if (meetingForm.email || lead.email) {
          await insertActivity(lead.id, user.id, 'system', 'Correo de actualización de reunión enviado')
        }
        
        if (lead.assigned_to && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Cita Modificada',
            message: `[${user.email || 'Un compañero'}] actualizó la cita: ${meetingForm.title}`,
            type: 'meeting',
            related_id: lead.id
          })
        }

        alert('Reunión actualizada exitosamente')
      } else {
        // CREATE MODE
        const response = await fetch('/api/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            created_by: user.id,
            lead_email: meetingForm.email || lead.email,
            lead_name: lead.contact_name
          })
        })

        const apiResult = await response.json()
        if (!apiResult.success) throw new Error(apiResult.error || 'Error al agendar en Google Calendar')

        const { error: mtError } = await supabase
          .from('meetings')
          .insert({
            lead_id: lead.id,
            title: meetingForm.title,
            description: meetingForm.description,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            google_event_id: apiResult.google_event_id,
            meet_link: apiResult.meet_link,
            created_by: user.id
          })

        if (mtError) throw mtError

        await insertActivity(lead.id, user.id, 'meeting', `Reunión agendada: ${meetingForm.title} (${startDateTime.toLocaleDateString('es-ES')} ${meetingForm.time})`)
        
        if (apiResult.email_sent) {
          await insertActivity(lead.id, user.id, 'system', 'Correo de confirmación de reunión enviado')
        }

        if (lead.assigned_to && lead.assigned_to !== user.id) {
          await createNotification({
            user_id: lead.assigned_to,
            title: 'Nueva Cita Agendada',
            message: `Se ha agendado una cita para ${lead.business_name}: ${meetingForm.title}`,
            type: 'meeting',
            related_id: lead.id
          })
        }

        alert('Reunión agendada exitosamente')
      }

      queryClient.invalidateQueries({ queryKey: ['meetings', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      onClose()
    } catch (err: any) {
      console.error('Error handling meeting submission:', err)
      alert(err.message || 'Error inesperado')
    } finally {
      setSchedulingMeeting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Calendar size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{editingMeeting ? 'Editar Reunión' : 'Agendar Reunión'}</h3>
              <p className="text-xs text-gray-500">{lead.business_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
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
              onClick={onClose}
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
  )
}

// ─── 5. REMINDER CREATION MODAL ───
export function ReminderModal({
  lead,
  user,
  onClose
}: {
  lead: Lead
  user: any
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [reminderForm, setReminderForm] = useState({ date: '', time: '', note: '' })
  const [savingReminder, setSavingReminder] = useState(false)

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lead || savingReminder) return
    setSavingReminder(true)

    try {
      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert({
          lead_id: lead.id,
          date: reminderForm.date,
          time: reminderForm.time || null,
          note: reminderForm.note || null,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      const timeStr = reminderForm.time ? ` a las ${reminderForm.time}` : ''
      await insertActivity(lead.id, user.id, 'meeting', `Recordatorio agregado para ${new Date(reminderForm.date + 'T00:00:00').toLocaleDateString('es-ES')}${timeStr}`)

      queryClient.invalidateQueries({ queryKey: ['reminders', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      onClose()
    } catch (error: any) {
      alert('Error al guardar recordatorio: ' + error.message)
    } finally {
      setSavingReminder(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Calendar size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Configurar Recordatorio</h3>
              <p className="text-xs text-gray-500">{lead.business_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
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
              onClick={onClose}
              className="w-full py-3 text-gray-500 text-xs font-bold hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 6. LOSS REASON MODAL ───
export function LossReasonModal({
  lead,
  user,
  updatingStatus,
  onStatusChange,
  onClose
}: {
  lead: Lead
  user: any
  updatingStatus: boolean
  onStatusChange: (status: string, reason: string) => void
  onClose: () => void
}) {
  const [lossReason, setLossReason] = useState('')
  const [customLossReason, setCustomLossReason] = useState('')

  const handleConfirmLoss = () => {
    const reason = lossReason === 'Otro' ? customLossReason.trim() : lossReason
    if (!reason) {
      alert("Por favor indica el motivo de pérdida.")
      return
    }
    onStatusChange('perdido', reason)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-headline font-bold text-gray-900">Motivo de Pérdida</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Para mejorar nuestra estrategia de ventas, por favor indica por qué se perdió esta oportunidad con <strong>{lead.business_name}</strong>.
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
                    ? 'bg-red-50 border-red-200 text-red-700 font-bold shadow-sm' 
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          {lossReason === 'Otro' && (
            <textarea 
              placeholder="Detalla el motivo..."
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none text-sm resize-none text-black"
              rows={3}
              value={customLossReason}
              onChange={(e) => setCustomLossReason(e.target.value)}
            />
          )}

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={!lossReason || updatingStatus}
              onClick={handleConfirmLoss}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updatingStatus ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Confirmar Pérdida
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 7. FULL ACTIVITIES TIMELINE MODAL ───
export function FullActivityModal({
  lead,
  activities,
  onClose
}: {
  lead: Lead
  activities: Activity[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Historial de Actividad Completo</h3>
              <p className="text-sm text-gray-500">Cronología de interacciones con {lead.business_name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
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
  )
}

// ─── 8. FULL FILES REPOSITORY MODAL ───
export function FullFilesModal({
  lead,
  files,
  uploadingFile,
  fileInputRef,
  generatingUrl,
  user,
  userRole,
  permissions,
  onFileUpload,
  onFileAction,
  onDeleteFile,
  onClose
}: {
  lead: Lead
  files: FileRecord[]
  uploadingFile: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  generatingUrl: string | null
  user: any
  userRole: string | null
  permissions: string[]
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileAction: (file: FileRecord, mode: 'view' | 'download') => void
  onDeleteFile: (file: FileRecord) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
              <FileIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 font-headline">Repositorio de Archivos</h3>
              <p className="text-sm text-gray-500">Documentos, contratos y propuestas asociados a {lead.business_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2">
              {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span>Subir Nuevo</span>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileUpload} disabled={uploadingFile} />
            </label>
            <button 
              onClick={onClose}
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
              <div key={file.id} className="flex items-center gap-5 p-5 bg-white border border-gray-200 rounded-[12px] hover:border-orange-200 hover:shadow-sm transition-all group h-fit">
                <div className="w-16 h-16 shrink-0 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600 shadow-sm group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <FileIcon size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate mb-1" title={file.file_name}>{file.file_name}</p>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                    <span className="text-xs text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      <UserIcon size={12} />
                      {file.profiles?.name || 'Sistema'}
                    </span>
                     <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium italic">
                      <Clock size={12} />
                      {parseDate(file.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => onFileAction(file, 'view')} 
                    disabled={generatingUrl === file.id} 
                    className="p-3 text-orange-600 bg-orange-50 hover:bg-orange-500 hover:text-white rounded-lg transition-all disabled:opacity-50"
                    title="Ver online"
                  >
                    {generatingUrl === file.id ? <Loader2 size={20} className="animate-spin" /> : <Eye size={20} />}
                  </button>
                  <button 
                    onClick={() => onFileAction(file, 'download')} 
                    disabled={generatingUrl === file.id} 
                    className="p-3 text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50"
                    title="Descargar"
                  >
                    <Download size={20} />
                  </button>
                  {(userRole === 'admin' || permissions.includes('manage_lead_content') || file.uploaded_by === user?.id) && (
                    <button 
                      onClick={() => onDeleteFile(file)}
                      className="p-3 text-red-650 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 9. FULL MEETINGS SCHEDULE MODAL ───
export function FullMeetingsModal({
  lead,
  meetings,
  meetingForm,
  setMeetingForm,
  user,
  onCancelMeeting,
  onOpenMeetingModal,
  onClose
}: {
  lead: Lead
  meetings: Meeting[]
  meetingForm: any
  setMeetingForm: React.Dispatch<React.SetStateAction<any>>
  user: any
  onCancelMeeting: (meeting: Meeting) => void
  onOpenMeetingModal: (meeting: Meeting) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Agenda de Reuniones</h3>
              <p className="text-sm text-gray-500">Historial completo y compromisos futuros con {lead.business_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setMeetingForm({ title: '', date: '', time: '', duration: '30', description: '', email: lead.email || '' })
                onOpenMeetingModal(null as any) // Null means create new
              }}
              className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2"
            >
              <Plus size={18} /> Nueva Reunión
            </button>
            <button 
              onClick={onClose}
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
              const isUpcoming = new Date(meeting.start_time) > new Date()
              return (
                <div key={meeting.id} className={`flex items-center gap-5 p-5 border rounded-[2rem] transition-all group h-fit relative ${
                  isUpcoming ? 'bg-purple-50/30 border-purple-100 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-50' : 'bg-gray-50 border-gray-200 opacity-80'
                }`}>
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
                      onClick={() => onOpenMeetingModal(meeting)}
                      className="p-2 text-gray-400 bg-gray-50 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => onCancelMeeting(meeting)}
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
                        {parseDate(meeting.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium italic">
                        <History size={12} />
                        {parseDate(meeting.start_time).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
