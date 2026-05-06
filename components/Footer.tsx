"use client";

import Link from "next/link";
import { ArrowRight, Shield, Sparkles, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-24 md:py-32 bg-white border-t border-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 md:gap-12">
          {/* Logo & Vision */}
          <div className="col-span-1 md:col-span-1 space-y-8">
            <Link href="/" className="inline-block group">
              <span className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2 group-hover:scale-105 transition-transform duration-500">
                Reply<span className="text-[#25D366] italic">Karo.</span>
              </span>
            </Link>
            <p className="text-slate-400 font-bold leading-relaxed text-sm max-w-xs">
              Built for the next generation of Indian creators. Automating WhatsApp Business with official Meta-verified engineering.
            </p>
          </div>

          {/* Links Grid */}
          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">WhatsApp in India</p>
              <div className="flex flex-col gap-4">
                <Link href="/whatsapp" className="text-sm font-black text-[#25D366] hover:opacity-80 transition-opacity flex items-center gap-2 italic">
                  #1 WhatsApp Automation India
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/alternatives/wati" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">vs WATI</Link>
                <Link href="/alternatives/interakt" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">vs Interakt</Link>
                <Link href="/alternatives/aisensy" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">vs AiSensy</Link>
                <Link href="/alternatives/manychat" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">vs ManyChat</Link>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Resources</p>
              <div className="flex flex-col gap-4">
                <Link href="/whatsapp#features" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">Features</Link>
                <Link href="/whatsapp#pricing" className="text-sm font-black text-[#25D366] hover:text-[#25D366] transition-colors flex items-center gap-2 italic">
                  Pricing Plans
                  <Sparkles className="h-3 w-3" />
                </Link>
                <Link href="/meta-ads" className="text-sm font-black text-[#1877F2] hover:opacity-80 transition-opacity flex items-center gap-2 italic">
                  Meta Ads Engine
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/privacy" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">Terms of Service</Link>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Trust</p>
              <div className="flex flex-col gap-4">
                <div className="text-sm font-black text-emerald-500 flex items-center gap-2 italic">
                  Meta Official API
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <Link href="/about" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors">About Us</Link>
                <a href="https://x.com/HelloReplykaro" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-400 hover:text-[#25D366] transition-colors flex items-center gap-2">
                  Follow on X
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="mt-20 pt-10 border-t border-slate-50 flex flex-col md:row items-center justify-between gap-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-300">
            &copy; {new Date().getFullYear()} ReplyKaro Engineering | WhatsApp Business Solutions
          </p>
          <div className="flex items-center gap-4 text-slate-300">
            <Shield className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Meta API Verified | 256-bit Encrypted</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
