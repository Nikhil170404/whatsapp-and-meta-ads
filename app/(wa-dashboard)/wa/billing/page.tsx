import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard, Check, CheckCircle2, Zap, Crown, ArrowRight, X as XIcon, Sparkles } from "lucide-react";

const plans = [
  {
    key: "free",
    name: "Free Starter",
    price: "0",
    description: "Test the waters",
    popular: false,
    cta: "Current Plan",
    features: [
      "1,000 Messages/month",
      "3 Active Automations",
      "Keyword Auto-Replies",
      "Message Inbox",
      "Contact Management",
    ],
  },
  {
    key: "starter",
    name: "Starter Pack",
    price: "99",
    description: "Growing businesses",
    popular: false,
    cta: "Upgrade to Starter",
    features: [
      "30,000 Messages/month",
      "10 Active Automations",
      "Template Broadcasts",
      "Contact CRM + Labels",
      "Handle Viral Campaigns 🔥",
      "Email Support (48h)",
    ],
  },
  {
    key: "pro",
    name: "Pro Pack",
    price: "299",
    description: "Scale your business",
    popular: true,
    cta: "Upgrade to Pro",
    features: [
      "250,000 Messages/month",
      "Unlimited Automations",
      "Priority Broadcast Queue",
      "Advanced CRM + Segments",
      "Detailed Analytics",
      "Priority Support (12h)",
    ],
  },
];

export default async function WaBillingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const currentPlan = session.plan_type || "free";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Billing & Plans</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">Manage your subscription and view usage.</p>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-[#25D366] to-[#1DA851] rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-white/80">Current Plan</span>
          </div>
          <h2 className="text-3xl font-black mb-1 capitalize">{currentPlan} Plan</h2>
          <p className="text-white/70 text-sm font-medium">
            {currentPlan === 'free' ? 'Free forever — upgrade anytime' : 'Your subscription is active'}
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div key={plan.key} className={`relative rounded-[2rem] p-6 border-2 transition-all ${
              plan.popular 
                ? 'border-[#25D366] bg-white shadow-xl shadow-[#25D366]/10' 
                : isCurrent 
                  ? 'border-[#25D366]/30 bg-[#25D366]/5' 
                  : 'border-slate-100 bg-white'
            }`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#25D366] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#25D366]/20">
                  Most Popular
                </div>
              )}
              
              <h3 className="text-base font-black text-slate-900 mb-0.5">{plan.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                <span className="text-slate-400 font-bold text-sm">/mo</span>
              </div>

              <button
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  isCurrent 
                    ? 'bg-slate-100 text-slate-500 cursor-default' 
                    : 'bg-[#25D366] text-white hover:bg-[#1DA851] shadow-lg shadow-[#25D366]/20'
                }`}
                disabled={isCurrent}
              >
                {isCurrent ? '✓ Current Plan' : plan.cta}
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

      {/* Help */}
      <div className="bg-slate-50 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-500">
          Need a custom plan or have billing questions?{" "}
          <a href="mailto:hello@replykaro.in" className="text-[#25D366] font-bold hover:underline">Contact us</a>
        </p>
      </div>
    </div>
  );
}
