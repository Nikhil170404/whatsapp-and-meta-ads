"use client";

import { useState, useMemo } from "react";
import { Users, Search, Plus, Tag, MessageSquare, Phone, X, Loader2, UserPlus } from "lucide-react";

interface Contact {
  id: string;
  phone_number: string;
  display_name?: string;
  labels?: string[];
  message_count?: number;
  last_message_at?: string;
}

export function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ phone_number: "", display_name: "", labels: "" });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.phone_number.toLowerCase().includes(q) ||
        (c.display_name ?? "").toLowerCase().includes(q) ||
        (c.labels ?? []).some((l) => l.toLowerCase().includes(q))
    );
  }, [contacts, search]);

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
      const labels = form.labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch("/api/whatsapp/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, display_name: form.display_name.trim() || null, labels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts((prev) => {
        const existing = prev.findIndex((c) => c.id === data.contact.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data.contact;
          return next;
        }
        return [data.contact, ...prev];
      });
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Manage your WhatsApp contacts. {contacts.length > 0 && `${contacts.length} total.`}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, phone number, or label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#25D366]" /> Add Contact
            </h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
                <p className="text-xs text-slate-400 mt-1">Include country code (e.g. +91)</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Labels <span className="text-slate-400 font-medium normal-case">(comma separated)</span></label>
              <input
                type="text"
                placeholder="e.g. customer, vip, lead"
                value={form.labels}
                onChange={(e) => setForm({ ...form, labels: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
              />
            </div>

            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? "Saving..." : "Add Contact"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {filtered.map((contact) => (
              <div key={contact.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-lg shrink-0">
                    {(contact.display_name || contact.phone_number || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{contact.display_name || contact.phone_number}</h3>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {contact.phone_number}
                      </p>
                      {(contact.message_count ?? 0) > 0 && (
                        <span className="text-xs text-slate-400">{contact.message_count} messages</span>
                      )}
                      {contact.last_message_at && (
                        <span className="text-xs text-slate-400">
                          Last: {new Date(contact.last_message_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    {contact.labels && contact.labels.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {contact.labels.slice(0, 4).map((label, li) => (
                          <span key={li} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            <Tag className="w-2.5 h-2.5" />
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button className="p-2.5 text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        ) : contacts.length > 0 ? (
          <div className="p-12 text-center">
            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts match "{search}"</p>
            <button onClick={() => setSearch("")} className="mt-3 text-xs font-bold text-[#25D366] hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No contacts yet</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm mb-6">
              Contacts appear automatically when users message your WhatsApp Business number, or you can add them manually.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20"
            >
              <Plus className="w-4 h-4" />
              Add Contact Manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
