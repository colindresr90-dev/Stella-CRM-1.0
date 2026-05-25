"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Pencil, XCircle, Clock, Video, ChevronRight, MoreVertical } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useQuery } from "@tanstack/react-query"
import { Lead, Meeting } from "./types"

export function LeadMeetings({
  lead,
  user,
  userRole,
  permissions,
  onEditMeetingClick,
  onCancelMeetingClick
}: {
  lead: Lead
  user: any
  userRole: string | null
  permissions: string[]
  onEditMeetingClick: (meeting: Meeting) => void
  onCancelMeetingClick: (meeting: Meeting) => void
}) {
  // Query meetings using TanStack Query
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings', lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', lead.id)
        .order('start_time', { ascending: true })
      
      if (error) throw error
      return (data || []) as Meeting[]
    }
  })

  // State to track expanded meeting IDs
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Record<string, boolean>>({})

  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetingIds(prev => ({
      ...prev,
      [meetingId]: !prev[meetingId]
    }))
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-panel border border-white/40 rounded-3xl overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="absolute top-0 left-0 -ml-10 -mt-10 w-32 h-32 bg-purple-400/20 blur-3xl rounded-full pointer-events-none" />
      <div className="relative z-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-purple-600" />
              <h3 className="text-lg font-bold text-slate-800">Reuniones</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-purple-100">
              Historial de Reuniones
            </span>
          </div>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-slate-400 font-medium">Cargando reuniones...</span>
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center min-h-[140px] border border-dashed border-slate-200/60 rounded-2xl bg-white/30">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Sin reuniones programadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => {
                const isUpcoming = new Date(meeting.start_time) > new Date()
                const expanded = !!expandedMeetingIds[meeting.id]
                
                const meetingDate = new Date(meeting.start_time)
                const formattedDate = meetingDate.toLocaleDateString('es-ES', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })
                const formattedTime = meetingDate.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })

                return (
                  <div 
                    key={meeting.id} 
                    className={`group flex flex-col border rounded-2xl transition-all overflow-hidden bg-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] ${
                      isUpcoming 
                        ? 'border-purple-100 shadow-[0_4px_16px_rgba(147,51,234,0.03)]' 
                        : 'border-slate-100/70 opacity-60'
                    }`}
                  >
                    {/* Header of Accordion Card */}
                    <div 
                      onClick={() => toggleMeetingExpanded(meeting.id)}
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronRight 
                          size={16} 
                          className={`text-slate-400 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`} 
                        />
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                          isUpcoming 
                            ? meeting.meet_link 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-purple-50 text-purple-600 border-purple-100'
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          {meeting.meet_link ? <Video size={14} /> : <Calendar size={14} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate pr-2">
                            {meeting.title}
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {isUpcoming ? 'Reunión pendiente' : 'Reunión finalizada'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                          <Clock size={10} className="opacity-60" />
                          <span>
                            {formattedDate} a las {formattedTime}
                          </span>
                        </div>

                        {/* Quick actions for meeting */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditMeetingClick(meeting)
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar reunión"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('¿Estás seguro de cancelar esta reunión?')) {
                                onCancelMeetingClick(meeting)
                              }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar reunión"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Body of Accordion Card */}
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="border-t border-slate-50 bg-slate-50/20 overflow-hidden"
                        >
                          <div className="p-5 space-y-4 text-xs">
                            {meeting.description ? (
                              <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</span>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {meeting.description}
                                </p>
                              </div>
                            ) : (
                              <p className="text-slate-400 italic">Sin descripción adicional.</p>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-slate-100/50 justify-between items-start sm:items-center">
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Estado: <span className={isUpcoming ? 'text-purple-600' : 'text-slate-500'}>
                                  {isUpcoming ? 'Programada' : 'Pasada'}
                                </span>
                              </div>

                              {meeting.meet_link && isUpcoming && (
                                <a 
                                  href={meeting.meet_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md shadow-purple-100 hover:shadow-lg transition-all"
                                >
                                  <Video size={12} />
                                  Unirse a Google Meet
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

