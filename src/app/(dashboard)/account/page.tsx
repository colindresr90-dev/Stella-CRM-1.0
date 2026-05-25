"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import type { User } from "@supabase/supabase-js"
import { 
  User as UserIcon, 
  Mail, 
  Globe, 
  X, 
  Loader2, 
  Save, 
  Key, 
  Briefcase, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<'perfil' | 'firma'>('perfil')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Profile state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [role, setRole] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Upload State
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Signature State
  const [nombreCompleto, setNombreCompleto] = useState("")
  const [cargo, setCargo] = useState("")
  const [telefono, setTelefono] = useState("")
  const [webEmail, setWebEmail] = useState("")
  const [logo, setLogo] = useState("")
  const [logoLayout, setLogoLayout] = useState<'left' | 'top'>('left')
  const [textoAdicional, setTextoAdicional] = useState("")
  const [incluirNuevos, setIncluirNuevos] = useState(true)
  const [incluirRespuestas, setIncluirRespuestas] = useState(true)
  const [savingSignature, setSavingSignature] = useState(false)

  // Toast State
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          router.push("/login")
          return
        }
        setUser(session.user)

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, phone, avatar_url, role")
          .eq("id", session.user.id)
          .single()

        if (profile) {
          setName(profile.name || "")
          setPhone(profile.phone || "")
          setAvatarUrl(profile.avatar_url || "")
          setRole(profile.role || "standard")
        }

        // Load signature configuration from localStorage
        const storedSig = localStorage.getItem(`stella_signature_${session.user.id}`)
        if (storedSig) {
          try {
            const parsed = JSON.parse(storedSig)
            setNombreCompleto(parsed.nombreCompleto ?? profile?.name ?? "")
            setCargo(parsed.cargo ?? "")
            setTelefono(parsed.telefono ?? profile?.phone ?? "")
            setWebEmail(parsed.webEmail ?? session.user.email ?? "")
            setLogo(parsed.logo ?? "")
            setLogoLayout(parsed.logoLayout ?? "left")
            setTextoAdicional(parsed.textoAdicional ?? "")
            setIncluirNuevos(parsed.incluirNuevos ?? true)
            setIncluirRespuestas(parsed.incluirRespuestas ?? true)
          } catch (e) {
            console.error("Error parsing signature", e)
          }
        } else {
          // Defaults if no signature found
          setNombreCompleto(profile?.name || "")
          setTelefono(profile?.phone || "")
          setWebEmail(session.user.email || "")
        }
      } catch (err) {
        console.error("Error loading account data:", err)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setProfileSaving(true)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          phone,
        })
        .eq("id", user.id)

      if (error) throw error
      showToast("Perfil actualizado correctamente.", "success")
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error al actualizar perfil."
      showToast(errMsg, "error")
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      showToast("La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y un número.", "error")
      return
    }

    if (newPassword !== confirmPassword) {
      showToast("Las contraseñas nuevas no coinciden.", "error")
      return
    }
    
    setPasswordSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      showToast("Contraseña actualizada exitosamente.", "success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error al cambiar la contraseña."
      showToast(errMsg, "error")
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingAvatar(true)

    // Show instant preview
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(file)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get Public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const finalUrl = data.publicUrl
      setAvatarUrl(finalUrl)

      // Save directly to profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: finalUrl })
        .eq("id", user.id)

      if (profileError) throw profileError

      showToast("Imagen subida exitosamente.", "success")
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error al subir la imagen."
      showToast(errMsg, "error")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Format validation
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showToast("Formato no soportado. Usa JPG o PNG.", "error")
      return
    }

    // Size validation (max 1MB)
    if (file.size > 1024 * 1024) {
      showToast("La imagen supera el límite de 1MB.", "error")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setLogo(base64)
      
      const img = new Image()
      img.onload = () => {
        if (img.width > 160 || img.width > img.height * 1.3) {
          setLogoLayout('top')
        } else {
          setLogoLayout('left')
        }
      }
      img.src = base64
    }
    reader.readAsDataURL(file)
  }

  const handleSaveSignature = async () => {
    setSavingSignature(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error("No hay sesión activa")

      const sigData = {
        nombreCompleto,
        cargo,
        telefono,
        webEmail,
        logo,
        logoLayout,
        textoAdicional,
        incluirNuevos,
        incluirRespuestas
      }

      localStorage.setItem(`stella_signature_${currentUser.id}`, JSON.stringify(sigData))
      showToast("Firma de correo guardada.", "success")
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error al guardar firma"
      showToast(errMsg, "error")
    } finally {
      setSavingSignature(false)
    }
  }

  const handleRestoreDefaults = async () => {
    if (!confirm("¿Estás seguro de que deseas restaurar los valores por defecto?")) return
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, phone")
          .eq("id", currentUser.id)
          .single()

        setNombreCompleto(profile?.name || "")
        setCargo("")
        setTelefono(profile?.phone || "")
        setWebEmail(currentUser.email || "")
        setLogo("")
        setLogoLayout("left")
        setTextoAdicional("")
        setIncluirNuevos(true)
        setIncluirRespuestas(true)

        localStorage.removeItem(`stella_signature_${currentUser.id}`)
        showToast("Valores por defecto restaurados.", "success")
      }
    } catch {
      showToast("Error al restaurar valores por defecto.", "error")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 pb-4 border-b border-outline-variant/10">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <UserIcon className="text-primary" size={28} />
            </div>
            Mi Cuenta
          </h1>
          <p className="text-on-surface-variant mt-2 font-medium">
            Gestiona tu información de perfil, configuración de seguridad y firma de correo.
          </p>
        </div>
        <button 
          onClick={() => router.push("/")}
          className="px-4 py-2 border border-outline-variant/20 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-surface-container-low p-1.5 rounded-2xl mb-8 w-fit border border-outline-variant/10 shadow-sm">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'perfil' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
        >
          <UserIcon size={18} /> Perfil
        </button>
        <button
          onClick={() => setActiveTab('firma')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'firma' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
        >
          <Mail size={18} /> Firma de correo
        </button>
      </div>

      {/* Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'perfil' && (
            <motion.div
              key="perfil"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Profile Card */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-outline-variant/10 shadow-xl shadow-black/5">
                <div className="pb-6 border-b border-outline-variant/10 mb-6">
                  <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                    <UserIcon className="text-primary animate-pulse" size={22} />
                    Información de Perfil
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">Actualiza tus datos públicos y medios de contacto.</p>
                </div>

                <form className="space-y-6" onSubmit={handleProfileUpdate}>
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-50 border border-slate-200 flex-shrink-0 relative group shadow-inner">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-3xl">
                          {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-white/75 flex items-center justify-center backdrop-blur-sm">
                           <Loader2 className="animate-spin text-primary" size={24} />
                        </div>
                      )}
                    </div>
                    <div className="text-center sm:text-left">
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-outline-variant/20 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {uploadingAvatar ? "Subiendo..." : "Cambiar imagen"}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <p className="text-[10px] text-on-surface-variant mt-2 font-medium">Formatos soportados: JPG, PNG. Tamaño máximo 2MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Nombre Completo</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Teléfono</label>
                      <input
                        type="tel"
                        required
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Correo Electrónico (Solo Lectura)</label>
                      <input
                        type="email"
                        disabled
                        className="w-full px-4 py-3 bg-slate-50 border border-outline-variant/10 rounded-xl text-slate-500 cursor-not-allowed outline-none font-medium text-sm"
                        value={user?.email || ""}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-outline-variant/10">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="bg-primary hover:bg-primary/95 text-white px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md min-w-[150px]"
                    >
                      {profileSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>

              {/* Work Info Card */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-outline-variant/10 shadow-xl shadow-black/5">
                <div className="pb-6 border-b border-outline-variant/10 mb-6">
                  <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                    <Briefcase className="text-primary" size={22} />
                    Información Laboral
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">Datos asignados en tu pertenencia a la organización.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Rol</label>
                    <div className="px-4 py-3 bg-slate-50 border border-outline-variant/10 rounded-xl text-slate-700 capitalize font-semibold text-sm">
                      {role || "Cargando..."}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">ID de Usuario</label>
                    <div className="px-4 py-3 bg-slate-50 border border-outline-variant/10 rounded-xl text-slate-500 font-mono text-xs truncate">
                      {user?.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-outline-variant/10 shadow-xl shadow-black/5">
                <div className="pb-6 border-b border-outline-variant/10 mb-6">
                  <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                    <Key className="text-primary" size={22} />
                    Seguridad
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">Actualiza las credenciales de tu cuenta siguiendo las reglas de seguridad.</p>
                </div>

                <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Contraseña Actual (Opcional)</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Requerido en configuraciones avanzadas"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Nueva Contraseña</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Min 8 caract, mayúsc, minúsc y número"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Confirmar Nueva Contraseña</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Repite tu contraseña"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/10">
                    <button
                      type="submit"
                      disabled={passwordSaving || !newPassword || !confirmPassword}
                      className="border border-primary text-primary hover:bg-primary/5 px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 shadow-sm min-w-[180px] flex items-center justify-center bg-transparent cursor-pointer"
                    >
                      {passwordSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                      Actualizar Contraseña
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'firma' && (
            <motion.div
              key="firma"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-8 border border-outline-variant/10 shadow-xl shadow-black/5 animate-fade-in"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Formulario (Lado Izquierdo) */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-on-surface mb-2">Firma de Correo</h3>
                    <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Personaliza la firma que se incluirá en tus comunicaciones por correo.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Nombre Completo</label>
                      <input
                        type="text"
                        value={nombreCompleto}
                        onChange={(e) => setNombreCompleto(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Ej: Rodrigo Colindres"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Cargo / Puesto</label>
                      <input
                        type="text"
                        value={cargo}
                        onChange={(e) => setCargo(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Ej: Ejecutivo de Cuentas"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Teléfono</label>
                      <input
                        type="text"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Ej: +1 (555) 123-4567"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Sitio Web o Email</label>
                      <input
                        type="text"
                        value={webEmail}
                        onChange={(e) => setWebEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                        placeholder="Ej: www.stellacrm.com o agente@stellacrm.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Logo o Imagen</label>
                      <div className="flex items-center gap-4 bg-surface/40 p-4 rounded-2xl border border-outline-variant/10">
                        {logo ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-outline-variant/20 bg-white flex-shrink-0 flex items-center justify-center shadow-sm">
                            <img src={logo} alt="Logo preview" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => { setLogo(""); setLogoLayout("left"); }}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white p-1 rounded-full transition-colors shadow-md cursor-pointer border-none"
                              title="Quitar imagen"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-outline-variant/30 bg-white/50 flex items-center justify-center text-on-surface-variant/40 flex-shrink-0">
                            <Globe size={24} />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="signature-logo-upload"
                          />
                          <label
                            htmlFor="signature-logo-upload"
                            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-outline-variant/20 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            Seleccionar Imagen
                          </label>
                          <p className="text-[10px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">JPG o PNG, Máx 1MB. Se detecta alineación idónea automáticamente.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Texto Adicional / Disclaimer</label>
                      <textarea
                        value={textoAdicional}
                        onChange={(e) => setTextoAdicional(e.target.value)}
                        className="w-full px-4 py-3 bg-surface rounded-xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm h-20 resize-none"
                        placeholder="Ej: Este mensaje contiene información confidencial..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Incluir firma automáticamente en correos nuevos</span>
                      <button
                        type="button"
                        onClick={() => setIncluirNuevos(!incluirNuevos)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          incluirNuevos ? 'bg-[#006C49]' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            incluirNuevos ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Incluir firma en respuestas y reenvíos</span>
                      <button
                        type="button"
                        onClick={() => setIncluirRespuestas(!incluirRespuestas)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          incluirRespuestas ? 'bg-[#006C49]' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            incluirRespuestas ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-6 border-t border-outline-variant/10">
                    <button
                      type="button"
                      onClick={handleSaveSignature}
                      disabled={savingSignature}
                      className="bg-[#006C49] hover:bg-[#005237] text-white px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer border-none shadow-md"
                    >
                      {savingSignature ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                      Guardar Firma
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreDefaults}
                      className="border border-[#006C49] text-[#006C49] hover:bg-[#006C49]/5 px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all cursor-pointer bg-transparent"
                    >
                      Restaurar por defecto
                    </button>
                  </div>
                </div>

                {/* Preview en tiempo real (Lado Derecho) */}
                <div 
                  className="bg-slate-50/50 rounded-3xl p-8 border border-outline-variant/10 flex flex-col justify-start gap-6"
                  style={{ minHeight: '420px' }}
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vista previa del correo</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                      </div>
                    </div>

                    {/* Simulated Message Content */}
                    <div className="space-y-3">
                      <div className="h-4 bg-slate-200/50 rounded-md w-1/3 animate-pulse" />
                      <div className="h-4 bg-slate-200/50 rounded-md w-3/4 animate-pulse" />
                      <div className="h-4 bg-slate-200/50 rounded-md w-1/2 animate-pulse" />
                    </div>
                  </div>

                  {/* Live Signature Preview Container */}
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 select-none border-b border-slate-100 pb-1">Firma en Correo</div>
                    
                    {/* Standard Email Format */}
                    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.5', color: '#334155', textAlign: 'left' }}>
                      <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '10px 0 15px 0' }} />
                      <div style={logoLayout === 'top' ? { display: 'flex', flexDirection: 'column', gap: '12px' } : { display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        {logo && (
                          <div style={{ flexShrink: 0, maxWidth: logoLayout === 'top' ? '200px' : '100px' }}>
                            <img 
                              src={logo} 
                              alt="Logo" 
                              style={{ 
                                maxHeight: logoLayout === 'top' ? '96px' : '56px', 
                                maxWidth: logoLayout === 'top' ? '200px' : '100px', 
                                objectFit: 'contain' 
                              }} 
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontWeight: 'bold', color: '#000000', fontSize: '14px' }}>
                            {nombreCompleto || 'Nombre Completo'}
                          </div>
                          {cargo && (
                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px', fontWeight: '500' }}>
                              {cargo}
                            </div>
                          )}
                          <div style={{ color: '#334155', fontSize: '12px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {telefono && (
                              <div>
                                <span style={{ color: '#64748b', fontWeight: 'bold', marginRight: '4px' }}>Tel:</span>
                                {telefono}
                              </div>
                            )}
                            {webEmail && (
                              <div>
                                <span style={{ color: '#64748b', fontWeight: 'bold', marginRight: '4px' }}>Web/Email:</span>
                                {webEmail}
                              </div>
                            )}
                          </div>
                          {textoAdicional && (
                            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '10px', lineHeight: '1.4', borderTop: '1px dashed #e2e8f0', paddingTop: '6px', fontStyle: 'italic' }}>
                              {textoAdicional}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 text-white font-bold ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
