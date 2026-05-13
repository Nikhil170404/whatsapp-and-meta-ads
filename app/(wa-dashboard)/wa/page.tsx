import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Zap, Users, Send, CheckCircle2,
  ArrowUpRight, FileText, ChevronRight, AlertTriangle,
  Plus, Power, BarChart3
} from "lucide-react";

export default async function WaOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const [
    { data: connection },
    { data: automations },
    { count: templateCount },
    { count: contactCount },
    { data: recentMessages },
  ] = await Promise.all([
    supabase.from("wa_connections").select("*").eq("user_id", session.id).single(),
    supabase.from("wa_automations").select("*").eq("user_id", session.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("wa_templates").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_messages").select("*").eq("user_id", session.id).order("created_at", { ascending: false }).limit(4),
  ]);

  const isConnected = connection?.status === "active";
  const isTokenExpired = connection?.status === "expired";
  const activeAutomations = automations?.filter((a) => a.is_active) ?? [];
  const allAutomations = automations ?? [];
  const msgs = recentMessages ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Expired token warning ── */}
      {isTokenExpired && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-800">WhatsApp token expired — automations are paused</p>
            <p className="text-xs text-rose-600 font-medium">Reconnect to resume auto-replies.</p>
          </div>
          <Link href="/wa/connect" className="shrink-0 px-4 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors text-center">
            Reconnect Now
          </Link>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Hey, {session.display_name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            {activeAutomations.length > 0
              ? `${activeAutomations.length} automation${activeAutomations.length > 1 ? "s" : ""} running 24/7 for you.`
              : "Set up your first automation to start auto-replying."}
          </p>
        </div>
        <Link
          href="/wa/automations"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-md shadow-[#25D366]/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Automation</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* ── Connect prompt (if not connected) ── */}
      {!isConnected && !isTokenExpired && (
        <div className="bg-gradient-to-br from-[#25D366]/10 to-[#25D366]/5 border border-[#25D366]/20 rounded-[1.5rem] p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-white fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-slate-900 mb-1">Connect WhatsApp first</p>
              <p className="text-sm text-slate-500 font-medium mb-4">Link your WhatsApp Business Account to enable automations, broadcasts, and messages.</p>
              <Link
                href="/wa/connect"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-md shadow-[#25D366]/15"
              >
                Connect WhatsApp <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Automations section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Automations</h2>
          <Link href="/wa/automations" className="text-xs font-bold text-[#25D366] hover:underline flex items-center gap-0.5">
            Manage all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {allAutomations.length === 0 ? (
          /* Empty state: show 3 quick-start examples */
          <div className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-50">
              <p className="text-sm font-bold text-slate-700">No automations yet. Start with one of these:</p>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { keyword: "price", reply: "Hey! 👋 Our plans start at ₹999/mo. See full pricing at replykaro.in/pricing" },
                { keyword: "catalog", reply: "Here's our full catalog 📱 [link]. Reply DEMO to book a free call." },
                { keyword: "support", reply: "Hi! Our support team will get back to you within 2 hours. WhatsApp us anytime." },
              ].map((ex) => (
                <Link key={ex.keyword} href={`/wa/automations?keyword=${ex.keyword}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/15 transition-colors">
                    <Zap className="w-4 h-4 text-[#25D366]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">Keyword: <span className="text-[#25D366]">"{ex.keyword}"</span></p>
                    <p className="text-xs text-slate-400 font-medium truncate">{ex.reply}</p>
                  </div>
                  <Plus className="w-4 h-4 text-slate-300 group-hover:text-[#25D366] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
            <div className="p-4 border-t border-slate-50">
              <Link href="/wa/automations" className="flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all">
                <Plus className="w-4 h-4" /> Create Your First Automation
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {allAutomations.map((auto: any) => (
                <div key={auto.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${auto.is_active ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{auto.name}</p>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${auto.is_active ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"}`}>
                        {auto.is_active ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium truncate">
                      {auto.trigger_type === "keyword" ? `"${auto.trigger_keyword}"` : auto.trigger_type === "any" ? "Any message" : "First message"}
                      {" · "}{auto.sent_count ?? 0} sent
                    </p>
                  </div>
                  <Power className={`w-4 h-4 shrink-0 ${auto.is_active ? "text-[#25D366]" : "text-slate-300"}`} />
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-50">
              <Link href="/wa/automations" className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/5 rounded-xl transition-colors">
                Manage automations <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Connection",
            value: isConnected ? "Active" : isTokenExpired ? "Expired" : "Not set up",
            icon: MessageSquare,
            color: isConnected ? "text-[#25D366]" : "text-rose-500",
            bg: isConnected ? "bg-[#25D366]/10" : "bg-rose-50",
            href: "/wa/connect",
          },
          { label: "Active Automations", value: `${activeAutomations.length}`, icon: Zap, color: "text-violet-600", bg: "bg-violet-50", href: "/wa/automations" },
          { label: "Contacts", value: `${contactCount ?? 0}`, icon: Users, color: "text-blue-600", bg: "bg-blue-50", href: "/wa/contacts" },
          { label: "Templates", value: `${templateCount ?? 0}`, icon: FileText, color: "text-amber-600", bg: "bg-amber-50", href: "/wa/templates" },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md transition-all group cursor-pointer">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2.5`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="text-xl font-black text-slate-900 capitalize">{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: "Send a Broadcast", desc: "Message all contacts at once with a template", href: "/wa/broadcasts", icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
            { title: "Add a Template", desc: "Create reusable message templates", href: "/wa/templates", icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
            { title: "View Messages", desc: "See all incoming conversations", href: "/wa/messages", icon: MessageSquare, color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
          ].map((qa) => (
            <Link key={qa.title} href={qa.href}>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all group flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${qa.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <qa.icon className={`w-5 h-5 ${qa.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{qa.title}</p>
                  <p className="text-xs text-slate-400 font-medium truncate">{qa.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent messages ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Messages</h2>
          <Link href="/wa/messages" className="text-xs font-bold text-[#25D366] hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden">
          {msgs.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {msgs.map((msg: any) => (
                <Link key={msg.id} href="/wa/messages">
                  <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${msg.direction === "outbound" ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-500"}`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {msg.direction === "outbound" ? `→ ${msg.to_phone}` : `← ${msg.from_phone}`}
                      </p>
                      <p className="text-xs text-slate-400 truncate font-medium">{msg.content}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold shrink-0">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">No messages yet.</p>
              <p className="text-xs text-slate-300 font-medium mt-1">Messages will appear here once WhatsApp is connected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
