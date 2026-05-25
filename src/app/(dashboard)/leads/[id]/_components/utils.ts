import { supabase } from "@/lib/supabaseClient"

export const PACKAGES = [
  { name: 'Landing Page', price: 400 },
  { name: 'Sitio Web Empresarial', price: 650 },
  { name: 'Sitio Web para Generación de Clientes', price: 900 },
  { name: 'Sitio Web con Ecommerce', price: 1100 },
  { name: 'Sitio Web Interactivo con Reservas', price: 1300 },
  { name: 'Otro', price: 0 },
]

export const statusOptions = ['nuevo', 'contactado', 'reunión', 'demo', 'propuesta', 'venta', 'perdido']

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'nuevo': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'venta': return 'bg-green-100 text-green-700 border-green-200'
    case 'perdido': return 'bg-red-100 text-red-700 border-red-200'
    case 'contactado': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'reunión': return 'bg-purple-100 text-purple-700 border-purple-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export async function insertActivity(leadId: string, userId: string, type: string, description: string) {
  try {
    const { error } = await supabase.from('activities').insert({
      lead_id: leadId,
      type,
      description,
      created_by: userId
    })
    if (error) console.error("Error inserting activity:", error)
  } catch (err) {
    console.error("Error inserting activity:", err)
  }
}
