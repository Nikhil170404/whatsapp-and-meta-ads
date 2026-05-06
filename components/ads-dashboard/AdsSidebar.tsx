"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  LogOut,
  Link2,
  MessageSquare,
  CreditCard,
  MoreHorizontal,
  Home,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { SafeImage } from "@/components/ui/safe-image";

interface SidebarProps {
  user: SessionUser;
}

const navigation = [
  { name: "Overview", href: "/ads", icon: LayoutDashboard },
  { name: "Connect Account", href: "/ads/connect", icon: Link2 },
  { name: "Campaigns", href: "/ads/campaigns", icon: BarChart3 },
  { name: "Ad Automations", href: "/ads/automations", icon: Zap },
];

const bottomTabs = [
  { name: "Home", href: "/ads", icon: Home },
  { name: "Campaigns", href: "/ads/campaigns", icon: BarChart3 },
  { name: "Auto", href: "/ads/automations", icon: Zap },
  { name: "More", href: "__more__", icon: MoreHorizontal },
];

export function AdsSidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isTabActive = (href: string) => {
    if (href === "/ads") return pathname === "/ads";
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col z-50">
        <div className="flex flex-col h-full overflow-hidden bg-white border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center h-20 px-8">
            <Link href="/ads" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-[#1877F2]/20 group-hover:scale-110 transition-all duration-500 flex items-center justify-center bg-[#1877F2] text-white font-bold ring-1 ring-[#1877F2]/30">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tighter text-slate-900 uppercase leading-none block">
                  ReplyKaro
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Meta Ads Platform</span>
              </div>
            </Link>
          </div>

          <div className="flex-1 min-h-0 px-4 py-6 space-y-1 overflow-y-auto overscroll-contain">
            <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              Main Menu
            </p>
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = item.href === "/ads" ? pathname === "/ads" : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 group",
                      isActive
                        ? "bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/20"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-[#1877F2] transition-colors"
                    )} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 pt-6 border-t border-slate-100">
               <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                 Switch Product
               </p>
               <Link
                  href="/wa"
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 group"
                >
                  <MessageSquare className="h-5 w-5 text-slate-400 group-hover:text-[#25D366] transition-colors" />
                  WhatsApp Dashboard
                </Link>
            </div>
          </div>

          <div className="border-t border-slate-50 p-6 bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className="relative transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                <SafeImage
                  src={user.profile_picture_url}
                  alt={user.email || 'User'}
                  className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-[#1877F2]/10 ring-2 ring-white"
                  fallbackComponent={
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#155EC0] flex items-center justify-center text-white font-bold shadow-lg shadow-[#1877F2]/10 ring-2 ring-white">
                      {(user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  }
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Active" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">
                  {user.email || 'User'}
                </p>
                <span className={cn(
                  "text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md w-fit",
                  "bg-[#1877F2]/10 text-[#1877F2]"
                )}>
                  {user.plan_type} plan
                </span>
              </div>
              <a href="/api/auth/logout" className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                <LogOut className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* --- MOBILE BOTTOM TAB BAR --- */}
      <div className="lg:hidden bottom-tab-bar">
        <div className="flex items-stretch h-[var(--tab-bar-height)]">
          {bottomTabs.map((tab) => {
            if (tab.href === "__more__") {
              return (
                <button
                  key={tab.name}
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={cn("tab-item", isMoreOpen && "active")}
                  style={{ color: isMoreOpen ? '#1877F2' : undefined }}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            }
            const isActive = isTabActive(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn("tab-item")}
                style={{ color: isActive ? '#1877F2' : '#94a3b8' }}
              >
                <div className="relative">
                  <tab.icon className="h-5 w-5" />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#1877F2]" />
                  )}
                </div>
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* --- MOBILE "MORE" SHEET --- */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
        isMoreOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsMoreOpen(false)} />

      <div className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-[58] bg-white shadow-[0_-32px_64px_-16px_rgba(0,0,0,0.15)] transition-transform duration-500 rounded-t-[2.5rem] border-t border-slate-100 overflow-hidden",
        isMoreOpen ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-6 pb-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">More Options</p>
        </div>

        <nav className="px-4 pb-4 space-y-1">
          {[
            { name: "Connect Meta Ads", href: "/ads/connect", icon: Link2 },
          ].map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all",
                  isActive
                    ? "bg-[#1877F2] text-white shadow-lg shadow-[#1877F2]/20"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-100">
            <Link
              href="/wa"
              onClick={() => setIsMoreOpen(false)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold text-[#25D366] hover:bg-[#25D366]/5 transition-all"
            >
              <MessageSquare className="h-5 w-5" />
              WhatsApp Dashboard
            </Link>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-50 bg-slate-50/30">
          <div className="flex items-center gap-4 mb-4">
            <SafeImage
              src={user.profile_picture_url}
              alt={user.email || 'User'}
              fallbackComponent={
                <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white font-bold">
                  {(user.email || 'U').charAt(0).toUpperCase()}
                </div>
              }
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">{user.email || 'User'}</p>
              <p className="text-xs text-[#1877F2] uppercase font-black tracking-wider">{user.plan_type} plan</p>
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

      {/* --- MOBILE TOP HEADER --- */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[50] px-4 py-3">
        <div className="flex items-center justify-between px-5 h-14 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-100/50 shadow-sm">
          <Link href="/ads" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#1877F2] text-white shadow-sm">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-slate-900 tracking-tighter">ReplyKaro</span>
          </Link>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#1877F2] bg-[#1877F2]/10 px-2 py-1 rounded-lg">{user.plan_type}</span>
        </div>
      </div>
    </>
  );
}
