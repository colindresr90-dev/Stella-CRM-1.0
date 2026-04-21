"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Search, Bell, CircleHelp, Building2, User as UserIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationCenter } from './NotificationCenter';
import { getUserRole } from '@/lib/authHelper';

export const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('avatar_url, name')
          .eq('id', currentUser.id)
          .single();
        setProfile(profileData);
        
        const { role } = await getUserRole();
        setUserRole(role);
      }
    };
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    const handleKeyDownGlobal = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSearchResults(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDownGlobal);
    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDownGlobal);
    };
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      setShowSearchResults(true);
      setSelectedIndex(-1);

      const { data, error } = await supabase
        .from('leads')
        .select('id, business_name, contact_name')
        .or(`business_name.ilike.%${searchQuery}%,contact_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(6);

      if (!error && data) {
        setResults(data);
      } else {
        setResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (id: string) => {
    router.push(`/leads/${id}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    router.push('/login');
  };

  return (
    <header className="bg-surface/85 backdrop-blur-md sticky top-0 z-40 w-full shadow-[0px_20px_40px_rgba(15,23,42,0.04)] flex items-center justify-between px-8 py-3">
      <div className="flex-1 flex items-center">
        <div className="relative w-80 focus-within:ring-2 focus-within:ring-primary-container/30 rounded-full transition-all group" ref={searchRef}>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary" />
          <input 
            type="text" 
            placeholder="Search leads..." 
            className="w-full bg-surface-container-lowest border border-outline-variant/20 py-2 pl-10 pr-4 rounded-full focus:outline-none focus:ring-0 text-sm placeholder-on-surface-variant/50"
            value={searchQuery}
            ref={inputRef}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
              } else if (e.key === 'Enter') {
                if (selectedIndex >= 0 && results[selectedIndex]) {
                  handleResultClick(results[selectedIndex].id);
                } else if (results.length > 0) {
                  handleResultClick(results[0].id);
                }
              } else if (e.key === 'Escape') {
                setShowSearchResults(false);
              }
            }}
          />

          <AnimatePresence>
            {showSearchResults && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-outline-variant/10 overflow-hidden z-50"
              >
                <div className="max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                      <div className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2 mb-[-2px]" />
                      Buscando...
                    </div>
                  ) : results.length > 0 ? (
                    <div className="py-2">
                       <p className="px-4 py-2 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest border-b border-outline-variant/5 mb-1">Resultados</p>
                       {results.map((lead, index) => (
                         <button
                           key={lead.id}
                           onClick={() => handleResultClick(lead.id)}
                           onMouseEnter={() => setSelectedIndex(index)}
                           className={`w-full text-left px-4 py-3 transition-all group flex items-center gap-3 ${selectedIndex === index ? 'bg-primary/10' : 'hover:bg-surface-container-low'}`}
                         >
                           <div className={`p-2 rounded-lg transition-colors ${selectedIndex === index ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                             <Building2 size={16} />
                           </div>
                           <div className="flex flex-col">
                             <span className={`text-sm font-bold transition-colors ${selectedIndex === index ? 'text-primary' : 'text-on-surface'}`}>
                               {lead.business_name}
                             </span>
                             <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                               <UserIcon size={10} /> {lead.contact_name}
                             </span>
                           </div>
                         </button>
                       ))}
                    </div>
                  ) : searchQuery.trim().length >= 2 ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant text-sm font-medium">
                      No se encontraron resultados para "{searchQuery}"
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-on-surface-variant/50 text-sm italic">
                      Comienza a escribir para buscar leads...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center gap-4 text-secondary">
        <NotificationCenter />
        <button className="p-2 hover:bg-surface-container-low rounded-full transition-all">
          <CircleHelp size={20} />
        </button>
        <div className="h-6 w-px bg-outline-variant/30 mx-2" />
        {(userRole === 'admin') && (
          <button 
            onClick={() => router.push('/settings')}
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Settings
          </button>
        )}
        
        <div className="relative ml-2" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-surface flex items-center justify-center font-headline font-bold text-sm text-secondary shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-container transition-transform hover:scale-105"
          >
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="User" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-secondary uppercase">
                {profile?.name ? profile.name.charAt(0) : user?.email?.charAt(0) || "U"}
              </span>
            )}
          </button>
          
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0px_10px_30px_rgba(15,23,42,0.1)] border border-outline-variant/10 py-1 z-50 overflow-hidden"
              >
                {user ? (
                  <>
                    <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-lowest/50">
                      <p className="text-sm font-medium text-on-surface truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => { setIsDropdownOpen(false); router.push('/account'); }}
                      className="w-full text-left px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary-container transition-colors"
                    >
                      Mi cuenta
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => { setIsDropdownOpen(false); router.push('/login'); }}
                    className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low hover:text-primary-container transition-colors font-medium"
                  >
                    Log in
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  );
};
