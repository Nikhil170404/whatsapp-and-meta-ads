"use client";

import { useState } from "react";
import { Plus, Zap, MessageSquare, Trash2, Power, X, Loader2, ChevronDown } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_keyword?: string;
  reply_message: string;
  is_active: boolean;
  sent_count: number;
  created_at: string;
}

const TRIGGER_OPTIONS = [
  { value: "keyword", label: "Specific Keyword", desc: "Reply when message contains a word" },
  { value: "any", label: "Any Message", desc: "Reply to every incoming message" },
  { value: "welcome", label: "First Message Only", desc: "Reply only to first-time senders" },
];

export function AutomationsClient({ initialAutomations }: { initialAutomations: Automation[] }) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    trigger_type: "keyword",
    trigger_keyword: "",
    reply_message: "",
  });

  const resetForm = () => {
    setForm({ name: "", trigger_type: "keyword", trigger_keyword: "", reply_message: "" });
    setError(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return setError("Give your automation a name.");
    if (!form.reply_message.trim()) return setError("Add a reply message.");
    if (form.trigger_type === "keyword" && !form.trigger_keyword.trim()) return setError("Add a trigger keyword.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/automations", {
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

  const handleToggle = async (auto: Automation) => {
    setTogglingId(auto.id);
    try {
      const res = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, is_active: !auto.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutomations((prev) => prev.map((a) => (a.id === auto.id ? data.automation : a)));
    } catch {}
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/whatsapp/automations?id=${id}`, { method: "DELETE" });
      if (res.ok) setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch {}
    setDeletingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Automations</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Auto-reply to incoming messages based on keywords or triggers.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Automation
        </button>
      </div>

      {/* How it works tip */}
      {automations.length === 0 && !showForm && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
          <p className="text-sm font-bold text-violet-700 mb-2">How automations work</p>
          <ol className="space-y-1 text-sm text-violet-600 font-medium list-decimal list-inside">
            <li>Someone sends you a WhatsApp message</li>
            <li>ReplyKaro checks if it matches your trigger (e.g. contains the word "PRICE")</li>
            <li>Your reply is sent instantly — even at 3am</li>
          </ol>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900">New Automation</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Automation Name</label>
              <input
                type="text"
                placeholder="e.g. Price Enquiry Reply"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
              />
            </div>

            {/* Trigger Type */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">When to trigger</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TRIGGER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, trigger_type: opt.value })}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${form.trigger_type === opt.value ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}
                  >
                    <p className={`text-sm font-bold ${form.trigger_type === opt.value ? "text-[#25D366]" : "text-slate-700"}`}>{opt.label}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Keyword */}
            {form.trigger_type === "keyword" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trigger Keyword</label>
                <input
                  type="text"
                  placeholder='e.g. PRICE or "order status"'
                  value={form.trigger_keyword}
                  onChange={(e) => setForm({ ...form, trigger_keyword: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
                <p className="text-xs text-slate-400 font-medium mt-1.5">Message must contain this word (case-insensitive)</p>
              </div>
            )}

            {/* Reply Message */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Reply Message
              </label>
              <textarea
                rows={4}
                placeholder="Hi! Thanks for reaching out. Our pricing starts at ₹999/month. Reply DEMO to book a call."
                value={form.reply_message}
                onChange={(e) => setForm({ ...form, reply_message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none"
              />
              <p className="text-xs text-slate-400 font-medium mt-1.5">{form.reply_message.length} characters</p>
            </div>

            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all"
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
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${auto.is_active ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{auto.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-medium text-slate-400">
                        {auto.trigger_type === "keyword"
                          ? `Keyword: "${auto.trigger_keyword}"`
                          : auto.trigger_type === "any"
                          ? "Any message"
                          : "First message"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-medium text-slate-400">Sent {auto.sent_count ?? 0}×</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xs">{auto.reply_message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(auto)}
                    disabled={togglingId === auto.id}
                    title={auto.is_active ? "Pause" : "Activate"}
                    className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 ${auto.is_active ? "text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20" : "text-slate-400 bg-slate-100 hover:bg-slate-200"}`}
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
            <h3 className="text-lg font-bold text-slate-900 mb-2">No automations yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Click "New Automation" above to create your first auto-reply rule.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Automation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
