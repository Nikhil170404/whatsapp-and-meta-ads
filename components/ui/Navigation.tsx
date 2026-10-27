"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

const HIDDEN_PREFIXES = ["/wa", "/dashboard", "/admin"];
const HIDDEN_EXACT = ["/signin"];

export function Navigation() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const hidden =
    HIDDEN_EXACT.includes(pathname ?? "") || HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));

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
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (hidden) return null;

  const cta = isLoggedIn
    ? { href: "/wa", label: "Dashboard" }
    : { href: "/signin", label: "Start free" };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] bg-white/90 backdrop-blur transition-shadow",
        scrolled ? "border-b border-slate-100 shadow-sm" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ReplyKaro home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]">
            <MessageSquare className="h-4 w-4 fill-white text-white" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            Reply<span className="text-[#25D366]">Karo</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!isLoggedIn && (
            <Link href="/signin" className="hidden rounded-md px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              Sign in
            </Link>
          )}
          <Link href={cta.href} className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1DA851] active:scale-[0.98]">
            {cta.label}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-slate-100 bg-white px-4 pb-6 pt-3 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-xl px-4 py-3.5 text-base font-semibold text-slate-800 active:bg-slate-50">
              {l.label}
            </Link>
          ))}
          {!isLoggedIn && (
            <Link href="/signin" className="block rounded-xl px-4 py-3.5 text-base font-semibold text-slate-800 active:bg-slate-50">
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
