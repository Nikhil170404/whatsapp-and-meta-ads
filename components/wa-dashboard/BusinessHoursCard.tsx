"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import {
  AWAY_MESSAGE_MAX, DAYS, DAY_LABELS, DEFAULT_AWAY_MESSAGE, DEFAULT_TIMEZONE, DEFAULT_WEEK, PRESETS,
  isOpenNow, validateHours, type DayKey, type WeekHours,
} from "@/lib/whatsapp/hours";

const ZONES = [
  ["Asia/Kolkata", "India (IST)"], ["Asia/Dubai", "Dubai (GST)"], ["Asia/Singapore", "Singapore"], ["Europe/London", "London"],
  ["Europe/Berlin", "Central Europe"], ["Africa/Lagos", "West Africa (Lagos)"], ["America/New_York", "New York"],
  ["America/Los_Angeles", "Los Angeles"], ["Australia/Sydney", "Sydney"],
];

interface Props { initial: { enabled: boolean; hours: WeekHours; timezone: string; away_message: string }; connected: boolean }

const field = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30";

export function BusinessHoursCard({ initial, connected }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [week, setWeek] = useState<WeekHours>(initial.hours ?? DEFAULT_WEEK);
  const [zone, setZone] = useState(initial.timezone || DEFAULT_TIMEZONE);
  const [message, setMessage] = useState(initial.away_message || DEFAULT_AWAY_MESSAGE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = ZONES.some(([z]) => z === zone) ? ZONES : [[zone, zone], ...ZONES];
  const open = useMemo(() => { try { return isOpenNow(week, zone); } catch { return false; } }, [week, zone]);
  const problem = enabled ? validateHours(week, zone, message) : null;

  const setDay = (d: DayKey, patch: Partial<WeekHours[DayKey]>) => { setWeek((w) => ({ ...w, [d]: { ...w[d], ...patch } })); setSaved(false); };

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch("/api/whatsapp/hours", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, hours: week, timezone: zone, away_message: message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section aria-labelledby="hours-title" className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Clock className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 id="hours-title" className="text-base font-bold text-slate-900">Business hours &amp; away message</h2>
            <p className="mt-0.5 text-sm text-slate-600">When you are closed, customers get a polite note instead of silence. Sent once per customer every 12 hours, and never in place of a keyword reply.</p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" role="switch" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} className="h-5 w-5 accent-[#25D366]" />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      {enabled && (
        <div className="mt-5 space-y-5">
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            <span className={`h-2 w-2 rounded-full ${open ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
            Right now you are {open ? "open" : "closed"}
          </p>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => { setWeek(p.week); setSaved(false); }}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">{p.label}</button>
            ))}
          </div>

          <div>
            <label htmlFor="tz" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Time zone</label>
            <select id="tz" value={zone} onChange={(e) => { setZone(e.target.value); setSaved(false); }} className={`${field} bg-white`}>
              {zones.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
            </select>
          </div>

          <ul className="space-y-2">
            {DAYS.map((d) => (
              <li key={d} className="flex flex-wrap items-center gap-3">
                <label className="flex w-36 items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={week[d].open} onChange={(e) => setDay(d, { open: e.target.checked })} className="h-4 w-4 accent-[#25D366]" />
                  {DAY_LABELS[d]}
                </label>
                {week[d].open ? (
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <input type="time" aria-label={`${DAY_LABELS[d]} opens`} value={week[d].from} onChange={(e) => setDay(d, { from: e.target.value })} className={field} />
                    to
                    <input type="time" aria-label={`${DAY_LABELS[d]} closes`} value={week[d].to} onChange={(e) => setDay(d, { to: e.target.value })} className={field} />
                  </span>
                ) : <span className="text-sm text-slate-400">Closed</span>}
              </li>
            ))}
          </ul>

          <div>
            <label htmlFor="away" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Away message</label>
            <textarea id="away" rows={3} maxLength={AWAY_MESSAGE_MAX} value={message} onChange={(e) => { setMessage(e.target.value); setSaved(false); }}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-base font-medium focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm" />
            <p className="mt-1 text-xs text-slate-500">Tip: say when you reopen, for example “We reopen at 10 AM tomorrow.” Keep the opt-out line.</p>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>}
      {problem && <p className="mt-4 text-sm font-semibold text-amber-700">{problem}</p>}
      {!connected && <p className="mt-4 text-sm font-semibold text-amber-700">Connect your WhatsApp number first, then save.</p>}

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !!problem || !connected}
          className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851] disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save hours
        </button>
        {saved && <span role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden /> Saved</span>}
      </div>
    </section>
  );
}
