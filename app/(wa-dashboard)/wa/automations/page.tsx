import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus, Zap, MessageSquare, Trash2, Power } from "lucide-react";

export default async function WaAutomationsPage() {
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

  const { data: automations } = await supabase
    .from("wa_automations")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp Automations</h1>
          <p className="text-slate-500 font-medium mt-1">Set up keyword-based auto-replies for inbound messages.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20">
          <Plus className="w-5 h-5" />
          New Automation
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {automations && automations.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {automations.map((auto: any) => (
              <div key={auto.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${auto.is_active ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-slate-100 text-slate-400'}`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{auto.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        Trigger: <span className="font-bold text-slate-700">{auto.trigger_keyword || 'Any message'}</span>
                      </p>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <p className="text-sm font-medium text-slate-500">
                        Sent {auto.sent_count} times
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button className={`p-2.5 rounded-xl transition-colors ${auto.is_active ? 'text-[#25D366] hover:bg-[#25D366]/10 bg-[#25D366]/5' : 'text-slate-400 hover:bg-slate-100 bg-slate-50'}`} title="Toggle Active">
                    <Power className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 text-rose-500 hover:bg-rose-50 bg-rose-50/50 rounded-xl transition-colors" title="Delete">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Zap className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No automations yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">Create rules to instantly reply to users when they message you with specific keywords.</p>
          </div>
        )}
      </div>
    </div>
  );
}
