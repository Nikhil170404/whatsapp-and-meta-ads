"use client";

import { useState } from "react";
import { Plus, FileText, CheckCircle2, Clock, XCircle, X, Loader2, Eye } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  body_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

const CATEGORIES = [
  { value: "UTILITY", label: "Utility", desc: "Order updates, alerts, account info" },
  { value: "MARKETING", label: "Marketing", desc: "Promotions, offers, announcements" },
  { value: "AUTHENTICATION", label: "Authentication", desc: "OTPs and verification codes" },
];

const LANGUAGES = [
  { value: "en_US", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "kn", label: "Kannada" },
];

const EXAMPLES = [
  { label: "Order Confirmation", category: "UTILITY", text: "Hi {{1}}, your order #{{2}} has been confirmed! We'll deliver by {{3}}. Track your order at replykaro.in/track" },
  { label: "Flash Sale", category: "MARKETING", text: "🔥 Flash Sale! Hi {{1}}, get 40% OFF on all products today only. Use code FLASH40. Shop now: replykaro.in/sale" },
  { label: "Appointment Reminder", category: "UTILITY", text: "Reminder: Hi {{1}}, your appointment is scheduled for {{2}} at {{3}}. Reply YES to confirm or NO to reschedule." },
];

export function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    body_text: "",
  });

  const resetForm = () => {
    setForm({ name: "", category: "UTILITY", language: "en_US", body_text: "" });
    setError(null);
    setShowForm(false);
  };

  const applyExample = (ex: (typeof EXAMPLES)[0]) => {
    setForm((f) => ({ ...f, body_text: ex.text, category: ex.category }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return setError("Template name is required.");
    if (!/^[a-z0-9_]+$/.test(form.name.trim())) return setError("Name must be lowercase letters, numbers, and underscores only.");
    if (!form.body_text.trim()) return setError("Template body is required.");
    if (form.body_text.length < 10) return setError("Template body is too short.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates((prev) => [data.template, ...prev]);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
    if (status === "rejected") return <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold"><XCircle className="w-3 h-3" /> Rejected</span>;
    return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold"><Clock className="w-3 h-3" /> Pending</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Message Templates</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Create WhatsApp-approved templates for broadcasts and automations.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Info banner */}
      {!showForm && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Templates require Meta approval</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">New templates are reviewed by Meta within 24 hours. Use variables like {`{{1}}`}, {`{{2}}`} for dynamic content such as customer names or order numbers.</p>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900">Create Template</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Quick Examples */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start from an example</label>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => applyExample(ex)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. order_confirmation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces (use underscores)</p>
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] bg-white"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${form.category === cat.value ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}
                  >
                    <p className={`text-sm font-bold ${form.category === cat.value ? "text-[#25D366]" : "text-slate-700"}`}>{cat.label}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Body</label>
              <textarea
                rows={5}
                placeholder="Hi {{1}}, your order #{{2}} is confirmed! Delivery expected by {{3}}."
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-400 font-medium">Use {`{{1}}`}, {`{{2}}`} for dynamic values</p>
                <p className="text-xs text-slate-400 font-medium">{form.body_text.length}/1024</p>
              </div>
            </div>

            {/* WhatsApp Preview */}
            {form.body_text && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preview</label>
                <div className="bg-[#E5DDD5] rounded-2xl p-4">
                  <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
                    <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{form.body_text}</p>
                    <p className="text-[10px] text-slate-400 text-right mt-1">12:00 PM ✓✓</p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {saving ? "Submitting..." : "Submit for Approval"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.length > 0 ? (
          templates.map((tpl) => (
            <div key={tpl.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <FileText className="w-4 h-4" />
                </div>
                {statusBadge(tpl.status)}
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-0.5">{tpl.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {tpl.category} • {LANGUAGES.find((l) => l.value === tpl.language)?.label ?? tpl.language}
              </p>
              <div className="bg-[#E5DDD5] rounded-xl p-3 flex-1 mb-3">
                <div className="bg-white rounded-xl rounded-tl-none p-2.5 shadow-sm">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3">{tpl.body_text}</p>
                </div>
              </div>
              <button
                onClick={() => setPreview(tpl)}
                className="text-xs font-bold text-[#25D366] hover:text-[#1DA851] flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Full Preview
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full p-12 md:p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No templates yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Templates are needed to send broadcasts and run automations. Create your first one above.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Template
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-900">{preview.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{preview.category}</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#E5DDD5] rounded-2xl p-4">
              <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-sm">
                <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{preview.body_text}</p>
                <p className="text-[10px] text-slate-400 text-right mt-2">12:00 PM ✓✓</p>
              </div>
            </div>
            <div className="mt-4">{statusBadge(preview.status)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
