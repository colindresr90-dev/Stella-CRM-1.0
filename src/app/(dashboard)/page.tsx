"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { 
  Building2, 
  TrendingUp, 
  Users, 
  Target, 
  Phone, 
  Mail, 
  Calendar, 
  CheckCircle2,
  ArrowUpRight,
  Wallet,
  Clock,
  ExternalLink,
  Plus,
  X,
  Loader2,
  Search,
  Briefcase,
  Trophy,
  PieChart,
  BarChart3,
  Activity,
  Filter,
  Zap,
  TrendingDown,
  DollarSign,
  ChevronDown,
  MessageSquare
} from "lucide-react";
import { getUserRole } from "@/lib/authHelper";
import { motion, AnimatePresence } from "motion/react";

type DashboardMetrics = {
  totalRevenue: number;
  pendingDebt: number;
  newLeads: number;
  activeDeals: number;
  winRate: number;
}

type Period = 'Day' | 'Week' | 'Month' | 'Year' | 'Custom';

type DashboardActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  lead_name: string;
  lead_id: string;
}

type DashboardReminder = {
  id: string;
  lead_id: string;
  lead_name: string;
  note: string;
  time: string | null;
  date: string;
  overdue: boolean;
  type: 'reminder' | 'meeting';
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    pendingDebt: 0,
    newLeads: 0,
    activeDeals: 0,
    winRate: 0,
  });
  const [recentActivities, setRecentActivities] = useState<DashboardActivity[]>([]);
  const [reminders, setReminders] = useState<DashboardReminder[]>([]);
  const [allPendingReminders, setAllPendingReminders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{name: string, value: number, label: string}[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  
  // Expert Admin State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [forecast, setForecast] = useState({ potential: 0, total: 0 });
  const [workload, setWorkload] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]); // For Admins
  const [personalGoals, setPersonalGoals] = useState({
    monthlyLeads: 0,
    monthlySales: 0,
    cycleSales: 0,
    bonusAmount: 0,
    commissions: 0,
    nextBonusSales: 0,
    activeAgents: 1,
    totalRevenueGoal: 0
  }); // For Agents
  const [teamLeads, setTeamLeads] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [lastUpdatePing, setLastUpdatePing] = useState(false); // For real-time visual feedback
  
  // Leads for selection
  const [availableLeads, setAvailableLeads] = useState<{id: string, name: string}[]>([]);
  
  // Agent Selection (Admin only)
  const [agents, setAgents] = useState<{id: string, name: string}[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  
  // Advanced Filter State
  const [period, setPeriod] = useState<Period>('Week');
  const [customRange, setCustomRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Modal States
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    lead_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    note: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'personal' | 'lead'>('personal');

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      setUser(session.user);
      const { role, permissions } = await getUserRole();
      setUserRole(role);
      setPermissions(permissions);
      
      // Fetch Organization Goal (Revenue Target)
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('monthly_sales_target')
        .single();
      const revenueGoal = orgSettings?.monthly_sales_target || 0;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
        if (profileData.must_change_password || profileData.onboarding_completed === false) {
          router.push("/onboarding");
          return;
        }
      }
      
      // Fetch Agents for selector (Admin or has specific permission)
      if (role === 'admin' || permissions.includes('filter_dashboard_by_agent')) {
        const { data: agentsData } = await supabase.from('profiles').select('id, name');
        if (agentsData) {
          const filteredAgents = agentsData.filter(p => 
            !p.name.toLowerCase().includes('rodrigo') && 
            !p.name.toLowerCase().includes('gerardo')
          );
          setAgents(filteredAgents);
        }
      }

      if (session?.user?.id) {
        await fetchData(session.user.id as string, role || 'viewer', permissions, revenueGoal);
      }
      setLoading(false);
    };

    initDashboard();
  }, [period, customRange, router, selectedAgentId]);

  // Handle Real-time Subscriptions
  useEffect(() => {
    if (!userRole || !user?.id) return;

    const channel = supabase
      .channel('dashboard-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          fetchData(user.id, userRole!, permissions);
          setLastUpdatePing(true);
          setTimeout(() => setLastUpdatePing(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          fetchData(user.id, userRole!, permissions);
          setLastUpdatePing(true);
          setTimeout(() => setLastUpdatePing(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, user?.id, permissions]);

  const fetchData = async (userId: string, role: string, permissions: string[], revenueGoal: number = 0) => {
      // 1. Calculate Period Range
      let startDate = new Date();
      let endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      if (period === 'Day') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'Week') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'Month') {
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'Year') {
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'Custom') {
        startDate = new Date(customRange.start);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);
      }

      // 2. Fetch All Profiles (Excluding CEOs Rodrigo and Gerardo)
      const { data: profsData } = await supabase.from('profiles').select('id, name');
      const profs = (profsData || []).filter(p => 
        !p.name.toLowerCase().includes('rodrigo') && 
        !p.name.toLowerCase().includes('gerardo')
      );

      // 3. Fetch ALL Leads for Team Stats (Leaderboard, Funnel)
      const { data: teamLeadsData } = await supabase.from('leads').select('*, sales(*)');
      const teamLeads = teamLeadsData || [];
      setTeamLeads(teamLeads);
      
      // 2.5 Filter Leads for Personal Metrics
      const canViewAll = role === 'admin' || permissions.includes('view_team_dashboard');
      const canFilterByAgent = role === 'admin' || permissions.includes('filter_dashboard_by_agent');

      let myLeads = teamLeads || [];
      if (!canViewAll) {
        myLeads = (teamLeads || []).filter(l => l.assigned_to === userId);
      } else if (canFilterByAgent && selectedAgentId !== 'all') {
        myLeads = (teamLeads || []).filter(l => l.assigned_to === selectedAgentId);
      }

      const leads = myLeads;
      setLeads(leads);

      if (leads) {
        // Filter leads/sales for metrics within range
        const periodLeads = leads.filter(l => {
          const d = new Date(l.created_at);
          return d >= startDate && d <= endDate;
        });

        const periodSales = leads.flatMap(l => l.sales || []).filter(s => {
          const d = new Date(s.created_at);
          return d >= startDate && d <= endDate;
        });

        // Metrics Calculation
        const ganados = periodLeads.filter(l => ['venta', 'sold', 'cerrado'].includes((l.status || '').toLowerCase())).length;
        const perdidos = periodLeads.filter(l => ['perdido', 'lost'].includes((l.status || '').toLowerCase())).length;
        const winRate = (ganados + perdidos) > 0 ? (ganados / (ganados + perdidos)) * 100 : 0;
        
        const totalRevenue = periodSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
        const pendingDebt = periodSales.reduce((acc, s) => acc + (s.pending_amount || 0), 0);
        const activeDeals = teamLeads.filter(l => !['venta', 'sold', 'cerrado', 'perdido', 'lost'].includes((l.status || '').toLowerCase())).length; 

        setMetrics({
          totalRevenue,
          pendingDebt,
          newLeads: periodLeads.length,
          activeDeals,
          winRate
        });

        // 3. Adaptive Chart Data Generation (Now using teamLeads for momentum)
        const generatedData = [];
        const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        
        const chartSource = teamLeads || [];
        const periodTeamLeads = chartSource.filter(l => {
          const d = new Date(l.created_at);
          return !isNaN(d.getTime()) && d >= startDate && d <= endDate;
        });

        if (period === 'Day' || (period === 'Custom' && diffDays <= 1)) {
          // Hourly (24 ticks)
          for (let i = 0; i < 24; i++) {
            const hCount = periodTeamLeads.filter(l => new Date(l.created_at).getHours() === i).length;
            generatedData.push({ name: `${i}:00`, value: hCount, label: `${i}:00` });
          }
        } else if (period === 'Week') {
          // Daily (7 days)
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const count = periodTeamLeads.filter(l => new Date(l.created_at).toDateString() === d.toDateString()).length;
            generatedData.push({ name: d.toLocaleString('es-ES', { weekday: 'short' }), value: count, label: d.toLocaleDateString() });
          }
        } else if (period === 'Month' || (period === 'Custom' && diffDays <= 31)) {
          // Daily (period days)
          const tempDate = new Date(startDate);
          while (tempDate <= endDate) {
             const count = periodTeamLeads.filter(l => new Date(l.created_at).toDateString() === tempDate.toDateString()).length;
             generatedData.push({ name: tempDate.getDate().toString(), value: count, label: tempDate.toLocaleDateString() });
             tempDate.setDate(tempDate.getDate() + 1);
          }
        } else {
          // Monthly (Last 12 months)
          for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const count = chartSource.filter(l => {
              const ld = new Date(l.created_at);
              return !isNaN(ld.getTime()) && ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
            }).length;
            generatedData.push({ name: d.toLocaleString('es-ES', { month: 'short' }), value: count, label: d.toLocaleString('es-ES', { month: 'long', year: 'numeric' }) });
          }
        }
        setChartData(generatedData);

        // EXTRA: EXPERT TEAM TOOLS DATA AGGREGATION (Now for everyone as requested)
        if (teamLeads) {
          const profilesMap = new Map(profs.map(p => [p.id, p.name]));

          // B. Funnel Calculation (Normalized for case-sensitivity and synonyms)
          const funnelStages = [
            { key: 'nuevo', label: 'Nuevos', color: 'bg-blue-400', matches: ['nuevo', 'new'] },
            { key: 'contactado', label: 'Contactados', color: 'bg-yellow-400', matches: ['contactado', 'interesado'] },
            { key: 'reunión', label: 'Reuniones', color: 'bg-purple-400', matches: ['reunión', 'meeting', 'cita'] },
            { key: 'demo', label: 'Demos', color: 'bg-indigo-400', matches: ['demo'] },
            { key: 'propuesta', label: 'Propuestas', color: 'bg-orange-400', matches: ['propuesta'] },
            { key: 'venta', label: 'Ventas', color: 'bg-green-400', matches: ['venta', 'sold', 'cerrado'] }
          ];
          
          const funnel = funnelStages.map(stage => ({
            status: stage.label,
            count: teamLeads.filter(l => stage.matches.includes((l.status || '').toLowerCase())).length,
            color: stage.color
          }));
          setFunnelData(funnel);

          // C. Source Analysis (Cleaned and Global)
          const cleanSource = (src: string) => {
            if (!src) return 'Sin Origen';
            const s = src.toLowerCase();
            if (s.includes('instagram')) return 'Instagram';
            if (s.includes('facebook') || s.includes('fb')) return 'Facebook';
            if (s.includes('whatsapp') || s.includes('wa.')) return 'WhatsApp';
            if (s.includes('tiktok')) return 'TikTok';
            if (s.includes('google')) return 'Google';
            if (s.includes('referido') || s.includes('recomendación')) return 'Referido';
            return src.length > 20 ? src.substring(0, 17) + '...' : src;
          };

          const sources: any = {};
          (teamLeads || []).forEach(l => {
            const src = cleanSource(l.source || '');
            sources[src] = (sources[src] || 0) + 1;
          });
          setSourceData(Object.entries(sources).map(([name, value]) => ({ name, value } as any)).sort((a,b) => b.value - a.value));

          // D. Leaderboard (Sales Performance)
          const agentStats: any = {};
          (profs || []).forEach(p => {
             agentStats[p.id] = { id: p.id, name: p.name, revenue: 0, deals: 0, totalLeads: 0 };
          });

          teamLeads.forEach(l => {
            if (l.assigned_to && agentStats[l.assigned_to]) {
              agentStats[l.assigned_to].totalLeads++;
              if (l.status === 'venta') {
                agentStats[l.assigned_to].deals++;
                const leadRevenue = (l.sales || []).reduce((acc: number, s: any) => acc + (s.total_amount || 0), 0);
                agentStats[l.assigned_to].revenue += leadRevenue;
              }
            }
          });

          const leaderboardSorted = Object.values(agentStats)
            .sort((a: any, b: any) => b.revenue - a.revenue)
            .filter((a: any) => a.totalLeads > 0 || a.revenue > 0);
          setLeaderboard(leaderboardSorted);

          // E. Forecast (Pipeline Value - Team based)
          const potential = teamLeads
            .filter(l => ['reunión', 'demo', 'propuesta'].includes(l.status))
            .reduce((acc, l) => acc + (l.sale_price || 0), 0);
          setForecast({ potential, total: teamLeads.filter(l => l.status !== 'venta' && l.status !== 'perdido').length });

          // F. Workload
          setWorkload(leaderboardSorted.map((a: any) => ({
             id: a.id,
             name: a.name,
             active: a.totalLeads - a.deals, // Active = Total - Closed (simplification)
             capacity: 20 // Default capacity for visualization
          })));

          // G. Performance Monitoring (Daily & Monthly Targets)
          const todayStart = new Date();
          todayStart.setHours(0,0,0,0);
          
          const perfData = (profs || []).map(p => {
            const todayLeads = teamLeads.filter(l => l.assigned_to === p.id && new Date(l.created_at) >= todayStart).length;
            const moLeads = teamLeads.filter(l => {
              const ld = new Date(l.created_at);
              return l.assigned_to === p.id && ld.getMonth() === new Date().getMonth() && ld.getFullYear() === new Date().getFullYear();
            }).length;
            const moSales = teamLeads.filter(l => {
              const ld = l.closed_at ? new Date(l.closed_at) : null;
              return l.assigned_to === p.id && l.status === 'venta' && ld && ld.getMonth() === new Date().getMonth() && ld.getFullYear() === new Date().getFullYear();
            }).length;

            return {
              id: p.id,
              name: p.name,
              todayLeads,
              moLeads,
              moSales,
              leadsProgress: Math.min((moLeads / 100) * 100, 100),
              salesProgress: Math.min((moSales / 3) * 100, 100),
              bonusEligible: Math.floor(moSales / 5) * 150
            };
          }).sort((a,b) => b.todayLeads - a.todayLeads);
          
          setAgentPerformance(perfData);
        }

        // 3.5 Personal Goals Calculation (For all users, based on their assigned data)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();

        const myLeads = leads.filter(l => {
          const ld = new Date(l.created_at);
          return ld.getMonth() === currentMonth && ld.getFullYear() === currentYear;
        });

        const mySales = leads.filter(l => {
          const cd = l.closed_at ? new Date(l.closed_at) : null;
          return l.status === 'venta' && cd && cd.getMonth() === currentMonth && cd.getFullYear() === currentYear;
        });

        // Catorcena Logic
        let cycleStart: Date, cycleEnd: Date;
        if (currentDay >= 1 && currentDay <= 14) {
          cycleStart = new Date(currentYear, currentMonth, 1);
          cycleEnd = new Date(currentYear, currentMonth, 14, 23, 59, 59);
        } else if (currentDay >= 15 && currentDay <= 28) {
          cycleStart = new Date(currentYear, currentMonth, 15);
          cycleEnd = new Date(currentYear, currentMonth, 28, 23, 59, 59);
        } else {
          // 29th-31st: Part of Cycle 1 of next month
          cycleStart = new Date(currentYear, currentMonth, 29);
          const nextMonth = new Date(currentYear, currentMonth + 1, 1);
          cycleEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 14, 23, 59, 59);
        }

        const cycleSalesCount = leads.filter(l => {
          const cd = l.closed_at ? new Date(l.closed_at) : null;
          return l.status === 'venta' && cd && cd >= cycleStart && cd <= cycleEnd;
        }).length;

        const activeAgentsCount = profs.length || 1;

        setPersonalGoals({
          monthlyLeads: myLeads.length,
          monthlySales: mySales.length,
          cycleSales: cycleSalesCount,
          bonusAmount: Math.floor(mySales.length / 5) * 150,
          commissions: cycleSalesCount * 150,
          nextBonusSales: 5 - (mySales.length % 5),
          activeAgents: activeAgentsCount,
          totalRevenueGoal: typeof revenueGoal === 'number' ? revenueGoal : 0
        });

      // 4. Recent Activities (Team activities for context, as requested)
      let actQuery = supabase.from('activities').select('*, leads(business_name, assigned_to)').order('created_at', { ascending: false }).limit(8);
      const { data: acts } = await actQuery;
      if (acts) setRecentActivities(acts.map(a => ({
        id: a.id,
        type: a.type,
        description: a.description,
        created_at: a.created_at,
        lead_name: a.leads?.business_name || 'Desconocido',
        lead_id: a.lead_id
      })));

      // 5. Reminders & Meetings (Integrated Agenda)
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Fetch Reminders
      let remQuery = supabase.from('reminders')
        .select('*, leads(business_name)')
        .eq('is_completed', false)
        .order('date', { ascending: true });
        
      if (role !== 'admin' && !permissions.includes('view_team_dashboard')) remQuery = remQuery.eq('created_by', userId);
      const { data: remsData } = await remQuery;

      // Fetch Meetings (Citas)
      let meetQuery = supabase.from('meetings')
        .select('*, leads(business_name)')
        .gte('start_time', new Date(new Date().setHours(0,0,0,0)).toISOString()) // Today onwards
        .order('start_time', { ascending: true });
      
      if (role !== 'admin' && !permissions.includes('view_team_dashboard')) meetQuery = meetQuery.eq('created_by', userId);
      const { data: meetsData } = await meetQuery;

      // Unify and Transform
      const unifiedReminders: any[] = [];
      
      if (remsData) {
        remsData.forEach(r => {
          unifiedReminders.push({
            ...r,
            type: 'reminder'
          });
        });
      }

      if (meetsData) {
        meetsData.forEach(m => {
          const start = new Date(m.start_time);
          unifiedReminders.push({
            id: m.id,
            lead_id: m.lead_id,
            date: m.start_time.split('T')[0],
            time: start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            note: m.title,
            is_completed: false, // Meetings don't have a completion status yet in schema
            created_by: m.created_by,
            leads: m.leads,
            type: 'meeting'
          });
        });
      }

      // Sort unified list by date and time
      unifiedReminders.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '').localeCompare(b.time || '');
      });

      setAllPendingReminders(unifiedReminders);

      // Categorize for Dashboard view (Today + Overdue)
      const dashboardRems = unifiedReminders.filter(r => r.date <= todayStr);
      setReminders(dashboardRems.map(r => ({
        id: r.id,
        lead_id: r.lead_id,
        lead_name: r.leads?.business_name || (r.type === 'meeting' ? 'Cita' : 'Tarea Personal'),
        note: r.note,
        time: r.time,
        date: r.date,
        overdue: r.date < todayStr,
        type: r.type as 'reminder' | 'meeting'
      })));

      if (leads) setAvailableLeads(leads.map(l => ({ id: l.id, name: l.business_name })));
    }
  };

  const handleToggleReminder = async (rem: any) => {
    if (rem.type === 'meeting') {
      router.push(`/leads/${rem.lead_id}`);
      return;
    }
    const { error } = await supabase.from('reminders').update({ is_completed: true }).eq('id', rem.id);
    if (!error) {
      setReminders(prev => prev.filter(r => r.id !== rem.id));
      setAllPendingReminders(prev => prev.filter(r => r.id !== rem.id));
    }
  };

  const handleSaveQuickReminder = async () => {
    if (!reminderForm.date || isSavingReminder) return;
    setIsSavingReminder(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: newRem, error } = await supabase.from('reminders').insert({
        lead_id: reminderForm.lead_id || null,
        date: reminderForm.date,
        time: reminderForm.time || null,
        note: reminderForm.note || '',
        created_by: currentUser.id
      }).select('*, leads(business_name)').single();

      if (error) throw error;

      // Activity log if linked to lead
      if (reminderForm.lead_id) {
        await supabase.from('activities').insert({
          lead_id: reminderForm.lead_id,
          type: 'reminder',
          description: `Nuevo recordatorio: ${reminderForm.note}`,
          created_by: currentUser.id
        });
      }

      // Update UI
      const todayStr = new Date().toISOString().split('T')[0];
      if (newRem.date <= todayStr) {
        setReminders(prev => [{
          id: newRem.id,
          lead_id: newRem.lead_id,
          lead_name: newRem.leads?.business_name || 'Tarea Personal',
          note: newRem.note,
          time: newRem.time,
          date: newRem.date,
          overdue: newRem.date < todayStr,
          type: 'reminder' as const
        }, ...prev].sort((a,b) => a.date.localeCompare(b.date)));
      }
      setAllPendingReminders(prev => [...prev, { ...newRem, type: 'reminder' }]);
      setShowAddReminderModal(false);
      setReminderForm({ lead_id: '', date: todayStr, time: '', note: '' });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSavingReminder(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-10 min-h-screen">
      {/* Premium Dashboard Background Decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4 border-b border-outline-variant/10"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-headline font-black text-on-surface tracking-tight">
              Taskmasters <span className="text-primary italic">Web</span>
            </h1>
            <div className="h-10 w-[2px] bg-outline-variant/20 mx-2 rotate-[25deg] hidden md:block" />
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Hub de Ventas</span>
              {userRole === 'admin' && (
                <span className="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-widest">Admin Control Center</span>
              )}
            </div>
          </div>
          <p className="text-on-surface-variant font-medium text-sm sm:text-lg max-w-2xl leading-relaxed">
            Gestión estratégica de prospectos para <span className="text-on-surface font-headline font-bold">{profile?.name || 'Vendedor'}</span>.
          </p>
        </div>

        {/* Unified Control Center Hub */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-surface-container-low/50 p-2 rounded-2xl sm:rounded-[2rem] border border-outline-variant/10 backdrop-blur-md shadow-sm">
          {/* Agent Selector */}
          {(userRole === 'admin' || permissions.includes('filter_dashboard_by_agent')) && (
            <div className="relative group flex-1 min-w-[120px] sm:flex-none">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-primary/60">
                <Users size={16} />
              </div>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full pl-11 pr-8 py-2 sm:py-3 bg-surface-container-lowest/80 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest border border-outline-variant/5 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer hover:bg-surface-container-lowest shadow-sm"
              >
                <option value="all">Equipo Completo</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Period Selector */}
          <div className="relative group flex-1 min-w-[120px] sm:flex-none">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-primary/60">
              <Calendar size={16} />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="w-full pl-11 pr-10 py-2 sm:py-3 bg-surface-container-lowest/80 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest border border-outline-variant/5 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer hover:bg-surface-container-lowest shadow-sm"
            >
              <option value="Day">Hoy</option>
              <option value="Week">Semana</option>
              <option value="Month">Mes</option>
              <option value="Year">Año</option>
              <option value="Custom">Custom</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" />
          </div>

          {/* Custom Range Popover (Simplified inline for UI) */}
          {period === 'Custom' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 pr-2 w-full sm:w-auto"
            >
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))} 
                className="flex-1 sm:flex-none bg-surface-container-lowest/80 text-[10px] font-black border border-outline-variant/10 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none min-w-[110px]"
              />
              <span className="text-on-surface-variant text-[10px] font-black uppercase">al</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))} 
                className="flex-1 sm:flex-none bg-surface-container-lowest/80 text-[10px] font-black border border-outline-variant/10 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none min-w-[110px]"
              />
            </motion.div>
          )}
        </div>
      </motion.div>

    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    >
        {[
          { 
            label: `Facturación (${period === 'Day' ? 'Hoy' : period === 'Week' ? 'Semana' : period === 'Month' ? 'Mes' : period === 'Year' ? 'Año' : 'Rango'})`, 
            value: `$${metrics.totalRevenue.toLocaleString()}`, 
            icon: Building2, 
            color: 'from-emerald-500 to-teal-600',
            glow: 'shadow-emerald-500/20'
          },
          { 
            label: 'Deuda Pendiente', 
            value: `$${metrics.pendingDebt.toLocaleString()}`, 
            icon: Wallet, 
            color: 'from-amber-500 to-orange-600',
            glow: 'shadow-amber-500/20'
          },
          { 
            label: 'Prospectos Activos', 
            value: metrics.activeDeals.toString(), 
            icon: Target, 
            color: 'from-indigo-500 to-blue-600',
            glow: 'shadow-indigo-500/20'
          },
          { 
            label: 'Éxito (Win Rate)', 
            value: `${metrics.winRate.toFixed(1)}%`, 
            icon: TrendingUp, 
            color: 'from-primary to-primary-container',
            glow: 'shadow-primary/20'
          },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -5, scale: 1.02 }}
            className="group relative bg-surface-container-lowest/60 backdrop-blur-md rounded-3xl p-6 border border-outline-variant/10 shadow-sm hover:shadow-xl transition-all duration-300"
          >
            {/* Decorative Glow */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-[0.03] group-hover:opacity-[0.08] rounded-full blur-2xl transition-opacity`} />
            
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} text-on-primary shadow-lg ${stat.glow} group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-tighter">
                    Real Time <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                 </div>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black tracking-widest uppercase text-on-surface-variant/60">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-headline text-3xl font-black text-on-surface tracking-tighter tabular-nums drop-shadow-sm">
                  {stat.value}
                </h3>
              </div>
            </div>

          </motion.div>
        ))}
      </motion.div>
      <motion.div 
        layout
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="grid grid-cols-1 xl:grid-cols-3 gap-6"
      >
        <div className="xl:col-span-2 glass-panel rounded-3xl p-5 relative overflow-hidden group self-start">
           {/* Decorative Background Icon */}
           <Zap className="absolute -right-6 -top-6 w-32 h-32 text-primary/5 group-hover:rotate-12 transition-transform duration-700" />
           
           <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Zap size={20} className="text-primary" />
              </div>
              <h3 className="font-headline text-xl font-black text-on-surface">
                {selectedAgentId === 'all' ? 'Objetivos del Equipo' : 'Crecimiento Mensual'}
              </h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              {/* Leads Goal */}
              <div className="space-y-2">
                 <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-on-surface-variant/40 uppercase tracking-[0.2em] flex items-center gap-2">
                         Captura de Leads
                      </p>
                      <p className="text-2xl font-headline font-black text-on-surface tracking-tighter">
                         {personalGoals.monthlyLeads} <span className="text-sm text-on-surface-variant font-medium">/ {(selectedAgentId === 'all' ? (personalGoals.activeAgents * 100) : 100)}</span>
                      </p>
                    </div>
                 </div>
                 <div className="h-4 w-full bg-surface-container-high/40 rounded-full overflow-hidden border border-outline-variant/10 p-1">
                    <motion.div 
                       animate={{ width: `${Math.min((personalGoals.monthlyLeads / (selectedAgentId === 'all' ? (personalGoals.activeAgents * 100) : 100)) * 100, 100)}%` }}
                       transition={{ duration: 1.5, ease: "circOut" }}
                       className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]" 
                    />
                 </div>
              </div>

              {/* Sales Goal */}
              <div className="space-y-2">
                 <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-on-surface-variant/40 uppercase tracking-[0.2em] flex items-center gap-2">
                         Ventas Cerradas
                      </p>
                      <p className="text-2xl font-headline font-black text-on-surface tracking-tighter">
                         {personalGoals.monthlySales} <span className="text-sm text-on-surface-variant font-medium">/ {(selectedAgentId === 'all' ? (personalGoals.activeAgents * 3) : 3)}</span>
                      </p>
                    </div>
                 </div>
                 <div className="h-4 w-full bg-surface-container-high/40 rounded-full overflow-hidden border border-outline-variant/10 p-1">
                    <motion.div 
                       animate={{ width: `${Math.min((personalGoals.monthlySales / (selectedAgentId === 'all' ? (personalGoals.activeAgents * 3) : 3)) * 100, 100)}%` }}
                       transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
                       className={`h-full rounded-full shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)] ${personalGoals.monthlySales >= (selectedAgentId === 'all' ? (personalGoals.activeAgents * 3) : 3) ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-primary to-primary-container'}`}
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Catorcena & Bonus Card - Premium Wallet Layout */}
        <motion.div 
          layout
          className="bg-on-background text-on-primary rounded-3xl p-8 shadow-2xl relative overflow-hidden group"
        >
           {/* Decorative Background */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full" />
           <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-secondary/10 blur-[80px] rounded-full" />
           
           <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-8">
                   <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                     <Wallet size={22} className="text-primary-fixed" />
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] font-black text-primary-fixed uppercase tracking-[0.2em]">Billetera Stella</p>
                     <p className="text-[9px] font-bold text-white/40 uppercase">Ciclo de Ventas</p>
                   </div>
                </div>
                
                <div className="space-y-6">
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{selectedAgentId === 'all' ? 'Comisiones Equipo' : 'Mis Comisiones'}</p>
                      <h4 className="text-4xl font-headline font-black tracking-tighter tabular-nums text-white">
                         ${personalGoals.commissions.toLocaleString()}
                      </h4>
                   </div>
                   
                   <div className="flex justify-between items-end p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-primary-fixed uppercase tracking-widest">Bonos Acumulados</p>
                         <p className="text-xl font-headline font-black text-white">
                            ${(selectedAgentId === 'all' ? agentPerformance.reduce((acc, p) => acc + p.bonusEligible, 0) : personalGoals.bonusAmount).toLocaleString()}
                         </p>
                      </div>
                      <Trophy size={24} className="text-primary-fixed opacity-40" />
                   </div>
                </div>
              </div>

              <div className="mt-8">
                 {selectedAgentId === 'all' ? (
                   <div className="space-y-2 pt-6 border-t border-white/10">
                      <div className="flex justify-between items-center">
                         <span className="text-[11px] font-black uppercase text-white/50">Total Proyectado</span>
                         <span className="text-2xl font-black text-primary-fixed drop-shadow-[0_0_10px_rgba(111,251,190,0.3)]">
                            ${(personalGoals.commissions + agentPerformance.reduce((acc, p) => acc + p.bonusEligible, 0)).toLocaleString()}
                         </span>
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
                         <span className="text-white/40">Progreso de Bono</span>
                         <span className="text-primary-fixed italic">Venta {5 - personalGoals.nextBonusSales} de 5</span>
                      </div>
                      <div className="flex gap-2">
                         {[1,2,3,4,5].map(step => (
                            <div 
                              key={step} 
                              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step <= (5 - personalGoals.nextBonusSales) ? 'bg-primary-fixed shadow-[0_0_8px_rgba(111,251,190,0.5)]' : 'bg-white/10'}`}
                            />
                         ))}
                      </div>
                      <p className="text-[10px] font-bold text-white/40 text-center italic">
                         Faltan {personalGoals.nextBonusSales} ventas para bono de $150
                      </p>
                   </div>
                 )}
              </div>
           </div>
      </motion.div>
      </motion.div>
         {/* SHARED ANALYTICS SECTION (Leaderboard & Funnel) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="space-y-8"
      >
        <div className="flex items-center gap-4">
           <div className="h-10 w-2 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]" />
           <div className="space-y-0.5">
             <h3 className="font-headline text-3xl font-black text-on-surface tracking-tight">Estadísticas del Equipo</h3>
             <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Team Performance & Funnel</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 1. Leaderboard - Top Performers (Now visible to everyone) */}
          <div className="lg:col-span-4 glass-panel rounded-3xl p-8 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h4 className="font-headline text-xl font-bold flex items-center gap-2">
                <Trophy size={20} className="text-amber-500" /> Leaderboard
              </h4>
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp size={16} className="text-amber-600" />
              </div>
            </div>

            <div className="space-y-5 relative z-10">
              {leaderboard.length > 0 ? leaderboard.map((agent, i) => (
                <motion.div 
                  key={agent.id} 
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all border border-transparent ${i === 0 ? 'bg-primary-container/10 border-primary-container/20 shadow-lg shadow-primary/5 scale-[1.02]' : 'hover:bg-surface-container-low/40 hover:border-outline-variant/10'} group`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-amber-100 text-amber-700 ring-4 ring-amber-50' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {i === 0 ? <Zap size={16} className="fill-current" /> : i + 1}
                      </div>
                      {i === 0 && <div className="absolute -top-2 -right-1 text-xl drop-shadow-sm">👑</div>}
                    </div>
                    <div>
                      <p className={`text-sm font-black ${i === 0 ? 'text-on-surface' : 'text-on-surface-variant/80'}`}>{agent.name}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-tighter">{agent.deals} ventas • {agent.totalLeads} leads</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-on-surface tracking-tighter">${agent.revenue.toLocaleString()}</p>
                    <div className="w-16 h-1.5 bg-surface-container-high rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.min((agent.revenue / (leaderboard[0]?.revenue || 1)) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="py-20 text-center text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest">Esperando datos...</div>
              )}
            </div>
          </div>

          {/* 2. Sales Funnel - Depth Enhanced Visualization */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-8 relative group">
            <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                <h4 className="font-headline text-xl font-bold flex items-center gap-2">
                  <BarChart3 size={20} className="text-primary" /> Funnel de Ventas
                </h4>
                <p className="text-[10px] font-black uppercase text-on-surface-variant/40 tracking-[0.2em]">Team Conversion Flow</p>
              </div>
              <div className="text-right">
                 <p className="text-2xl font-headline font-black text-primary">
                    {Math.round((metrics.activeDeals > 0 ? (metrics.newLeads / metrics.activeDeals) : 0) * 100)}%
                 </p>
                 <p className="text-[9px] font-bold text-on-surface-variant/50 uppercase">Health Score</p>
              </div>
            </div>
            
            <div className="space-y-3 px-4 flex flex-col items-center">
              {funnelData.map((stage, i) => (
                <div key={stage.status} className="w-full flex flex-col items-center">
                  <motion.div 
                    initial={{ scaleX: 0, opacity: 0 }}
                    whileInView={{ scaleX: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                    className={`h-12 flex items-center justify-between px-6 rounded-2xl text-on-primary font-black transition-all hover:scale-[1.02] cursor-default ${stage.color} shadow-lg relative z-10 overflow-hidden group/stage`}
                    style={{ 
                      width: `${100 - (i * 8)}%`,
                      opacity: 1 - (i * 0.1)
                    }}
                  >
                    {/* Funnel Slope Effect (Left/Right cut-outs) */}
                    <div className="absolute inset-y-0 left-0 w-8 bg-black/10 -skew-x-[20deg] origin-left" />
                    <div className="absolute inset-y-0 right-0 w-8 bg-black/10 skew-x-[20deg] origin-right" />
                    
                    {/* Inner Shine */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none group-hover/stage:translate-x-full transition-transform duration-1000" />
                    
                    <span className="text-[10px] uppercase tracking-widest truncate mr-2 relative z-10">{stage.status}</span>
                    <span className="text-sm tabular-nums relative z-10">{stage.count}</span>
                  </motion.div>
                  {i < funnelData.length - 1 && (
                    <div className="w-[1px] h-3 bg-outline-variant/30 relative">
                       <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-outline-variant/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Forecast & Sources (Visible based on permissions) */}
          <div className="lg:col-span-3 space-y-6">
              {(userRole === 'admin' || permissions.includes('view_team_dashboard')) && (
                <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                   <div className="flex items-center gap-2 mb-6">
                     <div className="p-1.5 bg-green-50 rounded-lg">
                       <Activity size={18} className="text-green-600" />
                     </div>
                     <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Live Capture</h4>
                   </div>
                   <div className="space-y-4">
                     {agentPerformance.slice(0, 4).map((agent, idx) => (
                       <div key={agent.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full ${agent.todayLeads > 0 ? 'bg-green-500 animate-pulse' : 'bg-surface-container-high'}`} />
                             <span className="text-[11px] font-bold text-on-surface truncate max-w-[80px]">{agent.name}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter ${agent.todayLeads > 0 ? 'bg-green-100 text-green-700' : 'bg-surface-container-low text-on-surface-variant/40'}`}>
                            {agent.todayLeads > 0 ? `+${agent.todayLeads}` : 'IDLE'}
                          </span>
                       </div>
                     ))}
                   </div>
                   <div className="mt-6 pt-4 border-t border-outline-variant/10">
                      <div className="flex justify-between items-center text-[10px] font-black text-on-surface uppercase tracking-tight mb-2">
                         <span>Global Today</span>
                         <span className="text-green-600">{agentPerformance.reduce((acc, a) => acc + a.todayLeads, 0)} leads</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                         <div className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" style={{ width: '100%' }} />
                      </div>
                   </div>
                </div>
              )}

              <div className="bg-primary text-on-primary rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                 <Zap className="absolute -right-6 -top-6 w-32 h-32 text-on-primary/10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700" />
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Pipeline Value</p>
                 <h4 className="font-headline text-4xl font-black mb-6 tracking-tighter tabular-nums">${forecast.potential.toLocaleString()}</h4>
                 <div className="flex items-center gap-2 text-[10px] font-black bg-on-primary/10 w-fit px-3 py-1.5 rounded-2xl backdrop-blur-md border border-on-primary/5">
                   <Target size={14} fill="currentColor" className="opacity-40" /> {forecast.total} DEALS ACTIVE
                 </div>
              </div>

              <div className="glass-panel rounded-3xl p-6">
                 <div className="flex items-center gap-2 mb-4">
                   <div className="p-1.5 bg-indigo-50 rounded-lg">
                     <PieChart size={18} className="text-indigo-600" />
                   </div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Top Channels</h4>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   {sourceData.slice(0, 4).map((src) => (
                     <div key={src.name} className="bg-surface-container-low/40 p-3 rounded-2xl border border-outline-variant/5">
                       <p className="text-[8px] font-black text-on-surface-variant/60 uppercase truncate tracking-tight">{src.name}</p>
                       <p className="text-base font-black text-on-surface tracking-tighter">{src.value}</p>
                     </div>
                   ))}
                 </div>
              </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 glass-panel rounded-3xl p-8 flex flex-col group relative overflow-hidden border-primary/10"
        >
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">
                  {selectedAgentId === 'all' ? 'Vista General de Equipo' : 'Vista Individual de Agente'}
                </p>
                <h3 className="font-headline text-2xl font-black text-on-surface">Centro de Seguimiento Crítico</h3>
              </div>
              <div className="bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10">
                <p className="text-[10px] font-black text-primary uppercase mb-0.5">Pendientes</p>
                <p className="text-xl font-headline font-black text-on-surface text-right">{leads?.filter(l => ['nuevo', 'new'].includes((l.status || '').toLowerCase())).length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Quick Action Stats (Respects Filters) */}
              {[
                { label: 'Sin Contactar', count: leads?.filter(l => ['nuevo', 'new'].includes((l.status || '').toLowerCase())).length, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Sin Asignar', count: leads?.filter(l => !l.assigned_to).length, color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'En Proceso', count: leads?.filter(l => ['contactado', 'interesado', 'meeting', 'reunión'].includes((l.status || '').toLowerCase())).length, color: 'text-orange-500', bg: 'bg-orange-50' }
              ].map(stat => (
                <div key={stat.label} className={`${stat.bg} p-4 rounded-2xl border border-black/5 flex flex-col items-center justify-center text-center`}>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/60 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-headline font-black ${stat.color}`}>{stat.count}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Atención Inmediata (Prioridad de {selectedAgentId === 'all' ? 'Equipo' : 'Agente'})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(leads || [])
                  .filter(l => ['nuevo', 'new', 'interesado', 'contactado'].includes((l.status || '').toLowerCase()))
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 4)
                  .map(lead => (
                    <div 
                      key={lead.id} 
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="group/item flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary uppercase text-xs">
                          {lead.business_name?.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-on-surface group-hover/item:text-primary transition-colors">{lead.business_name}</p>
                          <p className="text-[10px] text-on-surface-variant/60 font-medium uppercase">{lead.contact_name}</p>
                        </div>
                      </div>
                      <ArrowUpRight size={16} className="text-on-surface-variant/30 group-hover/item:text-primary group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5 transition-all" />
                    </div>
                  ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
              <p className="text-[10px] font-medium text-on-surface-variant italic">
                Sugerencia: Tienes {teamLeads?.filter(l => !l.assigned_to).length} prospectos sin dueño. Asígnalos para aumentar la conversión.
              </p>
              <button 
                onClick={() => router.push('/leads')}
                className="px-6 py-2 bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center gap-2"
              >
                Ver Todos <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-panel rounded-3xl p-8 shadow-lg"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-xl">
                  <Clock size={20} className="text-secondary" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-headline text-lg font-black text-on-surface">Recordatorios</h3>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em]">{reminders.length} Tareas Hoy</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowAddReminderModal(true)}
                  className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center hover:scale-110 hover:rotate-90 transition-all shadow-lg shadow-primary/20"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
              {reminders.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {reminders.map((rem: any, idx) => (
                    <motion.div 
                      key={rem.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-4 rounded-2xl transition-all border group relative ${rem.overdue ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-container-low/40 border-outline-variant/10 hover:border-primary/30 shadow-sm'}`}
                    >
                      {rem.overdue && (
                        <div className="absolute -top-2 -right-2 bg-red-600 text-[8px] font-black text-white px-2 py-1 rounded-full shadow-lg animate-bounce uppercase tracking-tighter">
                          Atrasado
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-2 pr-10">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${rem.type === 'meeting' ? 'text-primary' : 'text-secondary'}`}>
                          {rem.type === 'meeting' ? '⬡ ' : '○ '} {rem.lead_name}
                        </p>
                        <span className="text-[10px] font-bold text-on-surface-variant/40">{rem.time || 'All Day'}</span>
                      </div>
                      
                      <div className="flex justify-between items-center gap-4">
                        <p className="text-sm font-medium text-on-surface leading-snug line-clamp-2">{rem.note}</p>
                        <button 
                          onClick={() => handleToggleReminder(rem)}
                          className={`w-9 h-9 rounded-full border-2 border-outline-variant/20 flex items-center justify-center transition-all shrink-0 ${rem.type === 'meeting' ? 'text-primary hover:bg-primary/5 border-primary/20' : 'text-on-surface-variant/20 hover:text-green-600 hover:border-green-600 hover:bg-green-50'}`}
                        >
                          {rem.type === 'meeting' ? <ExternalLink size={16} /> : <CheckCircle2 size={18} />}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="py-12 text-center bg-surface-container-low/30 rounded-3xl border border-dashed border-outline-variant/20">
                   <CheckCircle2 size={32} className="mx-auto text-primary/20 mb-3" />
                   <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">Todo bajo control</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowAgendaModal(true)}
              className="w-full mt-6 py-3 text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/5 rounded-2xl hover:bg-primary/10 transition-colors border border-primary/5"
            >
              Consultar Agenda Expandida
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-3xl p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="space-y-0.5">
                <h3 className="font-headline text-lg font-black text-on-surface">Actividad Reciente</h3>
                <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">Cierres e Interacciones</p>
              </div>
              <button onClick={() => router.push('/leads')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:brightness-125 transition-all">Ver Historial</button>
            </div>
            
            <div className="space-y-5">
              {recentActivities.map((act, idx) => (
                <div 
                  key={act.id} 
                  onClick={() => router.push(`/leads/${act.lead_id}`)} 
                  className="flex items-start gap-4 p-2 rounded-2xl hover:bg-surface-container-low/50 transition-all group cursor-pointer"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${act.type === 'venta' ? 'bg-primary/10 text-primary' : 'bg-surface-container-low text-on-surface-variant/40'}`}>
                    {act.type === 'venta' ? <Zap size={20} className="fill-current" /> : <Phone size={20} />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-black text-on-surface uppercase tracking-widest leading-none">{act.lead_name}</p>
                       <div className="w-1 h-1 rounded-full bg-outline-variant/30" />
                       <span className="text-[9px] font-black text-on-surface-variant/30 uppercase">{new Date(act.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors line-clamp-1 leading-snug">{act.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      {/* QUICK ADD REMINDER MODAL */}
      {showAddReminderModal && (
        <div className="fixed inset-0 bg-on-background/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-headline text-xl font-bold flex items-center gap-2">Nuevo Recordatorio</h3>
               <button onClick={() => setShowAddReminderModal(false)} className="p-2 rounded-full hover:bg-surface-container-low"><X size={20} /></button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-surface-container-low p-1 rounded-xl mb-6">
              <button 
                onClick={() => { setActiveTab('personal'); setReminderForm(p => ({ ...p, lead_id: '' })); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'personal' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Clock size={14} /> Tarea Personal
              </button>
              <button 
                onClick={() => setActiveTab('lead')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'lead' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Briefcase size={14} /> Vincular Lead
              </button>
            </div>
            
            <div className="space-y-5">
               {activeTab === 'lead' && (
                 <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Buscar Prospecto</label>
                   <div className="relative mb-3">
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" />
                     <input 
                       type="text"
                       placeholder="Nombre de la empresa o contacto..."
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                     />
                   </div>
                   <div className="max-h-32 overflow-y-auto custom-scrollbar border border-outline-variant/10 rounded-xl bg-surface-container-low/50">
                     {availableLeads
                       .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                       .map(l => (
                         <button 
                           key={l.id}
                           onClick={() => { setReminderForm(p => ({ ...p, lead_id: l.id })); setSearchQuery(''); }}
                           className={`w-full text-left px-4 py-3 text-xs font-medium border-b border-outline-variant/5 last:border-0 hover:bg-primary/5 transition-colors ${reminderForm.lead_id === l.id ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'}`}
                         >
                           {l.name}
                         </button>
                       ))}
                   </div>
                   {reminderForm.lead_id && (
                     <p className="mt-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                       ✓ Seleccionado: {availableLeads.find(l => l.id === reminderForm.lead_id)?.name}
                     </p>
                   )}
                 </div>
               )}
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block">Fecha</label>
                   <input 
                     type="date"
                     value={reminderForm.date}
                     onChange={e => setReminderForm(prev => ({ ...prev, date: e.target.value }))}
                     className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block">Hora</label>
                   <input 
                     type="time"
                     value={reminderForm.time}
                     onChange={e => setReminderForm(prev => ({ ...prev, time: e.target.value }))}
                     className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                   />
                 </div>
               </div>
               
               <div>
                 <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5 block">Nota del Recordatorio</label>
                 <textarea 
                   value={reminderForm.note}
                   onChange={e => setReminderForm(prev => ({ ...prev, note: e.target.value }))}
                   placeholder={activeTab === 'personal' ? "Ej: Enviar documentos de facturación..." : "Ej: Llamar para seguimiento de propuesta..."}
                   className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary"
                 />
               </div>
               
               <button 
                 onClick={handleSaveQuickReminder}
                 disabled={isSavingReminder || (activeTab === 'lead' && !reminderForm.lead_id)}
                 className="w-full bg-primary text-on-primary font-bold py-4 rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isSavingReminder ? <Loader2 className="animate-spin" size={20} /> : 'Guardar Recordatorio'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENDA MODAL */}
      {showAgendaModal && (
        <div className="fixed inset-0 bg-on-background/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-outline-variant/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-headline text-2xl font-bold flex items-center gap-3"><Calendar size={28} className="text-primary" /> Agenda de Tareas</h3>
               <button onClick={() => setShowAgendaModal(false)} className="p-2 rounded-full hover:bg-surface-container-low"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8">
               {['Atrasado', 'Hoy', 'Esta Semana', 'Próximamente'].map(section => {
                 let sectionRems = [];
                 const today = new Date().toISOString().split('T')[0];
                 const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
                 const nextWeekStr = nextWeek.toISOString().split('T')[0];

                 if (section === 'Atrasado') sectionRems = allPendingReminders.filter(r => r.date < today);
                 else if (section === 'Hoy') sectionRems = allPendingReminders.filter(r => r.date === today);
                 else if (section === 'Esta Semana') sectionRems = allPendingReminders.filter(r => r.date > today && r.date <= nextWeekStr);
                 else sectionRems = allPendingReminders.filter(r => r.date > nextWeekStr);

                 if (sectionRems.length === 0) return null;

                 return (
                   <div key={section} className="space-y-4">
                     <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded inline-block ${section === 'Atrasado' ? 'bg-red-50 text-red-600' : 'bg-primary/5 text-primary'}`}>{section}</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectionRems.map((rem: any) => (
                          <div key={rem.id} className="p-4 bg-surface-container-low border border-outline-variant/5 rounded-2xl hover:border-primary/20 transition-all group">
                             <div className="flex justify-between items-start mb-2">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest">
                                 {rem.type === 'meeting' && <span className="mr-1 bg-primary/10 px-1 py-0.5 rounded text-[8px] text-primary">CITA</span>}
                                 {rem.leads?.business_name || (rem.type === 'meeting' ? 'Cita' : 'Tarea Personal')}
                               </p>
                               <span className="text-[10px] font-bold text-on-surface-variant">{new Date(rem.date + 'T00:00:00').toLocaleDateString()}</span>
                             </div>
                             <p className="text-sm font-bold text-on-surface mb-3">{rem.note}</p>
                             <button 
                               onClick={() => handleToggleReminder(rem)}
                               className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                             >
                               {rem.type === 'meeting' ? <><ExternalLink size={14} /> Ver Detalle</> : <><CheckCircle2 size={14} /> Marcar como listo</>}
                             </button>
                          </div>
                        ))}
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
