"use client";

import { useMemo } from "react";
import { BarChart3, DollarSign, Eye, MousePointerClick, TrendingUp, Zap, Activity, ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  synced_at?: string;
}

interface Automation {
  id: string;
  trigger_keyword: string | null;
  reply_message: string;
  send_dm: boolean;
  is_active: boolean;
}

interface Props {
  campaigns: Campaign[];
  automations: Automation[];
  isConnected: boolean;
}

export function AdsAnalyticsClient({ campaigns, automations, isConnected }: Props) {
  const totalSpend = useMemo(() => campaigns.reduce((s, c) => s + Number(c.spend || 0), 0), [campaigns]);
  const totalImpressions = useMemo(() => campaigns.reduce((s, c) => s + Number(c.impressions || 0), 0), [campaigns]);
  const totalClicks = useMemo(() => campaigns.reduce((s, c) => s + Number(c.clicks || 0), 0), [campaigns]);
  const avgCtr = useMemo(() => campaigns.length ? campaigns.reduce((s, c) => s + Number(c.ctr || 0), 0) / campaigns.length : 0, [campaigns]);
  const activeCampaigns = campaigns.filter(c => c.status === "ACTIVE").length;
  const activeAutomations = automations.filter(a => a.is_active).length;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  // Top campaigns by spend
  const topBySpend = [...campaigns].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 5);
  const maxSpend = topBySpend.length > 0 ? Number(topBySpend[0].spend) : 1;

  // Top campaigns by clicks
  const topByClicks = [...campaigns].sort((a, b) => Number(b.clicks) - Number(a.clicks)).slice(0, 5);
  const maxClicks = topByClicks.length > 0 ? Number(topByClicks[0].clicks) : 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Ads Analytics</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Performance overview of your Meta ad campaigns.</p>
        </div>
        <Link href="/ads/campaigns"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm shrink-0">
          <RefreshCw className="w-4 h-4" /> Sync Campaigns
        </Link>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-amber-700">Connect your Meta Ads account to see analytics.</p>
          <Link href="/ads/connect" className="shrink-0 px-4 py-2 bg-[#1877F2] text-white text-xs font-bold rounded-xl hover:bg-[#155EC0] transition-colors">Connect Now</Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Spend", value: `$${totalSpend.toFixed(2)}`, sub: `${activeCampaigns} active campaigns`, icon: DollarSign, color: "text-[#1877F2]", bg: "bg-[#1877F2]/5", border: "border-[#1877F2]/10" },
          { label: "Total Impressions", value: totalImpressions.toLocaleString(), sub: `CPM: $${cpm.toFixed(2)}`, icon: Eye, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
          { label: "Total Clicks", value: totalClicks.toLocaleString(), sub: `Avg CPC: $${cpc.toFixed(2)}`, icon: MousePointerClick, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Avg CTR", value: `${avgCtr.toFixed(2)}%`, sub: `${campaigns.length} campaigns total`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        ].map(stat => (
          <div key={stat.label} className={`bg-white rounded-2xl border ${stat.border} p-4 md:p-5 hover:shadow-md transition-shadow`}>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{stat.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Two columns: top spend + top clicks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top by spend */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#1877F2]" /> Top Campaigns by Spend
          </h2>
          {topBySpend.length > 0 ? (
            <div className="space-y-3">
              {topBySpend.map((camp, i) => {
                const pct = Math.round((Number(camp.spend) / maxSpend) * 100);
                return (
                  <div key={camp.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                        <p className="text-sm font-bold text-slate-700 truncate">{camp.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${camp.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                          {camp.status}
                        </span>
                        <span className="text-xs font-black text-slate-900">${Number(camp.spend).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1877F2] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No campaigns synced yet.</p>
              <Link href="/ads/campaigns" className="mt-2 text-xs font-bold text-[#1877F2] hover:underline block">Sync campaigns →</Link>
            </div>
          )}
        </div>

        {/* Top by clicks */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-amber-500" /> Top Campaigns by Clicks
          </h2>
          {topByClicks.length > 0 ? (
            <div className="space-y-3">
              {topByClicks.map((camp, i) => {
                const pct = Math.round((Number(camp.clicks) / maxClicks) * 100);
                return (
                  <div key={camp.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                        <p className="text-sm font-bold text-slate-700 truncate">{camp.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-amber-600">{Number(camp.clicks).toLocaleString()} clicks</span>
                        <span className="text-xs text-slate-400">{Number(camp.ctr).toFixed(1)}% CTR</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <MousePointerClick className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No click data yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* All campaigns table */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-500" /> All Campaigns
          </h2>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="text-left pb-3 pr-4">Campaign</th>
                  <th className="text-right pb-3 px-2">Spend</th>
                  <th className="text-right pb-3 px-2">Impressions</th>
                  <th className="text-right pb-3 px-2">Clicks</th>
                  <th className="text-right pb-3 px-2">CTR</th>
                  <th className="text-right pb-3">CPC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.map(camp => {
                  const campCpc = Number(camp.clicks) > 0 ? Number(camp.spend) / Number(camp.clicks) : 0;
                  return (
                    <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${camp.status === "ACTIVE" ? "bg-green-500" : "bg-slate-300"}`} />
                          <div>
                            <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{camp.name}</p>
                            {camp.objective && <p className="text-[10px] text-slate-400 uppercase tracking-wider">{camp.objective.replace(/_/g, " ")}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 text-sm font-black text-[#1877F2]">${Number(camp.spend).toFixed(2)}</td>
                      <td className="text-right py-3 px-2 text-sm font-bold text-slate-700">{Number(camp.impressions).toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-sm font-bold text-amber-600">{Number(camp.clicks).toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-sm font-bold text-emerald-600">{Number(camp.ctr).toFixed(2)}%</td>
                      <td className="text-right py-3 text-sm font-bold text-slate-500">${campCpc.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-100">
                <tr>
                  <td className="py-3 pr-4 text-xs font-black text-slate-500 uppercase tracking-wider">Totals</td>
                  <td className="text-right py-3 px-2 text-sm font-black text-[#1877F2]">${totalSpend.toFixed(2)}</td>
                  <td className="text-right py-3 px-2 text-sm font-black text-slate-700">{totalImpressions.toLocaleString()}</td>
                  <td className="text-right py-3 px-2 text-sm font-black text-amber-600">{totalClicks.toLocaleString()}</td>
                  <td className="text-right py-3 px-2 text-sm font-black text-emerald-600">{avgCtr.toFixed(2)}%</td>
                  <td className="text-right py-3 text-sm font-black text-slate-500">${cpc.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Automations summary */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Ad Automations ({activeAutomations} active)
          </h2>
          <Link href="/ads/automations" className="text-xs font-bold text-[#1877F2] hover:underline flex items-center gap-1">
            Manage <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {automations.length > 0 ? (
          <div className="space-y-2">
            {automations.slice(0, 5).map(auto => (
              <div key={auto.id} className={`flex items-center gap-3 p-3 rounded-xl ${auto.is_active ? "bg-[#1877F2]/5" : "bg-slate-50"}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${auto.is_active ? "bg-[#1877F2]" : "bg-slate-300"}`} />
                <p className="text-sm font-bold text-slate-700 flex-1 truncate">
                  {auto.trigger_keyword ? `Keyword: "${auto.trigger_keyword}"` : "Any comment"}
                </p>
                {auto.send_dm && <span className="text-[10px] font-black text-[#1877F2] bg-[#1877F2]/10 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">+ DM</span>}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${auto.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                  {auto.is_active ? "ON" : "OFF"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Zap className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No ad automations yet.</p>
            <Link href="/ads/automations" className="mt-2 text-xs font-bold text-[#1877F2] hover:underline block">Create your first automation →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
