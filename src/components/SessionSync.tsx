"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function SessionSync() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const maxAgeAccess = session.expires_in || 3600
        const maxAgeRefresh = 604800 // 7 days
        
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${maxAgeAccess}; SameSite=Lax; Secure`
        document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${maxAgeRefresh}; SameSite=Lax; Secure`
      } else {
        document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure'
        document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure'
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
