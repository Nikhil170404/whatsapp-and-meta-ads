"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, MessageCircle, DollarSign, Loader2, CheckCircle2 } from "lucide-react";

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
    <div className="max-w-6xl mx-auto px-4 py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1877F2]/10 text-[#1877F2] font-bold text-sm mb-6 border border-[#1877F2]/20">
          <BarChart3 className="w-4 h-4" />
          ReplyKaro for Meta Ads
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-6 leading-tight">
          Supercharge Ads.<br />
          <span className="text-[#1877F2]">Automate Conversion.</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
          Automatically send personalized DMs to anyone who comments on your Facebook and Instagram Ad posts.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center mb-32">
        <div className="space-y-8 order-2 md:order-1">
          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#1877F2]/20 shadow-lg shadow-[#1877F2]/5 flex items-center justify-center text-[#1877F2] shrink-0">
              <MessageCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Comment to DM</h3>
              <p className="text-slate-500">Capture ad engagement instantly by sending a DM to users the moment they leave a comment on your ad.</p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#1877F2]/20 shadow-lg shadow-[#1877F2]/5 flex items-center justify-center text-[#1877F2] shrink-0">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Campaign Tracking</h3>
              <p className="text-slate-500">View real-time spend, impressions, and CTR metrics for all your active Meta campaigns in one dashboard.</p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#1877F2]/20 shadow-lg shadow-[#1877F2]/5 flex items-center justify-center text-[#1877F2] shrink-0">
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Lower Acquisition Cost</h3>
              <p className="text-slate-500">By instantly engaging commenters, turn expensive ad clicks into high-converting conversations.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-10 border border-[#1877F2]/20 shadow-2xl shadow-[#1877F2]/10 relative overflow-hidden order-1 md:order-2">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#1877F2]/10 to-transparent rounded-bl-full" />
          <h2 className="text-3xl font-black text-slate-900 mb-4 relative z-10">Get Early Access</h2>
          <p className="text-slate-500 mb-8 relative z-10">Join the waitlist to gain access to the Meta Ads integration beta.</p>
          
          {status === "success" ? (
            <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-2xl p-6 text-center relative z-10">
              <CheckCircle2 className="w-12 h-12 text-[#1877F2] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#1877F2] mb-2">You're on the list!</h3>
              <p className="text-[#1877F2]/80 text-sm">We'll notify you as soon as the Meta Ads platform is ready for your account.</p>
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
      
      <div className="text-center pt-10 border-t border-slate-200/50">
        <Link href="/" className="text-slate-500 hover:text-slate-900 font-bold transition-colors">
          &larr; Back to ReplyKaro
        </Link>
      </div>
    </div>
  );
}
