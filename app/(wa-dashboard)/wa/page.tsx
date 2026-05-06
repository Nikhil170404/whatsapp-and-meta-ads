import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  MessageSquare, Zap, Users, Send, CheckCircle2, 
  AlertCircle, ArrowUpRight, TrendingUp, Activity,
  FileText, CreditCard, Link2
} from "lucide-react";

export default async function WaOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Connection status
  const { data: connection } = await supabase
    .from("wa_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  // Active automations count
  let automationCount = 0;
  try {
    const { count } = await supabase
      .from("wa_automations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.id)
      .eq("is_active", true);
    automationCount = count || 0;
  } catch {}

  // Recent messages
  let recentMessages: any[] = [];
  try {
    const { data } = await supabase
      .from("wa_messages")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false })
      .limit(5);
    recentMessages = data || [];
  } catch {}

  const isConnected = connection?.status === 'active';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">WhatsApp Dashboard</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">
          Welcome back! Here's your automation overview.
        </p>
      </div>

      {/* Connection Banner */}
      {!isConnected && (
        <Link href="/wa/connect" className="block">
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200/50 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-800">Connect WhatsApp Business</h3>
                <p className="text-sm text-amber-600">Set up your WhatsApp API connection to start automating.</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Connection", value: isConnected ? "Active" : "Not Connected", icon: Activity, color: isConnected ? "text-[#25D366]" : "text-slate-400", bg: isConnected ? "bg-[#25D366]/10" : "bg-slate-50" },
          { label: "Automations", value: `${automationCount} active`, icon: Zap, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Messages Today", value: `${recentMessages.filter(m => new Date(m.created_at).toDateString() === new Date().toDateString()).length}`, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Plan", value: session.plan_type || "Free", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 hover:shadow-md transition-all group">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
            <p className="text-lg font-black text-slate-900 capitalize">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "New Automation", icon: Zap, href: "/wa/automations", color: "text-[#25D366]", bg: "bg-[#25D366]/5 border-[#25D366]/20 hover:bg-[#25D366]/10" },
            { label: "Send Broadcast", icon: Send, href: "/wa/broadcasts", color: "text-violet-600", bg: "bg-violet-50 border-violet-100 hover:bg-violet-100" },
            { label: "View Contacts", icon: Users, href: "/wa/contacts", color: "text-blue-600", bg: "bg-blue-50 border-blue-100 hover:bg-blue-100" },
            { label: "Templates", icon: FileText, href: "/wa/templates", color: "text-amber-600", bg: "bg-amber-50 border-amber-100 hover:bg-amber-100" },
          ].map((action, i) => (
            <Link key={i} href={action.href}>
              <div className={`${action.bg} border rounded-2xl p-4 md:p-5 text-center transition-all cursor-pointer group active:scale-95`}>
                <action.icon className={`w-6 h-6 mx-auto mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
                <p className="text-xs font-bold text-slate-700">{action.label}</p>
              </div>
            </Link>
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
          {recentMessages.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {recentMessages.map((msg: any) => (
                <div key={msg.id} className="p-4 md:p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    msg.direction === 'outbound' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {msg.direction === 'outbound' ? `→ ${msg.to_phone}` : `← ${msg.from_phone}`}
                      </p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        msg.direction === 'outbound' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {msg.direction}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{msg.content}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className={`text-[9px] font-bold ${
                      msg.status === 'read' ? 'text-blue-500' : 
                      msg.status === 'delivered' ? 'text-[#25D366]' : 'text-slate-400'
                    }`}>
                      {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">No messages yet. Connect your WhatsApp to start receiving messages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
