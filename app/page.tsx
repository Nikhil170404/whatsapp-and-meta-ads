"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Zap, BarChart3, Users, Send, FileText, Bot,
  ChevronDown, Check, X as XIcon, ArrowRight, ShieldCheck,
  Sparkles, CheckCircle2, Clock, Phone,
} from "lucide-react";
import { Footer } from "@/components/Footer";

const PLANS = [
  {
    key: "free",
    name: "Free Starter",
    monthly: "0",
    yearly: "0",
    description: "Try before you buy",
    cta: "Start Free Forever",
    popular: false,
    badge: null,
    features: ["3 Active Automations", "100 Contacts", "Keyword & Any Message Triggers", "Message Inbox", "Community Support"],
    missing: ["Template Broadcasts", "Meta Ads Integration", "Unlimited Contacts"],
  },
  {
    key: "growth",
    name: "Growth Plan",
    monthly: "999",
    yearly: "799",
    description: "Perfect for growing businesses",
    cta: "Get Growth Plan",
    popular: true,
    badge: "Most Popular",
    features: ["10 Active Automations", "Unlimited Contacts", "Template Broadcasts", "Contact CRM + Labels", "Meta Ads Sync", "Welcome Message Trigger", "Email Support (48h)"],
    missing: [],
  },
  {
    key: "pro",
    name: "Pro Plan",
    monthly: "1999",
    yearly: "1599",
    description: "For serious businesses & agencies",
    cta: "Get Pro Plan",
    popular: false,
    badge: "Best Value",
    features: ["Unlimited Automations", "Unlimited Contacts", "Priority Broadcast Queue", "Advanced CRM + Segments", "Full Meta Ads Automation", "Detailed Analytics", "Priority Support (12h)"],
    missing: [],
  },
];

const FAQS = [
  { q: "Is this the official WhatsApp API?", a: "Yes, 100% official. ReplyKaro uses Meta's official WhatsApp Business Cloud API. No grey-market tools, no ban risk. Your account is fully compliant with Meta's policies." },
  { q: "Will my WhatsApp number get banned?", a: "No. Unofficial tools (WhatsApp Web bots) cause bans. Our official Meta API integration means zero risk. Thousands of businesses run safely on our platform." },
  { q: "How is this different from WATI or AiSensy?", a: "Same official API, same features — WATI charges ₹2,499/mo, we charge ₹999. We also include Meta Ads integration that competitors charge extra for or don't offer at all." },
  { q: "Can I use my current WhatsApp number?", a: "You need a WhatsApp Business Account linked to Meta Business Manager. If you don't have one, we guide you through the 5-minute setup. Existing numbers can be migrated." },
  { q: "What are Meta conversation charges?", a: "Meta charges per-conversation fees directly to your Meta account — separate from your ReplyKaro subscription. Marketing: ~₹0.86. Utility: ~₹0.14. Service replies within 24h: free." },
  { q: "Do you offer refunds?", a: "Yes. If you're not satisfied in the first 7 days, full refund. No questions asked. Cancel anytime from settings — one click." },
];

const FEATURES = [
  { icon: Zap, title: "Keyword Automations", desc: "Koi 'price' likhe → instant reply. 24/7, bina aapke. Jab aap so rahe ho, automation kaam kar raha hoga." },
  { icon: Send, title: "Template Broadcasts", desc: "500 contacts ko ek saath message. Offers, reminders, updates — sab Meta-approved templates se." },
  { icon: Users, title: "Contact CRM", desc: "Contacts manage karo, labels lagao, conversation history dekho — sab ek inbox mein." },
  { icon: FileText, title: "27+ Ready Templates", desc: "E-commerce, restaurant, healthcare, real estate — 8 industries ke liye prebuilt templates." },
  { icon: BarChart3, title: "Meta Ads Integration", desc: "Ad se aane wale leads automatically WhatsApp pe engage ho. Competitor yeh nahi deta." },
  { icon: Bot, title: "Welcome Automation", desc: "Pehli baar message karne wale ko special welcome. First impression best hogi, hamesha." },
];

export default function LandingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-white overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative pt-28 pb-16 md:pt-40 md:pb-24">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,_#25D36610_0%,_transparent_70%)]" />
        </div>
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] font-bold text-xs mb-8">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Official Meta WhatsApp Business API Partner
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] font-black text-slate-900 tracking-tighter leading-[0.88] mb-6">
            WhatsApp pe<br />
            <span className="text-[#25D366]">automatic reply</span><br />
            hoga.
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-500 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
            Keyword automations, broadcasts, contact CRM — sab ek jagah. WATI se 60% sasta. India mein bana, India ke liye.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10">
            <Link href="/signin" className="w-full sm:w-auto">
              <button className="w-full h-14 px-8 bg-[#25D366] text-white rounded-2xl font-black text-base hover:bg-[#1DA851] active:scale-[0.97] transition-all shadow-lg shadow-[#25D366]/25 flex items-center justify-center gap-2">
                Shuru karo Free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="#pricing" className="w-full sm:w-auto">
              <button className="w-full h-14 px-8 border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-base hover:bg-slate-50 active:scale-[0.97] transition-all flex items-center justify-center">
                Pricing dekho
              </button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {["2,500+ active businesses", "No credit card needed", "5 min setup", "Cancel anytime"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Chat mockup */}
        <div className="container mx-auto px-4 max-w-[22rem] mt-14">
          <div className="bg-slate-900 rounded-[2.5rem] p-5 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-slate-700/40">
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-white fill-current" />
              </div>
              <div>
                <p className="text-white text-xs font-bold leading-none">Your Business</p>
                <p className="text-emerald-400 text-[10px] font-medium mt-0.5">● online</p>
              </div>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex gap-2 items-end">
                <div className="w-6 h-6 rounded-full bg-slate-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0">R</div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[80%]">
                  <p className="text-xs font-medium text-slate-800">Bhai, price kya hai?</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">10:42</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#25D366] rounded-2xl rounded-br-sm px-3.5 py-2.5 max-w-[85%]">
                  <p className="text-xs font-medium text-white">Hey! 👋 Plans ₹999/mo se start hote hain. Link: replykaro.in/pricing</p>
                  <p className="text-[9px] text-white/60 mt-1 text-right">10:42 ✓✓</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <div className="h-px flex-1 bg-slate-700/40" />
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#25D366]" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">auto in 0.8s</span>
                </div>
                <div className="h-px flex-1 bg-slate-700/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-10 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: "2,500+", l: "Businesses" },
              { v: "₹999/mo", l: "Starting price" },
              { v: "1.2M+", l: "Messages/day" },
              { v: "99.9%", l: "Uptime" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-2xl md:text-3xl font-black text-slate-900">{s.v}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3">
              5 minute mein <span className="text-[#25D366]">live</span>.
            </h2>
            <p className="text-slate-500 font-medium text-sm">No coding. No tech team. Bas connect karo.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { n: "01", title: "WhatsApp Connect karo", desc: "Meta se apna Business Account link karo. Sirf 2 minute.", icon: Phone },
              { n: "02", title: "Automation banao", desc: "Keyword likho, reply message type karo. Save karo — ho gaya.", icon: Zap },
              { n: "03", title: "Sone jao", desc: "24/7 aapke liye kaam karega. Morning mein dekho kitne gaye.", icon: Clock },
            ].map((s) => (
              <div key={s.n} className="relative p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/5 transition-all group">
                <span className="absolute top-5 right-5 text-5xl font-black text-slate-50 group-hover:text-[#25D366]/8 transition-colors select-none">{s.n}</span>
                <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <s.icon className="w-5 h-5 text-[#25D366]" />
                </div>
                <h3 className="text-sm font-black text-slate-900 mb-1.5">{s.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 md:py-28 bg-slate-50" id="features">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3">Sab kuch ek jagah.</h2>
            <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">WhatsApp automation ke liye jitna chahiye, sab yahan hai.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 bg-white rounded-[1.5rem] border border-slate-100 hover:border-[#25D366]/20 hover:shadow-lg transition-all group">
                <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center mb-3.5 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                  <f.icon className="w-5 h-5 text-[#25D366]" />
                </div>
                <h3 className="text-sm font-black text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 md:py-28" id="pricing">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] font-bold text-xs mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              WATI se 60% sasta
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3">
              Simple <span className="text-[#25D366]">pricing</span>.
            </h2>
            <p className="text-slate-500 font-medium text-sm mb-8">Koi hidden fees nahi. Free se shuru karo.</p>
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setYearly(false)} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${!yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Monthly</button>
              <button onClick={() => setYearly(true)} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${yearly ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                Yearly <span className="text-[10px] text-[#25D366] font-black">SAVE 20%</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div key={p.key} className={`relative rounded-[2rem] p-6 border-2 transition-all ${p.popular ? "border-[#25D366] shadow-2xl shadow-[#25D366]/10 bg-white" : "border-slate-100 bg-white"}`}>
                {p.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-white text-[10px] font-black uppercase tracking-widest rounded-full ${p.popular ? "bg-[#25D366]" : "bg-slate-800"}`}>{p.badge}</div>
                )}
                <div className="mb-4">
                  <h3 className="text-base font-black text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-400 font-medium">{p.description}</p>
                </div>
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">{p.key === "free" ? "Free" : `₹${yearly ? p.yearly : p.monthly}`}</span>
                    {p.key !== "free" && <span className="text-slate-400 text-sm font-bold">/mo</span>}
                  </div>
                  {yearly && p.key !== "free" && <p className="text-xs text-[#25D366] font-bold mt-0.5">billed yearly</p>}
                </div>
                <Link href="/signin">
                  <button className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] mb-5 ${p.popular ? "bg-[#25D366] text-white hover:bg-[#1DA851] shadow-md shadow-[#25D366]/20" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                    {p.cta}
                  </button>
                </Link>
                <div className="space-y-2.5">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-700 font-medium leading-relaxed">{f}</span>
                    </div>
                  ))}
                  {p.missing.map((f) => (
                    <div key={f} className="flex items-start gap-2 opacity-40">
                      <XIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-400 font-medium leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 font-medium mt-6">
            + Meta conversation charges billed to your Meta account (separate from ReplyKaro subscription)
          </p>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter mb-3">Compare karo.</h2>
            <p className="text-slate-500 font-medium text-sm">Kyon ReplyKaro better hai competitors se.</p>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 px-3 text-xs font-black text-slate-400 uppercase tracking-widest">Feature</th>
                  {[
                    { name: "ReplyKaro", price: "₹999", hl: true },
                    { name: "WATI", price: "₹2,499", hl: false },
                    { name: "AiSensy", price: "₹999", hl: false },
                    { name: "Interakt", price: "₹919", hl: false },
                  ].map((c) => (
                    <th key={c.name} className={`py-3 px-3 text-center text-[10px] font-black uppercase tracking-widest ${c.hl ? "text-[#25D366]" : "text-slate-400"}`}>
                      {c.name}
                      <div className={`text-[9px] mt-0.5 ${c.hl ? "text-[#25D366]" : "text-slate-300"}`}>{c.price}/mo</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feat: "Free Plan",            vals: [true, false, false, false] },
                  { feat: "Official API",         vals: [true, true, true, true] },
                  { feat: "Keyword Auto-Reply",   vals: [true, true, true, true] },
                  { feat: "Template Broadcasts",  vals: [true, true, true, true] },
                  { feat: "Meta Ads Integration", vals: [true, false, false, false] },
                  { feat: "UPI Payments",         vals: [true, true, true, true] },
                ].map((row) => (
                  <tr key={row.feat} className="border-t border-slate-100">
                    <td className="py-3 px-3 text-xs font-bold text-slate-700">{row.feat}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} className="py-3 px-3 text-center">
                        {v ? <Check className={`w-4 h-4 mx-auto ${i === 0 ? "text-[#25D366]" : "text-slate-300"}`} /> : <XIcon className="w-4 h-4 mx-auto text-slate-100" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 md:py-28" id="faq">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter mb-2">Sawaal?</h2>
            <p className="text-slate-500 font-medium text-sm">Common doubts clear karo.</p>
          </div>
          <div className="space-y-2">
            {FAQS.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-5 flex items-center justify-between text-left gap-4 transition-colors active:bg-slate-50">
                  <span className="text-sm font-bold text-slate-900">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-24 px-4">
        <div className="max-w-2xl mx-auto bg-slate-900 rounded-[2.5rem] p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#25D36618_0%,_transparent_60%)] pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-3 leading-tight">
              Shuru karo aaj.<br />
              <span className="text-[#25D366]">Free mein.</span>
            </h2>
            <p className="text-slate-400 font-medium text-sm mb-8">Credit card nahi chahiye. 5 minute mein live.</p>
            <Link href="/signin">
              <button className="h-14 px-10 bg-[#25D366] text-white rounded-2xl font-black text-base hover:bg-[#1DA851] active:scale-[0.97] transition-all shadow-lg shadow-[#25D366]/25 inline-flex items-center gap-2">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              {["Official API", "UPI Payments", "No Hidden Fees", "Cancel Anytime"].map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
