"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  { key: "free", name: "Free", inr: [0, 0], usd: [0, 0], blurb: "Try it with real customers", cta: "Start free", popular: false,
    features: ["3 active automations", "100 contacts", "Keyword and any-message triggers", "Shared inbox", "Consent and opt-out tracking"] },
  { key: "growth", name: "Growth", inr: [999, 799], usd: [12, 8], blurb: "For growing businesses", cta: "Choose Growth", popular: true,
    features: ["10 active automations", "Unlimited contacts", "Template broadcasts", "Contact CRM and labels", "Welcome message trigger", "Email support (48h)"] },
  { key: "pro", name: "Pro", inr: [1999, 1599], usd: [24, 20], blurb: "For teams and agencies", cta: "Choose Pro", popular: false,
    features: ["Unlimited automations", "Unlimited contacts", "Priority broadcast queue", "Advanced CRM and segments", "Detailed analytics", "Priority support (12h)"] },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [intl, setIntl] = useState(false);

  useEffect(() => {
    const c = document.cookie.split("; ").find((x) => x.startsWith("user_country="));
    if (c) setIntl(c.split("=")[1] !== "IN");
  }, []);

  const symbol = intl ? "$" : "₹";

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`rounded-full px-5 py-2 transition ${yearly === y ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {y ? "Yearly" : "Monthly"}
              {y && <span className="ml-1.5 text-xs text-[#128C7E]">save 20%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const price = (intl ? p.usd : p.inr)[yearly ? 1 : 0];
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-3xl p-7 ${
                p.popular ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/20 md:-translate-y-3" : "bg-white ring-1 ring-slate-200"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-3 py-1 text-xs font-bold text-white">Most popular</span>
              )}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className={`mt-1 text-sm ${p.popular ? "text-slate-300" : "text-slate-500"}`}>{p.blurb}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight">{price === 0 ? "Free" : `${symbol}${price}`}</span>
                {price > 0 && <span className={`text-sm ${p.popular ? "text-slate-300" : "text-slate-500"}`}>/month</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" aria-hidden />
                    <span className={p.popular ? "text-slate-200" : "text-slate-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signin"
                className={`mt-8 block rounded-xl px-5 py-3 text-center text-sm font-bold transition active:scale-[0.98] ${
                  p.popular ? "bg-[#25D366] text-white hover:bg-[#1DA851]" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        WhatsApp conversation fees are billed by Meta directly and are separate from your plan. Seven-day refund on paid plans.
      </p>
    </div>
  );
}
