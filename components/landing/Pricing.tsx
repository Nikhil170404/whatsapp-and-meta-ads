"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PLANS = [
  { key: "free", name: "Free", inr: [0, 0], usd: [0, 0], blurb: "Try it with real customers.", cta: "Start free", main: false,
    features: ["3 active automations", "100 contacts", "1 conversation flow", "Shared inbox", "Consent and opt-out tracking"] },
  { key: "growth", name: "Growth", inr: [999, 799], usd: [12, 8], blurb: "For growing businesses.", cta: "Choose Growth", main: true,
    features: ["10 active automations", "Unlimited contacts", "10 conversation flows", "Template broadcasts", "Contact labels and CRM", "Email support within 48 hours"] },
  { key: "pro", name: "Pro", inr: [1999, 1599], usd: [24, 20], blurb: "For teams and agencies.", cta: "Choose Pro", main: false,
    features: ["Unlimited automations", "Unlimited flows", "Priority broadcast queue", "Advanced segments", "Detailed analytics", "Priority support within 12 hours"] },
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
      <div role="group" aria-label="Billing period" className="mb-8 inline-flex bg-lp-field p-1 text-base font-semibold">
        {[false, true].map((y) => (
          <button key={String(y)} type="button" aria-pressed={yearly === y} onClick={() => setYearly(y)}
            className={`min-h-11 px-5 transition-colors duration-200 ${yearly === y ? "bg-lp-ink text-white" : "text-lp-soft hover:text-lp-ink"}`}>
            {y ? "Yearly, save 20%" : "Monthly"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3">
        {PLANS.map((p) => {
          const price = (intl ? p.usd : p.inr)[yearly ? 1 : 0];
          return (
            <div key={p.key} className={`group flex flex-col p-7 transition-colors duration-300 sm:p-9 ${p.main ? "bg-lp-ink text-white" : "bg-lp-field text-lp-ink"}`}>
              <h3 className="text-2xl font-semibold tracking-tight">{p.name}</h3>
              <p className={`mt-1 text-base ${p.main ? "text-emerald-100" : "text-lp-soft"}`}>{p.blurb}{p.main && " Most customers choose this."}</p>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight tabular-nums">{price === 0 ? "Free" : `${symbol}${price}`}</span>
                {price > 0 && <span className={`text-base ${p.main ? "text-emerald-100" : "text-lp-soft"}`}>a month</span>}
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-base">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3"><span aria-hidden className={`mt-2.5 h-2 w-2 shrink-0 ${p.main ? "bg-lp-accent" : "bg-lp-ink"}`} />{f}</li>
                ))}
              </ul>
              <Link href="/signin" className={`mt-10 inline-flex min-h-12 items-center justify-center px-6 text-base font-semibold transition active:scale-[0.98] ${p.main ? "bg-lp-accent text-lp-ink hover:bg-lp-accent-hover" : "bg-lp-ink text-white hover:bg-black"}`}>
                {p.cta}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 max-w-3xl text-base text-lp-soft">WhatsApp conversation fees are billed by Meta directly, at Meta&apos;s own rates, and are separate from your plan. Seven-day refund on paid plans.</p>
    </div>
  );
}
