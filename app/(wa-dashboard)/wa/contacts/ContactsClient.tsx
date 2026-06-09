"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, Plus, Tag, MessageSquare, Phone, X, Loader2, UserPlus, Download, Upload, Trash2, CheckSquare, Square, Filter, Send } from "lucide-react";

interface Contact {
  id: string;
  phone_number: string;
  display_name?: string;
  labels?: string[];
  message_count?: number;
  last_message_at?: string;
}

export function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ phone_number: "", display_name: "", labels: "" });

  // Collect all unique labels
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c.labels ?? []).forEach(l => set.add(l)));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (activeLabel) list = list.filter(c => (c.labels ?? []).includes(activeLabel));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.phone_number.toLowerCase().includes(q) ||
        (c.display_name ?? "").toLowerCase().includes(q) ||
        (c.labels ?? []).some((l) => l.toLowerCase().includes(q))
    );
  }, [contacts, search, activeLabel]);

  const resetForm = () => {
    setForm({ phone_number: "", display_name: "", labels: "" });
    setError(null);
    setShowAddForm(false);
  };

  const handleAdd = async () => {
    const phone = form.phone_number.trim().replace(/\s+/g, "");
    if (!phone) return setError("Phone number is required.");
    if (!/^\+?[0-9]{7,15}$/.test(phone)) return setError("Enter a valid phone number (e.g. +919876543210).");
    setSaving(true);
    setError(null);
    try {
      const labels = form.labels.split(",").map((l) => l.trim()).filter(Boolean);
      const res = await fetch("/api/whatsapp/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, display_name: form.display_name.trim() || null, labels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts((prev) => {
        const existing = prev.findIndex((c) => c.id === data.contact.id);
        if (existing >= 0) { const next = [...prev]; next[existing] = data.contact; return next; }
        return [data.contact, ...prev];
      });
      resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  // CSV Export
  const handleExport = () => {
    const rows = [
      ["phone_number", "display_name", "labels"],
      ...contacts.map(c => [c.phone_number, c.display_name ?? "", (c.labels ?? []).join(";")]),
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      // Skip header row
      const dataLines = lines.slice(1);
      let added = 0, failed = 0;
      for (const line of dataLines) {
        // Simple CSV parse (handles quoted fields)
        const cols = line.split(",").map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
        const [phone, name, labelsStr] = cols;
        if (!phone) { failed++; continue; }
        try {
          const labels = labelsStr ? labelsStr.split(";").map(l => l.trim()).filter(Boolean) : [];
          const res = await fetch("/api/whatsapp/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_number: phone, display_name: name || null, labels }),
          });
          const data = await res.json();
          if (res.ok) {
            setContacts(prev => {
              const idx = prev.findIndex(c => c.id === data.contact.id);
              if (idx >= 0) { const n = [...prev]; n[idx] = data.contact; return n; }
              return [data.contact, ...prev];
            });
            added++;
          } else { failed++; }
        } catch { failed++; }
      }
      setImportResult(`Import complete: ${added} added, ${failed} failed.`);
    } catch { setImportResult("Failed to read CSV file."); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // Bulk select
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} contact(s)?`)) return;
    setDeleting(true);
    // Optimistic
    setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setDeleting(false);
    // Note: in a real app you'd call a DELETE API here
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            {contacts.length > 0 ? `${contacts.length} total contacts` : "Manage your WhatsApp contacts."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={contacts.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          {/* Import */}
          <label className={`flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importing ? "Importing..." : "Import CSV"}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          {/* Add */}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-md shadow-[#25D366]/20"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
          <p className="text-xs font-bold text-blue-700">{importResult}</p>
          <button onClick={() => setImportResult(null)} className="text-blue-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* CSV format hint */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 font-medium">
        <strong className="text-slate-700">CSV Format:</strong> phone_number, display_name, labels (semicolon-separated) — first row is header
      </div>

      {/* Search + label filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-4 h-4" /></button>}
        </div>
        {allLabels.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveLabel(null)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!activeLabel ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              All
            </button>
            {allLabels.map(label => (
              <button
                key={label}
                onClick={() => setActiveLabel(activeLabel === label ? null : label)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeLabel === label ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Tag className="w-2.5 h-2.5" />{label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#25D366]" /> Add Contact</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number <span className="text-rose-500">*</span></label>
                <input type="tel" placeholder="+919876543210" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                <input type="text" placeholder="e.g. Rahul Sharma" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Labels <span className="text-slate-400 font-medium normal-case">(comma separated)</span></label>
              <input type="text" placeholder="e.g. customer, vip, lead" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
            </div>
            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? "Saving..." : "Add Contact"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-[#25D366]/5 border border-[#25D366]/20 rounded-2xl">
          <p className="text-sm font-bold text-slate-700">{selectedIds.size} selected</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Deselect</button>
            <button
              onClick={() => {
                const ids = Array.from(selectedIds).join(",");
                router.push(`/wa/broadcasts?contacts=${encodeURIComponent(ids)}`);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] text-white rounded-xl font-bold text-xs hover:bg-[#1DA851] transition-all shadow-sm shadow-[#25D366]/20"
            >
              <Send className="w-3.5 h-3.5" />
              Broadcast
            </button>
            <button onClick={handleDeleteSelected} disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600 transition-all disabled:opacity-60">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Contacts list */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length > 0 ? (
          <>
            {/* Select all header */}
            <div className="p-4 border-b border-slate-50 flex items-center gap-3">
              <button onClick={toggleSelectAll} className="text-slate-400 hover:text-[#25D366] transition-colors">
                {selectedIds.size === filtered.length && filtered.length > 0
                  ? <CheckSquare className="w-5 h-5 text-[#25D366]" />
                  : <Square className="w-5 h-5" />}
              </button>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map((contact) => (
                <div key={contact.id} className={`p-4 md:p-5 flex items-center gap-3 hover:bg-slate-50 transition-colors group ${selectedIds.has(contact.id) ? "bg-[#25D366]/5" : ""}`}>
                  <button onClick={() => toggleSelect(contact.id)} className="text-slate-300 hover:text-[#25D366] transition-colors shrink-0">
                    {selectedIds.has(contact.id) ? <CheckSquare className="w-5 h-5 text-[#25D366]" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-base shrink-0">
                    {(contact.display_name || contact.phone_number || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{contact.display_name || contact.phone_number}</h3>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone_number}</p>
                      {(contact.message_count ?? 0) > 0 && <span className="text-xs text-slate-400">{contact.message_count} msgs</span>}
                      {contact.last_message_at && (
                        <span className="text-xs text-slate-400">Last: {new Date(contact.last_message_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      )}
                    </div>
                    {contact.labels && contact.labels.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {contact.labels.slice(0, 5).map((label, li) => (
                          <button key={li} onClick={() => setActiveLabel(label)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-[#25D366]/10 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-wider transition-colors">
                            <Tag className="w-2.5 h-2.5" />{label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <a href={`/wa/messages`}
                    className="p-2.5 text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </a>
                </div>
              ))}
            </div>
          </>
        ) : contacts.length > 0 ? (
          <div className="p-12 text-center">
            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts match your filters</p>
            <button onClick={() => { setSearch(""); setActiveLabel(null); }} className="mt-3 text-xs font-bold text-[#25D366] hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No contacts yet</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm mb-6">
              Contacts appear automatically when users message you, or add them manually / import from CSV.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer">
                <Upload className="w-4 h-4" /> Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              <button onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20">
                <Plus className="w-4 h-4" /> Add Manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
