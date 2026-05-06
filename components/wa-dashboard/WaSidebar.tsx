"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Zap,
  MessageSquare,
  FileText,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Link2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { SafeImage } from "@/components/ui/safe-image";

interface SidebarProps {
  user: SessionUser;
}

const navigation = [
  { name: "Overview", href: "/wa", icon: LayoutDashboard },
  { name: "Connect", href: "/wa/connect", icon: Link2 },
  { name: "Automations", href: "/wa/automations", icon: Zap },
  { name: "Messages", href: "/wa/messages", icon: MessageSquare },
  { name: "Templates", href: "/wa/templates", icon: FileText },
];

export function WaSidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col z-50">
        <div className="flex flex-col h-full overflow-hidden bg-white border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
          {/* Logo Section */}
          <div className="flex items-center h-20 px-8">
            <Link href="/wa" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-[#25D366]/20 group-hover:scale-110 transition-all duration-500 flex items-center justify-center bg-[#25D366] text-white font-bold ring-1 ring-[#25D366]/30">
                <MessageSquare className="w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">
                WhatsApp<br/><span className="text-[10px] text-slate-400">by ReplyKaro</span>
              </span>
            </Link>
          </div>

          {/* Navigation Section */}
          <div className="flex-1 min-h-0 px-4 py-8 space-y-1 overflow-y-auto overscroll-contain">
            <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              Main Menu
            </p>
            <nav className="space-y-1.5">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 group",
                      isActive
                        ? "bg-[#25D366] text-white shadow-md shadow-[#25D366]/20"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-[#25D366] transition-colors"
                    )} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8">
               <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                 Switch Product
               </p>
               <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 group"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
                  Instagram Dashboard
                </Link>
            </div>
          </div>

          {/* User Section */}
          <div className="border-t border-slate-50 p-6 bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className="relative transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                <SafeImage
                  src={user.profile_picture_url}
                  alt={user.instagram_username || user.email || 'User'}
                  className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-[#25D366]/10 ring-2 ring-white"
                  fallbackComponent={
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#1DA851] flex items-center justify-center text-white font-bold shadow-lg shadow-[#25D366]/10 ring-2 ring-white">
                      {(user.instagram_username || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  }
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Active" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">
                  {user.instagram_username ? `@${user.instagram_username}` : user.email}
                </p>
                <div className="flex flex-col gap-1 mt-0.5">
                  <span className={cn(
                    "text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md w-fit",
                    "bg-[#25D366]/10 text-[#25D366]"
                  )}>
                    {user.plan_type}
                  </span>
                </div>
              </div>
              <a href="/api/auth/logout" className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                <LogOut className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* --- MOBILE HEADER --- */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] px-4 py-4">
        <div className="flex items-center justify-between glass-nav px-6 h-16 rounded-[2rem] bg-white/80 backdrop-blur-md border border-slate-100 shadow-sm">
          <Link href="/wa" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-[#25D366] text-white shadow-sm border border-[#25D366]/20">
              <MessageSquare className="w-4 h-4 fill-current" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tighter uppercase">WhatsApp</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-full active:scale-90 transition-all"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 text-[#25D366]" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-over Overlay */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
        isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsMobileMenuOpen(false)} />

      {/* Mobile Sidebar Content */}
      <div className={cn(
        "lg:hidden fixed top-24 left-4 bottom-4 w-[280px] z-[58] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col rounded-[2.5rem] border border-slate-100 overflow-hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-[calc(100%+2rem)]"
      )}>
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all",
                  isActive
                    ? "bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
          
          <div className="pt-4 mt-4 border-t border-slate-100">
            <Link
               href="/dashboard"
               onClick={() => setIsMobileMenuOpen(false)}
               className="flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
               <ArrowLeft className="h-5 w-5" />
               Instagram Dashboard
            </Link>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-50 bg-slate-50/30 rounded-b-[2.5rem]">
          <div className="flex items-center gap-4 mb-4">
            <SafeImage
              src={user.profile_picture_url}
              alt={user.instagram_username || user.email || 'User'}
              fallbackComponent={
                <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white font-bold">
                  {(user.instagram_username || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              }
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">
                {user.instagram_username ? `@${user.instagram_username}` : user.email}
              </p>
              <p className="text-xs text-[#25D366] uppercase font-black tracking-wider">{user.plan_type} plan</p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-rose-500 bg-rose-50 rounded-2xl active:scale-95 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Logout Account
          </a>
        </div>
      </div>
    </>
  );
}
