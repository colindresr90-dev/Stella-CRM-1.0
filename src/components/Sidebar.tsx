"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  UserSearch, 
  CreditCard, 
  Users, 
  BadgeCheck,
  X,
  Menu
} from "lucide-react";
import { useState, useEffect } from "react";
import { getUserRole } from "@/lib/authHelper";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const loadRole = async () => {
      const { role, permissions } = await getUserRole();
      setUserRole(role);
      setPermissions(permissions);
    }
    loadRole();
  }, []);
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads', href: '/leads', icon: UserSearch },
    { id: 'sales', label: 'Sales', href: '/sales', icon: CreditCard },
    { id: 'customers', label: 'Customers', href: '/customers', icon: Users },
    { 
      id: 'team', 
      label: 'Team', 
      href: '/team', 
      icon: BadgeCheck,
      hidden: userRole !== 'admin' && !permissions.includes('access_team_page')
    },
  ] as const;

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside className={`bg-surface-container-low h-screen w-64 fixed left-0 top-0 flex flex-col py-6 px-4 z-50 border-r border-outline-variant/10 transition-transform duration-300 transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="px-2 mb-6 flex items-center justify-between">
          <Link href="/" className="block relative" onClick={onClose}>
            <div className="h-[48px] overflow-hidden flex items-center">
              <img
                src="/Logo.png"
                alt="Taskmasters Logo"
                className="w-full max-w-[180px] h-auto object-contain cursor-pointer block transform -translate-y-[2%]"
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <span
              className="absolute text-[8px] font-bold tracking-[0.2em] uppercase text-on-surface-variant opacity-40"
              style={{ 
                top: '38px', 
                left: '42px' 
              }}
            >
              by Taskmasters
            </span>
          </Link>
          <button 
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg md:hidden"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            if ('hidden' in item && item.hidden) return null;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-headline font-semibold text-sm transition-all duration-200 transform active:scale-95 ${
                  active 
                    ? 'text-primary-container font-bold border-l-4 border-primary-container bg-surface-container-high' 
                    : 'text-secondary hover:text-primary-container hover:bg-surface-container-high border-l-4 border-transparent text-on-surface-variant'
                }`}
              >
                <item.icon size={20} className={active ? 'fill-primary-container/20' : ''} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
