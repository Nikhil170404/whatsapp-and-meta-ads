export default function DashboardLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
