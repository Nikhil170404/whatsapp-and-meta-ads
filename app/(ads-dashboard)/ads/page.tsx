import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, TrendingUp, DollarSign, Activity, Eye, MousePointerClick } from "lucide-react";

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

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("user_id", session.id);

  const totalSpend = campaigns?.reduce((sum: number, c: any) => sum + Number(c.spend), 0) || 0;
  const totalImpressions = campaigns?.reduce((sum: number, c: any) => sum + Number(c.impressions), 0) || 0;
  const activeCampaigns = campaigns?.filter((c: any) => c.status === 'ACTIVE').length || 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ads Overview</h1>
          <p className="text-slate-500 font-medium mt-1">Monitor Meta Ads performance and comment-to-DM automations.</p>
        </div>
        <div className="flex items-center gap-3">
          {connection?.status === 'active' ? (
             <div className="flex items-center gap-2 px-4 py-2 bg-[#1877F2]/10 text-[#1877F2] rounded-xl font-bold text-sm">
               <div className="w-2 h-2 rounded-full bg-[#1877F2] animate-pulse" />
               Connected
             </div>
          ) : (
            <Link 
              href="/ads/connect" 
              className="flex items-center gap-2 px-6 py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/20"
            >
              Connect Meta Ads
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="w-24 h-24 text-[#1877F2]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center mb-4 text-[#1877F2]">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Spend</p>
            <h3 className="text-4xl font-black text-slate-900">${totalSpend.toFixed(2)}</h3>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Eye className="w-24 h-24 text-[#1877F2]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center mb-4 text-[#1877F2]">
              <Eye className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Impressions</p>
            <h3 className="text-4xl font-black text-slate-900">{totalImpressions.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Activity className="w-24 h-24 text-[#1877F2]" />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center mb-4 text-[#1877F2]">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Active Campaigns</p>
            <h3 className="text-4xl font-black text-slate-900">{activeCampaigns}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">Campaign Preview</h2>
          <Link href="/ads/campaigns" className="text-sm font-bold text-[#1877F2] hover:text-[#155EC0]">View All Campaigns →</Link>
        </div>
        
        {campaigns && campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Campaign</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Spend</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.slice(0, 5).map((campaign: any) => (
                  <tr key={campaign.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm">{campaign.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{campaign.objective}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-slate-900">${Number(campaign.spend).toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-slate-900">{Number(campaign.ctr).toFixed(2)}%</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No campaigns synced</h3>
            <p className="text-slate-500 text-sm">Connect your Ad Account to sync and view your campaigns.</p>
          </div>
        )}
      </div>
    </div>
  );
}
