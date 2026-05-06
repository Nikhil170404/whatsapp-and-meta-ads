import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3, RefreshCw, Eye, MousePointerClick, DollarSign } from "lucide-react";

export default async function AdsCampaignsPage() {
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

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("user_id", session.id)
    .order("synced_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campaigns</h1>
          <p className="text-slate-500 font-medium mt-1">View metrics and performance of your synced Meta Ads campaigns.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
          <RefreshCw className="w-4 h-4" />
          Sync Now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns && campaigns.length > 0 ? (
          campaigns.map((camp: any) => (
            <div key={camp.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider mb-2 ${
                    camp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {camp.status}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">{camp.name}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Spend</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">${Number(camp.spend).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">CTR</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">{Number(camp.ctr).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 col-span-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase">Impressions</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">{Number(camp.impressions).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <BarChart3 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No campaigns found</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">Connect your Ad Account and sync your campaigns to view performance metrics here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
