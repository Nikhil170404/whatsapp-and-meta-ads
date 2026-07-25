"use client";

import Link from "next/link";
import { MessageSquare, BarChart3, ShieldCheck, ExternalLink } from "lucide-react";

const LINKS = {
  products: [
    { label: "WhatsApp Automation", href: "/whatsapp" },
    { label: "Meta Ads Engine", href: "/meta-ads" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Sign in", href: "/signin" },
  ],
  features: [
    { label: "Keyword Auto-Reply", href: "/whatsapp#features" },
    { label: "Broadcast Templates", href: "/whatsapp#features" },
    { label: "Contact CRM", href: "/whatsapp#features" },
    { label: "CTWA Campaigns", href: "/meta-ads" },
    { label: "Meta Ads Automation", href: "/meta-ads" },
  ],
  support: [
    { label: "hello@replykaro.in", href: "mailto:hello@replykaro.in" },
    { label: "Follow on X", href: "https://x.com/HelloReplykaro", external: true },
    { label: "FAQ", href: "/#faq" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Data Deletion", href: "/data-deletion" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-5">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center shadow-sm transition-shadow group-hover:shadow-[0_0_0_4px_rgba(37,211,102,0.12)]">
                <MessageSquare className="h-4 w-4 text-white fill-white" />
              </div>
              <span className="text-[15px] font-semibold text-slate-900 tracking-tight">
                Reply<span className="text-[#25D366]">Karo</span>
              </span>
            </Link>
            <p className="text-[13px] text-slate-400 leading-relaxed max-w-[200px]">
              WhatsApp Business & Meta Ads automation — built for Indian businesses.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Meta Official API Partner
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">Products</p>
            <ul className="space-y-2.5">
              {LINKS.products.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">Features</p>
            <ul className="space-y-2.5">
              {LINKS.features.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">Support</p>
            <ul className="space-y-2.5">
              {LINKS.support.map((l) => (
                <li key={l.href}>
                  {"external" in l && l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {l.label}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  ) : (
                    <a
                      href={l.href}
                      className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider">Legal</p>
            <ul className="space-y-2.5">
              {LINKS.legal.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-slate-400">
            &copy; {new Date().getFullYear()} ReplyKaro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
              Terms
            </Link>
            <Link href="/data-deletion" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
              Data Deletion
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
