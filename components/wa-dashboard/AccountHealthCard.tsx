import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

const QUALITY_STYLE: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-800",
  poor: "bg-rose-50 text-rose-700",
  unknown: "bg-slate-100 text-slate-600",
};

/**
 * Shows what keeps a number safe: Meta's quality rating, the messaging limit and how much
 * of it is used, and any restriction. Everything here comes from Meta's own values.
 */
export function AccountHealthCard({ health }: { health: any }) {
  if (!health?.connected) return null;
  const { quality, messaging_limit: lim, restriction } = health;
  const limit: number | null = lim.per_24_hours;
  const pct = limit ? Math.min(100, Math.round((lim.used_last_24h / limit) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-[#25D366]";

  return (
    <section aria-labelledby="health-title" className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 id="health-title" className="text-base font-bold text-slate-900">Sending safety</h2>
          <p className="text-xs text-slate-500">Meta&apos;s own numbers for your WhatsApp account</p>
        </div>
      </div>

      {restriction && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {restriction.summary}
        </p>
      )}
      {quality.promotions_paused && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Promotions and automatic replies are paused because too many people blocked or reported your messages. They resume when Meta&apos;s rating recovers.
        </p>
      )}

      {health.tokens_encrypted === false && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Access tokens are stored without encryption. Set TOKEN_ENCRYPTION_KEY on the server (generate one with: openssl rand -base64 32), then run npm run secrets:encrypt -- --yes.
        </p>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Quality rating</dt>
          <dd className="mt-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${QUALITY_STYLE[quality.level]}`}>
              {quality.level === "good" && <CheckCircle2 className="h-4 w-4" aria-hidden />} {quality.label}
            </span>
            <span className="mt-1.5 block text-xs text-slate-500">
              {quality.level === "poor" ? "People are blocking or reporting your messages. Message only people who asked to hear from you."
                : quality.level === "medium" ? "Watch your audience and content. A drop to red pauses promotions."
                : quality.level === "good" ? "Keep messaging only people who agreed to hear from you."
                : "Meta rates a number after it has sent some messages."}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Customers you can message per 24 hours</dt>
          <dd className="mt-1.5">
            <span className="text-2xl font-black text-slate-900">{lim.used_last_24h.toLocaleString()}</span>
            <span className="text-sm text-slate-500"> of {lim.label}{lim.per_24_hours === null ? "" : " used"}</span>
            {limit !== null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily messaging limit used">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            <span className="mt-1.5 block text-xs text-slate-500">
              {lim.assumed ? "Meta has not reported your limit yet, so we assume 250, where every new account starts. " : ""}
              Counts different customers sent a template message in the last 24 hours. Replies inside a customer&apos;s open chat do not count. Meta raises the limit automatically when quality stays good.
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
