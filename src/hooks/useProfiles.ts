import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface ProfileOption {
  id: string
  name: string
}

export function useProfiles() {
  return useQuery<ProfileOption[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 10 * 60 * 1000, // profiles rarely change — cache 10 min
  })
}
