import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Zap, Users, Send, CheckCircle2,
  ArrowUpRight, Activity, FileText, Circle, ChevronRight
} from "lucide-react";

export default async function WaOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  );

  const [{ data: connection }, { count: automationCount }, { count: templateCount }, { count: contactCount }, { data: recentMessages }] = await Promise.all([
    supabase.from("wa_connections").select("*").eq("user_id", session.id).single(),
    supabase.from("wa_automations").select("*", { count: "exact", head: true }).eq("user_id", session.id).eq("is_active", true),
    supabase.from("wa_templates").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_messages").select("*").eq("user_id", session.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const isConnected = connection?.status === "active";
  const hasTemplates = (templateCount ?? 0) > 0;
  const hasAutomations = (automationCount ?? 0) > 0;
  const msgs = recentMessages ?? [];

  const steps = [
    { label: "Connect WhatsApp Business", desc: "Link your WhatsApp Business Account via Meta", href: "/wa/connect", done: isConnected },
    { label: "Create a Message Template", desc: "Build reusable templates for broadcasts & automations", href: "/wa/templates", done: hasTemplates },
    { label: "Set Up an Automation", desc: "Auto-reply to keywords or any incoming message", href: "/wa/automations", done: hasAutomations },
    { label: "Send Your First Broadcast", desc: "Reach all your contacts with one template message", href: "/wa/broadcasts", done: false },
  ];

  const completedSteps = steps.filter((s) => s.done).length;
  const allDone = completedSteps === steps.length - 1; // last step is action-based

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          Welcome, {session.display_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">
          Your WhatsApp automation hub. Follow the steps below to get started.
        </p>
      </div>

      {/* Getting Started */}
      {!allDone && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Getting Started</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{completedSteps} of {steps.length} steps completed</p>
            </div>
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${i < completedSteps ? "bg-[#25D366]" : "bg-slate-100"}`} />
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {steps.map((step, i) => (
              <Link key={i} href={step.href}>
                <div className={`flex items-center gap-4 p-5 md:p-6 group hover:bg-slate-50 transition-colors cursor-pointer ${step.done ? "opacity-60" : ""}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                    step.done
                      ? "bg-[#25D366] border-[#25D366] text-white"
                      : i === completedSteps
                      ? "border-[#25D366] text-[#25D366]"
                      : "border-slate-200 text-slate-300"
                  }`}>
                    {step.done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-black">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${step.done ? "text-slate-400 line-through" : i === completedSteps ? "text-slate-900" : "text-slate-500"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{step.desc}</p>
                  </div>
                  {!step.done && (
                    <ChevronRight className={`w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1 ${i === completedSteps ? "text-[#25D366]" : "text-slate-300"}`} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Connection", value: isConnected ? "Active" : "Not set up", icon: Activity, color: isConnected ? "text-[#25D366]" : "text-slate-400", bg: isConnected ? "bg-[#25D366]/10" : "bg-slate-50", href: "/wa/connect" },
          { label: "Automations", value: `${automationCount ?? 0} active`, icon: Zap, color: "text-violet-600", bg: "bg-violet-50", href: "/wa/automations" },
          { label: "Contacts", value: `${contactCount ?? 0}`, icon: Users, color: "text-blue-600", bg: "bg-blue-50", href: "/wa/contacts" },
          { label: "Templates", value: `${templateCount ?? 0}`, icon: FileText, color: "text-amber-600", bg: "bg-amber-50", href: "/wa/templates" },
        ].map((stat, i) => (
          <Link key={i} href={stat.href}>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 hover:shadow-md transition-all group cursor-pointer">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
              <p className="text-lg font-black text-slate-900 capitalize">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-br from-[#25D366]/5 to-slate-50 rounded-[2rem] border border-[#25D366]/10 p-6 md:p-8">
        <h2 className="text-base font-black text-slate-900 mb-1">How ReplyKaro Works</h2>
        <p className="text-xs text-slate-400 font-medium mb-6">Three ways to use WhatsApp automation</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              color: "text-violet-600",
              bg: "bg-violet-50",
              title: "Keyword Automations",
              desc: 'When someone texts "PRICE" → you automatically reply with your pricing. Works 24/7 without you.',
              href: "/wa/automations",
              cta: "Set up automation",
            },
            {
              icon: FileText,
              color: "text-amber-600",
              bg: "bg-amber-50",
              title: "Message Templates",
              desc: "Pre-approved WhatsApp templates for promotions, order updates, reminders, and more.",
              href: "/wa/templates",
              cta: "Create template",
            },
            {
              icon: Send,
              color: "text-blue-600",
              bg: "bg-blue-50",
              title: "Broadcasts",
              desc: "Send one template message to hundreds of contacts at once. Perfect for announcements & offers.",
              href: "/wa/broadcasts",
              cta: "Send broadcast",
            },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100">
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <h3 className="text-sm font-black text-slate-900 mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">{item.desc}</p>
              <Link href={item.href} className={`inline-flex items-center gap-1 text-xs font-bold ${item.color} hover:underline`}>
                {item.cta} <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Messages */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Messages</h2>
          <Link href="/wa/messages" className="text-xs font-bold text-[#25D366] hover:underline">View All →</Link>
        </div>
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          {msgs.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {msgs.map((msg: any) => (
                <div key={msg.id} className="p-4 md:p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${msg.direction === "outbound" ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-500"}`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {msg.direction === "outbound" ? `→ ${msg.to_phone}` : `← ${msg.from_phone}`}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{msg.content}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold shrink-0">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">No messages yet. Messages will appear here once your WhatsApp is connected and active.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
