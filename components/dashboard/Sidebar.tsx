"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  BookOpen,
  Menu,
  X,
  User,
  ExternalLink,
  Mail,
  Users,
  ChevronDown,
  Check,
  MessageSquare,
  MessageCircle,
  HelpCircle,
  ShieldCheck,
  Star,
  Trophy,
  Heart,
  Link2,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { UsageBar } from "./UsageBar";
import { SafeImage } from "@/components/ui/safe-image";

interface SidebarProps {
  user: SessionUser;
}

const navigation = [
  { name: "Create Automation", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Automations", href: "/dashboard/automations", icon: Zap },
  { name: "DM Automation", href: "/dashboard/dm-automation", icon: MessageCircle },
  { name: "Insights", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "My Fans", href: "/dashboard/leaderboard", icon: Heart },
  { name: "Comments", href: "/dashboard/comments", icon: MessageSquare },
  { name: "Account Health", href: "/dashboard/health", icon: ShieldCheck },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Referral", href: "/dashboard/referral", icon: Gift },
  { name: "Feedback", href: "/dashboard/feedback", icon: Star },
  { name: "Support", href: "/dashboard/support", icon: HelpCircle },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col z-50">
        <div className="flex flex-col h-full overflow-hidden bg-white border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
          {/* Logo Section */}
          <div className="flex items-center h-20 px-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-primary/20 group-hover:scale-110 transition-all duration-500 flex items-center justify-center bg-white ring-1 ring-slate-100">
                <img src="/logo.png" alt="ReplyKaro Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">
                ReplyKaro
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
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-primary transition-colors"
                    )} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Usage Bar - Desktop */}
          <div className="px-4 pb-4">
            <UsageBar />
          </div>

          {/* User Section */}
          <div className="border-t border-slate-50 p-6 bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className="relative transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                <SafeImage
                  src={user.profile_picture_url}
                  alt={user.instagram_username}
                  className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-primary/10 ring-2 ring-white"
                  fallbackComponent={
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/10 ring-2 ring-white">
                      {user.instagram_username.charAt(0).toUpperCase()}
                    </div>
                  }
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Active" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">
                  @{user.instagram_username}
                </p>
                <div className="flex flex-col gap-1 mt-0.5">
                  <span className={cn(
                    "text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md w-fit",
                    user.plan_type === "free" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
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
        <div className="flex items-center justify-between glass-nav px-6 h-16 rounded-[2rem]">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-sm border border-slate-100">
              <img src="/logo.png" alt="ReplyKaro Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tighter uppercase">ReplyKaro</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-full active:scale-90 transition-all"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 text-primary" />}
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
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Usage Bar - Mobile */}
        <div className="px-4 py-3 border-t border-slate-50">
          <UsageBar compact />
        </div>

        <div className="p-6 border-t border-slate-50 bg-slate-50/30 rounded-b-[2.5rem]">
          <div className="flex items-center gap-4 mb-4">
            <SafeImage
              src={user.profile_picture_url}
              alt={user.instagram_username}
              fallbackComponent={
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold">
                  {user.instagram_username.charAt(0).toUpperCase()}
                </div>
              }
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">@{user.instagram_username}</p>
              <p className="text-xs text-slate-500 uppercase font-black tracking-wider">{user.plan_type} plan</p>
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

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
