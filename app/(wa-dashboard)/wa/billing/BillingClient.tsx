"use client";

import { useState } from "react";
import { Crown, CheckCircle2, Loader2, Zap, Star, Sparkles, TrendingUp, IndianRupee } from "lucide-react";

interface Plan {
  key: string;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  description: string;
  popular: boolean;
  planKeyMonthly: string;
  planKeyYearly: string;
  features: string[];
  badge?: string;
}

const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free Starter",
    priceMonthly: "0",
    priceYearly: "0",
    description: "Try ReplyKaro — no credit card needed",
    popular: false,
    planKeyMonthly: "",
    planKeyYearly: "",
    features: [
      "3 Active Automations",
      "100 Contacts",
      "Keyword & Any Message Triggers",
      "Message Inbox (view only)",
      "1,000 free Meta conversations/mo",
      "Community Support",
    ],
  },
  {
    key: "starter",
    name: "Growth Plan",
    priceMonthly: "999",
    priceYearly: "799",
    description: "Perfect for small businesses",
    popular: true,
    badge: "Most Popular",
    planKeyMonthly: "starter_monthly",
    planKeyYearly: "starter_yearly",
    features: [
      "10 Active Automations",
      "Unlimited Contacts",
      "Template Broadcasts",
      "Contact CRM + Labels",
      "Meta Ads Sync",
      "Welcome Message Trigger",
      "Email Support (48h)",
    ],
  },
  {
    key: "pro",
    name: "Pro Plan",
    priceMonthly: "1999",
    priceYearly: "1599",
    description: "For serious businesses & agencies",
    popular: false,
    badge: "Best Value",
    planKeyMonthly: "pro_monthly",
    planKeyYearly: "pro_yearly",
    features: [
      "Unlimited Automations",
      "Unlimited Contacts",
      "Priority Broadcast Queue",
      "Advanced CRM + Segments",
      "Full Meta Ads Automation",
      "Detailed Analytics",
      "Priority Support (12h)",
    ],
  },
];

// Profit projections — Vercel + Supabase + Upstash all FREE up to ~100 customers
// Only real cost early on: domain (~₹1K/yr). Supabase Pro ($25/mo) needed ~100+ customers to avoid pause.
const PROFIT_SCENARIOS = [
  { customers: 10,  revenue: 12000,   razorpay: 420,   infra: 0,      profit: 11580,  annual: 138960,  infraNote: "100% free tier" },
  { customers: 25,  revenue: 30000,   razorpay: 1050,  infra: 0,      profit: 28950,  annual: 347400,  infraNote: "100% free tier" },
  { customers: 50,  revenue: 60000,   razorpay: 2100,  infra: 1000,   profit: 56900,  annual: 682800,  infraNote: "~free + domain" },
  { customers: 100, revenue: 120000,  razorpay: 4200,  infra: 3000,   profit: 112800, annual: 1353600, infraNote: "Supabase Pro ₹2.1K" },
  { customers: 250, revenue: 300000,  razorpay: 10500, infra: 15000,  profit: 274500, annual: 3294000, infraNote: "Vercel Pro + DB" },
  { customers: 500, revenue: 600000,  razorpay: 21000, infra: 40000,  profit: 539000, annual: 6468000, infraNote: "Scaled infra" },
];

function formatINR(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BillingClient({ currentPlan, isOwner }: { currentPlan: string; isOwner?: boolean }) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (plan: Plan) => {
    if (plan.key === "free" || plan.key === currentPlan) return;

    const planKey = billing === "yearly" ? plan.planKeyYearly : plan.planKeyMonthly;
    if (!planKey) {
      setError("This plan is not available yet. Contact us at hello@replykaro.in");
      return;
    }

    setUpgradingKey(plan.key);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Razorpay failed to load. Check your connection.");

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscription_id,
        name: "ReplyKaro",
        description: `${plan.name} — ${billing === "yearly" ? "Yearly" : "Monthly"}`,
        image: "/logo.png",
        handler: () => {
          window.location.reload();
        },
        theme: { color: "#25D366" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpgradingKey(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Billing & Plans</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">Upgrade to send more messages and unlock all features.</p>
      </div>

      {/* Current plan banner */}
      <div className="bg-gradient-to-br from-[#25D366] to-[#1DA851] rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest text-white/80">Current Plan</span>
            </div>
            <h2 className="text-3xl font-black mb-1 capitalize">{currentPlan} Plan</h2>
            <p className="text-white/70 text-sm font-medium">
              {currentPlan === "free" ? "Upgrade anytime — no contracts" : "Your subscription is active. Thank you! 🙏"}
            </p>
          </div>
          {currentPlan === "free" && (
            <div className="shrink-0 bg-white/10 border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Competitors charge</p>
              <p className="text-white font-black text-lg">₹999–₹2499</p>
              <p className="text-white/80 text-xs font-medium">We charge ₹999 🎉</p>
            </div>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling("monthly")}
          className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${billing === "monthly" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling("yearly")}
          className={`px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"}`}
        >
          Yearly
          <span className="text-[10px] px-2 py-0.5 bg-[#25D366] text-white rounded-full font-black">Save 20%</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          const price = billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
          const isUpgrading = upgradingKey === plan.key;

          return (
            <div
              key={plan.key}
              className={`relative rounded-[2rem] p-6 border-2 transition-all ${
                plan.popular
                  ? "border-[#25D366] bg-white shadow-xl shadow-[#25D366]/10"
                  : isCurrent
                  ? "border-[#25D366]/30 bg-[#25D366]/5"
                  : "border-slate-100 bg-white"
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg ${
                  plan.popular ? "bg-[#25D366] shadow-[#25D366]/20" : "bg-slate-700"
                }`}>
                  {isCurrent ? "✓ Active" : plan.badge}
                </div>
              )}

              <h3 className="text-base font-black text-slate-900 mb-0.5">{plan.name}</h3>
              <p className="text-xs text-slate-500 mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-black text-slate-900">₹{price}</span>
                <span className="text-slate-400 font-bold text-sm">/mo</span>
                {billing === "yearly" && plan.key !== "free" && (
                  <span className="text-xs text-[#25D366] font-bold ml-1">billed yearly</span>
                )}
              </div>

              <button
                onClick={() => handleUpgrade(plan)}
                disabled={isCurrent || plan.key === "free" || isUpgrading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isCurrent || plan.key === "free"
                    ? "bg-slate-100 text-slate-500 cursor-default"
                    : "bg-[#25D366] text-white hover:bg-[#1DA851] shadow-lg shadow-[#25D366]/20"
                }`}
              >
                {isUpgrading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : isCurrent ? (
                  "✓ Current Plan"
                ) : plan.key === "free" ? (
                  "Free Forever"
                ) : (
                  <><Zap className="w-4 h-4" /> Upgrade Now</>
                )}
              </button>

              <div className="mt-5 space-y-2.5">
                {plan.features.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" />
                    <span className="text-xs text-slate-700 font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Value proposition vs competitors */}
      <div className="bg-gradient-to-r from-slate-50 to-[#25D366]/5 rounded-[2rem] border border-[#25D366]/10 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-[#25D366]" />
          <h2 className="text-base font-black text-slate-900">Why businesses choose ReplyKaro</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Up to 2.5× cheaper than competitors", desc: "Wati charges ₹2,499/mo. We charge ₹999. Same WhatsApp API, fraction of the price." },
            { title: "No setup fees ever", desc: "Zero onboarding cost. Connect your Meta account and you're live in 5 minutes." },
            { title: "Cancel anytime", desc: "No lock-in contracts. Cancel with one click. We earn your business every month." },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-5 border border-slate-100">
              <div className="w-8 h-8 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-3">
                <Star className="w-4 h-4 text-[#25D366]" />
              </div>
              <h3 className="text-sm font-black text-slate-900 mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meta WhatsApp conversation charges notice */}
      <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-amber-600 text-sm font-black">ℹ</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-900 mb-1">Meta WhatsApp Conversation Charges (Separate)</h3>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              WhatsApp charges per-message fees directly to your Meta account — these are <strong>separate</strong> from your ReplyKaro subscription. ReplyKaro is your automation platform; Meta is your messaging carrier.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { type: "Marketing", price: "₹0.86", desc: "Promotions, offers, broadcasts", color: "bg-rose-50 border-rose-100 text-rose-700" },
            { type: "Utility", price: "₹0.14", desc: "Order updates, OTPs, alerts", color: "bg-blue-50 border-blue-100 text-blue-700" },
            { type: "Service", price: "Free*", desc: "Replies within 24h window", color: "bg-green-50 border-green-100 text-green-700" },
          ].map((item) => (
            <div key={item.type} className={`rounded-xl p-4 border ${item.color}`}>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1">{item.type}</p>
              <p className="text-xl font-black mb-0.5">{item.price}</p>
              <p className="text-[10px] font-medium opacity-80">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-amber-600 mt-3 font-medium">* Service conversation charges vary. Rates are per-message (effective July 2025). Check your Meta billing dashboard for exact charges.</p>
      </div>

      {/* Owner-only: Revenue Profit Calculator */}
      {isOwner && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-6 md:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#25D366]/20 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h2 className="text-base font-black">ReplyKaro Revenue Projections</h2>
              <p className="text-xs text-slate-400 font-medium">Your SaaS profit at different subscriber counts</p>
            </div>
          </div>

          <div className="mb-5 p-4 bg-[#25D366]/10 rounded-2xl border border-[#25D366]/20">
            <p className="text-xs text-[#25D366] font-black mb-1">Vercel + Supabase + Upstash = FREE for first 50–100 customers</p>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Avg ₹1,200/customer (Growth ₹999 + Pro ₹1,999 mix) · Razorpay 3.5% · No team salaries (you build it)
            </p>
          </div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-6 gap-2 px-4 mb-2">
            {["Customers", "Revenue/mo", "−Razorpay", "−Infra", "Net Profit/mo", "Annual Profit"].map((h) => (
              <p key={h} className="text-[10px] font-black uppercase tracking-wider text-slate-400">{h}</p>
            ))}
          </div>

          <div className="space-y-2">
            {PROFIT_SCENARIOS.map((row) => (
              <div
                key={row.customers}
                className="grid md:grid-cols-6 grid-cols-2 gap-2 p-4 rounded-2xl border bg-[#25D366]/10 border-[#25D366]/20"
              >
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">Customers</p>
                  <p className="text-lg font-black">{row.customers}</p>
                  <p className="text-[10px] text-[#25D366] font-bold">{row.infraNote}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">Revenue/mo</p>
                  <p className="text-sm font-bold text-slate-200">{formatINR(row.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">−Razorpay</p>
                  <p className="text-sm font-bold text-rose-400">−{formatINR(row.razorpay)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">−Infra</p>
                  <p className="text-sm font-bold text-rose-400">{row.infra === 0 ? "₹0 FREE" : `−${formatINR(row.infra)}`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">Net/mo</p>
                  <p className="text-sm font-black text-[#25D366]">+{formatINR(row.profit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 md:hidden font-bold mb-0.5">Annual</p>
                  <p className="text-sm font-black text-[#25D366]">+{formatINR(row.annual)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">First customer</p>
              <p className="text-2xl font-black text-[#25D366]">Day 1</p>
              <p className="text-xs text-slate-400 font-medium">already profitable</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">At 50 customers</p>
              <p className="text-2xl font-black text-[#25D366]">₹57K/mo</p>
              <p className="text-xs text-slate-400 font-medium">₹6.8L/year profit</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">At 500 customers</p>
              <p className="text-2xl font-black text-[#25D366]">₹5.4L/mo</p>
              <p className="text-xs text-slate-400 font-medium">₹65L/year profit</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 mt-4 text-center font-medium">
            Infra stays ₹0 (free tiers) until ~100 customers. Supabase Pro ($25/mo) needed when DB {">"} 500MB or you need uptime guarantees. No team salary = maximum profit early stage.
          </p>
        </div>
      )}

      {/* Help */}
      <div className="bg-slate-50 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-500">
          Need a custom plan or have billing questions?{" "}
          <a href="mailto:hello@replykaro.in" className="text-[#25D366] font-bold hover:underline">
            Contact us at hello@replykaro.in
          </a>
        </p>
      </div>
    </div>
  );
}
