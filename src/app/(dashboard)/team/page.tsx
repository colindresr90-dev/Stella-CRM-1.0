"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserRole } from "@/lib/authHelper"
import { supabase } from "@/lib/supabaseClient"
import { User as UserIcon, Users, Shield, Briefcase, Mail, Loader2, Plus, X, Search, Clock, ExternalLink, FileText, Calendar, Phone, Trash2, Download, Info, FilePlus } from "lucide-react"
import { createNotification } from "@/lib/notifications"

type Profile = {
  id: string
  name: string
  role: string
  hire_date?: string
  emergency_contact?: string
  admin_notes?: string
  permissions?: string[]
  status?: 'active' | 'inactive'
}

type MemberDocument = {
  name: string
  url: string
  created_at: string | null
  size?: number
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Modal & Form State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("sales")
  const [submitting, setSubmitting] = useState(false)
  const [team, setTeam] = useState<Profile[]>([])
  const [fetchingTeam, setFetchingTeam] = useState(true)

  // Detailed Member View State
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'docs' | 'notes' | 'permissions'>('info')
  const [memberDocuments, setMemberDocuments] = useState<MemberDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [isUpdatingMember, setIsUpdatingMember] = useState(false)
  
  // Member Detail Form
  const [detailForm, setDetailForm] = useState({
    hire_date: "",
    emergency_contact: "",
    admin_notes: "",
    role: "sales",
    permissions: [] as string[],
    status: "active" as 'active' | 'inactive'
  })
  
  // Toast State
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const enforceRoleAccess = async () => {
      const { role } = await getUserRole()
      
      if (role !== "admin") {
        router.push("/")
      } else {
        setIsAdmin(true)
        setLoading(false)
        fetchTeam()
      }
    }

    enforceRoleAccess()
  }, [router])

  const fetchTeam = async () => {
    setFetchingTeam(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("name")
    
    if (!error && data) {
      setTeam(data as Profile[])
    }
    setFetchingTeam(false)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Falló la creación del usuario.")
      }

      showToast("¡Usuario creado exitosamente!", "success")
      
      // NOTIFICATION: Welcome and Role Assignment
      if (data.user?.id) {
        await createNotification({
          user_id: data.user.id,
          title: 'Bienvenido a Stella CRM',
          message: `Tu cuenta ha sido creada con el rol de ${role === 'admin' ? 'Administrador' : 'Vendedor'}.`,
          type: 'role'
        });
      }
      
      // Clear form & Close Modal
      setEmail("")
      setPassword("")
      setRole("sales")
      setShowCreateModal(false)
      fetchTeam()
      
    } catch (err: any) {
      showToast(err.message || "Error inesperado al servidor.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const fetchMemberDocuments = async (profileId: string) => {
    setLoadingDocs(true)
    try {
      const { data, error } = await supabase.storage
        .from('team-documents')
        .list(profileId)

      if (error) throw error

      if (data) {
        const docs = await Promise.all(data.map(async (file) => {
          const { data: urlData } = supabase.storage
            .from('team-documents')
            .getPublicUrl(`${profileId}/${file.name}`)
          
          return {
            name: file.name,
            url: urlData.publicUrl,
            created_at: file.created_at,
            size: file.metadata?.size
          }
        }))
        setMemberDocuments(docs)
      }
    } catch (err) {
      console.error("Error fetching docs:", err)
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleMemberClick = (member: Profile) => {
    setSelectedMember(member)
    setDetailForm({
      hire_date: member.hire_date || "",
      emergency_contact: member.emergency_contact || "",
      admin_notes: member.admin_notes || "",
      role: member.role || "sales",
      permissions: Array.isArray(member.permissions) ? member.permissions : [],
      status: member.status || "active"
    })
    setShowDetailsModal(true)
    setActiveDetailTab('info')
    fetchMemberDocuments(member.id)
  }

  const handleStatusToggle = async () => {
    if (!selectedMember || !confirm(`¿Estás seguro de que deseas ${detailForm.status === 'active' ? 'DESACTIVAR' : 'ACTIVAR'} a este usuario? ${detailForm.status === 'active' ? 'Perderá el acceso al CRM inmediatamente.' : ''}`)) return
    
    setIsUpdatingMember(true)
    const newStatus = detailForm.status === 'active' ? 'inactive' : 'active'
    
    try {
      const response = await fetch("/api/update-user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedMember.id, status: newStatus })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al actualizar el estado")
      }

      showToast(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'} con éxito.`, "success")
      
      // Update local state
      setDetailForm(prev => ({ ...prev, status: newStatus }))
      setTeam(prev => prev.map(m => m.id === selectedMember.id ? { ...m, status: newStatus } : m))
      
    } catch (err: any) {
      showToast(err.message || "Error al cambiar estado.", "error")
    } finally {
      setIsUpdatingMember(false)
    }
  }

  const handleUpdateMemberInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) return
    setIsUpdatingMember(true)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          hire_date: detailForm.hire_date || null,
          emergency_contact: detailForm.emergency_contact,
          admin_notes: detailForm.admin_notes,
          role: detailForm.role,
          permissions: detailForm.permissions
        })
        .eq("id", selectedMember.id)

      if (error) throw error

      showToast("Información actualizada.", "success")
      
      // NOTIFICATION: Permission Change
      if (detailForm.role !== selectedMember.role || JSON.stringify(detailForm.permissions) !== JSON.stringify(selectedMember.permissions)) {
        await createNotification({
          user_id: selectedMember.id,
          title: 'Permisos Actualizados',
          message: `Un administrador ha actualizado tus permisos y rol (${detailForm.role.toUpperCase()}).`,
          type: 'role'
        });
      }

      // Update local team list to reflect changes
      setTeam(prev => prev.map(m => 
        m.id === selectedMember.id 
          ? { ...m, ...detailForm } 
          : m
      ))
    } catch (err: any) {
      showToast(err.message || "Error al actualizar.", "error")
    } finally {
      setIsUpdatingMember(false)
    }
  }

  const togglePermission = (perm: string) => {
    setDetailForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }))
  }

  const ALL_PERMISSIONS = [
    { id: 'view_team_dashboard', label: 'Ver Dashboard de Equipo', desc: 'Métricas colectivas y rendimiento de otros.' },
    { id: 'filter_dashboard_by_agent', label: 'Filtrar Dashboard', desc: 'Capacidad de ver datos específicos de otros agentes.' },
    { id: 'create_and_assign_leads', label: 'Asignar Leads', desc: 'Permite asignar prospectos a otros durante la creación.' },
    { id: 'export_leads_csv', label: 'Exportar Datos', desc: 'Descarga de leads en formato CSV.' },
    { id: 'reassign_leads', label: 'Reasignar Leads', desc: 'Cambiar el dueño de prospectos existentes.' },
    { id: 'delete_leads', label: 'Eliminar Leads', desc: 'Borrar prospectos permanentemente.' },
    { id: 'manage_lead_content', label: 'Gestionar Contenido', desc: 'Eliminar notas o archivos de otros.' },
    { id: 'manage_sales_records', label: 'Gestionar Ventas', desc: 'Editar o eliminar registros de venta.' },
    { id: 'access_team_page', label: 'Acceso a Equipo', desc: 'Entrada al módulo de personal.' },
    { id: 'manage_team_roster', label: 'Gestionar Personal', desc: 'Crear o dar de baja usuarios.' },
    { id: 'manage_member_docs', label: 'Gestionar Expedientes', desc: 'Ver/Subir documentos de otros miembros.' },
  ];

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedMember) return

    setUploadingDoc(true)

    try {
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${selectedMember.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('team-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      showToast("Documento subido.", "success")
      fetchMemberDocuments(selectedMember.id)
    } catch (err: any) {
      showToast(err.message || "Error al subir archivo.", "error")
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleDeleteDocument = async (fileName: string) => {
    if (!selectedMember || !confirm("¿Eliminar este documento?")) return

    try {
      const { error } = await supabase.storage
        .from('team-documents')
        .remove([`${selectedMember.id}/${fileName}`])

      if (error) throw error

      showToast("Documento eliminado.", "success")
      fetchMemberDocuments(selectedMember.id)
    } catch (err: any) {
      showToast(err.message || "Error al eliminar.", "error")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       {/* Toast Notification Overlay */}
       {toast && (
          <div className="fixed bottom-6 right-6 z-[200] animate-fade-in-up">
            <div className={`px-6 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-sm font-bold text-white backdrop-blur-md ${toast.type === 'success' ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-lowest/50 backdrop-blur-xl p-8 rounded-3xl border border-outline-variant/10 shadow-sm">
          <div>
            <h1 className="font-headline text-3xl font-black text-on-surface tracking-tight">Gestión de Equipo</h1>
            <p className="text-on-surface-variant font-medium mt-1">Administra accesos, roles y el rendimiento de tus colaboradores.</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-on-primary rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Nuevo Usuario
          </button>
        </div>

        {/* TEAM MEMBERS LIST CARD */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden ambient-shadow">
          <div className="px-8 py-8 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-surface-container-low/50 to-transparent">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-on-surface">Colaboradores</h2>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                  {team.length} {team.length === 1 ? 'Usuario' : 'Usuarios'}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant font-medium mt-1">Listado completo de personal registrado.</p>
            </div>
            
            <div className="relative group max-w-sm w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-low rounded-2xl border border-outline-variant/5 focuses:border-primary/30 focuses:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-on-surface-variant/50 text-sm font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {fetchingTeam ? (
              <div className="flex flex-col justify-center items-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                <p className="text-sm font-bold text-on-surface-variant animate-pulse">Sincronizando equipo...</p>
              </div>
            ) : team.length === 0 ? (
              <div className="text-center py-20 bg-surface-container-low/20">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4">
                   <Users className="text-on-surface-variant/30" size={32} />
                </div>
                <h3 className="text-lg font-bold text-on-surface">No hay miembros</h3>
                <p className="text-sm text-on-surface-variant">Comienza registrando a tu primer colaborador.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low/30 border-b border-outline-variant/10">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Colaborador</th>
                    <th className="px-8 py-5 text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Rol / Permisos</th>
                    <th className="px-8 py-5 text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {team.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map((member) => (
                    <tr 
                      key={member.id} 
                      onClick={() => handleMemberClick(member)}
                      className="hover:bg-primary/[0.04] transition-all cursor-pointer group active:scale-[0.998]"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-primary font-black text-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                            {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface truncate max-w-[200px] group-hover:text-primary transition-colors">{member.name}</p>
                            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-tighter opacity-50">ID: {member.id.substring(0, 12)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          {member.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200/50 shadow-sm">
                              <Shield size={12} className="text-amber-500" /> Administrador
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border border-primary/10 shadow-sm">
                              <Briefcase size={12} className="text-primary/70" /> Vendedor
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`flex items-center gap-2 text-xs font-bold w-fit px-3 py-1.5 rounded-full ${member.status === 'inactive' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-surface-container-high text-on-surface-variant relative overflow-hidden'}`}>
                          <div className={`w-2 h-2 rounded-full ${member.status === 'inactive' ? 'bg-red-500' : 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}></div>
                          {member.status === 'inactive' ? 'Inactivo' : 'Activo'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MODAL: CREATE USER */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-on-background/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-surface-container-lowest rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-outline-variant/10 relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -translate-y-8 translate-x-8 -z-10" />
              
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-on-surface font-headline italic tracking-tight">Nuevo Colaborador</h2>
                  <p className="text-sm font-medium text-on-surface-variant">Registra el acceso para tu equipo.</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-10 h-10 rounded-full bg-surface-container-high/50 flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Correo Institucional</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-on-surface-variant/30 text-sm font-bold"
                        placeholder="ejemplo@stellacrm.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Contraseña Temporal</label>
                    <div className="relative group">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-on-surface-variant/30 text-sm font-bold"
                        placeholder="Temp123!"
                      />
                    </div>
                    <p className="text-[9px] text-on-surface-variant/50 mt-2 font-bold uppercase tracking-tighter ml-1 flex items-center gap-1.5 italic">
                      <Clock size={10} /> Cambio obligatorio en el primer ingreso.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Rol Operativo</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-5 py-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/10 focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_1.25rem_center] bg-no-repeat"
                    >
                      <option value="sales">Vendedor (Sales) - Acceso Operativo</option>
                      <option value="admin">Administrador (Admin) - Control Total</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-4 text-on-surface-variant text-sm font-bold rounded-2xl hover:bg-surface-container-high transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !email || !password}
                    className="flex-[2] py-4 bg-primary text-on-primary text-sm font-black rounded-2xl transition disabled:opacity-50 flex justify-center items-center h-[52px] shadow-lg shadow-primary/20"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Confirmar Registro"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: MEMBER DETAILS & DOCUMENTS */}
        {showDetailsModal && selectedMember && (
          <div className="fixed inset-0 bg-on-background/30 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
             <div className="bg-surface-container-lowest rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] shadow-2xl border border-outline-variant/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Modal Header */}
                <div className="p-8 pb-4 border-b border-outline-variant/10 flex items-center justify-between bg-gradient-to-r from-surface-container-low to-transparent">
                   <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-3xl bg-primary text-on-primary flex items-center justify-center text-2xl font-black shadow-xl shadow-primary/20">
                         {selectedMember.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-on-surface font-headline italic tracking-tight">{selectedMember.name}</h2>
                         <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">{selectedMember.role}</span>
                            <span className="text-xs font-bold text-on-surface-variant/60">ID: {selectedMember.id}</span>
                         </div>
                      </div>
                   </div>
                   <button 
                      onClick={() => setShowDetailsModal(false)}
                      className="w-12 h-12 rounded-2xl bg-surface-container-high/50 flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-red-500 transition-all"
                   >
                      <X size={24} />
                   </button>
                </div>

                {/* Tabs Navigation */}
                <div className="px-8 pt-2 flex gap-8 border-b border-outline-variant/5 bg-surface-container-low/30">
                   {[
                      { id: 'info', label: 'Información', icon: Info },
                      { id: 'docs', label: 'Documentos', icon: FileText },
                      { id: 'notes', label: 'Bitácora Admin', icon: Mail },
                      { id: 'permissions', label: 'Permisos', icon: Shield }
                   ].map(tab => (
                      <button
                         key={tab.id}
                         onClick={() => setActiveDetailTab(tab.id as any)}
                         className={`flex items-center gap-2.5 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeDetailTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                      >
                         <tab.icon size={16} />
                         {tab.label}
                      </button>
                   ))}
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8">
                   
                   {/* TAB: INFO */}
                   {activeDetailTab === 'info' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5">
                                  <label className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">
                                     <Calendar size={14} className="text-primary" /> Fecha de Ingreso
                                  </label>
                                  <input 
                                     type="date"
                                     value={detailForm.hire_date}
                                     onChange={(e) => setDetailForm(prev => ({ ...prev, hire_date: e.target.value }))}
                                     className="w-full bg-surface-container-high rounded-2xl px-4 py-3 text-sm font-bold border border-outline-variant/10 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                                  />
                               </div>
                               <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5">
                                  <label className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-3">
                                     <Phone size={14} className="text-primary" /> Contacto de Emergencia
                                  </label>
                                  <input 
                                     type="text"
                                     placeholder="Nombre y Teléfono..."
                                     value={detailForm.emergency_contact}
                                     onChange={(e) => setDetailForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                                     className="w-full bg-surface-container-high rounded-2xl px-4 py-3 text-sm font-bold border border-outline-variant/10 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                                  />
                               </div>
                            </div>
                            
                            <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10 flex flex-col items-center justify-center text-center">
                                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-primary shadow-lg mb-4">
                                   <Shield size={40} />
                                </div>
                                <h3 className="text-sm font-black text-on-surface uppercase tracking-tight mb-2">Estado de la Cuenta</h3>
                                <p className="text-xs text-on-surface-variant/70 mb-6 max-w-[200px]">Controla el acceso de este colaborador al CRM Stella.</p>
                                
                                <button
                                   type="button"
                                   disabled={isUpdatingMember}
                                   onClick={handleStatusToggle}
                                   className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${detailForm.status === 'active' ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-500 hover:text-white hover:border-green-500'}`}
                                >
                                   {isUpdatingMember ? (
                                      <Loader2 size={16} className="animate-spin" />
                                   ) : (
                                      detailForm.status === 'active' ? 'Desactivar Usuario' : 'Activar Usuario'
                                   )}
                                </button>
                             </div>
                         </div>
                         <div className="flex justify-end pt-4">
                            <button 
                               onClick={handleUpdateMemberInfo}
                               disabled={isUpdatingMember}
                               className="px-10 py-4 bg-primary text-on-primary rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                               {isUpdatingMember ? <Loader2 size={20} className="animate-spin" /> : "Guardar Cambios"}
                            </button>
                         </div>
                      </div>
                   )}

                   {/* TAB: DOCUMENTS */}
                   {activeDetailTab === 'docs' && (
                      <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                         <div className="flex items-center justify-between">
                            <div>
                               <h3 className="text-xl font-bold text-on-surface">Expediente Digital</h3>
                               <p className="text-sm text-on-surface-variant font-medium">Contratos, identificaciones y documentos legales.</p>
                            </div>
                            <label className="flex items-center gap-2 px-6 py-3 bg-surface-container-high text-on-surface rounded-2xl font-bold text-sm cursor-pointer hover:bg-primary hover:text-white transition-all shadow-sm border border-outline-variant/10">
                               <FilePlus size={18} />
                               {uploadingDoc ? "Subiendo..." : "Subir Documento"}
                               <input type="file" onChange={handleUploadDocument} className="hidden" />
                            </label>
                         </div>

                         {loadingDocs ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                               <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                               <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant animate-pulse">Escaneando archivos...</p>
                            </div>
                         ) : memberDocuments.length === 0 ? (
                            <div className="border-2 border-dashed border-outline-variant/10 rounded-[2rem] py-20 text-center flex flex-col items-center bg-surface-container-low/20">
                               <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant/20 mb-4">
                                  <FileText size={32} />
                               </div>
                               <p className="text-on-surface font-bold">No hay documentos cargados</p>
                               <p className="text-xs text-on-surface-variant px-10 mt-1">Sube el contrato o documentos de identidad para completar el expediente.</p>
                            </div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {memberDocuments.map(doc => (
                                  <div key={doc.name} className="flex items-center gap-4 p-5 bg-surface-container-low rounded-3xl border border-outline-variant/5 group hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
                                     <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                                        <FileText size={24} />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-on-surface truncate pr-2">{doc.name}</p>
                                        <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-tighter">
                                           {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'} • {(doc.size ? (doc.size / 1024).toFixed(0) : '0')} KB
                                        </p>
                                     </div>
                                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a 
                                           href={doc.url} 
                                           target="_blank" 
                                           className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                           title="Descargar"
                                        >
                                           <Download size={18} />
                                        </a>
                                        <button 
                                           onClick={() => handleDeleteDocument(doc.name)}
                                           className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                           title="Eliminar"
                                        >
                                           <Trash2 size={18} />
                                        </button>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   )}

                   {/* TAB: NOTES */}
                   {activeDetailTab === 'notes' && (
                      <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                         <div>
                            <h3 className="text-xl font-bold text-on-surface italic">Bitácora Administrativa</h3>
                            <p className="text-sm text-on-surface-variant font-medium">Notas privadas, historial disciplinario o comentarios internos.</p>
                         </div>
                         <textarea 
                            rows={8}
                            value={detailForm.admin_notes}
                            onChange={(e) => setDetailForm(prev => ({ ...prev, admin_notes: e.target.value }))}
                            placeholder="Escribe comentarios internos sobre el desempeño o incidencias del colaborador..."
                            className="w-full bg-surface-container-low rounded-[2rem] p-8 text-sm font-bold border border-outline-variant/10 focus:ring-8 focus:ring-primary/5 outline-none transition-all placeholder:italic leading-relaxed shadow-inner"
                         />
                         <div className="flex justify-end">
                            <button 
                               onClick={handleUpdateMemberInfo}
                               disabled={isUpdatingMember}
                               className="px-10 py-4 bg-primary text-on-primary rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                               {isUpdatingMember ? <Loader2 size={20} className="animate-spin" /> : "Guardar Notas"}
                            </button>
                         </div>
                      </div>
                   )}

                   {/* TAB: PERMISSIONS */}
                   {activeDetailTab === 'permissions' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                         <div className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/5">
                            <div className="flex items-center justify-between mb-6">
                               <div>
                                  <h3 className="text-lg font-black text-on-surface tracking-tight">Nivel de Acceso Principal</h3>
                                  <p className="text-sm text-on-surface-variant font-medium">Define el rol básico del colaborador en el sistema.</p>
                               </div>
                               <select 
                                  value={detailForm.role}
                                  onChange={(e) => setDetailForm(prev => ({ ...prev, role: e.target.value }))}
                                  className="bg-surface-container-high rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest border border-outline-variant/10 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                               >
                                  <option value="sales">Vendedor (Acceso Granular)</option>
                                  <option value="admin">Administrador (Acceso Total)</option>
                               </select>
                            </div>

                            {detailForm.role === 'admin' && (
                               <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold leading-relaxed">
                                  <Shield size={20} className="shrink-0 text-amber-500" />
                                  <p>Advertencia: El rol de Administrador otorga acceso total a todas las funciones y datos del sistema. Los permisos individuales a continuación serán ignorados.</p>
                               </div>
                            )}
                         </div>

                         {detailForm.role !== 'admin' && (
                            <div className="space-y-6">
                               <div>
                                  <h3 className="text-lg font-black text-on-surface tracking-tight">Funciones Delegables</h3>
                                  <p className="text-sm text-on-surface-variant font-medium">Selecciona las acciones administrativas que este agente puede realizar.</p>
                               </div>

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {ALL_PERMISSIONS.map(perm => {
                                     const isSelected = detailForm.permissions.includes(perm.id);
                                     return (
                                        <div 
                                           key={perm.id}
                                           onClick={() => togglePermission(perm.id)}
                                           className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5' : 'bg-surface-container-low border-outline-variant/5 hover:border-outline-variant/20'}`}
                                        >
                                           <div className="flex-1 pr-4">
                                              <p className={`text-sm font-bold pr-2 transition-colors ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{perm.label}</p>
                                              <p className="text-[10px] font-medium text-on-surface-variant leading-tight mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{perm.desc}</p>
                                           </div>
                                           <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary text-white scale-110' : 'border-outline-variant/20'}`}>
                                              {isSelected && <Plus size={16} className="rotate-45" />}
                                           </div>
                                        </div>
                                     )
                                  })}
                                </div>
                            </div>
                         )}

                         <div className="flex justify-end pt-4">
                            <button 
                               onClick={handleUpdateMemberInfo}
                               disabled={isUpdatingMember}
                               className="px-10 py-4 bg-primary text-on-primary rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                               {isUpdatingMember ? <Loader2 size={20} className="animate-spin" /> : "Guardar Configuración de Acceso"}
                            </button>
                         </div>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}
    </div>
  )
}
