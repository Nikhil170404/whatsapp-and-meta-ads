"use client";

import { useState } from "react";
import { Plus, Zap, MessageCircle, Trash2, Power, X, Loader2, AlertCircle, Send } from "lucide-react";
import Link from "next/link";

interface AdsAutomation {
  id: string;
  trigger_keyword: string | null;
  reply_message: string;
  send_dm: boolean;
  is_active: boolean;
  created_at: string;
}

const PREBUILT = [
  { label: "Interest Reply", keyword: "interested", reply: "Thanks for your interest! 🎉 Reply to this message and our team will get back to you shortly with more details.", send_dm: true },
  { label: "Price Enquiry", keyword: "price", reply: "Hi! Thanks for asking about pricing. Our plans start from ₹99/month. DM us to know more!", send_dm: true },
  { label: "Any Comment", keyword: "", reply: "Thanks for engaging with our ad! We'll reach out to you with more information very soon. 🙌", send_dm: true },
  { label: "Buy Now", keyword: "buy", reply: "Great choice! 🛍️ Visit our store to complete your purchase. Our team will help you through the process.", send_dm: true },
];

export function AdsAutomationsClient({
  initialAutomations,
  isConnected,
}: {
  initialAutomations: AdsAutomation[];
  isConnected: boolean;
}) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    trigger_keyword: "",
    reply_message: "",
    send_dm: true,
  });

  const resetForm = () => {
    setForm({ trigger_keyword: "", reply_message: "", send_dm: true });
    setError(null);
    setShowForm(false);
  };

  const applyPrebuilt = (pb: typeof PREBUILT[0]) => {
    setForm({ trigger_keyword: pb.keyword, reply_message: pb.reply, send_dm: pb.send_dm });
  };

  const handleCreate = async () => {
    if (!form.reply_message.trim()) return setError("Add a reply message.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutomations((prev) => [data.automation, ...prev]);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (auto: AdsAutomation) => {
    setTogglingId(auto.id);
    try {
      const res = await fetch("/api/ads/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, is_active: !auto.is_active }),
      });
      const data = await res.json();
      if (res.ok) setAutomations((prev) => prev.map((a) => (a.id === auto.id ? data.automation : a)));
    } catch {}
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ads/automations?id=${id}`, { method: "DELETE" });
      if (res.ok) setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch {}
    setDeletingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Ad Automations</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Automatically reply to users who comment on your Meta Ads and send them a DM.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Meta Ads account not connected</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              <Link href="/ads/connect" className="font-bold underline">Connect your account</Link> first to use ad automations.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      {automations.length === 0 && !showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <p className="text-sm font-bold text-blue-700 mb-2">How Ad Automations work</p>
          <ol className="space-y-1.5 text-sm text-blue-600 font-medium list-decimal list-inside">
            <li>Someone comments on your Facebook/Instagram ad</li>
            <li>ReplyKaro detects the comment (keyword match or any comment)</li>
            <li>Automatically replies to the comment + sends a private DM</li>
            <li>Turn cold leads into warm conversations — 24/7</li>
          </ol>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#1877F2]/20 shadow-lg shadow-[#1877F2]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900">New Ad Automation</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Prebuilt starters */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Quick Start Templates
              </label>
              <div className="flex flex-wrap gap-2">
                {PREBUILT.map((pb) => (
                  <button
                    key={pb.label}
                    onClick={() => applyPrebuilt(pb)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors border border-blue-100"
                  >
                    {pb.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger keyword */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Trigger Keyword <span className="text-slate-400 font-medium normal-case">(leave blank for any comment)</span>
              </label>
              <input
                type="text"
                placeholder='e.g. "interested", "price", "buy" — or leave blank for all comments'
                value={form.trigger_keyword}
                onChange={(e) => setForm({ ...form, trigger_keyword: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
              />
            </div>

            {/* Reply message */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Comment Reply + DM Message
              </label>
              <textarea
                rows={4}
                placeholder="Thanks for your interest! Our team will reach out to you shortly with all the details. 🎉"
                value={form.reply_message}
                onChange={(e) => setForm({ ...form, reply_message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2] resize-none"
              />
              <p className="text-xs text-slate-400 font-medium mt-1.5">{form.reply_message.length} characters</p>
            </div>

            {/* Send DM toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-900">Also send a private DM</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Send the same reply as a direct message to the commenter</p>
              </div>
              <button
                onClick={() => setForm({ ...form, send_dm: !form.send_dm })}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.send_dm ? "bg-[#1877F2]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.send_dm ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {saving ? "Saving..." : "Create Automation"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {automations.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {automations.map((auto) => (
              <div key={auto.id} className="p-5 md:p-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${auto.is_active ? "bg-[#1877F2]/10 text-[#1877F2]" : "bg-slate-100 text-slate-400"}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">
                        {auto.trigger_keyword ? `Keyword: "${auto.trigger_keyword}"` : "Any comment"}
                      </p>
                      {auto.send_dm && (
                        <span className="text-[10px] px-2 py-0.5 bg-[#1877F2]/10 text-[#1877F2] rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                          <Send className="w-2.5 h-2.5" /> DM enabled
                        </span>
                      )}
                      {auto.is_active ? (
                        <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-bold">Active</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">Paused</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xs">{auto.reply_message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(auto)}
                    disabled={togglingId === auto.id}
                    title={auto.is_active ? "Pause" : "Activate"}
                    className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 ${auto.is_active ? "text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20" : "text-slate-400 bg-slate-100 hover:bg-slate-200"}`}
                  >
                    {togglingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(auto.id)}
                    disabled={deletingId === auto.id}
                    title="Delete"
                    className="p-2.5 text-rose-400 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {deletingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Zap className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No ad automations yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Click "Add Rule" to automatically reply to anyone who comments on your Meta ads.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
