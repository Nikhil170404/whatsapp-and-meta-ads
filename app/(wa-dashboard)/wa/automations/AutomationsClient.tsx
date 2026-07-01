"use client";

import { useState } from "react";
import { Plus, Zap, Trash2, Power, X, Loader2, Edit2, Check } from "lucide-react";

const CATEGORIES = [
  { id: "general",     emoji: "⚡", label: "General" },
  { id: "ecommerce",   emoji: "📦", label: "E-commerce" },
  { id: "restaurant",  emoji: "🍽️", label: "Restaurant" },
  { id: "healthcare",  emoji: "🏥", label: "Clinic" },
  { id: "realestate",  emoji: "🏠", label: "Real Estate" },
  { id: "education",   emoji: "🎓", label: "Education" },
  { id: "salon",       emoji: "💇", label: "Salon" },
  { id: "automotive",  emoji: "🚗", label: "Auto" },
];

const STARTER_TEMPLATES = [
  // ── General ──────────────────────────────────────────────────────────
  {
    id: "price", category: "general", emoji: "💰", label: "Price Inquiry",
    trigger_keyword: "price",
    reply_message: "Hi! Thanks for your interest 😊 Our prices start from ₹499. Reply with 'catalog' to see all products, or call us for a custom quote!",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    id: "hours", category: "general", emoji: "🕐", label: "Business Hours",
    trigger_keyword: "hours",
    reply_message: "We're open Monday–Saturday, 10 AM to 7 PM IST. Sundays we're closed. Feel free to message anytime — we'll reply during business hours!",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "location", category: "general", emoji: "📍", label: "Location / Address",
    trigger_keyword: "location",
    reply_message: "We're located at [Your Address Here]. Find us on Google Maps: [link]. Need directions? Just reply 'directions'!",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    id: "human", category: "general", emoji: "👋", label: "Talk to Human",
    trigger_keyword: "human",
    reply_message: "Sure! A team member will connect with you shortly. Response time: ~30 min during business hours. Thank you for your patience! 🙏",
    color: "bg-violet-50 border-violet-200 text-violet-700",
  },
  {
    id: "catalog", category: "general", emoji: "📋", label: "Product Catalog",
    trigger_keyword: "catalog",
    reply_message: "Here's our catalog! 🎉 Check out our latest offerings at [your-website.com/catalog]. Want a specific product? Type its name!",
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    id: "help", category: "general", emoji: "🆘", label: "Support Request",
    trigger_keyword: "help",
    reply_message: "Hi! We're here to help 😊\n\nYou can ask us about:\n• Pricing — type PRICE\n• Order status — type ORDER\n• Location — type LOCATION\n• Talk to us — type HUMAN\n\nWhat do you need?",
    color: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    id: "offer", category: "general", emoji: "🎁", label: "Current Offers",
    trigger_keyword: "offer",
    reply_message: "🎉 Current Offers:\n• Flat 20% off on orders above ₹999 — use code SAVE20\n• Buy 2 Get 1 Free on select items\n• Free delivery on orders above ₹599\n\nOffer valid till [date]. Shop now: [link]",
    color: "bg-pink-50 border-pink-200 text-pink-700",
  },

  // ── E-commerce ────────────────────────────────────────────────────────
  {
    id: "order", category: "ecommerce", emoji: "📦", label: "Order Status",
    trigger_keyword: "order",
    reply_message: "To check your order status, please share your Order ID (e.g. #12345). We'll update you within 1 hour during business hours! 📦",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    id: "track", category: "ecommerce", emoji: "🚚", label: "Track Delivery",
    trigger_keyword: "track",
    reply_message: "📦 To track your delivery:\n1. Share your Order ID\n2. Or visit: [tracking-link]\n\nTypically dispatched within 24–48 hrs. Expected delivery: 3–5 business days.",
    color: "bg-sky-50 border-sky-200 text-sky-700",
  },
  {
    id: "return", category: "ecommerce", emoji: "↩️", label: "Return / Refund",
    trigger_keyword: "return",
    reply_message: "We offer 7-day easy returns! 😊\n\nTo initiate a return:\n1. Share your Order ID\n2. Reason for return\n3. Photos (if damaged)\n\nRefunds are processed within 5–7 business days after we receive the item.",
    color: "bg-red-50 border-red-200 text-red-700",
  },
  {
    id: "payment", category: "ecommerce", emoji: "💳", label: "Payment Options",
    trigger_keyword: "payment",
    reply_message: "We accept:\n✅ UPI (GPay, PhonePe, Paytm)\n✅ Credit/Debit Cards\n✅ Net Banking\n✅ Cash on Delivery\n✅ EMI (on orders ₹3000+)\n\nAll payments are 100% secure 🔒",
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    id: "cancel_order", category: "ecommerce", emoji: "❌", label: "Cancel Order",
    trigger_keyword: "cancel",
    reply_message: "To cancel your order, please share your Order ID. Orders can be cancelled within 2 hours of placing. After dispatch, you'll need to initiate a return instead. 📦",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    id: "cod", category: "ecommerce", emoji: "💵", label: "Cash on Delivery",
    trigger_keyword: "cod",
    reply_message: "Yes, we offer Cash on Delivery! 💵\n\n• Available on orders up to ₹5,000\n• Extra ₹40 COD handling fee applies\n• Available in [your city/region]\n\nShall we place your order?",
    color: "bg-yellow-50 border-yellow-200 text-yellow-700",
  },

  // ── Restaurant ────────────────────────────────────────────────────────
  {
    id: "book_table", category: "restaurant", emoji: "🍽️", label: "Table Booking",
    trigger_keyword: "book",
    reply_message: "We'd love to have you! 🍽️ To book a table, please share:\n1. Date & Time\n2. Number of guests\n3. Your name\n\nWe'll confirm within 15 minutes!",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    id: "menu", category: "restaurant", emoji: "📜", label: "View Menu",
    trigger_keyword: "menu",
    reply_message: "Here's our menu! 🍛\n\nView full menu: [menu-link]\n\nToday's specials:\n• [Dish 1] — ₹[price]\n• [Dish 2] — ₹[price]\n\nWant to pre-order? Just ask!",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
  {
    id: "food_delivery", category: "restaurant", emoji: "🛵", label: "Home Delivery",
    trigger_keyword: "delivery",
    reply_message: "🛵 We deliver within [X] km radius!\n\nDelivery charges: ₹30–₹50\nFree delivery on orders above ₹399\nEstimated time: 30–45 minutes\n\nOrder now: [order-link] or send us your address!",
    color: "bg-red-50 border-red-200 text-red-700",
  },
  {
    id: "timings", category: "restaurant", emoji: "🕐", label: "Restaurant Timings",
    trigger_keyword: "timings",
    reply_message: "⏰ We're open:\nLunch: 12:00 PM – 3:30 PM\nDinner: 7:00 PM – 11:00 PM\n\nClosed on Mondays.\n\nFor large group reservations (10+ pax), call us directly!",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },

  // ── Healthcare ────────────────────────────────────────────────────────
  {
    id: "appointment", category: "healthcare", emoji: "📅", label: "Book Appointment",
    trigger_keyword: "appointment",
    reply_message: "To book your appointment, please share:\n1. Your full name\n2. Preferred date & time\n3. Type of consultation (General / Specialist)\n\nOur team will confirm within 30 minutes. 🏥",
    color: "bg-teal-50 border-teal-200 text-teal-700",
  },
  {
    id: "doctor", category: "healthcare", emoji: "👨‍⚕️", label: "Doctor Availability",
    trigger_keyword: "doctor",
    reply_message: "Available Doctors:\n👨‍⚕️ Dr. [Name] (General Physician) — Mon–Sat, 9 AM–1 PM\n👩‍⚕️ Dr. [Name] (Cardiologist) — Tue, Thu, 2 PM–6 PM\n\nReply APPOINTMENT to book a slot!",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "fees_clinic", category: "healthcare", emoji: "💰", label: "Consultation Fees",
    trigger_keyword: "fees",
    reply_message: "Our consultation charges:\n🏥 General Physician: ₹300\n🫀 Specialist: ₹500–₹800\n🦷 Dental: ₹200 (check-up)\n\nDiagnostics available on-site. Senior citizen discount: 10% 🙏",
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    id: "emergency", category: "healthcare", emoji: "🚨", label: "Emergency Info",
    trigger_keyword: "emergency",
    reply_message: "🚨 For emergencies, please call:\n☎️ [Helpline]: [phone number]\n\nEmergency services available 24/7 at:\n[Clinic/Hospital Address]\n\nFor non-emergencies, message us and we'll respond ASAP.",
    color: "bg-red-50 border-red-200 text-red-700",
  },

  // ── Real Estate ───────────────────────────────────────────────────────
  {
    id: "property", category: "realestate", emoji: "🏠", label: "Property Inquiry",
    trigger_keyword: "property",
    reply_message: "Thanks for your interest! 🏠 Please share your requirements:\n1. Type (1BHK/2BHK/Villa/Plot)\n2. Budget range\n3. Preferred location\n4. Ready to move or under construction?\n\nWe'll share matching options shortly!",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    id: "site_visit", category: "realestate", emoji: "👀", label: "Site Visit",
    trigger_keyword: "visit",
    reply_message: "Great! We'd love to show you the property 🏡\n\nTo schedule a site visit:\n1. Share your preferred date & time\n2. Your name and contact number\n\nOur executive will pick you up from a convenient location!",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "rera", category: "realestate", emoji: "📄", label: "RERA & Documents",
    trigger_keyword: "rera",
    reply_message: "All our projects are RERA registered ✅\n\nRERA No: [Your RERA Number]\n\nDocuments available:\n• Floor plans\n• Brochure\n• Price sheet\n• Legal approvals\n\nType BROCHURE to receive the project brochure!",
    color: "bg-violet-50 border-violet-200 text-violet-700",
  },

  // ── Education ─────────────────────────────────────────────────────────
  {
    id: "admission", category: "education", emoji: "🎓", label: "Admission Info",
    trigger_keyword: "admission",
    reply_message: "Admissions are open! 🎓\n\nCourses available:\n• [Course 1] — ₹[Fee] / [Duration]\n• [Course 2] — ₹[Fee] / [Duration]\n\nNext batch starts: [Date]\n\nType FEES for fee structure or DEMO for a free trial class!",
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  {
    id: "fees_edu", category: "education", emoji: "💰", label: "Fee Structure",
    trigger_keyword: "tuition",
    reply_message: "Our fee structure:\n📚 [Course 1]: ₹[amount] (One-time / Monthly)\n📚 [Course 2]: ₹[amount]\n\nEMI available | Scholarships for merit students\nNo hidden charges ✅\n\nShall we schedule a counselling session?",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "demo", category: "education", emoji: "▶️", label: "Free Demo Class",
    trigger_keyword: "demo",
    reply_message: "🎉 Book your FREE demo class!\n\nShare:\n1. Your name\n2. Subject/Course of interest\n3. Preferred date & time\n\nNo commitment required. Experience our teaching style first! 😊",
    color: "bg-green-50 border-green-200 text-green-700",
  },

  // ── Salon ─────────────────────────────────────────────────────────────
  {
    id: "salon_book", category: "salon", emoji: "💈", label: "Book Appointment",
    trigger_keyword: "booking",
    reply_message: "Book your slot at [Salon Name]! 💇\n\nPlease share:\n1. Service required (haircut/colour/facial etc.)\n2. Preferred date & time\n3. Your name\n\nSlots available Mon–Sun, 10 AM to 8 PM!",
    color: "bg-pink-50 border-pink-200 text-pink-700",
  },
  {
    id: "salon_services", category: "salon", emoji: "✨", label: "Services & Pricing",
    trigger_keyword: "services",
    reply_message: "Our services:\n✂️ Haircut (Women): ₹300–₹800\n✂️ Haircut (Men): ₹150–₹400\n💅 Manicure/Pedicure: ₹500–₹1200\n🧴 Facial: ₹800–₹2500\n🎨 Hair Colour: ₹1200+\n\nAll services include wash & finish. Type BOOKING to reserve!",
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    id: "salon_combo", category: "salon", emoji: "💎", label: "Combo Packages",
    trigger_keyword: "package",
    reply_message: "💎 Our Bestseller Packages:\n\n🌸 Bridal Package: ₹8,999 (all inclusive)\n👗 Party Ready: ₹2,499 (hair + makeup + nails)\n🧖 Self-Care Sunday: ₹1,999 (facial + massage + mani-pedi)\n\nAll packages include complimentary tea/coffee ☕",
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },

  // ── Automotive ────────────────────────────────────────────────────────
  {
    id: "service", category: "automotive", emoji: "🔧", label: "Car Service Booking",
    trigger_keyword: "service",
    reply_message: "Book your car service! 🚗\n\nShare:\n1. Car make & model\n2. Registration number\n3. Preferred date & time\n4. Type of service (basic / full / AC / tyres)\n\nPickup & drop available at extra charge!",
    color: "bg-slate-50 border-slate-200 text-slate-700",
  },
  {
    id: "car_price", category: "automotive", emoji: "💰", label: "Service Charges",
    trigger_keyword: "charges",
    reply_message: "Our service charges:\n🔧 Basic Service: ₹1,999\n🔧 Full Service: ₹3,499\n❄️ AC Service: ₹1,499\n🛞 Tyre Change: ₹400/tyre\n\nAll prices inclusive of labour. Parts at actuals. Free vehicle health check with every service! ✅",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "test_drive", category: "automotive", emoji: "🚗", label: "Test Drive",
    trigger_keyword: "testdrive",
    reply_message: "Experience your dream car! 🚗✨\n\nBook a FREE test drive:\n1. Car model you're interested in\n2. Preferred date & time\n3. Your name & location\n\nWe can also bring the car to your doorstep! 🏠",
    color: "bg-green-50 border-green-200 text-green-700",
  },
];

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_keyword?: string;
  reply_message: string;
  is_active: boolean;
  sent_count: number;
  last_fired_at?: string;
  last_error?: string;
  created_at: string;
}

interface FormPanelProps {
  isEdit: boolean;
  id?: string;
  form: { name: string; trigger_type: string; trigger_keyword: string; reply_message: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; trigger_type: string; trigger_keyword: string; reply_message: string }>>;
  error: string | null;
  saving: boolean;
  onSubmit: (id?: string) => void;
  onCancel: () => void;
}

const TRIGGER_OPTIONS = [
  { value: "keyword", label: "Specific Keyword", desc: "Reply when message contains a word" },
  { value: "any", label: "Any Message", desc: "Reply to every incoming message" },
  { value: "welcome", label: "First Message Only", desc: "Reply only to first-time senders" },
];

function FormPanel({ isEdit, id, form, setForm, error, saving, onSubmit, onCancel }: FormPanelProps) {
  return (
    <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-slate-900">{isEdit ? "Edit Automation" : "New Automation"}</h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Automation Name</label>
          <input type="text" placeholder="e.g. Price Enquiry Reply" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">When to trigger</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TRIGGER_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setForm({ ...form, trigger_type: opt.value })}
                className={`text-left p-4 rounded-xl border-2 transition-all ${form.trigger_type === opt.value ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}>
                <p className={`text-sm font-bold ${form.trigger_type === opt.value ? "text-[#25D366]" : "text-slate-700"}`}>{opt.label}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        {form.trigger_type === "keyword" && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trigger Keyword</label>
            <input type="text" placeholder='e.g. PRICE or "order status"' value={form.trigger_keyword} onChange={(e) => setForm({ ...form, trigger_keyword: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]" />
            <p className="text-xs text-slate-400 font-medium mt-1.5">Case-insensitive match</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reply Message</label>
          <textarea rows={4} placeholder="Hi! Thanks for reaching out..."
            value={form.reply_message} onChange={(e) => setForm({ ...form, reply_message: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none" />
          <p className="text-xs text-slate-400 font-medium mt-1.5">{form.reply_message.length} characters</p>
        </div>
        {/* WhatsApp preview */}
        {form.reply_message.trim() && (
          <div className="bg-[#E5DDD5] rounded-2xl p-4">
            <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
              <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{form.reply_message}</p>
              <p className="text-[10px] text-slate-400 text-right mt-1">12:00 PM ✓✓</p>
            </div>
          </div>
        )}
        {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => onSubmit(id)} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Automation"}
          </button>
          <button onClick={onCancel} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function AutomationsClient({ initialAutomations }: { initialAutomations: Automation[] }) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activatingTemplate, setActivatingTemplate] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState("general");

  const emptyForm = { name: "", trigger_type: "keyword", trigger_keyword: "", reply_message: "" };
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => { setForm(emptyForm); setError(null); setShowForm(false); setEditingId(null); };

  const activateTemplate = async (template: typeof STARTER_TEMPLATES[0]) => {
    setActivatingTemplate(template.id);
    try {
      const res = await fetch("/api/whatsapp/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.label,
          trigger_type: "keyword",
          trigger_keyword: template.trigger_keyword,
          reply_message: template.reply_message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutomations((prev) => [data.automation, ...prev]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivatingTemplate(null);
    }
  };

  const startEdit = (auto: Automation) => {
    setForm({ name: auto.name, trigger_type: auto.trigger_type, trigger_keyword: auto.trigger_keyword ?? "", reply_message: auto.reply_message });
    setEditingId(auto.id);
    setShowForm(false);
    setError(null);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return setError("Give your automation a name.");
    if (!form.reply_message.trim()) return setError("Add a reply message.");
    if (form.trigger_type === "keyword" && !form.trigger_keyword.trim()) return setError("Add a trigger keyword.");
    setSaving(true); setError(null);
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
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id?: string) => {
    if (!id) return;
    if (!form.name.trim()) return setError("Give your automation a name.");
    if (!form.reply_message.trim()) return setError("Add a reply message.");
    if (form.trigger_type === "keyword" && !form.trigger_keyword.trim()) return setError("Add a trigger keyword.");
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutomations(prev => prev.map(a => a.id === id ? data.automation : a));
      resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
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
      setAutomations(prev => prev.map(a => a.id === auto.id ? data.automation : a));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/whatsapp/automations?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { setError(e.message); }
    setDeletingId(null);
  };

  const visibleTemplates = STARTER_TEMPLATES.filter(t => t.category === templateCategory);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Automations</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Auto-reply to incoming messages based on keywords or triggers.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 shrink-0">
          <Plus className="w-4 h-4" /> New Automation
        </button>
      </div>

      {error && !showForm && !editingId && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {automations.length === 0 && !showForm && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
          <p className="text-sm font-bold text-violet-700 mb-2">How automations work</p>
          <ol className="space-y-1 text-sm text-violet-600 font-medium list-decimal list-inside">
            <li>Someone sends you a WhatsApp message</li>
            <li>ReplyKaro checks if it matches your trigger (e.g. contains "PRICE")</li>
            <li>Your reply is sent instantly — even at 3am</li>
          </ol>
        </div>
      )}

      {showForm && <FormPanel isEdit={false} form={form} setForm={setForm} error={error} saving={saving} onSubmit={handleCreate} onCancel={resetForm} />}

      {automations.length < 5 && (
        <div className="mb-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">⚡ Quick-Start Templates</p>

          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap mb-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setTemplateCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  templateCategory === cat.id
                    ? "bg-[#25D366] text-white border-[#25D366] shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {visibleTemplates.map((t) => {
              const alreadyAdded = automations.some(a => a.trigger_keyword === t.trigger_keyword);
              return (
                <button
                  key={t.id}
                  onClick={() => !alreadyAdded && activateTemplate(t)}
                  disabled={alreadyAdded || activatingTemplate === t.id}
                  className={`${t.color} border rounded-2xl p-4 text-left transition-all active:scale-95 disabled:opacity-60`}
                >
                  <div className="text-2xl mb-2">{t.emoji}</div>
                  <p className="text-sm font-bold">{t.label}</p>
                  <p className="text-xs mt-1 opacity-70">Keyword: {t.trigger_keyword}</p>
                  {alreadyAdded ? (
                    <p className="text-xs font-bold mt-2 opacity-60">✓ Added</p>
                  ) : activatingTemplate === t.id ? (
                    <p className="text-xs font-bold mt-2">Adding…</p>
                  ) : (
                    <p className="text-xs font-bold mt-2">+ Add in 1 tap</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {automations.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {automations.map((auto) => (
              <div key={auto.id}>
                {editingId === auto.id ? (
                  <div className="p-4">
                    <FormPanel isEdit={true} id={auto.id} form={form} setForm={setForm} error={error} saving={saving} onSubmit={handleEdit} onCancel={resetForm} />
                  </div>
                ) : (
                  <div className="p-5 md:p-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${auto.is_active ? "bg-[#25D366]/10 text-[#25D366]" : "bg-slate-100 text-slate-400"}`}>
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{auto.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-400">
                            {auto.trigger_type === "keyword" ? `Keyword: "${auto.trigger_keyword}"` : auto.trigger_type === "any" ? "Any message" : "First message"}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-medium text-slate-400">Sent {auto.sent_count ?? 0}×</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xs">{auto.reply_message}</p>
                        {auto.last_error && <p className="text-xs text-amber-600 font-medium mt-0.5 truncate max-w-xs">⚠ {auto.last_error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {confirmDeleteId === auto.id ? (
                        <>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-2 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors">
                            Cancel
                          </button>
                          <button onClick={() => handleDelete(auto.id)} disabled={deletingId === auto.id}
                            className="px-3 py-2 text-white bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                            {deletingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(auto)} title="Edit"
                            className="p-2.5 text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleToggle(auto)} disabled={togglingId === auto.id} title={auto.is_active ? "Pause" : "Activate"}
                            className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 ${auto.is_active ? "text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20" : "text-slate-400 bg-slate-100 hover:bg-slate-200"}`}>
                            {togglingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setConfirmDeleteId(auto.id)} title="Delete"
                            className="p-2.5 text-rose-400 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Zap className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No automations yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">Pick a template above or click "New Automation" to create your first auto-reply rule.</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all">
              <Plus className="w-4 h-4" /> Create First Automation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
