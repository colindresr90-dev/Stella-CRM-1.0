"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Bell, CheckCircle, Clock, Trash2, ExternalLink, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { createNotification } from '@/lib/notifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  related_id: string | null;
  created_at: string;
}

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    // AUTO-REMINDERS CHECK
    const checkDailyReminders = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const today = new Date().toISOString().split('T')[0];
      
      // Fetch reminders for leads assigned to user with reminders for today or overdue
      const { data: remindersDue } = await supabase
        .from('reminders')
        .select(`
          id,
          date,
          note,
          lead_id,
          leads!inner (
            business_name,
            assigned_to
          )
        `)
        .eq('leads.assigned_to', currentUser.id)
        .eq('is_completed', false)
        .lte('date', today);

      if (remindersDue) {
        for (const rem of remindersDue) {
          const isToday = rem.date === today;
          // leads is an object because of !inner join
          const lead = rem.leads as any;
          
          await createNotification({
            user_id: currentUser.id,
            title: isToday ? 'Recordatorio para HOY' : 'Recordatorio VENCIDO',
            message: `Seguimiento pendiente para ${lead.business_name}${rem.note ? `: "${rem.note}"` : ''}`,
            type: 'reminder',
            related_id: rem.lead_id
          });
        }
      }
    };

    checkDailyReminders();
    
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const markOneAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleNotificationClick = (n: Notification) => {
    markOneAsRead(n.id);
    if (n.related_id) {
      router.push(`/leads/${n.related_id}`);
    }
    setIsOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <ExternalLink size={14} className="text-blue-500" />;
      case 'sale': return <CheckCircle size={14} className="text-green-500" />;
      case 'payment': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'meeting': return <Clock size={14} className="text-purple-500" />;
      case 'reminder': return <Bell size={14} className="text-amber-500" />;
      case 'update': return <ExternalLink size={14} className="text-indigo-500" />;
      default: return <Bell size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-surface-container-low rounded-full transition-all relative text-secondary"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-surface animate-in zoom-in duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-[0px_20px_50px_rgba(15,23,42,0.15)] border border-outline-variant/10 z-50 overflow-hidden flex flex-col max-h-[500px]"
          >
            <div className="px-4 py-3 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Notificaciones</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-bold text-primary hover:text-primary-container transition-colors uppercase tracking-wider"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/30" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Bell className="w-8 h-8 text-outline-variant/30 mx-auto" />
                  <p className="text-sm text-on-surface-variant font-medium">No tienes notificaciones</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/5">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`px-4 py-3 hover:bg-surface-container-lowest transition-colors cursor-pointer flex gap-3 group relative ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="shrink-0 pt-1">
                        <div className={`p-1.5 rounded-lg ${!n.read ? 'bg-white shadow-sm' : 'bg-surface-container-low'}`}>
                          {getTypeIcon(n.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.read ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-on-surface-variant/70 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/40 mt-1.5 font-medium flex items-center gap-1">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="absolute right-4 top-4 w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2 border-t border-outline-variant/10 text-center">
                <button className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest hover:text-on-surface transition-colors py-1 w-full">
                  Ver todas
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
