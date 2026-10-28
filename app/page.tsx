import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Stage, InlinePhone } from "@/components/landing/Stage";
import { Reveal } from "@/components/landing/Reveal";
import { Pricing } from "@/components/landing/Pricing";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { BroadcastFragment, ConsentFragment, FlowFragment, InboxFragment, RuleFragment } from "@/components/landing/Fragments";
import { FAQS } from "@/lib/landing-faqs";

const btn = "inline-flex min-h-12 items-center justify-center gap-2 px-7 text-base font-semibold transition active:scale-[0.98]";

const STEPS = [
  { stage: 1, title: "Answer the common questions in seconds", text: "Pick the words customers use, like price or hours, and write the reply once. It goes out day or night, with no one watching the phone." },
  { stage: 2, title: "Guide the rest through a short chat", text: "Offer buttons and menus, ask for a name or an email, check the answer, and save the lead. You build it by dragging blocks, and you can see it exactly as a customer will." },
  { stage: 3, title: "Follow up only with people who agreed", text: "Send approved templates to contacts who opted in. Replying STOP ends messaging at once, and the date and time are kept as proof." },
];

const FEATURES = [
  { title: "Automatic replies", text: "A keyword or any message starts a reply. Edit the words any time.", art: <RuleFragment /> },
  { title: "Broadcasts that respect consent", text: "Meta-approved templates, sent in the background. Contacts who opted out are skipped for you.", art: <BroadcastFragment /> },
  { title: "One shared inbox", text: "Every conversation in one place. Assign a chat to a teammate when a person needs to step in.", art: <InboxFragment /> },
  { title: "A record of every opt-in", text: "Who agreed, to what, when and how. Ready to show under India's DPDP Act.", art: <ConsentFragment /> },
];

const FACTS = [
  ["Official WhatsApp Cloud API", "No unofficial tools, so your number is not put at risk."],
  ["One-word opt-out", "Customers reply STOP and messaging ends immediately."],
  ["Consent records", "Who agreed, to what, when and how, kept as an audit trail."],
  ["90-day message retention", "Message content is erased automatically after 90 days."],
  ["You pay Meta directly", "Conversation fees go to Meta at Meta's rates, with no markup from us."],
  ["Delete on request", "Customers can ask for their data to be exported or erased."],
];

export default function LandingPage() {
  return (
    <div className="bg-lp-ground pt-16 text-lp-ink">
      <Stage>
        {/* Hero */}
        <section data-stage="0" className="flex min-h-[calc(100svh-4rem)] flex-col justify-center py-12 lg:py-16">
          <h1 className="max-w-[16ch] text-[clamp(2.5rem,5.2vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em]">Answer every WhatsApp chat.</h1>
          <p className="mt-6 max-w-[34rem] text-xl leading-relaxed text-lp-soft">Auto-replies, guided chats and broadcasts for your business, with every customer&apos;s consent recorded from the first message.</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/signin" className={`${btn} bg-lp-accent text-lp-ink hover:bg-lp-accent-hover`}>Start free <ArrowRight className="h-5 w-5" aria-hidden /></Link>
            <Link href="#how-it-works" className="py-2 text-base font-semibold underline-offset-4 hover:underline">See how it works</Link>
          </div>
          <p className="mt-4 text-base text-lp-soft">No credit card. Live in minutes.</p>
          <InlinePhone stage={0} />
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 pb-8">
          <Reveal as="h2" className="max-w-[18ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">Three jobs, handled while you work.</Reveal>
          {STEPS.map((s) => (
            <article key={s.stage} data-stage={s.stage} className="py-16 lg:flex lg:min-h-[70svh] lg:flex-col lg:justify-center">
              <Reveal>
                <h3 className="max-w-[20ch] text-[clamp(1.75rem,2.6vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.025em]">{s.title}</h3>
                <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-lp-soft">{s.text}</p>
              </Reveal>
              <InlinePhone stage={s.stage} />
            </article>
          ))}
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 pb-24 pt-8 lg:pb-32">
          <Reveal as="h2" className="max-w-[20ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">Everything you need for WhatsApp.</Reveal>
          <div className="mt-14 space-y-16 lg:space-y-24">
            {FEATURES.map((f) => (
              <Reveal key={f.title} className="grid gap-6 xl:grid-cols-[minmax(0,360px)_1fr] xl:items-start xl:gap-10">
                {f.art}
                <div className="max-w-[26rem]">
                  <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-lp-soft">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </Stage>

      {/* Flow builder: breaks the split and runs full width */}
      <section className="bg-lp-dark px-5 py-24 text-white sm:px-8 md:py-32 lg:px-14">
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <h2 className="max-w-[16ch] text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">Build chats by dragging.</h2>
            <p className="mt-6 max-w-[32rem] text-xl leading-relaxed text-emerald-50/90">Greet, ask, offer a menu, save a lead, hand over to a person. Preview it like a customer and see anything that is wrong before it goes live. It works on your phone too.</p>
            <Link href="/signin" className={`${btn} mt-9 bg-lp-accent text-lp-ink hover:bg-lp-accent-hover`}>Build your first flow <ArrowRight className="h-5 w-5" aria-hidden /></Link>
          </Reveal>
          <Reveal delay={120}><FlowFragment /></Reveal>
        </div>
      </section>

      {/* Compliance: plain facts in columns */}
      <section className="px-5 py-24 sm:px-8 md:py-36 lg:px-14">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <Reveal as="h2" className="max-w-[14ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">Consent comes first.</Reveal>
          <dl className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {FACTS.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 2) * 80}>
                <dt className="text-xl font-semibold tracking-tight">{t}</dt>
                <dd className="mt-1.5 text-lg leading-relaxed text-lp-soft">{d}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 px-5 pb-24 sm:px-8 md:pb-36 lg:px-14">
        <div className="mx-auto max-w-[1400px]">
          <Reveal as="h2" className="max-w-[20ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">Start free. Pay when you grow.</Reveal>
          <div className="mt-10"><Pricing /></div>
        </div>
      </section>

      {/* FAQ: read as text */}
      <section id="faq" className="scroll-mt-16 px-5 pb-24 sm:px-8 md:pb-36 lg:px-14">
        <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <h2 className="text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">Questions, answered.</h2>
          <div className="space-y-6 text-lg leading-relaxed lg:columns-2 lg:gap-14 lg:space-y-0 [&>p]:mb-6 [&>p]:break-inside-avoid">
            {FAQS.map((f) => (<p key={f.q}><strong className="font-semibold">{f.q}</strong> {f.a}</p>))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-lp-accent px-5 py-24 text-lp-ink sm:px-8 md:py-36 lg:px-14">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="max-w-[12ch] text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.95] tracking-[-0.045em]">Reply to everyone.</h2>
          <p className="mt-6 max-w-[30rem] text-xl leading-relaxed">Connect your number, switch on a first reply, and your next customer gets an answer straight away.</p>
          <Link href="/signin" className={`${btn} mt-9 bg-lp-ink text-white hover:bg-black`}>Start free <ArrowRight className="h-5 w-5" aria-hidden /></Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
