import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Zap, Activity, Settings, Plus, ExternalLink, RefreshCw } from "lucide-react";

export default async function WaOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = cookies();
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
    .from("wa_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  const { count: automationsCount } = await supabase
    .from("wa_automations")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", session.id);

  const { count: messagesCount } = await supabase
    .from("wa_messages")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", session.id);

  const { data: recentMessages } = await supabase
    .from("wa_messages")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp Overview</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your WhatsApp Business connection and automations.</p>
        </div>
        <div className="flex items-center gap-3">
          {connection?.status === 'active' ? (
             <div className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 text-[#25D366] rounded-xl font-bold text-sm">
               <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
               Connected
             </div>
          ) : (
            <Link 
              href="/wa/connect" 
              className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20"
            >
              Connect Now
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <MessageSquare className="w-24 h-24 text-[#25D366]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-4 text-[#25D366]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Messages</p>
            <h3 className="text-4xl font-black text-slate-900">{messagesCount || 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Zap className="w-24 h-24 text-[#25D366]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-4 text-[#25D366]">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Active Automations</p>
            <h3 className="text-4xl font-black text-slate-900">{automationsCount || 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Activity className="w-24 h-24 text-[#25D366]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-4 text-[#25D366]">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Connection Status</p>
            <h3 className="text-xl font-black text-slate-900 mt-2">
              {connection ? connection.phone_number : 'Not Connected'}
            </h3>
            {connection && (
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase">WABA: {connection.waba_id}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Recent Messages</h2>
            <Link href="/wa/messages" className="text-sm font-bold text-[#25D366] hover:text-[#1DA851]">View All →</Link>
          </div>
          
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            {recentMessages && recentMessages.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {recentMessages.map((msg: any) => (
                  <div key={msg.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${msg.direction === 'inbound' ? 'bg-slate-800' : 'bg-[#25D366]'}`}>
                        {msg.direction === 'inbound' ? 'IN' : 'OUT'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{msg.direction === 'inbound' ? msg.from_phone : msg.to_phone}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">{msg.content || 'Media message'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 uppercase">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      <p className="text-xs font-bold text-slate-500 mt-0.5 capitalize">{msg.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No messages yet</h3>
                <p className="text-slate-500 text-sm">When you connect WhatsApp and start messaging, they will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-black text-slate-900">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/wa/automations" className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#25D366]/30 hover:shadow-md hover:shadow-[#25D366]/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">Create Automation</h4>
                <p className="text-xs text-slate-500 font-medium">Set up new keyword replies</p>
              </div>
            </Link>
            
            <Link href="/wa/templates" className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#25D366]/30 hover:shadow-md hover:shadow-[#25D366]/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm">New Template</h4>
                <p className="text-xs text-slate-500 font-medium">Submit templates to Meta</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
