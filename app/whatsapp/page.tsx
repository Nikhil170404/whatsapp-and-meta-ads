"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Zap, Target, Loader2, CheckCircle2, ArrowRight, ShieldCheck, BarChart3, Globe, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function WhatsAppLandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "whatsapp", email }),
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
            <span className="text-[#25D366]">Built for Scale.</span>
          </h1>
          
          <p className="text-lg md:text-2xl text-slate-500 max-w-3xl mx-auto font-medium mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            India's #1 platform for WhatsApp Business automation. Auto-replies, broadcasts, and shared inbox flows that actually convert.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <Link href="/signin">
              <Button className="h-16 px-10 bg-[#25D366] text-white hover:bg-[#1DA851] rounded-2xl font-black text-lg uppercase tracking-widest glow-whatsapp transition-all active:scale-95 shadow-xl shadow-[#25D366]/20">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" className="h-16 px-10 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-black text-lg uppercase tracking-widest transition-all">
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Premium Dashboard Preview */}
          <div className="relative max-w-6xl mx-auto animate-in fade-in zoom-in duration-1000 delay-500">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 h-[20%] top-[80%]" />
            <div className="rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-[0_32px_120px_-20px_rgba(37,211,102,0.15)] bg-slate-900">
              <Image 
                src="/dashboard-preview.png" 
                alt="ReplyKaro WhatsApp Dashboard" 
                width={1200} 
                height={800} 
                className="w-full h-auto opacity-95 hover:opacity-100 transition-opacity duration-700"
              />
            </div>
            {/* Floating Elements */}
            <div className="absolute -top-10 -right-10 hidden lg:block animate-bounce-slow">
              <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-50 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#25D366] rounded-2xl flex items-center justify-center text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-400 uppercase">Real-time Replies</p>
                  <p className="text-xl font-black text-slate-900 tracking-tight">1.2ms Avg Speed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { label: "Active Businesses", value: "2,500+", icon: Globe },
              { label: "Messages Daily", value: "1.2M+", icon: MessageSquare },
              { label: "Average ROI", value: "310%", icon: BarChart3 },
              { label: "Happy Users", value: "10k+", icon: Users },
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

      {/* Features Grid */}
      <section className="py-32" id="features">
        <div className="container mx-auto px-4">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">Everything you need<br />to <span className="text-[#25D366]">dominate</span> WhatsApp.</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">From direct keyword triggers to automated shared inbox management, we've built the ultimate WhatsApp toolkit for growth.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Keyword Triggers",
                desc: "Set up instant replies for common customer queries like 'pricing', 'catalog' or 'support' with 99.9% uptime.",
                icon: Zap,
                color: "#25D366"
              },
              {
                title: "Shared Inbox",
                desc: "Manage all your WhatsApp conversations in a single, fast interface that works for your whole team.",
                icon: Users,
                color: "#25D366"
              },
              {
                title: "Template Broadcasts",
                desc: "Send pre-approved official Meta templates for marketing, utility, and authentication at the lowest cost in India.",
                icon: MessageSquare,
                color: "#25D366"
              }
            ].map((feature, i) => (
              <div key={i} className="p-10 rounded-[3rem] bg-white border border-slate-100 hover:border-[#25D366]/30 hover:shadow-2xl hover:shadow-[#25D366]/5 transition-all duration-500 group">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:-rotate-12`} style={{ backgroundColor: `${feature.color}15`, color: feature.color }}>
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist / CTA Section */}
      <section className="pb-32 px-4" id="demo">
        <div className="max-w-6xl mx-auto bg-slate-900 rounded-[4rem] p-12 md:p-24 relative overflow-hidden text-center md:text-left">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#25D366]/20 via-transparent to-transparent" />
          
          <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
            <div>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-8 leading-tight">Join the next wave of <span className="text-[#25D366]">WhatsApp Commerce.</span></h2>
              <p className="text-slate-400 font-medium text-lg mb-10">We are currently onboarding early adopters. Get exclusive access and priority support for your business setup.</p>
              
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="flex items-center gap-2 text-white font-bold">
                  <CheckCircle2 className="text-[#25D366] w-5 h-5" /> Official API
                </div>
                <div className="flex items-center gap-2 text-white font-bold">
                  <CheckCircle2 className="text-[#25D366] w-5 h-5" /> UPI Payments
                </div>
                <div className="flex items-center gap-2 text-white font-bold">
                  <CheckCircle2 className="text-[#25D366] w-5 h-5" /> 24/7 Support
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[3rem]">
              {status === "success" ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-[#25D366] mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-white mb-4">You're on the list!</h3>
                  <p className="text-slate-400">We'll reach out to your email as soon as your account is ready for onboarding.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter your email"
                      className="w-full h-16 px-6 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#25D366] transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full h-16 bg-[#25D366] text-white hover:bg-[#1DA851] rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl shadow-[#25D366]/20 transition-all active:scale-95"
                  >
                    {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin" /> : "Join Waitlist"}
                  </Button>
                  <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">No credit card required</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .glow-whatsapp {
          box-shadow: 0 0 20px -5px rgba(37, 211, 102, 0.4);
        }
        .glow-whatsapp:hover {
          box-shadow: 0 0 40px -5px rgba(37, 211, 102, 0.6);
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
