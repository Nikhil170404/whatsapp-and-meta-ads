import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Send, Plus, CheckCircle2, Clock, AlertCircle, Users, BarChart3 } from "lucide-react";

export default async function WaBroadcastsPage() {
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

  let broadcasts: any[] = [];
  try {
    const { data } = await supabase
      .from("wa_broadcasts")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });
    broadcasts = data || [];
  } catch {}

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Broadcasts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Send template messages to multiple contacts at once.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 self-start">
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Broadcast List */}
      <div className="space-y-4">
        {broadcasts.length > 0 ? (
          broadcasts.map((bc: any) => (
            <div key={bc.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{bc.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(bc.created_at).toLocaleDateString()} • {bc.total_recipients} recipients
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  bc.status === 'completed' ? 'bg-green-50 text-green-700' :
                  bc.status === 'sending' ? 'bg-amber-50 text-amber-600' :
                  bc.status === 'failed' ? 'bg-rose-50 text-rose-600' :
                  'bg-slate-50 text-slate-600'
                }`}>
                  {bc.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {bc.status === 'sending' && <Clock className="w-3.5 h-3.5" />}
                  {bc.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                  {bc.status}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Sent", value: bc.sent_count, color: "text-slate-900" },
                  { label: "Delivered", value: bc.delivered_count, color: "text-[#25D366]" },
                  { label: "Read", value: bc.read_count, color: "text-blue-600" },
                  { label: "Failed", value: bc.failed_count, color: "text-rose-500" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-lg font-black ${stat.color}`}>{stat.value || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Send className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No broadcasts yet</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm mb-6">Send Meta-approved template messages to your contacts for marketing, utility, or transactional purposes.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
              {[
                { icon: Users, label: "Select contacts" },
                { icon: Send, label: "Pick template" },
                { icon: BarChart3, label: "Track delivery" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl">
                  <step.icon className="w-5 h-5 text-[#25D366]" />
                  <span className="text-xs font-bold text-slate-600">{step.label}</span>
                </div>
              ))}
            </div>

            <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20">
              <Plus className="w-4 h-4" />
              Create First Broadcast
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
