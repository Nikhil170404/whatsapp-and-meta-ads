import Link from "next/link";
import {
  ArrowRight, BarChart3, Bell, CheckCircle2, ClipboardCheck, FileText, Inbox,
  Send, ShieldCheck, Smartphone, Sparkles, Users, Zap,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { FlowPreview } from "@/components/landing/FlowPreview";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { Pricing } from "@/components/landing/Pricing";
import { FAQS } from "@/lib/landing-faqs";

const FEATURES = [
  { icon: Zap, title: "Keyword auto-replies", desc: "When a customer types “price” or “hours”, they get the right answer in seconds, day or night." },
  { icon: Send, title: "Template broadcasts", desc: "Send Meta-approved offers and reminders to the contacts who agreed to hear from you." },
  { icon: Inbox, title: "Shared inbox", desc: "Every conversation in one place. Assign chats to teammates and step in when a human is needed." },
  { icon: FileText, title: "Ready-made flows", desc: "Install a full set of replies for your industry in one click, then edit them to fit your business." },
  { icon: ClipboardCheck, title: "Consent built in", desc: "Every opt-in and opt-out is recorded with a timestamp, so you can show proof under India's DPDP Act." },
  { icon: BarChart3, title: "Clear analytics", desc: "See messages sent, delivered and answered, and which automations earn their keep." },
];

const STEPS = [
  { n: "1", title: "Connect your number", desc: "Link your WhatsApp Business account with Meta's guided sign-up. It takes about five minutes.", icon: Smartphone },
  { n: "2", title: "Pick a flow", desc: "Choose your industry and install a ready-made set of replies, or write your own.", icon: Sparkles },
  { n: "3", title: "Go live", desc: "Customers get instant answers. You get the leads, orders and bookings.", icon: CheckCircle2 },
];

const INDUSTRIES = ["E-commerce", "Restaurants", "Clinics", "Real estate", "Education", "Salons", "Auto services", "General business"];

const TRUST = [
  { icon: ShieldCheck, title: "Official WhatsApp Cloud API", desc: "No unofficial workarounds, so your number stays safe." },
  { icon: Bell, title: "One-word opt-out", desc: "Customers reply STOP and messaging ends immediately." },
  { icon: Users, title: "Consent records", desc: "Who agreed, when, how and to what, kept as an audit trail." },
  { icon: FileText, title: "90-day message retention", desc: "Message content is erased automatically after 90 days." },
];

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden bg-white text-slate-900">
      {/* Hero with live demo */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_60%_at_70%_20%,#25D3661f,transparent)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 md:pt-36 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pb-24">
          <div className="text-center lg:text-left">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-3.5 py-1.5 text-xs font-semibold text-[#128C7E] lg:mx-0">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Built on the official WhatsApp Cloud API
            </p>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Answer every WhatsApp message{" "}
              <span className="text-[#25D366]">automatically.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600 lg:mx-0">
              Auto-replies, broadcasts and a shared inbox for your business, with customer consent tracked from the first message. Try it live: type a word in the chat and watch it reply.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/signin" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition hover:bg-[#1DA851] active:scale-[0.98]">
                Start free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                See how it works
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-500 lg:justify-start">
              {["No credit card", "Live in minutes", "Cancel anytime"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#25D366]" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Set up in three steps</h2>
            <p className="mt-3 text-slate-600">No code and no developer needed.</p>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ n, title, desc, icon: Icon }) => (
              <li key={n} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span className="text-5xl font-black text-slate-100" aria-hidden>{n}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Everything for WhatsApp, nothing you do not need</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="rounded-3xl p-7 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Real dashboard */}
      <section className="pb-16 md:pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-3xl font-black tracking-tight sm:text-4xl">One dashboard for every conversation</h2>
          <DashboardPreview />
        </div>
      </section>

      {/* Flow + industries */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Flows ready for your industry</h2>
            <p className="mt-4 text-slate-600">
              Choose your business type and install a complete set of replies in one click: a welcome message with opt-out notice, pricing, hours, bookings and more. Edit anything before it goes live.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {INDUSTRIES.map((i) => (
                <li key={i} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">{i}</li>
              ))}
            </ul>
          </div>
          <FlowPreview />
        </div>
      </section>

      {/* Trust & compliance */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Respect your customers. Protect your number.</h2>
            <p className="mt-3 text-slate-600">Consent-first messaging keeps quality ratings high and keeps you aligned with India&apos;s DPDP Act.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-3xl bg-emerald-50/60 p-6 ring-1 ring-emerald-100">
                <Icon className="h-6 w-6 text-[#128C7E]" aria-hidden />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-slate-600">Start free. Upgrade when you need more.</p>
          </div>
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">Questions, answered</h2>
          <div className="mt-10 divide-y divide-slate-200 rounded-3xl ring-1 ring-slate-200">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl text-slate-400 transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-16 sm:px-6 md:pb-24">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-slate-900 px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Your next customer is messaging you right now.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">Set up in minutes and reply to every message automatically.</p>
          <Link href="/signin" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#1DA851] active:scale-[0.98]">
            Start free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
