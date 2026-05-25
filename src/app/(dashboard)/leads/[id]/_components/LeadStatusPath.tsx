"use client"

import React from "react"
import { motion } from "framer-motion"
import { Check, ChevronRight, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react"
import { Lead } from "./types"

type LeadStatusPathProps = {
  lead: Lead
  onStatusChange: (status: string) => void
  onReopenLead: () => void
  isPending: boolean
  reopenLoading: boolean
  userRole: string | null
}

const sequentialStages = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta']

const stageLabels: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  reunión: 'Reunión',
  demo: 'Demo',
  propuesta: 'Propuesta',
  venta: 'Ganado',
  perdido: 'Perdido'
}

export function LeadStatusPath({
  lead,
  onStatusChange,
  onReopenLead,
  isPending,
  reopenLoading,
  userRole
}: LeadStatusPathProps) {
  const currentStatus = lead.status.toLowerCase()
  const isClosedWon = currentStatus === 'venta'
  const isClosedLost = currentStatus === 'perdido'

  // Index of current stage in sequential stages
  const currentStageIndex = sequentialStages.indexOf(currentStatus)

  const handleStageClick = (stage: string) => {
    if (isPending || reopenLoading) return
    if (stage === currentStatus) return
    onStatusChange(stage)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-100 rounded-3xl p-4 flex flex-col md:flex-row items-center gap-4 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
    >
      {/* Title Section */}
      <div className="flex items-center gap-2 shrink-0 self-start md:self-center pl-1">
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Embudo de Ventas</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Fase actual: <span className="text-primary font-black">{stageLabels[currentStatus] || currentStatus}</span>
          </p>
        </div>
      </div>

      {/* Stepper Pipeline Path */}
      <div className="w-full overflow-x-auto flex-nowrap scrollbar-none py-1 flex items-center gap-2 grow md:justify-center px-1">
        {sequentialStages.map((stage, index) => {
          const isCurrent = currentStatus === stage
          
          // Determine if this stage is completed
          let isCompleted = false
          if (isClosedWon) {
            isCompleted = true
          } else if (!isClosedLost && currentStageIndex > index) {
            isCompleted = true
          }

          // Determine if stages are disabled/lost
          const isLostStyle = isClosedLost

          let stageStyle = ""
          if (isCurrent) {
            stageStyle = 'bg-blue-600 text-white border-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.18)]'
          } else if (isCompleted) {
            stageStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200/45 hover:bg-emerald-100/70'
          } else if (isLostStyle) {
            stageStyle = 'bg-slate-100/40 text-slate-400 border-slate-200/20 line-through opacity-45 cursor-not-allowed'
          } else {
            // Future / upcoming stage
            stageStyle = 'bg-slate-50 text-slate-500 border-slate-200/50 hover:bg-slate-100/80 hover:text-slate-800'
          }

          return (
            <React.Fragment key={stage}>
              <button
                onClick={() => !isLostStyle && handleStageClick(stage)}
                disabled={isPending || reopenLoading || isLostStyle}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer select-none shrink-0 ${stageStyle}`}
              >
                {isCompleted ? (
                  <Check size={11} strokeWidth={3} className="text-emerald-600 shrink-0" />
                ) : isCurrent && isPending ? (
                  <Loader2 size={11} className="animate-spin shrink-0" />
                ) : null}
                <span>{stageLabels[stage]}</span>
              </button>

              {index < sequentialStages.length - 1 && (
                <ChevronRight 
                  size={12} 
                  className={`hidden sm:inline-block shrink-0 ${
                    isCompleted ? 'text-emerald-400' : 'text-slate-300'
                  }`} 
                />
              )}
            </React.Fragment>
          )
        })}

        {/* Closed Won Badge */}
        {isClosedWon && (
          <>
            <ChevronRight size={12} className="hidden sm:inline-block shrink-0 text-emerald-400" />
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white border border-emerald-600 rounded-2xl text-xs font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(16,185,129,0.25)] shrink-0 select-none">
              <CheckCircle2 size={12} />
              <span>Ganado</span>
            </div>
            {userRole === 'admin' && (
              <button
                onClick={onReopenLead}
                disabled={reopenLoading}
                className="flex items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0 disabled:opacity-55"
                title="Reabrir Lead"
              >
                {reopenLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              </button>
            )}
          </>
        )}

        {/* Closed Lost Badge */}
        {isClosedLost && (
          <>
            <ChevronRight size={12} className="hidden sm:inline-block shrink-0 text-red-300" />
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white border border-red-650 rounded-2xl text-xs font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(220,38,38,0.25)] shrink-0 select-none">
              <XCircle size={12} />
              <span>Perdido</span>
            </div>
            {userRole === 'admin' && (
              <button
                onClick={onReopenLead}
                disabled={reopenLoading}
                className="flex items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0 disabled:opacity-55"
                title="Reabrir Lead"
              >
                {reopenLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
