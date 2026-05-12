"use client";

import { useState } from "react";
import { Plus, FileText, CheckCircle2, Clock, XCircle, X, Loader2, Eye, ChevronDown, ChevronUp } from "lucide-react";

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

const TEMPLATE_LIBRARY = [
  // E-commerce
  { industry: "🛍️ E-commerce", label: "Order Confirmed", category: "UTILITY", text: "Hi {{1}}! 🎉 Your order #{{2}} has been confirmed. Expected delivery: {{3}}. Track your order at our website. Thank you for shopping with us!" },
  { industry: "🛍️ E-commerce", label: "Order Shipped", category: "UTILITY", text: "Great news, {{1}}! 📦 Your order #{{2}} has been shipped via {{3}}. Tracking ID: {{4}}. Estimated delivery: {{5}}." },
  { industry: "🛍️ E-commerce", label: "Out for Delivery", category: "UTILITY", text: "Hey {{1}}! 🚚 Your order #{{2}} is out for delivery today. Our delivery partner will arrive between {{3}}. Please be available!" },
  { industry: "🛍️ E-commerce", label: "Flash Sale", category: "MARKETING", text: "🔥 FLASH SALE is LIVE! Hi {{1}}, get {{2}}% OFF on everything today only. Use code: {{3}}\nShop now before stocks run out! Valid till midnight. 🛒" },
  { industry: "🛍️ E-commerce", label: "Cart Abandoned", category: "MARKETING", text: "Hey {{1}}, you left something behind! 😢\n\nYour cart has {{2}} item(s) worth ₹{{3}}. Complete your purchase now and get FREE shipping today!\n\nUse code COMEBACK for extra 10% off. 🎁" },
  { industry: "🛍️ E-commerce", label: "Back in Stock", category: "MARKETING", text: "{{1}} is BACK! 🎉\n\nHey {{2}}, the product you wanted is back in stock. Grab it before it sells out again!\n\nOnly {{3}} units left. Order now →" },

  // Restaurant & Food
  { industry: "🍽️ Restaurant & Food", label: "Order Received", category: "UTILITY", text: "Thanks {{1}}! 🍽️ We've received your order #{{2}}. Estimated preparation time: {{3}} minutes. Our chef is already on it!" },
  { industry: "🍽️ Restaurant & Food", label: "Table Booking Confirmed", category: "UTILITY", text: "Your table is reserved, {{1}}! 🍷\n\nDate: {{2}}\nTime: {{3}}\nTable for: {{4}} guests\nRestaurant: {{5}}\n\nSee you soon! Reply CANCEL if plans change." },
  { industry: "🍽️ Restaurant & Food", label: "Daily Special", category: "MARKETING", text: "Today's Special 🌟\n\nHi {{1}}! Chef's special today is {{2}} for just ₹{{3}}.\n\nOrder now and get a free dessert! 🍮\nCall us: {{4}} or reply ORDER to place your order." },

  // Healthcare
  { industry: "🏥 Healthcare", label: "Appointment Reminder", category: "UTILITY", text: "Appointment Reminder 📅\n\nHi {{1}}, your appointment with Dr. {{2}} is scheduled for:\n📆 {{3}} at {{4}}\n📍 {{5}}\n\nReply YES to confirm or NO to reschedule." },
  { industry: "🏥 Healthcare", label: "Prescription Ready", category: "UTILITY", text: "Hi {{1}}, your prescription is ready for pickup! 💊\n\nMedication: {{2}}\nPickup from: {{3}}\nAvailable till: {{4}}\n\nFor queries, call us at {{5}}." },
  { industry: "🏥 Healthcare", label: "Health Checkup Due", category: "MARKETING", text: "Hi {{1}}! 🏥 It's been {{2}} months since your last health checkup.\n\nBook your annual health package today and get {{3}}% off. Prevention is better than cure!\n\nCall {{4}} to book." },

  // Real Estate
  { industry: "🏠 Real Estate", label: "Site Visit Confirmed", category: "UTILITY", text: "Site Visit Confirmed! 🏡\n\nHi {{1}}, your site visit for {{2}} is confirmed:\n📅 {{3}} at {{4}}\n📍 {{5}}\n\nOur agent {{6}} will meet you there. Questions? Reply here." },
  { industry: "🏠 Real Estate", label: "New Property Alert", category: "MARKETING", text: "New Property Alert! 🏠\n\nHi {{1}}, a new {{2}} BHK flat is available in {{3}}.\n\n💰 Price: ₹{{4}}\n📐 Area: {{5}} sq ft\n✨ Ready to move in!\n\nInterested? Reply VIEW for details." },

  // Education
  { industry: "🎓 Education", label: "Class Reminder", category: "UTILITY", text: "Class Reminder ⏰\n\nHi {{1}}, your {{2}} class starts in {{3}} minutes!\n\n📚 Topic: {{4}}\n🔗 Join here: {{5}}\n\nBe on time and keep your notes ready!" },
  { industry: "🎓 Education", label: "Fee Due", category: "UTILITY", text: "Fee Reminder 💳\n\nHi {{1}}, your fee of ₹{{2}} for {{3}} is due on {{4}}.\n\nPay online at {{5}} or visit our office.\n\nFor help, reply HELP." },
  { industry: "🎓 Education", label: "Course Launch", category: "MARKETING", text: "🚀 New Course Launched!\n\nHi {{1}}, we just launched {{2}} — a complete course on {{3}}.\n\n✅ {{4}} hours of content\n✅ Certificate included\n✅ Early bird price: ₹{{5}}\n\nEnroll now → reply JOIN" },

  // Travel & Hotels
  { industry: "✈️ Travel & Hotels", label: "Booking Confirmed", category: "UTILITY", text: "Booking Confirmed! ✈️\n\nHi {{1}}, your booking is confirmed.\n\n🏨 {{2}}\n📅 Check-in: {{3}}\n📅 Check-out: {{4}}\n🔑 Booking ID: {{5}}\n\nHave a great trip!" },
  { industry: "✈️ Travel & Hotels", label: "Check-in Reminder", category: "UTILITY", text: "Check-in Reminder! 🏨\n\nHi {{1}}, your check-in at {{2}} is tomorrow ({{3}}).\n\nCheck-in time: {{4}}\nAddress: {{5}}\n\nNeed help? Reply here anytime." },
  { industry: "✈️ Travel & Hotels", label: "Travel Deal", category: "MARKETING", text: "Exclusive Travel Deal! 🌍\n\nHi {{1}}, {{2}} trip for only ₹{{3}}/person (was ₹{{4}})!\n\n📅 Dates: {{5}}\n✅ Includes: Flights + Hotel + Breakfast\n\nOnly {{6}} seats left! Reply BOOK now." },

  // Finance & Banking
  { industry: "💰 Finance", label: "Payment Received", category: "UTILITY", text: "Payment Received ✅\n\nHi {{1}}, we received your payment of ₹{{2}} on {{3}}.\n\nTransaction ID: {{4}}\nBalance remaining: ₹{{5}}\n\nThank you!" },
  { industry: "💰 Finance", label: "EMI Reminder", category: "UTILITY", text: "EMI Due Reminder 💳\n\nHi {{1}}, your EMI of ₹{{2}} for {{3}} is due on {{4}}.\n\nPay on time to avoid late fees. Pay online at {{5}}.\n\nFor queries, call {{6}}." },
  { industry: "💰 Finance", label: "Loan Offer", category: "MARKETING", text: "Pre-Approved Loan Offer! 🎉\n\nHi {{1}}, you're pre-approved for a loan up to ₹{{2}} at just {{3}}% interest.\n\n✅ Instant approval\n✅ No collateral\n✅ Flexible EMIs\n\nApply now — reply YES to proceed." },

  // General Business
  { industry: "💼 General Business", label: "Welcome Message", category: "UTILITY", text: "Welcome to {{1}}! 🎉\n\nHi {{2}}, we're thrilled to have you on board. Here's what you can do:\n\n1️⃣ Reply HELP for support\n2️⃣ Reply MENU to see our services\n3️⃣ Reply HUMAN to talk to an agent\n\nWe're here 24/7!" },
  { industry: "💼 General Business", label: "Support Ticket", category: "UTILITY", text: "Support Ticket Created ✅\n\nHi {{1}}, we've received your request.\n\n🎫 Ticket ID: {{2}}\n📋 Issue: {{3}}\n⏰ Expected resolution: {{4}}\n\nWe'll keep you updated. Reply {{2}} for status." },
  { industry: "💼 General Business", label: "Review Request", category: "MARKETING", text: "How was your experience? ⭐\n\nHi {{1}}, thank you for choosing {{2}}!\n\nWould you mind leaving us a quick review? It takes just 30 seconds and helps us grow.\n\n⭐ Rate us here: {{3}}\n\nThank you so much! 🙏" },
  { industry: "💼 General Business", label: "OTP Verification", category: "AUTHENTICATION", text: "Your OTP for {{1}} is: *{{2}}*\n\nThis OTP is valid for {{3}} minutes. Do not share it with anyone.\n\nIf you didn't request this, ignore this message." },
];

const INDUSTRIES = [...new Set(TEMPLATE_LIBRARY.map((t) => t.industry))];

export function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);

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
    setShowLibrary(false);
  };

  const applyTemplate = (tpl: typeof TEMPLATE_LIBRARY[0]) => {
    const nameSlug = tpl.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setForm((f) => ({ ...f, body_text: tpl.text, category: tpl.category, name: f.name || nameSlug }));
    setShowLibrary(false);
    setShowForm(true);
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

  const industryTemplates = TEMPLATE_LIBRARY.filter((t) => t.industry === selectedIndustry);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Message Templates</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Create WhatsApp-approved templates for broadcasts and automations.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setShowLibrary(!showLibrary); setShowForm(false); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <FileText className="w-4 h-4" />
            Template Library
          </button>
          <button
            onClick={() => { setShowForm(true); setShowLibrary(false); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Info banner */}
      {!showForm && !showLibrary && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Templates require Meta approval (24h)</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Use <span className="font-bold">Template Library</span> for ready-made templates across 8 industries. Use <code className="bg-amber-100 px-1 rounded">{`{{1}}`}</code>, <code className="bg-amber-100 px-1 rounded">{`{{2}}`}</code> for dynamic content like names or order numbers.
            </p>
          </div>
        </div>
      )}

      {/* Template Library */}
      {showLibrary && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">Template Library</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{TEMPLATE_LIBRARY.length} ready-to-use templates across {INDUSTRIES.length} industries</p>
            </div>
            <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Industry tabs */}
          <div className="flex gap-2 flex-wrap mb-5">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedIndustry === ind ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {ind}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {industryTemplates.map((tpl) => (
              <div key={tpl.label} className="border border-slate-100 rounded-2xl p-4 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all group">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{tpl.label}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      tpl.category === "MARKETING" ? "bg-purple-50 text-purple-700" :
                      tpl.category === "AUTHENTICATION" ? "bg-blue-50 text-blue-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>{tpl.category}</span>
                  </div>
                  <button
                    onClick={() => applyTemplate(tpl)}
                    className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1DA851] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    Use This
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3 whitespace-pre-line">{tpl.text}</p>
              </div>
            ))}
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
            {/* Quick library link */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">Want a head start?</p>
              <button
                onClick={() => { setShowLibrary(true); setShowForm(false); }}
                className="text-xs font-bold text-[#25D366] hover:underline flex items-center gap-1"
              >
                Browse {TEMPLATE_LIBRARY.length} prebuilt templates →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. order_confirmation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, underscores only</p>
              </div>
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

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Body</label>
              <textarea
                rows={6}
                placeholder="Hi {{1}}, your order #{{2}} is confirmed! Delivery expected by {{3}}."
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-400 font-medium">Use {`{{1}}`}, {`{{2}}`} for dynamic values (name, order no, etc.)</p>
                <p className="text-xs text-slate-400 font-medium">{form.body_text.length}/1024</p>
              </div>
            </div>

            {/* WhatsApp Preview */}
            {form.body_text && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp Preview</label>
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
                {saving ? "Submitting..." : "Submit for Meta Approval"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
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
                  <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3 whitespace-pre-line">{tpl.body_text}</p>
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
              Start from our library of {TEMPLATE_LIBRARY.length}+ prebuilt templates across 8 industries — or create your own.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => setShowLibrary(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                <FileText className="w-4 h-4" /> Browse Library
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
              >
                <Plus className="w-4 h-4" /> Create Custom
              </button>
            </div>
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
                <p className="text-xs text-slate-400 font-medium">{preview.category} • {LANGUAGES.find((l) => l.value === preview.language)?.label}</p>
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
