import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, Zap, Link2, AlertCircle, ArrowUpRight, Activity, TrendingUp, Clock, ExternalLink } from "lucide-react";

export default async function AdsOverviewPage() {
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

  const { data: connection } = await supabase
    .from("ad_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  let campaignCount = 0;
  try {
    const { count } = await supabase
      .from("ad_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.id);
    campaignCount = count || 0;
  } catch {}

  let automationCount = 0;
  try {
    const { count } = await supabase
      .from("ad_automations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.id)
      .eq("is_active", true);
    automationCount = count || 0;
  } catch {}

  const isConnected = connection?.status === 'active';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Meta Ads Dashboard</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">
          Monitor campaigns and automate ad comment responses.
        </p>
      </div>

      {/* Meta API Approval Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-blue-800 mb-1">Meta API Approval in Progress</p>
            <p className="text-xs text-blue-700 font-medium leading-relaxed mb-3">
              Our Meta Business app is currently under review for full API access (comments, DMs, advanced ads permissions).
              While approval is pending, you can connect your account, set up automations, and view campaigns — everything will go live the moment Meta approves.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">✓ Account connect works</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">✓ Campaign sync works</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">⏳ Comment automation — coming soon</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">⏳ Auto DM — coming soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Banner */}
      {!isConnected && (
        <Link href="/ads/connect" className="block">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200/50 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-[#1877F2] shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-blue-800">Connect Facebook Account</h3>
                <p className="text-sm text-blue-600">Link your Meta Ads account to sync campaigns and enable automations.</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Connection", value: isConnected ? "Active" : "Not Connected", icon: Activity, color: isConnected ? "text-[#1877F2]" : "text-slate-400", bg: isConnected ? "bg-[#1877F2]/10" : "bg-slate-50" },
          { label: "Campaigns", value: `${campaignCount} synced`, icon: BarChart3, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Automations", value: `${automationCount} active`, icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Plan", value: session.plan_type || "Free", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 hover:shadow-md transition-all">
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Connect Account", icon: Link2, href: "/ads/connect", color: "text-[#1877F2]", bg: "bg-[#1877F2]/5 border-[#1877F2]/20 hover:bg-[#1877F2]/10" },
            { label: "View Campaigns", icon: BarChart3, href: "/ads/campaigns", color: "text-violet-600", bg: "bg-violet-50 border-violet-100 hover:bg-violet-100" },
            { label: "Ad Automations", icon: Zap, href: "/ads/automations", color: "text-amber-600", bg: "bg-amber-50 border-amber-100 hover:bg-amber-100" },
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
    </div>
  );
}
