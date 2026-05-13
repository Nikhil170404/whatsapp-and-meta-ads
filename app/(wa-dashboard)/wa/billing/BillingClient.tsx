"use client";

import { useState } from "react";
import { Crown, CheckCircle2, Loader2, Zap, Star, Sparkles } from "lucide-react";

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
    priceMonthly: "299",
    priceYearly: "239",
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
    priceMonthly: "799",
    priceYearly: "639",
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

export function BillingClient({ currentPlan }: { currentPlan: string }) {
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
              <p className="text-white/80 text-xs font-medium">We charge ₹99 🎉</p>
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
            { title: "10× cheaper than competitors", desc: "Wati charges ₹2499/mo. We charge ₹299. Same WhatsApp API, fraction of the price." },
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
              WhatsApp charges per-conversation fees directly to your Meta account — these are <strong>separate</strong> from your ReplyKaro subscription. ReplyKaro is just your automation platform on top.
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
        <p className="text-[10px] text-amber-600 mt-3 font-medium">* Free service conversations are being phased out by Meta from Nov 2024. Rates are approximate and may vary. Check your Meta billing dashboard for exact charges.</p>
      </div>

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
