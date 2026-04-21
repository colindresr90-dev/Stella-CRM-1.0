"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import type { User } from "@supabase/supabase-js"
import { KeyRound, User as UserIcon, CheckCircle2, ChevronRight, Loader2 } from "lucide-react"

export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(0) // 0: Password, 1: Profile
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  
  // step 0: Password state
  const [password, setPassword] = useState("")
  
  // step 1: Profile state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  
  const router = useRouter()

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session?.user) {
          router.push("/login")
          return
        }
        
        setUser(session.user)

        // Check profile status
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, must_change_password, onboarding_completed")
          .eq("id", session.user.id)
          .single()
        
        if (profileError) {
            console.error("Error fetching profile:", profileError);
            // If profile is missing but user exists, we continue to step 0
            setStep(0);
            setLoading(false);
            return;
        }
          
        if (profile?.onboarding_completed) {
          router.push("/")
          return
        }

        // Determine initial step
        if (profile?.must_change_password) {
          setStep(0)
        } else {
          setStep(1)
        }
        
        setLoading(false)
      } catch (err) {
        console.error("Error connecting to Supabase auth:", err)
        router.push("/login")
      }
    }

    checkAuthAndProfile()
  }, [router])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setSaving(true)
    setMessage(null)
    
    try {
      // 1. Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })
      
      if (updateError) throw updateError
      
      // 2. Update profile to clear must_change_password flag
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id)
        
      if (profileError) throw profileError
      
      setMessage({
        text: "¡Contraseña actualizada con éxito!",
        type: "success"
      })

      // Move to next step
      setTimeout(() => {
        setStep(1)
        setMessage(null)
        setSaving(false)
      }, 1000)
      
    } catch (error: any) {
      setMessage({
        text: error.message || "Error al actualizar la contraseña.",
        type: "error"
      })
      setSaving(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setSaving(true)
    setMessage(null)
    
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        name: `${firstName} ${lastName}`.trim(),
        phone,
        onboarding_completed: true,
        must_change_password: false
      })
      
      if (error) throw error
      
      // Onboarding complete!
      router.push("/")
    } catch (err: any) {
      setMessage({
        text: err.message || "Error al completar el perfil. Por favor intenta de nuevo.",
        type: "error"
      })
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12 font-sans">
      <div className="w-full max-w-xl">
        {/* Progress Tracker */}
        <div className="flex items-center justify-center gap-4 mb-12">
            <div className={`flex items-center gap-2 ${step >= 0 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all font-bold ${step === 0 ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : step > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'border-outline-variant text-on-surface-variant/40'}`}>
                    {step > 0 ? <CheckCircle2 size={16} /> : "1"}
                </div>
                <span className="text-xs font-black uppercase tracking-widest italic">Seguridad</span>
            </div>
            <div className={`w-12 h-px ${step > 0 ? 'bg-primary' : 'bg-outline-variant'} opacity-20`} />
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all font-bold ${step === 1 ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-outline-variant text-on-surface-variant/40'}`}>
                    "2"
                </div>
                <span className="text-xs font-black uppercase tracking-widest italic">Perfil</span>
            </div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2.5rem] p-10 shadow-huge border border-outline-variant/10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.03] rounded-bl-full -translate-y-20 translate-x-20 -z-10" />
          
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
                {step === 0 ? <KeyRound size={32} /> : <UserIcon size={32} />}
            </div>
            <h1 className="text-3xl font-black text-on-surface font-headline italic tracking-tight">
                {step === 0 ? "Asegura tu cuenta" : "Cuéntanos de ti"}
            </h1>
            <p className="mt-2 text-sm font-medium text-on-surface-variant max-w-sm mx-auto">
                {step === 0 
                    ? "Por seguridad, debes actualizar tu contraseña temporal antes de continuar." 
                    : "Necesitamos algunos datos básicos para configurar tu espacio de trabajo."}
            </p>
          </div>

          <div className="space-y-6">
            {step === 0 ? (
                <form onSubmit={handleSetPassword} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest italic ml-1">
                            Nueva Contraseña
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/20 px-5 py-4 rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl text-xs font-bold animate-in zoom-in-95 duration-200 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
                            <div className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`} />
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving || password.length < 6}
                        className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest italic shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-2 group"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Continuar al Perfil
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleProfileSubmit} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest italic ml-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant/20 px-5 py-4 rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                placeholder="Ej. Juan"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest italic ml-1">
                                Apellido
                            </label>
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant/20 px-5 py-4 rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                placeholder="Ej. Pérez"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-on-surface-variant uppercase tracking-widest italic ml-1">
                            Teléfono
                        </label>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/20 px-5 py-4 rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                            placeholder="+52 000 000 0000"
                        />
                    </div>

                    {message && (
                        <div className="p-4 rounded-2xl text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-600" />
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving || !firstName || !lastName || !phone}
                        className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest italic shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-2 group"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Finalizar Registro
                                <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                            </>
                        )}
                    </button>
                    
                    <p className="text-[10px] text-center text-on-surface-variant/50 font-bold uppercase tracking-widest mt-4">
                        Al finalizar, tendrás acceso total al panel de Stella CRM
                    </p>
                </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
