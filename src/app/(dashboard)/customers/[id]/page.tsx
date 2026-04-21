"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { createNotification } from "@/lib/notifications"
import { 
  ArrowLeft, 
  Loader2, 
  CreditCard, 
  Calendar, 
  History, 
  MessageSquare, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  Plus, 
  Trash2,
  Wallet,
  TrendingUp,
  Mail,
  Phone,
  ShieldAlert
} from "lucide-react"

type PageProps = {
  params: Promise<{ id: string }>
}

type Lead = {
  id: string
  business_name: string
  contact_name: string
  phone: string | null
  email: string | null
  status: string
  assigned_to: string
  created_at: string
}

type Sale = {
  id: string
  lead_id: string
  package: string
  total_amount: number
  deposit_amount: number
  pending_amount: number
  status: 'pendiente' | 'pagado'
  created_at: string
}

type Note = {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
  creator?: { name: string } | null
}

type Activity = {
  id: string
  lead_id: string
  type: string
  description: string
  created_at: string
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Lead | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [user, setUser] = useState<any>(null)
  
  // UI State
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUser(user)

      // Fetch Customer Data (Lead where status = 'venta')
      const { data: leadData } = await supabase.from('leads').select('*').eq('id', id).single()
      if (leadData) {
        setCustomer(leadData)
      } else {
        router.push("/customers")
        return
      }

      // Fetch Sales
      const { data: salesData } = await supabase.from('sales').select('*').eq('lead_id', id).order('created_at', { ascending: false })
      setSales(salesData || [])

      // Fetch Notes
      const { data: notesData } = await supabase.from('notes').select('*, creator:profiles(name)').eq('lead_id', id).order('created_at', { ascending: false })
      setNotes(notesData || [])

      // Fetch Activities
      const { data: actsData } = await supabase.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false })
      setActivities(actsData || [])

      setLoading(false)
    }
    init()
  }, [id, router])

  const insertActivity = async (type: string, description: string) => {
    if (!user) return
    const { data } = await supabase.from('activities').insert({
      lead_id: id,
      type,
      description,
      created_by: user.id
    }).select().single()
    
    if (data) setActivities([data, ...activities])
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return
    setSavingNote(true)
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        lead_id: id,
        content: newNote.trim(),
        created_by: user.id
      })
      .select('*, creator:profiles(name)')
      .single()
    
    if (data) {
      setNotes([data, ...notes])
      setNewNote('')
      await insertActivity('note', 'Nota post-venta agregada')
    }
    setSavingNote(false)
  }

  const handleConfirmPayment = async (sale: Sale) => {
    if (sale.status === 'pagado' || actionInProgress) return
    setActionInProgress(true)

    try {
      const { error } = await supabase
        .from('sales')
        .update({ 
          status: 'pagado', 
          pending_amount: 0,
          deposit_amount: sale.total_amount 
        })
        .eq('id', sale.id)

      if (!error && user && customer) {
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, status: 'pagado', pending_amount: 0, deposit_amount: sale.total_amount } : s))
        await insertActivity('payment_confirmed', `Pago completado para el paquete: ${sale.package}`)
        
        await createNotification({
          user_id: user.id,
          title: 'Pago Confirmado',
          message: `Se ha completado el pago de $${sale.pending_amount} para ${customer.business_name}`,
          type: 'update',
          related_id: id
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionInProgress(false)
    }
  }

  const totalSpent = sales.reduce((acc, s) => acc + s.total_amount, 0)
  const totalPending = sales.reduce((acc, s) => acc + s.pending_amount, 0)

  if (loading || !customer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/customers')}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-highest transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-headline text-3xl font-bold text-on-background">{customer.business_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded uppercase tracking-widest">Cliente Activo</span>
              <span className="text-on-surface-variant text-xs flex items-center gap-1">
                <Calendar size={12} /> Miembro desde {new Date(customer.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => router.push('/sales')}
            className="bg-primary text-on-primary font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Nueva Venta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: FINANCIALS & SALES */}
        <div className="lg:col-span-12 xl:col-span-8 space-y-8">
           {/* FINANCIAL DASHBOARD */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 relative overflow-hidden group">
               <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
               <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Inversión Total</p>
               <h3 className="font-headline text-3xl font-extrabold text-on-background">${totalSpent.toLocaleString()}</h3>
               <div className="flex items-center gap-1 mt-4 text-[10px] font-medium text-primary">
                 <TrendingUp size={12} /> Valor de por vida del cliente
               </div>
             </div>

             <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 relative overflow-hidden group">
               <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
               <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-1">Pendiente de Cobro</p>
               <h3 className="font-headline text-3xl font-extrabold text-amber-600">${totalPending.toLocaleString()}</h3>
               <div className="flex items-center gap-1 mt-4 text-[10px] font-medium text-amber-600">
                 <Clock size={12} /> {totalPending > 0 ? 'Facturas pendientes por liquidar' : 'Sin deudas pendientes'}
               </div>
             </div>

             <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 flex flex-col justify-center gap-4">
               <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Email</p>
                    <p className="text-sm font-bold text-on-surface truncate pr-1">{customer.email || 'N/A'}</p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Teléfono</p>
                    <p className="text-sm font-bold text-on-surface">{customer.phone || 'N/A'}</p>
                  </div>
               </div>
             </div>
           </div>

           {/* SALES HISTORY */}
           <div className="bg-surface-container-low rounded-3xl p-2 border border-outline-variant/10">
              <div className="px-6 py-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold text-on-background flex items-center gap-2">
                  <History size={18} className="text-primary" /> Historial de Transacciones
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant border-b border-outline-variant/5">
                      <th className="px-8 py-5">Paquete / Servicio</th>
                      <th className="px-6 py-5">Fecha</th>
                      <th className="px-6 py-5">Monto Total</th>
                      <th className="px-6 py-5">Estado</th>
                      <th className="px-8 py-5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="group hover:bg-surface-container-highest/20 transition-all">
                        <td className="px-8 py-6">
                           <p className="font-bold text-sm text-on-surface">{sale.package}</p>
                           <p className="text-[10px] text-on-surface-variant mt-0.5">Venta ID: {sale.id.split('-')[0]}</p>
                        </td>
                        <td className="px-6 py-6 text-xs text-on-surface-variant font-medium">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-6 font-bold text-sm text-on-surface">
                          ${sale.total_amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-6">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 w-fit ${
                            sale.status === 'pagado' 
                              ? 'bg-green-500/10 text-green-700' 
                              : 'bg-amber-500/10 text-amber-700'
                          }`}>
                            {sale.status === 'pagado' ? <CheckCircle size={10} /> : <Clock size={10} />}
                            {sale.status === 'pagado' ? 'Liquidado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {sale.status === 'pendiente' && (
                            <button 
                              onClick={() => handleConfirmPayment(sale)}
                              className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-on-primary transition-all"
                            >
                              Marcar como Pagado
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-on-surface-variant text-sm font-medium italic">
                          No se encontraron transacciones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: TIMELINE & NOTES */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-6">
           {/* LOG NEW NOTE */}
           <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 bg-primary/5 rounded-bl-3xl">
                <MessageSquare size={16} className="text-primary opacity-30" />
              </div>
              <h3 className="font-headline text-lg font-bold text-on-background mb-4">Notas Internas</h3>
              <div className="space-y-4">
                <textarea 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Detalles sobre retención, nuevas necesidades, seguimiento..."
                  className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-4 text-xs font-medium text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all resize-none min-h-[100px] ambient-shadow"
                />
                <button 
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || savingNote}
                  className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Guardar Nota
                </button>
              </div>
           </div>

           {/* RECENT JOURNEY */}
           <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/10">
              <h3 className="font-headline text-lg font-bold text-on-background mb-6 flex items-center gap-2">
                <History size={18} className="text-primary" /> Recorrido del Cliente
              </h3>
              <div className="space-y-0 relative border-l-2 border-outline-variant/10 ml-2">
                 {activities.slice(0, 8).map((act, i) => (
                   <div key={act.id} className="pl-6 relative pb-6 group">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full border-4 border-surface-container-low bg-primary group-hover:scale-125 transition-transform" />
                      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/5 group-hover:border-primary/20 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{act.type.replace('_', ' ')}</span>
                          <span className="text-[10px] text-on-surface-variant font-medium">{new Date(act.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{act.description}</p>
                      </div>
                   </div>
                 ))}
                 {activities.length === 0 && (
                   <div className="py-8 text-center text-xs text-on-surface-variant font-medium italic">Sin actividad reciente</div>
                 )}
              </div>
           </div>

           {/* NOTES LIST */}
           <div className="space-y-4">
              {notes.slice(0, 3).map((note) => (
                <div key={note.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/10 shadow-sm relative group overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 bg-primary/5 rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} className="text-on-surface-variant hover:text-red-500 cursor-pointer" />
                   </div>
                   <p className="text-xs text-on-surface font-medium leading-relaxed">{note.content}</p>
                   <div className="flex items-center justify-between mt-3">
                      <p className="text-[10px] font-bold text-primary/70">{note.creator?.name || 'Sistema'}</p>
                      <p className="text-[10px] font-medium text-on-surface-variant">{new Date(note.created_at).toLocaleDateString()}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  )
}
