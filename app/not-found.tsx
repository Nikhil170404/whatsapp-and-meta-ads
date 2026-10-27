import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-black text-[#25D366]">404</p>
        <h1 className="mt-4 text-2xl font-black text-slate-900">We could not find that page</h1>
        <p className="mt-3 text-slate-600">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851]">Go home</Link>
          <Link href="/wa" className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
