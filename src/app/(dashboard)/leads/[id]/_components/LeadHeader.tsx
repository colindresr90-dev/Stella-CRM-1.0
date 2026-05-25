"use client"

import React from "react"
import { ArrowLeft, Pencil, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react"
import { getStatusStyle } from "./utils"
import { Lead } from "./types"

type LeadHeaderProps = {
  lead: Lead
  isEditing: boolean
  setIsEditing: (v: boolean) => void
  userRole: string | null
  onCloseSaleClick: () => void
  onMarkLostClick: () => void
  onReopenLead: () => void
  reopenLoading: boolean
  onBackClick: () => void
}

export function LeadHeader({
  lead,
  isEditing,
  setIsEditing,
  userRole,
  onCloseSaleClick,
  onMarkLostClick,
  onReopenLead,
  reopenLoading,
  onBackClick
}: LeadHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Breadcrumb / Back button */}
      <div>
        <button 
          onClick={onBackClick}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft size={12} /> Volver a Leads
        </button>
      </div>

      {/* Main Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-primary to-primary-container rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary/10">
            {lead.business_name ? lead.business_name.slice(0, 2).toUpperCase() : '?'}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight font-headline">
                {lead.business_name}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${getStatusStyle(lead.status)}`}>
                {lead.status}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Contacto principal: <span className="font-bold text-slate-700">{lead.contact_name}</span>
            </p>
          </div>
        </div>

        {/* Action buttons at the top right */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border cursor-pointer shadow-sm ${
              isEditing 
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' 
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Pencil size={12} /> {isEditing ? 'Ver Detalles' : 'Editar'}
          </button>

          {lead.status !== 'venta' && lead.status !== 'perdido' ? (
            <>
              <button
                onClick={onCloseSaleClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 cursor-pointer"
              >
                <CheckCircle size={14} />
                <span>Registrar Venta</span>
              </button>
              <button
                onClick={onMarkLostClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm"
              >
                <XCircle size={14} />
                <span>Perdido</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                lead.status === 'venta' 
                  ? 'bg-green-50 text-green-700 border-green-200' 
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {lead.status === 'venta' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>{lead.status === 'venta' ? 'Ganado' : 'Perdido'}</span>
              </div>

              {userRole === 'admin' && (
                <button 
                  onClick={onReopenLead}
                  disabled={reopenLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {reopenLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Reabrir Lead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
