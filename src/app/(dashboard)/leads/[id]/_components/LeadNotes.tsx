"use client"

import React, { useState, useRef } from "react"
import { motion } from "framer-motion"
import { FileText, Send, Loader2, History, Trash2, Clock, User, Bold, Italic, Underline, List, Palette, Link } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { createNotification } from "@/lib/notifications"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { insertActivity } from "./utils"
import { Lead, Note } from "./types"

type NoteWithCreator = Note & {
  creator?: { name: string } | null
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

export function LeadNotes({
  lead,
  user,
  userRole,
  permissions,
  onDeleteNoteClick
}: {
  lead: Lead
  user: any
  userRole: string | null
  permissions: string[]
  onDeleteNoteClick: (note: Note) => void
}) {
  const queryClient = useQueryClient()
  const [hasContent, setHasContent] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Query notes using TanStack Query with safe join
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', lead.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select(`
            *,
            creator:profiles!created_by ( name )
          `)
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        return data.map((n: any) => ({
          ...n,
          creator: Array.isArray(n.creator) ? n.creator[0] : n.creator
        })) as NoteWithCreator[]
      } catch (err) {
        console.warn("Error with notes profiles join, using fallback:", err)
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data as NoteWithCreator[]
      }
    }
  })

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Debes estar autenticado")
      const { data, error } = await supabase
        .from('notes')
        .insert({
          lead_id: lead.id,
          content,
          created_by: user.id
        })
        .select()
        .single()
      if (error) throw error

      await insertActivity(lead.id, user.id, 'note', 'Nota agregada')
      await createNotification({
        user_id: user.id,
        title: 'Nota Guardada',
        message: `Has agregado una nueva nota en ${lead.business_name}`,
        type: 'update',
        related_id: lead.id
      })

      if (lead.assigned_to && lead.assigned_to !== user.id) {
        await createNotification({
          user_id: lead.assigned_to,
          title: 'Nueva Nota de Equipo',
          message: `[${user.email || 'Un compañero'}] agregó una nota en su lead.`,
          type: 'update',
          related_id: lead.id
        })
      }

      return data
    },
    onSuccess: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = ""
      }
      setHasContent(false)
      queryClient.invalidateQueries({ queryKey: ['notes', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] })
    },
    onError: (err: any) => {
      alert('Error al guardar la nota: ' + err.message)
    }
  })

  const handleInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText.trim()
      setHasContent(text.length > 0 || editorRef.current.innerHTML.includes("<img") || editorRef.current.innerHTML.includes("<li"))
    }
  }

  const execEditorCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      editorRef.current.focus()
      handleInput()
    }
  }

  const handleAddLink = () => {
    const url = prompt("Introduce la URL:")
    if (url) {
      execEditorCommand("createLink", url)
    }
  }

  const handleAddNote = () => {
    const htmlContent = editorRef.current ? editorRef.current.innerHTML.trim() : ""
    const textContent = editorRef.current ? editorRef.current.innerText.trim() : ""
    
    if (!textContent && !htmlContent.includes("<img") && !htmlContent.includes("<iframe") && !htmlContent.includes("<li")) return
    if (addNoteMutation.isPending) return
    
    addNoteMutation.mutate(htmlContent)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-panel border border-white/40 rounded-3xl overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="absolute top-0 left-0 -ml-10 -mt-10 w-32 h-32 bg-blue-400/20 blur-3xl rounded-full pointer-events-none" />
      
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-blue-600" />
          <h3 className="text-lg font-bold text-slate-800">Notas</h3>
        </div>
      </div>

      <div className="p-6">
        {/* Note Input */}
        <div className="mb-8 p-6 bg-white/40 rounded-2xl border border-white/50 backdrop-blur-md space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/60 p-1.5 rounded-2xl shadow-sm flex-wrap">
            <button
              type="button"
              onClick={() => execEditorCommand("bold")}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer font-bold"
              title="Negrita"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => execEditorCommand("italic")}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer italic"
              title="Itálica"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onClick={() => execEditorCommand("underline")}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer underline"
              title="Subrayado"
            >
              <Underline size={14} />
            </button>
            <button
              type="button"
              onClick={() => execEditorCommand("insertUnorderedList")}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              title="Lista con viñetas"
            >
              <List size={14} />
            </button>

            {/* Color Selector Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
                title="Color de texto"
              >
                <Palette size={14} />
              </button>
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute left-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 flex gap-1.5">
                    {COLORS.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          execEditorCommand("foreColor", color.value)
                          setShowColorPicker(false)
                        }}
                        className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer transition-transform hover:scale-110"
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
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              title="Insertar Enlace"
            >
              <Link size={14} />
            </button>
          </div>

          {/* contentEditable Div */}
          <div className="relative">
            <div
              contentEditable
              ref={editorRef}
              onInput={handleInput}
              suppressContentEditableWarning={true}
              className="w-full px-4 py-3 bg-white/40 border border-slate-200/70 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/40 outline-none transition-all min-h-[120px] max-h-[300px] overflow-y-auto text-slate-800 leading-relaxed rich-editor prose prose-sm max-w-none"
            />
            {/* Custom placeholder for contentEditable */}
            {!hasContent && (
              <div 
                className="absolute top-3 left-4 text-slate-400 text-sm pointer-events-none select-none"
                onClick={() => editorRef.current?.focus()}
              >
                Escribe una nota interna para este lead...
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              {hasContent && (
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-1">
                  Presiona el botón para guardar
                </span>
              )}
            </div>
            <button 
              onClick={handleAddNote}
              disabled={addNoteMutation.isPending || !hasContent}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all shadow-md shadow-blue-100/50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
            >
              {addNoteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>Guardar Nota</span>
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {/* Main notes (imported or initial registration) */}
          {lead.notes && (
            <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100/50 group relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <History size={14} />
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Nota del Registro Principal</span>
              </div>
              <div dangerouslySetInnerHTML={{ __html: lead.notes }} className="rich-editor whitespace-pre-wrap text-slate-700 text-sm leading-relaxed" />
              <div className="mt-4 pt-3 border-t border-blue-100/30 text-[10px] text-blue-400 font-medium italic">
                Esta nota fue guardada al momento de crear o importar el lead.
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : notes.length === 0 && !lead.notes ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200/60 rounded-2xl bg-white/30">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileText size={32} className="opacity-20" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">No hay notas registradas</p>
            </div>
          ) : (
            notes.map(note => (
              <div 
                key={note.id} 
                className="bg-white/60 p-5 rounded-2xl border border-slate-100/70 group hover:border-blue-100 hover:bg-blue-50/10 transition-all relative shadow-[0_4px_16px_rgba(0,0,0,0.01)]"
              >
                {(userRole === 'admin' || permissions.includes('manage_lead_content') || note.created_by === user?.id) && (
                  <button 
                    onClick={() => onDeleteNoteClick(note)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-40 group-hover:opacity-100"
                    title="Eliminar nota"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                
                <div 
                  dangerouslySetInnerHTML={{ __html: note.content }} 
                  className="rich-editor whitespace-pre-wrap text-slate-700 text-sm leading-relaxed pr-8"
                />
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="opacity-60" />
                    <span>
                      {new Date(note.created_at).toLocaleString('es-ES', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {note.creator?.name && (
                    <div className="flex items-center gap-1">
                      <User size={12} className="opacity-60 text-blue-500" />
                      <span>Por: {note.creator.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  )
}

