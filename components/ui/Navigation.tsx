"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, MessageSquare, BarChart3, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  {
    name: "WhatsApp Automation",
    description: "Auto-replies, broadcasts & contact CRM",
    href: "/whatsapp",
    Icon: MessageSquare,
    accent: "#25D366",
    bg: "rgba(37,211,102,0.1)",
  },
  {
    name: "Meta Ads Engine",
    description: "Comment-to-DM & CTWA campaigns",
    href: "/meta-ads",
    Icon: BarChart3,
    accent: "#1877F2",
    bg: "rgba(24,119,242,0.1)",
  },
];

const HIDDEN_PREFIXES = ["/wa", "/ads", "/dashboard", "/admin", "/dm/", "/rewards", "/open"];
const HIDDEN_EXACT = ["/signin", "/signup", "/waitlist"];

export function Navigation() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);

  const isHidden =
    HIDDEN_EXACT.includes(pathname ?? "") ||
    HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setIsLoggedIn(!!d.user))
      .catch(() => setIsLoggedIn(false));

    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  if (isHidden) return null;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] bg-white transition-all duration-200",
          scrolled
            ? "border-b border-slate-100 shadow-[0_1px_16px_-4px_rgba(0,0,0,0.06)]"
            : "border-b border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center shadow-sm transition-shadow group-hover:shadow-[0_0_0_4px_rgba(37,211,102,0.12)]">
              <MessageSquare className="h-4 w-4 text-white fill-white" />
            </div>
            <span className="text-[15px] font-semibold text-slate-900 tracking-tight">
              Reply<span className="text-[#25D366]">Karo</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">

            {/* Products dropdown */}
            <div ref={productsRef} className="relative">
              <button
                onClick={() => setProductsOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13.5px] font-medium transition-colors select-none",
                  productsOpen
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                Products
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 opacity-50 transition-transform duration-150",
                    productsOpen && "rotate-180"
                  )}
                />
              </button>

              {productsOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-68 min-w-[260px] bg-white rounded-xl border border-slate-100 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12)] p-1.5 z-50">
                  {PRODUCTS.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      onClick={() => setProductsOpen(false)}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: p.bg }}
                      >
                        <p.Icon className="h-4 w-4" style={{ color: p.accent }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900 leading-none mb-1">
                          {p.name}
                        </p>
                        <p className="text-[12px] text-slate-400 leading-snug">{p.description}</p>
                      </div>
                    </Link>
                  ))}
                  <div className="my-1 h-px bg-slate-50" />
                  <Link
                    href="/signin"
                    onClick={() => setProductsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#25D366]/5 transition-colors group"
                  >
                    <span className="text-[12px] font-medium text-[#25D366]">Start free — no credit card</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#25D366] group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/#pricing"
              className={cn(
                "px-3.5 py-2 rounded-md text-[13.5px] font-medium transition-colors",
                pathname === "/#pricing"
                  ? "text-slate-900 bg-slate-100"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Pricing
            </Link>

            <a
              href="mailto:hello@replykaro.in"
              className="px-3.5 py-2 rounded-md text-[13.5px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Support
            </a>
          </nav>

          {/* Auth CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {isLoggedIn === null ? (
              <div className="w-24 h-8 bg-slate-100 animate-pulse rounded-lg" />
            ) : isLoggedIn ? (
              <Link
                href="/wa"
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1DA851] transition-colors shadow-sm"
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="hidden sm:block px-3.5 py-2 text-[13.5px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signin"
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-700 transition-colors"
                >
                  Start free <Zap className="h-3.5 w-3.5" />
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[110] md:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[288px] bg-white z-[120] flex flex-col md:hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[−4px_0_40px_rgba(0,0,0,0.12)]",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 h-[60px] border-b border-slate-100 shrink-0">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            <span className="text-[14px] font-semibold text-slate-900">
              Reply<span className="text-[#25D366]">Karo</span>
            </span>
          </Link>
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Products
          </p>
          {PRODUCTS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: p.bg }}
              >
                <p.Icon className="h-3.5 w-3.5" style={{ color: p.accent }} />
              </div>
              <span className="text-[13px] font-medium text-slate-700">{p.name}</span>
            </Link>
          ))}

          <div className="my-3 h-px bg-slate-100" />

          {[
            { label: "Pricing", href: "/#pricing" },
            { label: "Support", href: "mailto:hello@replykaro.in" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}

          <div className="my-3 h-px bg-slate-100" />
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Legal
          </p>
          {[
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "Data Deletion", href: "/data-deletion" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">
          {isLoggedIn ? (
            <Link
              href="/wa"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1DA851] transition-colors"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center h-11 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800 transition-colors"
              >
                Start free <Zap className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
