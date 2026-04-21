"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { getUserRole } from "@/lib/authHelper"
import { 
  Building2, 
  Package, 
  Users, 
  Settings as SettingsIcon, 
  Save, 
  Plus, 
  Trash2, 
  Target, 
  Globe, 
  DollarSign, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

type OrgSettings = {
  id: string;
  company_name: string;
  logo_url: string | null;
  currency: string;
  monthly_sales_target: number;
}

type ServicePackage = {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

type LeadSource = {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'general' | 'ventas' | 'leads'>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  // Settings State
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  
  // Form State
  const [newPackage, setNewPackage] = useState({ name: '', price: '', description: '' })
  const [newSource, setNewSource] = useState('')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { role } = await getUserRole()
      setUserRole(role)

      if (role !== 'admin') {
        router.push('/')
        return
      }

      await fetchData()
    }
    init()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Organization Settings
      const { data: orgData, error: orgError } = await supabase
        .from('organization_settings')
        .select('*')
        .single()
      
      if (orgError && orgError.code !== 'PGRST116') {
         console.error('Error fetching settings:', orgError)
      } else {
         setSettings(orgData)
      }

      // 2. Service Packages
      const { data: pkgData } = await supabase
        .from('service_packages')
        .select('*')
        .order('name')
      setPackages(pkgData || [])

      // 3. Lead Sources
      const { data: srcData } = await supabase
        .from('lead_sources')
        .select('*')
        .order('name')
      setSources(srcData || [])

    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings || saving) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('organization_settings')
        .update({
          company_name: settings.company_name,
          currency: settings.currency,
          monthly_sales_target: settings.monthly_sales_target
        })
        .eq('id', settings.id)
      
      if (error) throw error
      showToast("Configuración general guardada.", "success")
    } catch (err: any) {
      showToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleAddPackage = async () => {
    if (!newPackage.name || !newPackage.price) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('service_packages')
        .insert({
          name: newPackage.name,
          price: parseFloat(newPackage.price),
          description: newPackage.description
        })
        .select()
        .single()
      
      if (error) throw error
      setPackages([...packages, data])
      setNewPackage({ name: '', price: '', description: '' })
      showToast("Paquete agregado.", "success")
    } catch (err: any) {
      showToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePackage = async (id: string) => {
    try {
      const { error } = await supabase.from('service_packages').delete().eq('id', id)
      if (error) throw error
      setPackages(packages.filter(p => p.id !== id))
      showToast("Paquete eliminado.", "success")
    } catch (err: any) {
      showToast(err.message, "error")
    }
  }

  const handleAddSource = async () => {
    if (!newSource.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({ name: newSource.trim() })
        .select()
        .single()
      
      if (error) throw error
      setSources([...sources, data])
      setNewSource('')
      showToast("Fuente agregada.", "success")
    } catch (err: any) {
      showToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    try {
      const { error } = await supabase.from('lead_sources').delete().eq('id', id)
      if (error) throw error
      setSources(sources.filter(s => s.id !== id))
      showToast("Fuente eliminada.", "success")
    } catch (err: any) {
      showToast(err.message, "error")
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
    <div className="min-h-screen bg-surface p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <SettingsIcon className="text-primary" size={28} />
            </div>
            Settings
          </h1>
          <p className="text-on-surface-variant mt-2 font-medium">Gestiona la configuración global de tu negocio.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-low p-1.5 rounded-2xl mb-8 w-fit border border-outline-variant/10 shadow-sm">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'general' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
        >
          <Building2 size={18} /> General
        </button>
        <button
          onClick={() => setActiveTab('ventas')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'ventas' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
        >
          <Package size={18} /> Ventas
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'leads' ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
        >
          <Users size={18} /> Prospectos
        </button>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-xl shadow-black/5"
            >
              <form onSubmit={handleSaveGeneral} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Nombre de la Empresa</label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={20} />
                      <input
                        type="text"
                        value={settings?.company_name || ''}
                        onChange={(e) => setSettings(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                        className="w-full pl-12 pr-4 py-4 bg-surface rounded-2xl border border-outline-variant/20 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium"
                        placeholder="Ej: Stella CRM"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Moneda del Sistema</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={20} />
                      <select
                        value={settings?.currency || 'USD'}
                        disabled={true} // Locked as per request
                        className="w-full pl-12 pr-4 py-4 bg-surface rounded-2xl border border-outline-variant/20 outline-none appearance-none cursor-not-allowed font-medium opacity-70"
                      >
                        <option value="USD">Dólar Estadounidense (USD)</option>
                        <option value="MXN">Peso Mexicano (MXN)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-on-surface-variant/60 font-medium italic mt-1">* Configurado como global por el momento.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant/10 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {activeTab === 'ventas' && (
            <motion.div
              key="ventas"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Monthly Goal Card */}
              <div className="bg-gradient-to-br from-primary to-primary-container rounded-[2.5rem] p-10 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                      <Target size={32} /> Meta de Ventas Mensual
                    </h2>
                    <p className="opacity-80 mt-2 font-medium">Define el objetivo de ingresos para todo el equipo.</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 p-2 rounded-3xl backdrop-blur-md">
                     <div className="pl-6 pr-2">
                        <span className="text-4xl font-headline font-black tracking-tighter">
                          ${(settings?.monthly_sales_target || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold opacity-60 ml-2 uppercase">USD / Mes</span>
                     </div>
                     <button 
                        onClick={() => {
                           const val = prompt("Ingresa la nueva meta mensual ($):", settings?.monthly_sales_target.toString())
                           if (val && !isNaN(parseFloat(val))) {
                              setSettings(prev => prev ? { ...prev, monthly_sales_target: parseFloat(val) } : null)
                           }
                        }}
                        className="bg-white text-primary p-4 rounded-2xl shadow-lg hover:scale-105 transition-transform"
                     >
                        <SettingsIcon size={20} />
                     </button>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
              </div>

              {/* Service Catalog */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-xl shadow-black/5">
                <h3 className="text-xl font-black text-on-surface mb-6 flex items-center gap-2">
                  <Package className="text-primary" size={24} /> Catálogo de Paquetes
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Add Form */}
                  <div className="lg:col-span-1 bg-surface rounded-3xl p-6 space-y-4 h-fit">
                    <h4 className="text-sm font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-2">
                      <Plus size={16} /> Nuevo Paquete
                    </h4>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Nombre del paquete"
                        value={newPackage.name}
                        onChange={e => setNewPackage({ ...newPackage, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-outline-variant/20 outline-none focus:border-primary text-sm font-medium"
                      />
                      <input
                        type="number"
                        placeholder="Precio (USD)"
                        value={newPackage.price}
                        onChange={e => setNewPackage({ ...newPackage, price: e.target.value })}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-outline-variant/20 outline-none focus:border-primary text-sm font-medium font-headline"
                      />
                      <textarea
                        placeholder="Descripción corta"
                        value={newPackage.description}
                        onChange={e => setNewPackage({ ...newPackage, description: e.target.value })}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-outline-variant/20 outline-none focus:border-primary text-sm font-medium h-24 resize-none"
                      />
                      <button
                        onClick={handleAddPackage}
                        disabled={saving || !newPackage.name || !newPackage.price}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> Agregar al Catálogo
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="lg:col-span-2">
                    <div className="space-y-4">
                      {packages.length === 0 ? (
                        <div className="text-center py-20 bg-surface/50 rounded-3xl border-2 border-dashed border-outline-variant/20">
                          <Package className="mx-auto text-on-surface-variant/30 mb-3" size={48} />
                          <p className="text-on-surface-variant font-medium">No hay paquetes registrados.</p>
                        </div>
                      ) : (
                        packages.map(pkg => (
                          <div key={pkg.id} className="flex items-center justify-between p-6 bg-surface rounded-3xl border border-outline-variant/5 hover:border-primary/20 transition-all group">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm">
                                <DollarSign size={24} />
                              </div>
                              <div>
                                <h5 className="font-bold text-on-surface leading-tight">{pkg.name}</h5>
                                {pkg.description && <p className="text-xs text-on-surface-variant mt-1">{pkg.description}</p>}
                                <span className="text-xs font-headline font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full mt-2 inline-block">${pkg.price.toLocaleString()} USD</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="p-3 text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'leads' && (
            <motion.div
              key="leads"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-xl shadow-black/5"
            >
              <h3 className="text-xl font-black text-on-surface mb-8 flex items-center gap-2">
                <Users className="text-primary" size={24} /> Fuentes de Origen
              </h3>
              
              <div className="max-w-2xl">
                <div className="flex gap-4 mb-8">
                  <input
                    type="text"
                    value={newSource}
                    onChange={e => setNewSource(e.target.value)}
                    placeholder="Ej: Referido, Instagram Ads..."
                    className="flex-1 px-6 py-4 bg-surface rounded-2xl border border-outline-variant/20 outline-none focus:border-primary font-medium"
                  />
                  <button
                    onClick={handleAddSource}
                    disabled={saving || !newSource.trim()}
                    className="bg-primary text-white px-8 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    <Plus size={20} /> Agregar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sources.map(src => (
                    <div key={src.id} className="flex items-center justify-between px-6 py-4 bg-surface rounded-2xl group border border-outline-variant/10 hover:border-primary/30 transition-all">
                      <span className="font-bold text-on-surface">{src.name}</span>
                      <button
                        onClick={() => handleDeleteSource(src.id)}
                        className="p-2 text-on-surface-variant/0 group-hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {sources.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-on-surface-variant font-medium">No hay fuentes definidas.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistence Button for General Tab or Modal change confirmation */}
      {activeTab === 'general' && (
        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-blue-700 text-sm font-medium">
          <AlertCircle size={18} />
          <span>La mayoría de estos cambios se reflejarán instantáneamente en tu Dashboard y Header.</span>
        </div>
      )}

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
