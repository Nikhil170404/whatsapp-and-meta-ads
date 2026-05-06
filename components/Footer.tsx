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
                Reply<span className="text-primary italic">Karo.</span>
              </span>
            </Link>
            <p className="text-slate-400 font-bold leading-relaxed text-sm max-w-xs">
              Built for the next generation of Indian creators. Automating viral growth with official Meta-verified engineering.
            </p>
          </div>

          {/* Links Grid */}
          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Growth in India</p>
              <div className="flex flex-col gap-4">
                <Link href="/blog/manychat-alternative-india-2026" className="text-sm font-black text-primary hover:opacity-80 transition-opacity flex items-center gap-2 italic">
                  #1 ManyChat Alternative India
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/alternatives/manychat" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs ManyChat</Link>
                <Link href="/alternatives/aisensy" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs AiSensy</Link>
                <Link href="/alternatives/interakt" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs Interakt</Link>
                <Link href="/alternatives/wati" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs WATI</Link>
                <Link href="/alternatives/grohubz" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs Grohubz</Link>
                <Link href="/alternatives/kwikzy" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">vs Kwikzy</Link>
                <Link href="/alternatives" className="text-sm font-black text-primary hover:text-primary transition-colors flex items-center gap-2 group italic mt-2">
                  All Alternatives
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Resources</p>
              <div className="flex flex-col gap-4">
                <Link href="/blog" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Blog & Guides</Link>
                <Link href="/tools" className="text-sm font-black text-primary hover:text-primary transition-colors flex items-center gap-2 italic">
                  Free Creator Tools
                  <Sparkles className="h-3 w-3" />
                </Link>
                <Link href="/features/autodm" className="text-sm font-black text-primary hover:opacity-80 transition-opacity flex items-center gap-2 italic">
                  AutoDM Engine
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/features/comment-to-dm" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Comment to DM</Link>
                <Link href="/features/story-automation" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Story Automation</Link>
                <Link href="/features/instagram-automation" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Instagram Engine</Link>
                <Link href="/features/fan-mode" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Fan Mode Loyalty</Link>
                <Link href="/referral" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Referral Program</Link>
                <Link href="/faq" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Help Center</Link>
                <Link href="/guide" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">User Manual</Link>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Meta Policy</p>
              <div className="flex flex-col gap-4">
                <Link href="/verified" className="text-sm font-black text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-2 italic">
                  Verified Status
                  <ShieldCheck className="h-3 w-3" />
                </Link>
                <Link href="/privacy" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Terms of Service</Link>
                <Link href="/deletion-status" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Data Deletion</Link>
                <Link href="/about" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">About Brand</Link>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Community & Trust</p>
              <div className="flex flex-col gap-4">
                <a href="https://www.g2.com/products/replykaro/reviews" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Review us on G2
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.producthunt.com/products/replykaro" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Find us on Product Hunt
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.shipit.buzz/products/replykaro" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Review on Shipit
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://peerpush.net/p/replykaro" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Vote on PeerPush
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://wellfound.com/company/replykaro" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Follow us on Wellfound
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://x.com/HelloReplykaro" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Follow on X (Twitter)
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.linkedin.com/company/replykaro/" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Connect on LinkedIn
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.instagram.com/replykaro.ai" target="_blank" rel="noopener noreferrer me" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Follow on Instagram
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://medium.com/@replykaro1704/the-definitive-guide-to-instagram-autodm-tools-10-alternatives-compared-2026-edition-34a45a98dc63" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                  Ultimate Guide on Medium
                  <ArrowRight className="h-3 w-3" />
                </a>
                <Link href="/alternatives" className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">Comparisons</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="mt-20 pt-10 border-t border-slate-50 flex flex-col md:row items-center justify-between gap-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-300">
            &copy; {new Date().getFullYear()} ReplyKaro Engineering | Universal Automation
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
