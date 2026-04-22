"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-64'}`}>
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
