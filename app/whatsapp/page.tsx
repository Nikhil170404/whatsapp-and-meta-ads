"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Zap, Target, Loader2, CheckCircle2, ArrowRight, ShieldCheck,
  BarChart3, Globe, Users, Send, FileText, Bot, Clock, Shield, ChevronDown,
  Check, X as XIcon, Star, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

const plans = [
  {
    name: "Free Starter",
    price: "0",
    yearlyPrice: "0",
    usdPrice: "0",
    badge: "FREE",
    description: "Test the waters risk-free",
    popular: false,
    cta: "Start Free Forever",
    features: [
      "1 WhatsApp Number",
      "3 Active Automations",
      "100 Contacts Limit",
      "Keyword Auto-Replies",
      "Contact Management",
      "Email Support (72h)",
    ],
    limits: ["Meta charges billed directly", "No Broadcasts", "No Meta Ads Sync"],
  },
  {
    name: "Growth Plan",
    price: "999",
    yearlyPrice: "9588",
    usdPrice: "$12",
    usdYearlyPrice: "$96",
    badge: "Most Popular",
    description: "Perfect for growing businesses",
    popular: true,
    cta: "Get Growth Plan",
    features: [
      "10 Active Automations",
      "Unlimited Contacts",
      "Template Broadcasts",
      "Contact CRM + Labels",
      "Meta Ads Integration 🚀",
      "Welcome Message Trigger",
      "Email Support (48h)",
    ],
    limits: ["Meta charges billed directly"],
  },
  {
    name: "Pro Plan",
    price: "1999",
    yearlyPrice: "19188",
    usdPrice: "$24",
    usdYearlyPrice: "$240",
    badge: "Best Value",
    description: "For serious businesses & agencies",
    popular: false,
    cta: "Get Pro Plan",
    features: [
      "Unlimited Automations",
      "Unlimited Contacts",
      "Priority Broadcast Queue",
      "Advanced CRM + Segments",
      "Full Meta Ads Automation 💎",
      "Detailed Analytics",
      "Priority Support (12h)",
    ],
    limits: ["Meta charges billed directly"],
  },
];

const competitors = [
  { name: "ReplyKaro", price: "₹999/mo", free: true, highlight: true },
  { name: "WATI", price: "₹2,499/mo", free: false, highlight: false },
  { name: "Interakt", price: "₹999/mo", free: false, highlight: false },
  { name: "AiSensy", price: "₹999/mo", free: false, highlight: false },
  { name: "ManyChat", price: "$15/mo", free: true, highlight: false },
];

const comparisonFeatures = [
  "Free Plan Available",
  "WhatsApp Business API",
  "Keyword Auto-Reply",
  "Template Broadcasts",
  "Contact CRM",
  "UPI / Indian Payments",
  "Meta Ads Integration",
];

const comparisonData: Record<string, boolean[]> = {
  "ReplyKaro": [true, true, true, true, true, true, true],
  "WATI": [false, true, true, true, true, true, false],
  "Interakt": [false, true, true, true, true, true, false],
  "AiSensy": [false, true, true, true, false, true, false],
  "ManyChat": [true, false, true, false, false, false, true],
};

const faqs = [
  {
    q: "How does ReplyKaro work?",
    a: "ReplyKaro connects to the official WhatsApp Business API through Meta. You connect your WhatsApp Business Account, set up keyword-based automation rules, and our system automatically replies to incoming messages in real-time. You can also send broadcast templates to multiple contacts."
  },
  {
    q: "Is this official or unofficial WhatsApp API?",
    a: "100% Official. ReplyKaro uses Meta's official WhatsApp Business Cloud API. We are NOT using any unofficial or grey-market APIs. Your account is safe and compliant with Meta's policies."
  },
  {
    q: "Can I use this with my existing WhatsApp number?",
    a: "You need a WhatsApp Business Account (WABA) registered through Meta Business Manager. If you don't have one, we guide you through the setup process — it takes about 10 minutes."
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept UPI, credit/debit cards, net banking, and wallets via Razorpay. For international users, we accept cards via Stripe in USD."
  },
  {
    q: "What happens if I exceed my message limit?",
    a: "Messages are queued and processed in order. You'll get a notification to upgrade your plan. No messages are lost — they're just delayed until you upgrade or the next billing cycle starts."
  },
  {
    q: "How is this better than WATI or Interakt?",
    a: "ReplyKaro starts at ₹499/month vs ₹999+ for competitors. We offer the same official API, same features, but at a lower platform cost. Plus, we include Meta Ads integration that competitors don't offer."
  },
];

export default function WhatsAppLandingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-white selection:bg-[#25D366]/30 selection:text-slate-900">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#25D366]/5 to-transparent rounded-full blur-3xl -z-10" />

        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 text-[#25D366] font-bold text-xs md:text-sm mb-8 border border-[#25D366]/20 animate-in fade-in slide-in-from-top-4 duration-700">
            <ShieldCheck className="w-4 h-4" />
            Official Meta WhatsApp Business API Partner
          </div>

          <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            WhatsApp Automation.<br />
            <span className="text-[#25D366]">10x Cheaper.</span>
          </h1>

          <p className="text-lg md:text-2xl text-slate-500 max-w-3xl mx-auto font-medium mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            India's #1 WhatsApp Business automation tool. Auto-replies, broadcasts, contact CRM, and Meta Ads integration — starting from just <strong className="text-[#25D366]">₹999/month</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <Link href="/signin">
              <Button className="h-16 px-10 bg-[#25D366] text-white hover:bg-[#1DA851] rounded-2xl font-black text-lg uppercase tracking-widest glow-whatsapp transition-all active:scale-95 shadow-xl shadow-[#25D366]/20">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" className="h-16 px-10 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-black text-lg uppercase tracking-widest transition-all">
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Floating Chat Bubbles */}
          <div className="relative max-w-lg mx-auto animate-in fade-in zoom-in duration-1000 delay-500">
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-8 space-y-4 text-left">
              {/* Incoming */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">C</div>
                <div className="wa-bubble-in px-4 py-3 max-w-[75%] shadow-sm">
                  <p className="text-sm">Hi! I saw your ad. What's the pricing?</p>
                  <p className="text-[10px] text-slate-400 mt-1">10:31 AM</p>
                </div>
              </div>
              {/* Typing indicator */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="wa-bubble-out px-4 py-3 max-w-[75%]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-white/70 typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-white/70 typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-white/70 typing-dot" />
                  </div>
                </div>
              </div>
              {/* Auto-reply */}
              <div className="flex gap-3 justify-end">
                <div className="wa-bubble-out px-4 py-3 max-w-[75%]">
                  <p className="text-sm">Hey! 👋 Thanks for reaching out! Our starter plan is just ₹499/mo. Here's the full pricing: replykaro.in/pricing</p>
                  <p className="text-[10px] text-white/60 mt-1 text-right">10:31 AM ✓✓</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Zap className="w-3.5 h-3.5 text-[#25D366]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-replied in 1.2 seconds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { label: "Active Businesses", value: "2,500+", icon: Globe },
              { label: "Messages Daily", value: "1.2M+", icon: MessageSquare },
              { label: "Cheaper than WATI", value: "10x", icon: Sparkles },
              { label: "Uptime SLA", value: "99.9%", icon: Shield },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <stat.icon className="w-6 h-6 mx-auto mb-4 text-[#25D366] transition-transform group-hover:scale-110" />
                <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-1">{stat.value}</p>
                <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">
              3 steps to <span className="text-[#25D366]">automate</span>.
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">Get set up in under 5 minutes. No coding required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Connect WhatsApp", desc: "Link your WhatsApp Business Account via Meta. Takes 2 minutes.", icon: MessageSquare, color: "#25D366" },
              { step: "02", title: "Set Up Rules", desc: "Create keyword triggers and auto-reply messages. No code needed.", icon: Zap, color: "#25D366" },
              { step: "03", title: "Go Live", desc: "Sit back and watch your automation handle conversations 24/7.", icon: Target, color: "#25D366" },
            ].map((item, i) => (
              <div key={i} className="relative p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:border-[#25D366]/30 hover:shadow-2xl hover:shadow-[#25D366]/5 transition-all duration-500 group text-center">
                <div className="text-6xl font-black text-slate-50 absolute top-6 right-8 group-hover:text-[#25D366]/10 transition-colors">{item.step}</div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110 group-hover:-rotate-6" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{item.title}</h3>
                <p className="text-slate-500 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 md:py-32 bg-slate-50/50" id="features">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">Everything you need<br />to <span className="text-[#25D366]">dominate</span> WhatsApp.</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">From keyword triggers to broadcast campaigns, we've built the ultimate WhatsApp toolkit for growth.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { title: "Keyword Triggers", desc: "Instant replies for 'pricing', 'catalog', or any keyword with 99.9% uptime.", icon: Zap },
              { title: "Template Broadcasts", desc: "Send Meta-approved templates to thousands of contacts simultaneously.", icon: Send },
              { title: "Contact CRM", desc: "Manage contacts with labels, tags, and conversation history.", icon: Users },
              { title: "Shared Inbox", desc: "View all conversations in one fast interface. Real-time message delivery.", icon: MessageSquare },
              { title: "Message Templates", desc: "Create and submit templates for marketing, utility, and authentication.", icon: FileText },
              { title: "Meta Ads Integration", desc: "Connect ad campaigns and auto-reply to ad post commenters via WhatsApp.", icon: BarChart3 },
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:border-[#25D366]/30 hover:shadow-2xl hover:shadow-[#25D366]/5 transition-all duration-500 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:-rotate-12 bg-[#25D366]/10 text-[#25D366]">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 md:py-32" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 text-[#25D366] font-bold text-sm mb-6 border border-[#25D366]/20">
              <Sparkles className="w-4 h-4" />
              10x cheaper than competitors
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">
              Simple, honest <span className="text-[#25D366]">pricing</span>.
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto mb-8">No hidden fees. No per-message charges. Start free, upgrade when you grow.</p>

            {/* Toggle */}
            <div className="inline-flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${!isYearly ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${isYearly ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}
              >
                Yearly <span className="text-[#25D366] text-[10px]">SAVE 16%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div key={i} className={`relative rounded-[2.5rem] p-8 border-2 transition-all duration-500 ${plan.popular
                  ? 'border-[#25D366] bg-white shadow-2xl shadow-[#25D366]/10 scale-[1.02]'
                  : 'border-slate-100 bg-white hover:border-[#25D366]/30 hover:shadow-xl'
                }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-[#25D366] text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#25D366]/20">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-slate-900">
                      ₹{isYearly ? plan.yearlyPrice : plan.price}
                    </span>
                    <span className="text-slate-400 font-bold text-sm">/{isYearly ? 'year' : 'mo'}</span>
                  </div>
                  {plan.usdPrice !== "0" && (
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      or {isYearly ? plan.usdYearlyPrice : plan.usdPrice}/{isYearly ? 'year' : 'mo'} USD
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-bold mt-3 border-t border-slate-100 pt-3">
                    + Meta Conversation Charges (billed by Meta directly)
                  </p>
                </div>

                <Link href="/signin">
                  <Button className={`w-full h-12 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 ${plan.popular
                      ? 'bg-[#25D366] text-white hover:bg-[#1DA851] shadow-lg shadow-[#25D366]/20'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}>
                    {plan.cta}
                  </Button>
                </Link>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature, fi) => (
                    <div key={fi} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" />
                      <span className="text-sm text-slate-700 font-medium">{feature}</span>
                    </div>
                  ))}
                  {plan.limits.map((limit, li) => (
                    <div key={li} className="flex items-center gap-2.5 opacity-50">
                      <XIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-400 font-medium">{limit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">
              Why teams switch to <span className="text-[#25D366]">ReplyKaro</span>
            </h2>
            <p className="text-slate-500 font-medium">See how we compare to expensive alternatives.</p>
          </div>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Feature</th>
                  {competitors.map((c) => (
                    <th key={c.name} className={`p-4 text-center text-xs font-black uppercase tracking-widest ${c.highlight ? 'text-[#25D366]' : 'text-slate-400'}`}>
                      {c.name}
                      <div className={`text-[10px] mt-1 font-black ${c.highlight ? 'text-[#25D366]' : 'text-slate-300'}`}>
                        {c.price}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, fi) => (
                  <tr key={fi} className="border-t border-slate-100">
                    <td className="p-4 text-sm font-bold text-slate-700">{feature}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className="p-4 text-center">
                        {comparisonData[c.name]?.[fi] ? (
                          <Check className={`w-5 h-5 mx-auto ${c.highlight ? 'text-[#25D366]' : 'text-slate-400'}`} />
                        ) : (
                          <XIcon className="w-5 h-5 mx-auto text-slate-200" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 md:py-32" id="faq">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">
              Frequently asked <span className="text-[#25D366]">questions</span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all hover:shadow-md">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 flex items-center justify-between text-left"
                >
                  <h3 className="text-base font-bold text-slate-900 pr-4">{faq.q}</h3>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 -mt-2">
                    <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-32 px-4">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-20 relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#25D366]/20 via-transparent to-transparent" />

          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-tight">
              Ready to automate<br /><span className="text-[#25D366]">WhatsApp?</span>
            </h2>
            <p className="text-slate-400 font-medium text-lg mb-10 max-w-xl mx-auto">
              Join 2,500+ businesses that trust ReplyKaro for their WhatsApp automation. Start free today.
            </p>

            <Link href="/signin">
              <Button className="h-16 px-12 bg-[#25D366] text-white hover:bg-[#1DA851] rounded-2xl font-black text-lg uppercase tracking-widest glow-whatsapp transition-all active:scale-95 shadow-xl shadow-[#25D366]/20">
                Start Free — No Credit Card
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>

            <div className="flex flex-wrap gap-6 justify-center mt-10">
              {["Official API", "UPI Payments", "24/7 Support", "No Hidden Fees"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-white font-bold text-sm">
                  <CheckCircle2 className="text-[#25D366] w-4 h-4" />
                  {item}
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
