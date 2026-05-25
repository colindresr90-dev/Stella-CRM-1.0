"use client"

import React, { useState, useMemo } from "react"
import { History, Clock, FileText, File as FileIcon, User, RefreshCw, Calendar, Loader2, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useQuery } from "@tanstack/react-query"
import { Lead, Activity } from "./types"

type ActivityFilter = 'all' | 'note' | 'meeting' | 'file' | 'system';

export function LeadActivities({
  lead,
  onViewAllClick
}: {
  lead: Lead
  onViewAllClick: () => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all')

  // Query activities using TanStack Query
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', lead.id],
    queryFn: async () => {
      // Attempt with join
      const { data: joinData, error: joinError } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!created_by ( name )
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      
      if (!joinError && joinData) {
        return joinData.map((a: any) => ({
          ...a,
          creator: Array.isArray(a.creator) ? a.creator[0] : a.creator
        })) as Activity[]
      }

      if (joinError) {
        console.warn('Initial fetchActivities with join failed, trying fallback:', joinError.message)
      }

      // Fallback
      const { data: plainData, error: plainError } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      
      if (plainError) {
        return []
      }
      return (plainData || []) as Activity[]
    }
  })

  // Filter activities dynamically
  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities
    if (filter === 'note') return activities.filter(a => a.type === 'note')
    if (filter === 'meeting') return activities.filter(a => a.type === 'meeting' || a.type === 'meeting_canceled')
    if (filter === 'file') return activities.filter(a => a.type === 'file')
    if (filter === 'system') {
      return activities.filter(a => !['note', 'meeting', 'meeting_canceled', 'file'].includes(a.type))
    }
    return activities
  }, [activities, filter])

  // Helper to map activity types to colors and icons
  const getActivityMeta = (type: string) => {
    switch (type) {
      case 'status_change':
        return {
          title: 'Cambio de Estado',
          bg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
          icon: <Clock size={12} strokeWidth={2.5} />
        }
      case 'reopen':
      case 'reassignment':
        return {
          title: 'Reasignación',
          bg: 'bg-blue-50 text-blue-600 border-blue-100',
          icon: <User size={12} strokeWidth={2.5} />
        }
      case 'note':
        return {
          title: 'Nota Creada',
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          icon: <FileText size={12} strokeWidth={2.5} />
        }
      case 'file':
        return {
          title: 'Archivo Adjunto',
          bg: 'bg-orange-50 text-orange-600 border-orange-100',
          icon: <FileIcon size={12} strokeWidth={2.5} />
        }
      case 'meeting':
      case 'meeting_canceled':
        return {
          title: 'Cita Agendada',
          bg: 'bg-purple-50 text-purple-600 border-purple-100',
          icon: <Calendar size={12} strokeWidth={2.5} />
        }
      default:
        return {
          title: 'Sistema',
          bg: 'bg-slate-50 text-slate-500 border-slate-100',
          icon: <RefreshCw size={12} strokeWidth={2.5} />
        }
    }
  }

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    }) + " a las " + d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* Activity Timeline Section Header */}
      <div className="flex items-center justify-between pb-1">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Historial de Actividades</h4>
        {activities.length > 0 && (
          <button 
            onClick={onViewAllClick}
            className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest cursor-pointer"
          >
            Ver todo
          </button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {(['all', 'note', 'meeting', 'file', 'system'] as const).map((key) => {
          const labels: Record<ActivityFilter, string> = {
            all: 'Todos',
            note: 'Notas',
            meeting: 'Reuniones',
            file: 'Archivos',
            system: 'Sistema'
          }
          const isActive = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all border ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-100 text-slate-500 hover:text-slate-700 hover:border-slate-200'
              }`}
            >
              {labels[key]}
            </button>
          )
        })}
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:inset-y-0 before:left-2.5 before:w-[1px] before:bg-slate-100 before:pointer-events-none">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={18} />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200/50 rounded-2xl bg-slate-50/20 ml-[-24px]">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {filter === 'all' ? 'Sin actividades registradas' : 'Sin actividades que coincidan con el filtro'}
            </p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const meta = getActivityMeta(activity.type)
            return (
              <div key={activity.id} className="relative z-10">
                {/* Timeline dot icon */}
                <div className={`absolute left-[-21px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                  activity.type === 'note' ? 'bg-emerald-500' :
                  activity.type === 'meeting' ? 'bg-purple-500' :
                  activity.type === 'file' ? 'bg-orange-500' : 'bg-slate-400'
                }`} />

                {/* Activity Card */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-slate-200/80 transition-all flex flex-col gap-1 ml-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ChevronRight size={10} className="text-slate-400 shrink-0" />
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                        {meta.title} {activity.creator?.name ? `por ${activity.creator.name}` : ''}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {formatActivityDate(activity.created_at)}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-600 leading-relaxed mt-1">
                    {activity.description}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
