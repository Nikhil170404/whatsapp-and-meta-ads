"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, MessageCircle, DollarSign, Loader2, CheckCircle2, ArrowRight, Zap, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function MetaAdsLandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "meta-ads", email }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="bg-white selection:bg-[#1877F2]/30 selection:text-slate-900">
      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#1877F2]/5 to-transparent rounded-full blur-3xl -z-10" />
        
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1877F2]/10 text-[#1877F2] font-bold text-xs md:text-sm mb-8 border border-[#1877F2]/20 animate-in fade-in slide-in-from-top-4 duration-700">
            <BarChart3 className="w-4 h-4" />
            ReplyKaro for Meta Ads
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Supercharge Ads.<br />
            <span className="text-[#1877F2]">Automate Conversion.</span>
          </h1>
          
          <p className="text-lg md:text-2xl text-slate-500 max-w-3xl mx-auto font-medium mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Automatically send personalized DMs to anyone who comments on your Facebook and Instagram Ad posts. Turn expensive ad clicks into <strong className="text-[#1877F2]">high-converting conversations</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <Link href="/signin">
              <Button className="h-16 px-10 bg-[#1877F2] text-white hover:bg-[#155EC0] rounded-2xl font-black text-lg uppercase tracking-widest glow-meta transition-all active:scale-95 shadow-xl shadow-[#1877F2]/20">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/whatsapp">
              <Button variant="outline" className="h-16 px-10 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-black text-lg uppercase tracking-widest transition-all">
                View WhatsApp
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 md:py-32 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">
              How <span className="text-[#1877F2]">ReplyKaro Ads</span> works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: MessageCircle, title: "Comment to DM", desc: "Capture ad engagement instantly by sending a DM to users the moment they leave a comment on your ad.", color: "#1877F2" },
              { icon: BarChart3, title: "Campaign Tracking", desc: "View real-time spend, impressions, and CTR metrics for all your active Meta campaigns in one dashboard.", color: "#1877F2" },
              { icon: DollarSign, title: "Lower Acquisition Cost", desc: "By instantly engaging commenters, turn expensive ad clicks into high-converting conversations.", color: "#1877F2" },
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:border-[#1877F2]/30 hover:shadow-2xl hover:shadow-[#1877F2]/5 transition-all duration-500 group text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-500 font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto bg-white rounded-[3rem] p-10 border border-[#1877F2]/20 shadow-2xl shadow-[#1877F2]/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#1877F2]/10 to-transparent rounded-bl-full" />
            <h2 className="text-3xl font-black text-slate-900 mb-4 relative z-10">Get Early Access</h2>
            <p className="text-slate-500 mb-8 relative z-10">Join the waitlist for the Meta Ads integration beta. Launching soon.</p>
            
            {status === "success" ? (
              <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-2xl p-6 text-center relative z-10">
                <CheckCircle2 className="w-12 h-12 text-[#1877F2] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1877F2] mb-2">You're on the list!</h3>
                <p className="text-[#1877F2]/80 text-sm">We'll notify you as soon as Meta Ads platform is ready.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-[#1877F2] focus:border-[#1877F2] transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-4 bg-[#1877F2] text-white rounded-xl font-bold text-lg hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/30 flex items-center justify-center gap-2"
                >
                  {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin" /> : "Join Waitlist"}
                </button>
                {status === "error" && <p className="text-rose-500 text-sm font-bold text-center mt-2">Something went wrong. Please try again.</p>}
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
