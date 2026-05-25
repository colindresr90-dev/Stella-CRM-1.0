"use client"

import React from "react"
import { Building2, Globe, Mail, Phone } from "lucide-react"
import { Lead } from "./types"

type LeadCompanyCardProps = {
  lead: Lead
}

export function LeadCompanyCard({ lead }: LeadCompanyCardProps) {
  const getWebsite = () => {
    if (!lead.business_name) return "test.com"
    const sanitized = lead.business_name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "")
    return `${sanitized}.com`
  }

  return (
    <div className="bg-white border-[0.5px] border-slate-200 rounded-[12px] p-3 shadow-none relative overflow-hidden">
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-8 h-8 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
          <Building2 size={14} />
        </div>
        <div className="min-w-0">
          <h5 className="text-[16px] font-semibold text-slate-800 truncate leading-tight mt-0.5">
            {lead.business_name || "Test"}
          </h5>
          <a
            href={`https://${getWebsite()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-semibold text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"
          >
            <Globe size={11} />
            <span className="truncate">{getWebsite()}</span>
          </a>
        </div>
      </div>

      <div className="space-y-1.5 text-[14px]">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Mail size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 truncate text-[15px]" title={lead.email}>
              {lead.email}
            </span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Phone size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 truncate text-[15px]">
              {lead.phone}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
