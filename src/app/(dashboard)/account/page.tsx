"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import type { User } from "@supabase/supabase-js"

export default function AccountPage() {
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
    } catch (err: any) {
      if (err?.message?.includes("schema cache")) {
        showToast("Error: Asegúrate de haber agregado 'role' a tu base de datos.", "error")
      } else {
        showToast(err.message || "Error al actualizar perfil.", "error")
      }
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
    } catch (err: any) {
      showToast(err.message || "Error al cambiar la contraseña.", "error")
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
    } catch (err: any) {
      showToast(err.message || "Error al subir la imagen.", "error")
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8 relative">
        
        {/* Toast Notification Overlay */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
            <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 text-sm font-medium text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        {/* Helper Nav Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">Mi Cuenta</h1>
          <button 
            onClick={() => router.push("/")}
            className="text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            ← Volver al Dashboard
          </button>
        </div>

        {/* Section A: Profile Information */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Información del Perfil</h2>
            <p className="text-sm text-gray-500">Actualiza tus datos públicos y medios de contacto.</p>
          </div>
          
          <form className="p-6 space-y-6" onSubmit={handleProfileUpdate}>
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 relative group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl">
                    {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                     <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
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
                <p className="text-xs text-gray-400 mt-2">JPG, PNG hasta 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Solo Lectura)</label>
                <input
                  type="email"
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                  value={user?.email || ""}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center justify-center min-w-[150px]"
              >
                {profileSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Section C: Work Info */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Información Laboral</h2>
            <p className="text-sm text-gray-500">Datos privados de tu pertenencia a la organización.</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <div className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm capitalize font-medium">
                {role || "Cargando..."}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID de Usuario</label>
              <div className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 font-mono text-xs truncate">
                {user?.id}
              </div>
            </div>
          </div>
        </section>

        {/* Section B: Security */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Seguridad</h2>
            <p className="text-sm text-gray-500">Actualiza las credenciales de tu cuenta siguiendo las reglas de seguridad.</p>
          </div>
          
          <form className="p-6 space-y-6" onSubmit={handlePasswordUpdate}>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual (Opcional)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Requerido en configuraciones avanzadas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="8 caract, mayúsc, minúsc, número"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Repite tu contraseña"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium rounded-lg transition disabled:opacity-50 shadow-sm min-w-[180px] flex items-center justify-center"
              >
                {passwordSaving ? (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Actualizar Contraseña"
                )}
              </button>
            </div>
          </form>
        </section>

      </div>
    </div>
  )
}
