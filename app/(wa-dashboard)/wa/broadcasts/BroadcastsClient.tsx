"use client";

import { useEffect, useState, useMemo } from "react";
import {
  bodyVariables, defaultVariablePlan, resolveBodyParameters, validateVariablePlan,
  type VariableSource,
} from "@/lib/whatsapp/template-builder";
import { Plus, Send, CheckCircle2, Clock, AlertCircle, Users, BarChart3, X, Loader2, FileText, Search, Trash2, Lock, Tag } from "lucide-react";

interface Broadcast {
  error?: string | null;
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
  body_text: string | null;
  status: string;
  category: string;
}

interface Contact {
  id: string;
  phone_number: string;
  display_name?: string;
  is_opted_in?: boolean;
  opted_out_at?: string;
}

export function BroadcastsClient({
  initialBroadcasts,
  templates,
  planType,
  health,
  contactTotal = 0,
  labels = [],
}: {
  initialBroadcasts: Broadcast[];
  templates: Template[];
  planType?: string;
  health?: any;
  contactTotal?: number;
  labels?: string[];
}) {
  const isPaidPlan = planType !== undefined && planType !== "free" && planType !== "expired";
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [showUpgradeGate, setShowUpgradeGate] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [showOptedOut, setShowOptedOut] = useState(false);

  const [form, setForm] = useState({
    name: "",
    template_id: "",
    contact_ids: [] as string[],
    scheduled_at: "",
    variables: [] as VariableSource[],
    audience: "pick" as "pick" | "all" | "label",
    label: "",
  });

  const selectedTemplate = templates.find((t) => t.id === form.template_id);

  const contactLabels = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach(c => ((c as any).labels ?? []).forEach((l: string) => s.add(l)));
    return Array.from(s).sort();
  }, [contacts]);

  const optedInContacts = contacts.filter(c => c.is_opted_in !== false);
  const optedOutCount = contacts.length - optedInContacts.length;
  const contactPool = showOptedOut ? contacts : optedInContacts;

  const filteredContacts = contactPool.filter(
    (c) =>
      (c.phone_number.includes(contactSearch) || (c.display_name ?? "").toLowerCase().includes(contactSearch.toLowerCase())) &&
      (!labelFilter || ((c as any).labels ?? []).includes(labelFilter))
  );

  const openForm = async () => {
    if (!isPaidPlan) {
      setShowUpgradeGate(true);
      return;
    }
    setShowForm(true);
    setStep(1);
    setForm({ name: "", template_id: "", contact_ids: [], scheduled_at: "", variables: [], audience: "pick", label: "" });
    setError(null);

    setLoadingContacts(true);
    try {
      const res = await fetch("/api/whatsapp/contacts?limit=500");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contacts");
      setContacts(data.contacts ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingContacts(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setStep(1);
    setForm({ name: "", template_id: "", contact_ids: [], scheduled_at: "", variables: [], audience: "pick", label: "" });
    setError(null);
  };

  const goNext = () => {
    if (step === 1) {
      if (!form.name.trim()) return setError("Give your broadcast a name.");
      if (!form.template_id) return setError("Select a template.");
      const planError = validateVariablePlan(selectedTemplate?.body_text ?? "", form.variables);
      if (planError) return setError(planError);
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (form.audience === "pick" && form.contact_ids.length === 0) return setError("Select at least one contact.");
      if (form.audience === "label" && !form.label) return setError("Choose a label.");
      if (form.audience === "all" && contactTotal === 0) return setError("You have no contacts yet.");
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
      const isScheduled = !!form.scheduled_at;
      const { audience, label, contact_ids, ...rest } = form;
      const payload: Record<string, any> = { ...rest };
      if (audience === "all") payload.all_contacts = true;
      else if (audience === "label") payload.label = label;
      else payload.contact_ids = contact_ids;
      if (!payload.scheduled_at) delete payload.scheduled_at;
      const res = await fetch("/api/whatsapp/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (isScheduled) {
        setBroadcasts((prev) => [{ ...data.broadcast, status: "scheduled" }, ...prev]);
      } else {
        // Sending happens in the background; this only puts the broadcast in line.
        const execRes = await fetch(`/api/whatsapp/broadcasts/${data.broadcast.id}/send`, { method: "POST" });
        const execData = await execRes.json();
        if (!execRes.ok) throw new Error(execData.error);
        setBroadcasts((prev) => [{ ...data.broadcast, status: "queued" }, ...prev]);
      }
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/whatsapp/broadcasts?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete broadcast");
      }
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      setConfirmDeleteId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  // Queue (or resume) a broadcast. It is sent in the background, so this returns at once.
  const executeBroadcast = async (id: string) => {
    const before = broadcasts.find((b) => b.id === id)?.status ?? "draft";
    setError(null);
    setBroadcasts((prev) => prev.map((b) => b.id === id ? { ...b, status: "queued", error: null } : b));
    try {
      const res = await fetch(`/api/whatsapp/broadcasts/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e: any) {
      setBroadcasts((prev) => prev.map((b) => b.id === id ? { ...b, status: before } : b));
      setError(e.message);
    }
  };

  // While anything is waiting or sending, refresh progress every few seconds.
  const active = broadcasts.some((b) => b.status === "queued" || b.status === "sending");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/whatsapp/broadcasts");
        if (res.ok) setBroadcasts((await res.json()).broadcasts ?? []);
      } catch { /* try again on the next tick */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [active]);

  // OTP (authentication) templates are for one-to-one codes, never bulk sending.
  const approvedTemplates = templates.filter((t) => t.status === "approved" && t.category !== "AUTHENTICATION");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Broadcasts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Send a template message to multiple contacts at once.</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Upgrade gate */}
      {showUpgradeGate && (
        <div className="bg-white rounded-3xl border border-violet-200 shadow-lg shadow-violet-500/5 p-6 md:p-8">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upgrade to send Broadcasts</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Broadcasts are available on the Growth and Pro plans.</p>
            </div>
            <button onClick={() => setShowUpgradeGate(false)} className="ml-auto p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: "Bulk broadcasts", desc: "Send one message to hundreds of contacts at once" },
              { label: "Scheduled sends", desc: "Queue broadcasts for the perfect time" },
              { label: "Delivery analytics", desc: "Track sent, delivered, read, and failed counts" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-2.5 p-3 bg-violet-50 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900">{f.label}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href="/wa/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/25"
          >
            View Plans & Upgrade →
          </a>
        </div>
      )}

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
        <div className="bg-white rounded-3xl border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-400"}`}>
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
              <h2 className="text-lg font-bold text-slate-900">Set up broadcast</h2>

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
                        onClick={() => setForm({ ...form, template_id: tpl.id, variables: defaultVariablePlan(tpl.body_text ?? "") })}
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

              {/* Fill in the template's changing values, then preview */}
              {selectedTemplate && (() => {
                const body = selectedTemplate.body_text ?? "";
                const count = new Set(bodyVariables(body)).size;
                const sampleContact = contacts.find((c) => form.contact_ids.includes(c.id)) ?? contacts[0];
                const sample = resolveBodyParameters(body, form.variables, {
                  name: sampleContact?.display_name ?? "Priya",
                  phone: sampleContact?.phone_number ?? "+919876543210",
                });
                const preview = body.replace(/\{\{(\d+)\}\}/g, (_m, n) => sample[Number(n) - 1] ?? "");
                const setVar = (i: number, v: VariableSource) =>
                  setForm((f) => { const next = [...f.variables]; next[i] = v; return { ...f, variables: next }; });
                return (
                  <div className="space-y-4">
                    {count > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fill in the changing values</label>
                        <p className="text-xs text-slate-500 mb-3">Choose what goes into each {"{{ }}"} in your template. Every recipient gets their own message.</p>
                        <div className="space-y-2">
                          {Array.from({ length: count }, (_, i) => {
                            const v = form.variables[i] ?? { source: "text", value: "" };
                            return (
                              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <span className="w-14 shrink-0 text-xs font-mono text-slate-500">{`{{${i + 1}}}`}</span>
                                <select aria-label={`Value for variable ${i + 1}`} value={v.source}
                                  onChange={(e) => setVar(i, e.target.value === "text" ? { source: "text", value: "" } : { source: e.target.value as "name" | "phone" })}
                                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30">
                                  <option value="name">Contact&apos;s name</option>
                                  <option value="phone">Contact&apos;s phone number</option>
                                  <option value="text">Same text for everyone</option>
                                </select>
                                {v.source === "text" && (
                                  <input aria-label={`Text for variable ${i + 1}`} value={v.value} placeholder="e.g. 20%, Sunday, SAVE20"
                                    onChange={(e) => setVar(i, { source: "text", value: e.target.value })}
                                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">What your customer will see</label>
                      <div className="bg-[#E5DDD5] rounded-2xl p-4">
                        <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
                          <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{preview}</p>
                          <p className="text-[10px] text-slate-400 text-right mt-1">12:00 PM</p>
                        </div>
                      </div>
                      {count > 0 && sampleContact && <p className="text-xs text-slate-500 mt-2">Shown with {sampleContact.display_name || sampleContact.phone_number} as an example.</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Marketing frequency cap notice */}
              {selectedTemplate?.category === "MARKETING" && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Promotions can be limited per person</p>
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5 leading-snug">
                      Meta may withhold a promotion if a person has recently received many from businesses. Those people are skipped, not retried, and you can try them again after 24 hours. Sending too often to the same people raises blocks and lowers your quality rating.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Schedule <span className="text-slate-400 font-medium normal-case">(optional — leave blank to send now)</span></label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] bg-white"
                />
                {form.scheduled_at && (
                  <p className="text-xs text-slate-400 font-medium mt-1">Will send at: {new Date(form.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                )}
              </div>

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
                <h2 className="text-lg font-bold text-slate-900">Choose recipients</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  {form.audience === "pick" ? `${form.contact_ids.length} selected` : form.audience === "all" ? `${contactTotal.toLocaleString()} contacts` : form.label || "no label"}
                </span>
              </div>

              <div role="group" aria-label="Who to send to" className="grid gap-2 sm:grid-cols-3">
                {([
                  ["pick", "Pick contacts", "Choose people one by one"],
                  ["all", `Everyone (${contactTotal.toLocaleString()})`, "All contacts, however many"],
                  ["label", "A label", "For example “vip” or “leads”"],
                ] as const).map(([mode, title, hint]) => (
                  <button key={mode} type="button" aria-pressed={form.audience === mode} onClick={() => setForm((f) => ({ ...f, audience: mode }))}
                    className={`rounded-xl border-2 p-3 text-left transition ${form.audience === mode ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}>
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">{hint}</p>
                  </button>
                ))}
              </div>
              {form.audience === "label" && (
                <select aria-label="Label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm">
                  <option value="">Choose a label…</option>
                  {labels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              {form.audience !== "pick" && (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  People who opted out are skipped automatically{selectedTemplate?.category === "MARKETING" ? ", and so is anyone who has not agreed to promotions" : ""}. You will see the final count before anything is sent.
                </p>
              )}

              {form.audience === "pick" && contactTotal > contacts.length && contacts.length > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  Showing your {contacts.length.toLocaleString()} most recent contacts of {contactTotal.toLocaleString()}. To reach everyone, or a group, choose “Everyone” or “A label” above.
                </p>
              )}
              {form.audience !== "pick" ? null : loadingContacts ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#25D366] mx-auto" /></div>
              ) : contacts.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No contacts yet. Contacts appear automatically when people message you.</p>
                </div>
              ) : (
                <>
                  {optedOutCount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-amber-700">
                          {optedOutCount} contact{optedOutCount > 1 ? "s" : ""} opted out
                        </p>
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                          Meta policy: opted-out contacts cannot receive broadcasts.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowOptedOut(!showOptedOut)}
                        className="text-xs font-bold text-amber-600 underline shrink-0 ml-3"
                      >
                        {showOptedOut ? "Hide opted-out" : "Show all"}
                      </button>
                    </div>
                  )}

                  {contactLabels.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setLabelFilter("")} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!labelFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
                      {contactLabels.map(l => (
                        <button key={l} onClick={() => setLabelFilter(labelFilter === l ? "" : l)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${labelFilter === l ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          <Tag className="w-3 h-3" /> {l}
                        </button>
                      ))}
                    </div>
                  )}
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
                    {filteredContacts.map((c) => {
                      const isOptedOut = c.is_opted_in === false;
                      return (
                      <button
                        key={c.id}
                        onClick={() => !isOptedOut && toggleContact(c.id)}
                        disabled={isOptedOut}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${isOptedOut ? "opacity-40 cursor-not-allowed" : form.contact_ids.includes(c.id) ? "bg-[#25D366]/10" : "hover:bg-slate-50"}`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${form.contact_ids.includes(c.id) ? "bg-[#25D366] border-[#25D366]" : "border-slate-300"}`}>
                          {form.contact_ids.includes(c.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{c.display_name || c.phone_number}</p>
                          <p className="text-xs text-slate-400">{c.display_name ? c.phone_number : ""}{isOptedOut ? " · opted out" : ""}</p>
                        </div>
                      </button>
                      );
                    })}
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
              <h2 className="text-lg font-bold text-slate-900">Review & Send</h2>

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
                  <p className="text-sm font-bold text-[#25D366]">
                    {form.audience === "pick" ? `${form.contact_ids.length} contacts` : form.audience === "all" ? `Everyone (${contactTotal.toLocaleString()})` : `Label “${form.label}”`}
                  </p>
                </div>
                {form.scheduled_at && (
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm font-bold text-slate-500">Scheduled for</p>
                    <p className="text-sm font-bold text-violet-600">{new Date(form.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                )}
              </div>

              {(() => {
                const h = health;
                if (!h?.connected) return null;
                const remaining: number | null = h.messaging_limit?.remaining;
                const planned = form.audience === "pick" ? form.contact_ids.length : form.audience === "all" ? contactTotal : null;
                return (
                  <div className="space-y-2" aria-label="Sending safety">
                    {h.restriction && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{h.restriction.summary}</p>}
                    {h.quality?.level === "poor" && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Your number&apos;s quality rating is Poor (red). Promotions are paused until it recovers.</p>}
                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      Meta lets your account message <strong>{h.messaging_limit.label}</strong> different people per 24 hours. You have messaged{" "}
                      <strong>{h.messaging_limit.used_last_24h.toLocaleString()}</strong> in the last 24 hours
                      {remaining !== null && <>, so you can reach <strong>{remaining.toLocaleString()}</strong> more now</>}.
                      {planned !== null && remaining !== null && planned > remaining && (
                        <span className="mt-1 block font-semibold text-amber-800">
                          This broadcast is bigger than that. The first {remaining.toLocaleString()} go out now; the rest wait, and you press Send again later to continue. Nobody is dropped.
                        </span>
                      )}
                      {h.messaging_limit.assumed && <span className="mt-1 block text-slate-500">We could not read your exact limit from Meta yet, so we assume the lowest (250) to keep you safe.</span>}
                    </p>
                  </div>
                );
              })()}

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
                  {saving ? "Queuing..." : form.scheduled_at ? "Schedule broadcast" : form.audience === "pick" ? `Send to ${form.contact_ids.length} contacts` : "Send broadcast"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global error banner (e.g. from executeBroadcast when form is closed) */}
      {!showForm && error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {broadcasts.length > 0 ? (
          broadcasts.map((bc) => (
            <div key={bc.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">{bc.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    {new Date(bc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {bc.total_recipients} recipients
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    bc.status === "completed" ? "bg-green-50 text-green-700" :
                    bc.status === "sending" || bc.status === "queued" ? "bg-amber-50 text-amber-600" :
                    bc.status === "paused" ? "bg-orange-50 text-orange-700" :
                    bc.status === "scheduled" ? "bg-violet-50 text-violet-600" :
                    bc.status === "failed" ? "bg-rose-50 text-rose-600" :
                    "bg-slate-50 text-slate-600"
                  }`}>
                    {bc.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {(bc.status === "sending" || bc.status === "queued") && <Clock className="w-3.5 h-3.5" />}
                    {bc.status === "paused" && <AlertCircle className="w-3.5 h-3.5" />}
                    {bc.status === "scheduled" && <Clock className="w-3.5 h-3.5" />}
                    {bc.status === "failed" && <AlertCircle className="w-3.5 h-3.5" />}
                    {bc.status}
                  </span>
                  {confirmDeleteId === bc.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(bc.id)}
                        disabled={deleting}
                        className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                      >
                        {deleting ? "…" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(bc.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete broadcast"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              {bc.status === "paused" && bc.error && (
                <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">{bc.error}</p>
              )}
              {(bc.status === "queued" || bc.status === "sending") && (
                <p className="mt-4 text-xs font-medium text-slate-500">
                  {bc.status === "queued" ? "Waiting for the sender. It starts within seconds and keeps going in the background, so you can close this page." : "Sending in the background. This page updates by itself."}
                </p>
              )}
              {(bc.status === "draft" || bc.status === "paused" || bc.status === "failed") && (
                <button
                  onClick={() => executeBroadcast(bc.id)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
                >
                  <Send className="w-4 h-4" /> {bc.status === "paused" ? "Resume" : bc.status === "failed" ? "Try again" : "Send Now"}
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 md:p-16 text-center">
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
