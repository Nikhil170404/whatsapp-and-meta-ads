"use client";

import { useState } from "react";
import { BarChart3, RefreshCw, Eye, MousePointerClick, DollarSign, AlertCircle, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  synced_at: string;
}

export function AdsCampaignsClient({
  initialCampaigns,
  isConnected,
}: {
  initialCampaigns: Campaign[];
  isConnected: boolean;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/ads/campaigns", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refetch updated campaigns
      const fetchRes = await fetch("/api/ads/campaigns");
      const fetchData = await fetchRes.json();
      setCampaigns(fetchData.campaigns ?? []);
      setSyncMsg({ type: "success", text: `Synced ${data.synced} campaign${data.synced !== 1 ? "s" : ""} from Meta.` });
    } catch (e: any) {
      setSyncMsg({ type: "error", text: e.message || "Sync failed. Check your Meta connection." });
    } finally {
      setSyncing(false);
    }
  };

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + Number(c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.clicks || 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Campaigns</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">View metrics and performance of your synced Meta Ads campaigns.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !isConnected}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Meta Ads account not connected</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              <Link href="/ads/connect" className="font-bold underline">Connect your account</Link> to sync and view your campaigns.
            </p>
          </div>
        </div>
      )}

      {/* Sync feedback */}
      {syncMsg && (
        <div className={`rounded-2xl p-4 text-sm font-bold ${syncMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-600"}`}>
          {syncMsg.text}
        </div>
      )}

      {/* Summary Stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active", value: activeCampaigns.toString(), icon: Activity, color: "text-green-600", bg: "bg-green-50" },
            { label: "Total Spend", value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" },
            { label: "Impressions", value: totalImpressions.toLocaleString(), icon: Eye, color: "text-violet-600", bg: "bg-violet-50" },
            { label: "Clicks", value: totalClicks.toLocaleString(), icon: MousePointerClick, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {campaigns.length > 0 ? (
          campaigns.map((camp) => (
            <div key={camp.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 flex-1">
                  <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider mb-2 ${
                    camp.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {camp.status}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 leading-tight line-clamp-2">{camp.name}</h3>
                  {camp.objective && (
                    <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">{camp.objective.replace(/_/g, " ")}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] shrink-0 ml-3">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Spend</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">${Number(camp.spend).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">CTR</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">{Number(camp.ctr).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Views</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">{Number(camp.impressions).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Clicks</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">{Number(camp.clicks).toLocaleString()}</p>
                </div>
              </div>

              {camp.synced_at && (
                <p className="text-[10px] text-slate-400 font-medium mt-3">
                  Synced {new Date(camp.synced_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full p-12 md:p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <BarChart3 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No campaigns synced yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Connect your Meta Ads account and click "Sync Now" to pull in your campaigns.
            </p>
            {isConnected && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Campaigns"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
