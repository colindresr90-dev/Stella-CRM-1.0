import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface OrgSettings {
  id: string
  company_name: string | null
  currency: string | null
  monthly_sales_target: number | null
  logo_url: string | null
  updated_at: string | null
}

export function useOrgSettings() {
  return useQuery<OrgSettings>({
    queryKey: ['org_settings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')
      const res = await fetch('/api/organization-settings', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to load org settings')
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })
}
