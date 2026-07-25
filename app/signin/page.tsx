"use client";

import React, { useState, useEffect, Suspense } from "react";
import {
  MessageSquare,
  BarChart3,
  Zap,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const FEATURES = [
  {
    icon: Zap,
    title: "Smart Automations",
    desc: "Auto-reply to keywords 24/7. Never miss a lead.",
  },
  {
    icon: MessageSquare,
    title: "Broadcast Campaigns",
    desc: "Send one message to thousands of opted-in contacts.",
  },
  {
    icon: BarChart3,
    title: "Meta Ads Analytics",
    desc: "Track campaigns, clicks, and conversions in one place.",
  },
  {
    icon: TrendingUp,
    title: "Growth Tools",
    desc: "Click-to-WhatsApp ads, templates, and team inboxes.",
  },
];

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SignInContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  const handleFacebookLogin = () => {
    setIsLoading(true);
    setError(null);
    window.location.href = "/api/auth/facebook/login";
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT BRAND PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#0c1421] flex-col justify-between p-14 relative overflow-hidden">
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Green glow orbs */}
        <div className="absolute top-[-120px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[#25D366]/10 blur-[100px]" />
        <div className="absolute bottom-[-80px] right-[-60px] w-[300px] h-[300px] rounded-full bg-[#1877F2]/10 blur-[80px]" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-black text-lg tracking-tight">ReplyKaro</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
            WhatsApp automation<br />
            <span className="text-[#25D366]">that actually works.</span>
          </h1>
          <p className="text-slate-400 text-base font-medium leading-relaxed max-w-md">
            Connect your WhatsApp Business account, set up automations, run Meta Ads, and grow — all from one dashboard.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4 my-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-[#25D366]" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{f.title}</p>
                <p className="text-slate-400 text-xs font-medium mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#25D366]" />
            <span className="text-xs text-slate-400 font-semibold">Meta verified</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#25D366]" />
            <span className="text-xs text-slate-400 font-semibold">GDPR compliant</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#25D366]" />
            <span className="text-xs text-slate-400 font-semibold">Data encrypted</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIGN-IN PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 lg:py-0 min-h-screen lg:min-h-0">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-slate-900 font-black text-lg tracking-tight">ReplyKaro</span>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              Sign in to your account
            </h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Use your Facebook account — the same one connected to your WhatsApp Business and Meta Ads.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-rose-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Facebook button */}
          <button
            onClick={handleFacebookLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-[#1877F2] hover:bg-[#166fe5] active:bg-[#1468d9] disabled:opacity-60 text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-[#1877F2]/25 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40 focus:ring-offset-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FacebookIcon className="w-5 h-5" />
            )}
            <span>{isLoading ? "Signing in…" : "Continue with Facebook"}</span>
            {!isLoading && <ArrowRight className="w-4 h-4 ml-auto opacity-60" />}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">What you get</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Mobile feature list (compact) */}
          <div className="grid grid-cols-2 gap-3 lg:hidden mb-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <f.icon className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-slate-700 leading-snug">{f.title}</p>
              </div>
            ))}
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-slate-400 font-medium leading-relaxed">
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-slate-600 hover:text-slate-900 underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-slate-600 hover:text-slate-900 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <Link
          href="/"
          className="mt-10 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
