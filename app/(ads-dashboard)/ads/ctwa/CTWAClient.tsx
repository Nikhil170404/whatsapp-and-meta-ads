"use client";

import { useState } from "react";
import { Plus, MessageSquare, Power, Trash2, Loader2, X, AlertCircle, CheckCircle, ChevronRight, Megaphone, IndianRupee, Globe } from "lucide-react";
import Link from "next/link";

interface CTWACampaign {
  id: string;
  name: string;
  ad_text: string;
  headline: string;
  whatsapp_number: string;
  opening_message: string;
  daily_budget_inr: number;
  target_countries: string[];
  meta_campaign_id: string | null;
  meta_ad_id: string | null;
  status: string;
  created_at: string;
}

interface Props {
  initialCampaigns: CTWACampaign[];
  isConnected: boolean;
  hasPage: boolean;
  waPhoneNumber: string;
}

const COUNTRY_LABELS: Record<string, string> = {
  IN: "India", US: "United States", GB: "United Kingdom", AE: "UAE",
  SG: "Singapore", AU: "Australia", CA: "Canada", NZ: "New Zealand",
};

const HOW_IT_WORKS = [
  { step: "1", text: "Someone scrolls Facebook/Instagram and sees your ad" },
  { step: "2", text: "They tap the \"Send Message\" button on the ad" },
  { step: "3", text: "WhatsApp opens with your pre-filled opening message" },
  { step: "4", text: "They hit send — you have a warm lead in your WhatsApp inbox" },
];

export function CTWAClient({ initialCampaigns, isConnected, hasPage, waPhoneNumber }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    ad_text: "",
    headline: "",
    whatsapp_number: waPhoneNumber,
    opening_message: "Hi, I saw your ad and I'm interested!",
    daily_budget_inr: "100",
    countries: ["IN"],
  });

  const resetForm = () => {
    setForm({
      name: "",
      ad_text: "",
      headline: "",
      whatsapp_number: waPhoneNumber,
      opening_message: "Hi, I saw your ad and I'm interested!",
      daily_budget_inr: "100",
      countries: ["IN"],
    });
    setError(null);
    setShowForm(false);
  };

  const toggleCountry = (code: string) => {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(code)
        ? f.countries.filter((c) => c !== code)
        : [...f.countries, code],
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return setError("Campaign name is required.");
    if (!form.ad_text.trim()) return setError("Primary ad text is required.");
    if (!form.headline.trim()) return setError("Headline is required.");
    if (!form.whatsapp_number.trim()) return setError("WhatsApp number is required.");
    if (Number(form.daily_budget_inr) < 57) return setError("Minimum daily budget is ₹57.");
    if (form.countries.length === 0) return setError("Select at least one country.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/ctwa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, daily_budget_inr: Number(form.daily_budget_inr) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaigns((prev) => [data.campaign, ...prev]);
      resetForm();
      setSuccessMsg("CTWA campaign created! Go to Meta Ads Manager to add an image/video and activate it.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: CTWACampaign) => {
    setTogglingId(c.id);
    setSuccessMsg(null);
    try {
      const newStatus = c.status === "active" ? "paused" : "active";
      const res = await fetch("/api/ads/ctwa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: newStatus } : x));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this CTWA campaign? This will also delete it from Meta Ads Manager.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ads/ctwa?id=${id}`, { method: "DELETE" });
      if (res.ok) setCampaigns((prev) => prev.filter((c) => c.id !== id));
      else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const canCreate = isConnected && hasPage;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Click-to-WhatsApp Ads</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Run Facebook & Instagram ads that open WhatsApp directly — turn cold traffic into conversations.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Ad
          </button>
        )}
      </div>

      {/* Warnings */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Meta Ads account not connected</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              <Link href="/ads/connect" className="font-bold underline">Connect your account</Link> first to create CTWA ads.
            </p>
          </div>
        </div>
      )}
      {isConnected && !hasPage && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">No Facebook Page linked</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              <Link href="/ads/connect" className="font-bold underline">Reconnect your Meta account</Link> to link a Facebook Page (required for CTWA ads).
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-700">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* How it works — shown when no campaigns */}
      {campaigns.length === 0 && !showForm && (
        <div className="bg-gradient-to-br from-[#1877F2]/5 to-blue-50 border border-[#1877F2]/10 rounded-[2rem] p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">How Click-to-WhatsApp works</p>
              <p className="text-xs text-slate-500 font-medium">Same feature as AiSensy & Wati — now built into ReplyKaro</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex items-start gap-3 bg-white/70 rounded-2xl p-4">
                <div className="w-7 h-7 rounded-xl bg-[#1877F2] text-white flex items-center justify-center text-xs font-black shrink-0">
                  {item.step}
                </div>
                <p className="text-sm font-medium text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-5 flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/20"
            >
              <Plus className="w-4 h-4" /> Create Your First CTWA Ad
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#1877F2]/20 shadow-lg shadow-[#1877F2]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900">New Click-to-WhatsApp Ad</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Campaign name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Summer Sale — WhatsApp Leads"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
              />
            </div>

            {/* Ad primary text */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Primary Ad Text <span className="font-medium normal-case text-slate-400">(shown in the feed above the image)</span>
              </label>
              <textarea
                rows={3}
                placeholder="🔥 Limited time offer! Get 30% off today. Chat with us on WhatsApp to claim your discount."
                value={form.ad_text}
                onChange={(e) => setForm({ ...form, ad_text: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2] resize-none"
              />
              <p className="text-xs text-slate-400 font-medium mt-1">{form.ad_text.length} chars</p>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Headline <span className="font-medium normal-case text-slate-400">(appears on the button card)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Chat with us on WhatsApp"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
              />
            </div>

            {/* WhatsApp number + opening message side by side on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  WhatsApp Number <span className="font-medium normal-case text-slate-400">(with country code)</span>
                </label>
                <input
                  type="tel"
                  placeholder="919876543210"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
                />
                <p className="text-xs text-slate-400 font-medium mt-1">Digits only, no + or spaces</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Opening WhatsApp Message <span className="font-medium normal-case text-slate-400">(pre-filled for user)</span>
                </label>
                <input
                  type="text"
                  placeholder="Hi, I saw your ad and I'm interested!"
                  value={form.opening_message}
                  onChange={(e) => setForm({ ...form, opening_message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
                />
              </div>
            </div>

            {/* Daily budget */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Daily Budget (INR) <span className="font-medium normal-case text-slate-400">— minimum ₹57/day</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="57"
                  step="1"
                  placeholder="100"
                  value={form.daily_budget_inr}
                  onChange={(e) => setForm({ ...form, daily_budget_inr: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
                />
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                At ₹{Number(form.daily_budget_inr || 0).toFixed(0)}/day → ~₹{(Number(form.daily_budget_inr || 0) * 30).toFixed(0)}/month
              </p>
            </div>

            {/* Target countries */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <Globe className="inline w-3.5 h-3.5 mr-1" />Target Countries
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleCountry(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      form.countries.includes(code)
                        ? "bg-[#1877F2] text-white border-[#1877F2]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-[#1877F2]/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note about image */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-1">After creating</p>
              <p className="text-xs text-blue-600 font-medium">
                Your ad will be created as <strong>Paused</strong> in Meta Ads Manager.
                Add an image or video there, then activate it to start running.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-rose-600">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#155EC0] disabled:opacity-60 transition-all shadow-lg shadow-[#1877F2]/20"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {saving ? "Creating on Meta…" : "Create CTWA Campaign"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error alert outside form */}
      {error && !showForm && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-rose-600">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {campaigns.map((c) => (
              <div key={c.id} className="p-5 md:p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      c.status === "active" ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"
                    }`}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-black text-slate-900">{c.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          c.status === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium truncate max-w-sm">{c.ad_text}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" />{c.daily_budget_inr}/day
                        </span>
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-[#25D366]" />+{c.whatsapp_number}
                        </span>
                        {c.target_countries?.length > 0 && (
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {c.target_countries.map((code) => COUNTRY_LABELS[code] || code).join(", ")}
                          </span>
                        )}
                        {c.meta_campaign_id && (
                          <a
                            href={`https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.meta_campaign_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#1877F2] font-bold hover:underline"
                          >
                            View in Ads Manager →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={togglingId === c.id}
                      title={c.status === "active" ? "Pause" : "Activate"}
                      className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                        c.status === "active"
                          ? "text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20"
                          : "text-slate-400 bg-slate-100 hover:bg-slate-200"
                      }`}
                    >
                      {togglingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      title="Delete campaign"
                      className="p-2.5 text-rose-400 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
