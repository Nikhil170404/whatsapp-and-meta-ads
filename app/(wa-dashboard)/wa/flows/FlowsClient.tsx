"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { FLOW_TEMPLATES } from "@/lib/flows/templates";

interface Row {
  id: string; name: string; description: string | null; status: "draft" | "published"; trigger_type: string; keywords: string[]; blocks: number; updated_at: string;
  stats: { started: number; completed: number; handed_over: number; leads: number; in_progress: number } | null;
}

const triggerText = (r: Row) => (r.trigger_type === "keyword" ? (r.keywords.length ? `Keyword: ${r.keywords.join(", ")}` : "No keyword set") : r.trigger_type === "welcome" ? "New customers" : "Any message");

export function FlowsClient({ initial, loadError }: { initial: Row[]; loadError: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(loadError);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const call = async (key: string, url: string, init?: RequestInit) => {
    setBusy(key); setError(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      return body;
    } catch (e: any) { setError(e.message); return null; } finally { setBusy(null); }
  };

  const create = async (template_id?: string) => {
    const flow = await call(template_id ?? "blank", "/api/whatsapp/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id }) });
    if (flow) router.push(`/wa/flows/${flow.id}`);
  };
  const duplicate = async (id: string) => { const f = await call(`dup${id}`, `/api/whatsapp/flows/${id}/duplicate`, { method: "POST" }); if (f) router.push(`/wa/flows/${f.id}`); };
  const remove = async (id: string) => {
    const r = await call(`del${id}`, `/api/whatsapp/flows/${id}`, { method: "DELETE" });
    if (r) { setRows((x) => x.filter((f) => f.id !== id)); setConfirmDelete(null); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Conversation flows</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">Build a chat that guides customers: ask questions, collect their details, show menus and hand over to your team. Drag blocks, connect them and preview it like a customer.</p>
        </div>
        <button type="button" onClick={() => create()} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1fb857] active:scale-95 disabled:opacity-60">
          {busy === "blank" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} New flow
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

      {rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="animate-in fade-in rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <Link href={`/wa/flows/${r.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-base font-extrabold text-slate-900">{r.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{r.status === "published" ? "Live" : "Draft"}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{triggerText(r)} · {r.blocks} blocks</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[["Started", r.stats?.started ?? 0], ["Finished", r.stats?.completed ?? 0], ["Leads", r.stats?.leads ?? 0]].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-slate-50 py-2"><dd className="text-lg font-extrabold tabular-nums text-slate-900">{v}</dd><dt className="text-[11px] font-semibold text-slate-500">{k}</dt></div>
                  ))}
                </dl>
              </Link>
              <div className="mt-3 flex items-center justify-end gap-1">
                {confirmDelete === r.id ? (
                  <>
                    <span className="mr-auto text-xs font-semibold text-rose-700">Delete this flow?</span>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Keep</button>
                    <button type="button" onClick={() => remove(r.id)} disabled={busy !== null} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60">Delete</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => duplicate(r.id)} disabled={busy !== null} aria-label={`Duplicate ${r.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setConfirmDelete(r.id)} aria-label={`Delete ${r.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="tpl">
        <h2 id="tpl" className="text-lg font-extrabold text-slate-900">{rows.length ? "Start from a ready-made flow" : "Start with a ready-made flow"}</h2>
        <p className="mb-3 text-sm text-slate-500">Each one is fully editable. Pick the closest and change the words.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FLOW_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => create(t.id)} disabled={busy !== null} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#25D366] hover:shadow-md active:scale-[0.99] disabled:opacity-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#128C7E]">{busy === t.id ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Workflow className="h-5 w-5" aria-hidden />}</span>
              <span><span className="block text-sm font-extrabold text-slate-900">{t.name}</span><span className="block text-xs leading-relaxed text-slate-500">{t.description}</span></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
