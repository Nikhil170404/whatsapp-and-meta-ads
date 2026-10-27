"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-rose-100 bg-rose-50/50 p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" aria-hidden />
      <h1 className="mt-4 text-lg font-bold text-slate-900">This page could not load</h1>
      <p className="mt-2 text-sm text-slate-600">
        Something went wrong on our side. Your data is safe. Try again, and if it keeps happening, contact support.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button onClick={reset} className="rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851]">
          Try again
        </button>
        <Link href="/wa" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
