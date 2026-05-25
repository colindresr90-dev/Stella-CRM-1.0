"use client"

import React, { useState, useRef } from "react"
import { motion } from "framer-motion"
import { File as FileIcon, Upload, Loader2, Eye, Download, Trash2, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { createNotification } from "@/lib/notifications"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { insertActivity } from "./utils"
import { Lead, FileRecord } from "./types"

export function LeadFiles({
  lead,
  user,
  userRole,
  permissions,
  onViewAllClick,
  onDeleteFileClick
}: {
  lead: Lead
  user: any
  userRole: string | null
  permissions: string[]
  onViewAllClick: () => void
  onDeleteFileClick: (file: FileRecord) => void
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  // Query files using TanStack Query
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', lead.id],
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
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return data.map((f: any) => ({
        ...f,
        uploader: Array.isArray(f.uploader) ? f.uploader[0] : f.uploader
      })) as FileRecord[]
    }
  })

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Debes estar autenticado para subir archivos.")

      // Generate unique storage path
      const filePath = `${user.id}/${Date.now()}-${file.name}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lead-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Save file record in database
      const insertPayload = {
        lead_id: lead.id,
        file_name: file.name,
        file_url: uploadData.path,
        uploaded_by: user.id
      }

      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert(insertPayload)
        .select()

      if (dbError) throw dbError

      await insertActivity(lead.id, user.id, 'file', `Archivo subido: ${file.name}`)

      // NOTIFICATION: File Uploaded
      await createNotification({
        user_id: user.id,
        title: 'Archivo Guardado',
        message: `Has subido el archivo: ${file.name}`,
        type: 'update',
        related_id: lead.id
      })

      if (lead.assigned_to && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Nuevo Documento',
          message: `[${user.email || 'Un compañero'}] subió un archivo: ${file.name}`,
          type: 'update',
          related_id: lead.id
        })
      }

      return fileRecord
    },
    onSuccess: (data, file) => {
      setUploadStatus('Archivo subido correctamente')
      queryClient.invalidateQueries({ queryKey: ['files', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
      
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setUploadStatus(null), 3000)
    },
    onError: (err: any) => {
      alert('Error al subir el archivo: ' + err.message)
    }
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadFileMutation.isPending) return
    uploadFileMutation.mutate(file)
  }

  const handleFileAction = async (file: FileRecord, mode: 'view' | 'download') => {
    if (generatingUrl) return
    setGeneratingUrl(file.id)

    let filePath = file.file_url
    if (filePath.includes('/storage/v1/object/public/lead-files/')) {
      filePath = filePath.split('/storage/v1/object/public/lead-files/').pop() || filePath
    }

    try {
      const { data, error } = await supabase.storage
        .from('lead-files')
        .createSignedUrl(filePath, 60, {
          download: mode === 'download' ? file.file_name : false
        })

      if (error) throw error

      if (data?.signedUrl) {
        if (mode === 'view') {
          window.open(data.signedUrl, '_blank')
        } else {
          const link = document.createElement('a')
          link.href = data.signedUrl
          link.setAttribute('download', file.file_name)
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    } catch (err: any) {
      console.error("Error generating signed URL:", err)
      alert("Error al generar el acceso al archivo: " + err.message)
    } finally {
      setGeneratingUrl(null)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100/60 mb-4">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Archivos Adjuntos</h4>
        {files.length > 0 && (
          <button 
            onClick={onViewAllClick}
            className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest cursor-pointer"
          >
            Ver todo
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Upload Button */}
        <label className="w-full py-2.5 bg-slate-50 border border-slate-200/50 hover:bg-slate-100/60 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
          {uploadFileMutation.isPending ? <Loader2 size={13} className="animate-spin text-slate-500" /> : <Upload size={12} className="text-slate-500" />}
          <span>+ Subir documento</span>
          <input 
            ref={fileInputRef} 
            type="file" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={uploadFileMutation.isPending} 
          />
        </label>

        {uploadStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-xl border border-green-100 animate-in fade-in">
            <CheckCircle size={12} /> {uploadStatus}
          </div>
        )}

        {/* Files list */}
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-slate-400" size={18} />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200/50 rounded-2xl bg-slate-50/20">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sin archivos adjuntos aún</p>
            </div>
          ) : (
            files.map(file => (
              <div 
                key={file.id} 
                className="flex items-center gap-3 p-3 bg-slate-50/30 border border-slate-100/60 rounded-2xl hover:border-slate-200 hover:bg-slate-50 transition-all group"
              >
                <div className="w-8 h-8 shrink-0 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 shadow-sm text-xs">
                  <FileIcon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 truncate" title={file.file_name}>
                    {file.file_name}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                    {new Date(file.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleFileAction(file, 'view')} 
                    disabled={!!generatingUrl} 
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Ver"
                  >
                    {generatingUrl === file.id ? <Loader2 size={11} className="animate-spin" /> : <Eye size={12} />}
                  </button>
                  <button 
                    onClick={() => handleFileAction(file, 'download')} 
                    disabled={!!generatingUrl} 
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Descargar"
                  >
                    <Download size={12} />
                  </button>
                  {(userRole === 'admin' || permissions.includes('manage_lead_content') || file.uploaded_by === user?.id) && (
                    <button 
                      onClick={() => onDeleteFileClick(file)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
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
