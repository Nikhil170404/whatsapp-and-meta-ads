"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Zap, Target, Loader2, CheckCircle2 } from "lucide-react";

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
    <div className="max-w-6xl mx-auto px-4 py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 text-[#25D366] font-bold text-sm mb-6 border border-[#25D366]/20">
          <MessageSquare className="w-4 h-4" />
          ReplyKaro for WhatsApp
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-6 leading-tight">
          Automate WhatsApp.<br />
          <span className="text-[#25D366]">Close More Deals.</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
          Set up keyword auto-replies, send targeted templates, and manage conversations at scale without touching your phone.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center mb-32">
        <div className="bg-white rounded-[3rem] p-10 border border-[#25D366]/20 shadow-2xl shadow-[#25D366]/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#25D366]/10 to-transparent rounded-bl-full" />
          <h2 className="text-3xl font-black text-slate-900 mb-4 relative z-10">Get Early Access</h2>
          <p className="text-slate-500 mb-8 relative z-10">Join the waitlist to be the first to experience ReplyKaro's powerful WhatsApp Business automation platform.</p>
          
          {status === "success" ? (
            <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl p-6 text-center relative z-10">
              <CheckCircle2 className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#25D366] mb-2">You're on the list!</h3>
              <p className="text-[#25D366]/80 text-sm">We'll notify you as soon as the WhatsApp platform is ready for your account.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <input
                type="email"
                required
                placeholder="Enter your email address"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-4 bg-[#25D366] text-white rounded-xl font-bold text-lg hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-2"
              >
                {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin" /> : "Join Waitlist"}
              </button>
              {status === "error" && <p className="text-rose-500 text-sm font-bold text-center mt-2">Something went wrong. Please try again.</p>}
            </form>
          )}
        </div>

        <div className="space-y-8">
          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 flex items-center justify-center text-[#25D366] shrink-0">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Keyword Triggers</h3>
              <p className="text-slate-500">Instantly reply to customers when they message specific words like "pricing" or "support".</p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 flex items-center justify-center text-[#25D366] shrink-0">
              <Target className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Template Messages</h3>
              <p className="text-slate-500">Submit and send pre-approved marketing and utility templates directly to your audience.</p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 flex items-center justify-center text-[#25D366] shrink-0">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Unified Inbox</h3>
              <p className="text-slate-500">Manage all your WhatsApp conversations in a clean, fast desktop interface.</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center pt-10 border-t border-slate-200/50">
        <Link href="/" className="text-slate-500 hover:text-slate-900 font-bold transition-colors">
          &larr; Back to ReplyKaro
        </Link>
      </div>
    </div>
  );
}
