"use client";

import React, { useState, useEffect, Suspense } from "react";
import { AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const POINTS = [
  ["Automatic replies", "Answer price, hours and order questions day and night."],
  ["Guided chats", "Ask for a name or email, show menus, and save the lead."],
  ["Broadcasts with consent", "Send approved templates only to people who agreed."],
  ["You pay Meta directly", "Message fees go to Meta at Meta's rates, with no markup."],
];

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-lp-ground text-lp-ink lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      <section className="flex flex-col justify-between gap-8 bg-lp-field px-5 py-6 sm:px-10 lg:px-14 lg:py-12">
        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="ReplyKaro home">
          <span className="flex h-9 w-9 items-center justify-center bg-lp-accent"><MessageSquare className="h-5 w-5 fill-lp-ink text-lp-ink" aria-hidden /></span>
          <span className="text-lg font-semibold tracking-tight">ReplyKaro</span>
        </Link>

        <div className="lg:py-0">
          <h1 className="max-w-[14ch] text-[clamp(2rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.035em]">Answer every WhatsApp chat.</h1>
          <ul className="mt-8 hidden max-w-md space-y-5 lg:block">
            {POINTS.map(([t, d]) => (
              <li key={t}><p className="text-lg font-semibold">{t}</p><p className="text-base text-lp-soft">{d}</p></li>
            ))}
          </ul>
        </div>

        <p className="hidden text-base text-lp-soft lg:block">Built on the official WhatsApp Cloud API. Customer consent is recorded under India&apos;s DPDP Act.</p>
      </section>

      <section className="flex items-start px-5 py-10 sm:px-10 lg:items-center lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-lg text-lp-soft">Use the Facebook account that manages your WhatsApp Business account. New here? The same button creates your account.</p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 bg-rose-50 p-4 text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="text-base leading-snug">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleFacebookLogin}
            disabled={isLoading}
            className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 bg-[#1877F2] px-6 text-lg font-semibold text-white transition hover:bg-[#166fe5] active:scale-[0.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FacebookIcon className="h-5 w-5" />}
            {isLoading ? "Signing in…" : "Continue with Facebook"}
          </button>

          <p className="mt-6 text-base leading-relaxed text-lp-soft">
            We only read the account details Meta shares to connect your WhatsApp number. By continuing you agree to our{" "}
            <Link href="/terms" className="font-semibold text-lp-ink underline underline-offset-4">Terms</Link> and{" "}
            <Link href="/privacy" className="font-semibold text-lp-ink underline underline-offset-4">Privacy Policy</Link>.
          </p>
          <Link href="/" className="mt-8 inline-block py-2 text-base font-semibold text-lp-ink underline-offset-4 hover:underline">Back to home</Link>
        </div>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
