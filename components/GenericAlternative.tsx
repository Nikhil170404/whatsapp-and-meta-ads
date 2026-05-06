import Link from "next/link";
import { CheckCircle2, XCircle, ArrowRight, Zap, Shield, Star, ChevronRight, MessageCircle, Clock, Globe, Sparkles, Users, Heart, Zap as ZapIcon, Rocket, ShieldCheck, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";

export default function GenericAlternativePage({ competitor = "Competitor" }) {
  const features = [
    { name: "Starting Price", replykaro: "₹99/mo ($3)", competitor: "Higher Pricing", win: true },
    { name: "Free Forever Plan", replykaro: true, competitor: false, detail: "ReplyKaro offers a truly free forever tier." },
    { name: "Comment-to-DM", replykaro: "⚡ Sub-second", competitor: "Standard", win: true },
    { name: "Story Mention Rewards", replykaro: true, competitor: false, detail: "Automated loyalty points for story tags." },
    { name: "Fan Loyalty Mode", replykaro: true, competitor: false, detail: "Native 3-tier rewards engine." },
    { name: "Follow-Gate (Auto-Growth)", replykaro: true, competitor: false, detail: "Grow followers with every DM sent." },
    { name: "AI Sales Agent", replykaro: true, competitor: false, detail: "Context-aware AI trained on your brand." },
    { name: "Viral Surge Handling", replykaro: "10k+ DMs/hr", competitor: "Variable", win: true },
    { name: "Setup Simplicity", replykaro: "60 Seconds", competitor: "Standard", win: true },
    { name: "UPI / Razorpay Support", replykaro: true, competitor: false, detail: "Built for Indian creators natively." },
    { name: "Global USD Billing", replykaro: true, competitor: true, detail: "Both support international cards." },
    { name: "Hinglish Support", replykaro: "Native", competitor: "English Only", win: true },
    { name: "Meta-Verified Partner", replykaro: true, competitor: true, detail: "Both ensure official API safety." },
    { name: "Lead Export (CSV)", replykaro: true, competitor: true, detail: "Both allow data portability." },
    { name: "Keyword Automation", replykaro: true, competitor: true, detail: "Both support keyword triggers." },
    { name: "Engagement Analytics", replykaro: "Creator Focused", competitor: "Basic", win: true },
    { name: "No Per-Message Fees", replykaro: true, competitor: true, detail: "One flat price, unlimited growth." },
    { name: "Story Reply Automation", replykaro: true, competitor: true, detail: "Respond to every story DM instantly." },
    { name: "Reel Comment Triggers", replykaro: true, competitor: true, detail: "Optimized for Reel viral engagement." },
    { name: "Community Tier System", replykaro: true, competitor: false, detail: "Bronze, Gold, Elite fan tiers included." },
  ];

  return (
    <div className="min-h-screen bg-white selection:bg-primary selection:text-white overflow-hidden">
      <section className="pt-32 pb-24 px-4 relative bg-slate-50/50 text-center">
        <Badge className="bg-primary/10 text-primary border-none px-6 py-2 rounded-full mb-8 uppercase tracking-[0.4em] text-[10px] font-black italic">Top {competitor} Alternative 2026</Badge>
        <h1 className="text-6xl md:text-9xl font-black text-slate-900 tracking-tighter leading-[0.85] mb-12">Upgrade Your <br /><span className="text-primary italic">Engagement.</span></h1>
        <p className="text-slate-500 text-xl md:text-3xl font-bold max-w-4xl mx-auto mb-12">Stop overpaying for basic automation. Get the full native engine for <strong className="text-slate-900">₹99/mo ($3/mo)</strong>.</p>
        <Link href="/signin"><Button className="h-20 px-16 rounded-[2.5rem] bg-primary text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/30 flex items-center gap-4 mx-auto text-lg">Start Free Forever <Zap className="h-6 w-6" /></Button></Link>
      </section>

      <section className="py-32 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter text-center mb-20 leading-tight">Native Engine <br /><span className="text-primary italic">vs {competitor}</span></h2>
          <div className="bg-white rounded-[4rem] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-900 text-white p-12 items-center">
              <div className="text-2xl font-black tracking-tighter uppercase opacity-50">Feature</div>
              <div className="text-3xl font-black tracking-tighter text-center text-primary italic">ReplyKaro</div>
              <div className="text-3xl font-black tracking-tighter text-center text-slate-500">{competitor}</div>
            </div>
            <div className="p-12">
              {features.map((feature, i) => (
                <div key={i} className="grid grid-cols-3 py-8 items-center border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group/row">
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-slate-900 tracking-tight group-hover/row:text-primary transition-colors">{feature.name}</h4>
                    {feature.detail && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{feature.detail}</p>}
                  </div>
                  <div className="flex justify-center">
                    {typeof feature.replykaro === "string" ? <span className="text-xl font-black text-primary italic">{feature.replykaro}</span> : feature.replykaro ? <CheckCircle2 className="h-10 w-10 text-emerald-500" /> : <XCircle className="h-10 w-10 text-slate-200" />}
                  </div>
                  <div className="flex justify-center">
                    {typeof feature.competitor === "string" ? <span className="text-xl font-black text-slate-400">{feature.competitor}</span> : feature.competitor ? <CheckCircle2 className="h-10 w-10 text-slate-400" /> : <XCircle className="h-10 w-10 text-rose-200" />}
                  </div>
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
