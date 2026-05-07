"use client";

import { useState } from "react";
import { Plus, Send, CheckCircle2, Clock, AlertCircle, Users, BarChart3, X, Loader2, FileText, Search } from "lucide-react";

interface Broadcast {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  body_text: string;
  status: string;
}

interface Contact {
  id: string;
  phone_number: string;
  display_name?: string;
}

export function BroadcastsClient({
  initialBroadcasts,
  templates,
}: {
  initialBroadcasts: Broadcast[];
  templates: Template[];
}) {
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    template_id: "",
    contact_ids: [] as string[],
  });

  const selectedTemplate = templates.find((t) => t.id === form.template_id);
  const filteredContacts = contacts.filter(
    (c) =>
      c.phone_number.includes(contactSearch) ||
      (c.display_name ?? "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  const openForm = async () => {
    setShowForm(true);
    setStep(1);
    setForm({ name: "", template_id: "", contact_ids: [] });
    setError(null);

    setLoadingContacts(true);
    try {
      const res = await fetch("/api/whatsapp/contacts");
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch {}
    setLoadingContacts(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setStep(1);
    setForm({ name: "", template_id: "", contact_ids: [] });
    setError(null);
  };

  const goNext = () => {
    if (step === 1) {
      if (!form.name.trim()) return setError("Give your broadcast a name.");
      if (!form.template_id) return setError("Select a template.");
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (form.contact_ids.length === 0) return setError("Select at least one contact.");
      setError(null);
      setStep(3);
    }
  };

  const toggleContact = (id: string) => {
    setForm((f) => ({
      ...f,
      contact_ids: f.contact_ids.includes(id)
        ? f.contact_ids.filter((c) => c !== id)
        : [...f.contact_ids, id],
    }));
  };

  const selectAll = () => {
    const all = filteredContacts.map((c) => c.id);
    const allSelected = all.every((id) => form.contact_ids.includes(id));
    setForm((f) => ({
      ...f,
      contact_ids: allSelected
        ? f.contact_ids.filter((id) => !all.includes(id))
        : [...new Set([...f.contact_ids, ...all])],
    }));
  };

  const handleSend = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBroadcasts((prev) => [data.broadcast, ...prev]);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const approvedTemplates = templates.filter((t) => t.status === "approved");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Broadcasts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Send a template message to multiple contacts at once.</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* No approved templates warning */}
      {approvedTemplates.length === 0 && !showForm && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">No approved templates yet</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Broadcasts require a Meta-approved template.{" "}
              <a href="/wa/templates" className="underline font-bold">Create a template</a> first and wait for Meta approval (usually within 24 hours).
            </p>
          </div>
        </div>
      )}

      {/* Create Form — Step-based wizard */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-colors ${step >= s ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-400"}`}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                <span className={`text-xs font-bold hidden sm:block ${step >= s ? "text-slate-700" : "text-slate-400"}`}>
                  {s === 1 ? "Details" : s === 2 ? "Contacts" : "Confirm"}
                </span>
                {s < 3 && <div className={`w-8 h-px ${step > s ? "bg-[#25D366]" : "bg-slate-200"}`} />}
              </div>
            ))}
            <button onClick={resetForm} className="ml-auto p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step 1: Name + Template */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-slate-900">Set up broadcast</h2>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Broadcast Name</label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Sale Announcement"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Choose Template</label>
                {approvedTemplates.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-xl text-sm text-amber-700 font-medium">
                    No approved templates available. <a href="/wa/templates" className="font-bold underline">Create one first →</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvedTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setForm({ ...form, template_id: tpl.id })}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${form.template_id === tpl.id ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${form.template_id === tpl.id ? "text-[#25D366]" : "text-slate-400"}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-bold ${form.template_id === tpl.id ? "text-[#25D366]" : "text-slate-700"}`}>{tpl.name}</p>
                            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{tpl.body_text}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              {selectedTemplate && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message Preview</label>
                  <div className="bg-[#E5DDD5] rounded-2xl p-4">
                    <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
                      <p className="text-sm text-slate-800 font-medium leading-relaxed">{selectedTemplate.body_text}</p>
                      <p className="text-[10px] text-slate-400 text-right mt-1">12:00 PM ✓✓</p>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}
              <button onClick={goNext} disabled={approvedTemplates.length === 0} className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-40 transition-all">
                Next: Choose Contacts →
              </button>
            </div>
          )}

          {/* Step 2: Contacts */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">Choose recipients</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  {form.contact_ids.length} selected
                </span>
              </div>

              {loadingContacts ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#25D366] mx-auto" /></div>
              ) : contacts.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No contacts yet. Contacts appear automatically when people message you.</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button onClick={selectAll} className="text-xs font-bold text-[#25D366] hover:underline">
                      {filteredContacts.every((c) => form.contact_ids.includes(c.id)) ? "Deselect all" : "Select all"}
                    </button>
                    <span className="text-xs text-slate-400">{filteredContacts.length} contacts</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-1">
                    {filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleContact(c.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${form.contact_ids.includes(c.id) ? "bg-[#25D366]/10" : "hover:bg-slate-50"}`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${form.contact_ids.includes(c.id) ? "bg-[#25D366] border-[#25D366]" : "border-slate-300"}`}>
                          {form.contact_ids.includes(c.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{c.display_name || c.phone_number}</p>
                          {c.display_name && <p className="text-xs text-slate-400">{c.phone_number}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">← Back</button>
                <button onClick={goNext} className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all">Next: Confirm →</button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-slate-900">Review & Send</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-bold text-slate-500">Broadcast name</p>
                  <p className="text-sm font-bold text-slate-900">{form.name}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-bold text-slate-500">Template</p>
                  <p className="text-sm font-bold text-slate-900">{selectedTemplate?.name}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-bold text-slate-500">Recipients</p>
                  <p className="text-sm font-bold text-[#25D366]">{form.contact_ids.length} contacts</p>
                </div>
              </div>

              {selectedTemplate && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message they'll receive</p>
                  <div className="bg-[#E5DDD5] rounded-2xl p-4">
                    <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
                      <p className="text-sm text-slate-800 font-medium leading-relaxed">{selectedTemplate.body_text}</p>
                      <p className="text-[10px] text-slate-400 text-right mt-1">Now ✓✓</p>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">← Back</button>
                <button
                  onClick={handleSend}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {saving ? "Sending..." : `Send to ${form.contact_ids.length} contacts`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {broadcasts.length > 0 ? (
          broadcasts.map((bc) => (
            <div key={bc.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{bc.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    {new Date(bc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {bc.total_recipients} recipients
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  bc.status === "completed" ? "bg-green-50 text-green-700" :
                  bc.status === "sending" ? "bg-amber-50 text-amber-600" :
                  bc.status === "failed" ? "bg-rose-50 text-rose-600" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  {bc.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {bc.status === "sending" && <Clock className="w-3.5 h-3.5" />}
                  {bc.status === "failed" && <AlertCircle className="w-3.5 h-3.5" />}
                  {bc.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                {[
                  { label: "Sent", value: bc.sent_count ?? 0, color: "text-slate-900" },
                  { label: "Delivered", value: bc.delivered_count ?? 0, color: "text-[#25D366]" },
                  { label: "Read", value: bc.read_count ?? 0, color: "text-blue-600" },
                  { label: "Failed", value: bc.failed_count ?? 0, color: "text-rose-500" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Send className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No broadcasts yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Send one template message to all your contacts at once. Great for promotions, alerts, and updates.
            </p>
            <button
              onClick={openForm}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Broadcast
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
