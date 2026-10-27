"use client";

import Link from "next/link";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-slate-600">Please try again. If the problem continues, email hello@replykaro.in.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851]">Try again</button>
          <Link href="/" className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Home</Link>
        </div>
      </div>
    </main>
  );
}
