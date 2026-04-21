"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const router = useRouter()

  useEffect(() => {
    // When the user clicks the link in their email, Supabase handles setting the session securely in the background.
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          // If the link is invalid, expired, or they simply aren't authenticated
          router.push("/login")
        } else {
          setCheckingSession(false)
        }
      } catch (err) {
        router.push("/login")
      }
    }
    
    checkSession()
  }, [router])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setMessage({
        text: "¡Tu contraseña ha sido actualizada exitosamente! Redirigiendo...",
        type: "success"
      })

      // Optional: Clear out `must_change_password` flag just in case this was a forced reset that they triggered themselves
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
         await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id)
      }

      setTimeout(() => {
        router.push("/")
      }, 1500)

    } catch (err: any) {
      setMessage({
        text: err.message || "Ocurrió un error al intentar actualizar la contraseña.",
        type: "error"
      })
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Crear contraseña</h1>
          <p className="mt-2 text-sm text-gray-500">
            Ingresa tu nueva contraseña para acceder a tu cuenta.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="block w-full px-4 py-3 rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              placeholder="Min. 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className={`p-4 text-sm rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? "Actualizando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  )
}
