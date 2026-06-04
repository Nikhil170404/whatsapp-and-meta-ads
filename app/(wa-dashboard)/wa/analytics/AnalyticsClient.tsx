"use client";
import { useMemo } from "react";
import { MessageSquare, Send, Inbox, Zap, Users, TrendingUp, BarChart3, CheckCircle2, Clock, AlertCircle, Eye } from "lucide-react";

interface Props {
  allMessages: { direction: string; created_at: string }[];
  recentMessages: { direction: string; created_at: string }[];
  automations: { name: string; sent_count: number; is_active: boolean }[];
  contactCount: number;
  broadcasts: {
    name: string; status: string; total_recipients: number;
    sent_count: number; delivered_count: number; read_count: number;
    failed_count: number; created_at: string;
  }[];
}

export function AnalyticsClient({ allMessages, recentMessages, automations, contactCount, broadcasts }: Props) {
  // Compute stats
  const sent30d = allMessages.filter(m => m.direction === "outbound").length;
  const received30d = allMessages.filter(m => m.direction === "inbound").length;
  const total30d = allMessages.length;

  const sent7d = recentMessages.filter(m => m.direction === "outbound").length;
  const received7d = recentMessages.filter(m => m.direction === "inbound").length;

  const automationsFired = automations.reduce((sum, a) => sum + (a.sent_count ?? 0), 0);
  const activeAutomations = automations.filter(a => a.is_active).length;

  // Build 7-day message chart data
  const dailyData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        date: d.toISOString().split("T")[0],
        sent: 0,
        received: 0,
      };
    });
    for (const msg of recentMessages) {
      const date = msg.created_at.split("T")[0];
      const day = days.find(d => d.date === date);
      if (!day) continue;
      if (msg.direction === "outbound") day.sent++;
      else day.received++;
    }
    return days;
  }, [recentMessages]);

  const maxVal = Math.max(...dailyData.map(d => d.sent + d.received), 1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">Your WhatsApp performance over the last 30 days.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Messages", value: total30d, sub: "last 30 days", icon: MessageSquare, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-100" },
          { label: "Messages Sent", value: sent30d, sub: `${sent7d} this week`, icon: Send, color: "text-[#25D366]", bg: "bg-[#25D366]/5", border: "border-[#25D366]/10" },
          { label: "Messages Received", value: received30d, sub: `${received7d} this week`, icon: Inbox, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Automations Fired", value: automationsFired, sub: `${activeAutomations} active`, icon: Zap, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
        ].map(stat => (
          <div key={stat.label} className={`bg-white rounded-2xl border ${stat.border} p-4 md:p-5 hover:shadow-md transition-shadow`}>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{stat.value.toLocaleString()}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* 7-day message chart */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-black text-slate-900">Messages This Week</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Daily sent vs received</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#25D366] inline-block" />Sent</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />Received</span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 md:gap-3 h-36 md:h-44">
          {dailyData.map((day) => {
            const sentH = maxVal ? Math.round((day.sent / maxVal) * 100) : 0;
            const recvH = maxVal ? Math.round((day.received / maxVal) * 100) : 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 justify-center" style={{ height: "120px" }}>
                  <div
                    className="flex-1 rounded-t-lg bg-[#25D366] transition-all duration-500 min-h-[2px]"
                    style={{ height: `${Math.max(sentH, 2)}%` }}
                    title={`Sent: ${day.sent}`}
                  />
                  <div
                    className="flex-1 rounded-t-lg bg-blue-400 transition-all duration-500 min-h-[2px]"
                    style={{ height: `${Math.max(recvH, 2)}%` }}
                    title={`Received: ${day.received}`}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{day.label}</span>
              </div>
            );
          })}
        </div>

        {total30d === 0 && (
          <p className="text-center text-sm text-slate-400 mt-4">No messages in the last 7 days yet.</p>
        )}
      </div>

      {/* Two column: automations + contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Automation leaderboard */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-500" /> Top Automations
          </h2>
          {automations.length > 0 ? (
            <div className="space-y-3">
              {[...automations].sort((a, b) => (b.sent_count ?? 0) - (a.sent_count ?? 0)).slice(0, 5).map((auto, i) => {
                const max = automations.reduce((m, a) => Math.max(m, a.sent_count ?? 0), 1);
                const pct = Math.round(((auto.sent_count ?? 0) / max) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700 truncate max-w-[70%]">{auto.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${auto.is_active ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"}`}>
                          {auto.is_active ? "ON" : "OFF"}
                        </span>
                        <span className="text-xs font-black text-slate-900">{auto.sent_count ?? 0}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No automations yet.</p>
          )}
        </div>

        {/* Contacts summary */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Audience
          </h2>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <p className="text-4xl font-black text-slate-900">{contactCount.toLocaleString()}</p>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">Total Contacts</p>
            <a href="/wa/contacts" className="mt-4 text-xs font-bold text-blue-500 hover:underline flex items-center gap-1">
              Manage contacts →
            </a>
          </div>
        </div>
      </div>

      {/* Broadcast performance */}
      {broadcasts.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6">
          <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-500" /> Recent Broadcasts
          </h2>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="text-left pb-3 pr-4">Campaign</th>
                  <th className="text-right pb-3 px-2">Sent</th>
                  <th className="text-right pb-3 px-2">Delivered</th>
                  <th className="text-right pb-3 px-2">Read</th>
                  <th className="text-right pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {broadcasts.map((bc) => {
                  const deliveryRate = bc.sent_count > 0 ? Math.round((bc.delivered_count / bc.sent_count) * 100) : 0;
                  const readRate = bc.delivered_count > 0 ? Math.round((bc.read_count / bc.delivered_count) * 100) : 0;
                  return (
                    <tr key={bc.name + bc.created_at} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[160px]">{bc.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{new Date(bc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </td>
                      <td className="text-right py-3 px-2 text-sm font-black text-slate-900">{bc.sent_count ?? 0}</td>
                      <td className="text-right py-3 px-2">
                        <p className="text-sm font-black text-[#25D366]">{bc.delivered_count ?? 0}</p>
                        <p className="text-[10px] text-slate-400">{deliveryRate}%</p>
                      </td>
                      <td className="text-right py-3 px-2">
                        <p className="text-sm font-black text-blue-600">{bc.read_count ?? 0}</p>
                        <p className="text-[10px] text-slate-400">{readRate}%</p>
                      </td>
                      <td className="text-right py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          bc.status === "completed" ? "bg-green-50 text-green-700" :
                          bc.status === "sending" ? "bg-amber-50 text-amber-600" :
                          "bg-rose-50 text-rose-600"
                        }`}>
                          {bc.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                          {bc.status === "sending" && <Clock className="w-3 h-3" />}
                          {bc.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
