"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, KeyRound, Loader2, TestTube2 } from "lucide-react";

interface Summary {
  phone_number: string; business_name: string | null; quality: string; messaging_limit: string;
  looks_like_test_number: boolean; token_expires_warning: string | null; webhook_subscribed: boolean;
  templates: { approved: number; total: number };
}

const field = "w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-medium focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm";
const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500";

/**
 * Connect with a WABA ID and access token: for Meta's free test account and for permanent
 * System User tokens. Admins also get a one-click button for the server's own credentials.
 */
export function ConnectWithCredentials({ serverCredentialsHint }: { serverCredentialsHint: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!serverCredentialsHint);
  const [waba, setWaba] = useState("");
  const [token, setToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [busy, setBusy] = useState<"form" | "server" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function submit(body: Record<string, unknown>, kind: "form" | "server") {
    setBusy(kind); setError(null); setSummary(null);
    try {
      const res = await fetch("/api/whatsapp/connect-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not connect.");
      setSummary(data.summary);
      setToken(""); // do not keep the token in the page once it has been used
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6" aria-labelledby="creds-title">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><KeyRound className="h-5 w-5" aria-hidden /></span>
          <span>
            <span id="creds-title" className="block text-base font-bold text-slate-900">Connect with a token</span>
            <span className="block text-xs text-slate-500">For Meta&apos;s free test account, or a permanent System User token</span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          {serverCredentialsHint && (
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-sm font-bold text-violet-900">Use the test account from server settings</p>
              <p className="mt-1 text-xs text-violet-800">Account {serverCredentialsHint}. Connects it to this ReplyKaro account in one click. Shown only to admins.</p>
              <button type="button" disabled={busy !== null} onClick={() => submit({ use_server_credentials: true }, "server")}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                {busy === "server" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />} Use test account
              </button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submit({ waba_id: waba, access_token: token, phone_number_id: phoneId || undefined }, "form"); }} className="space-y-4" autoComplete="off">
            <div>
              <label htmlFor="waba" className={label}>WhatsApp Business Account ID</label>
              <input id="waba" inputMode="numeric" className={field} placeholder="2115477789298460" value={waba} onChange={(e) => setWaba(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Meta → your app → WhatsApp → API Setup.</p>
            </div>
            <div>
              <label htmlFor="token" className={label}>Access token</label>
              <input id="token" type="password" className={field} placeholder="EAAG…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" />
              <p className="mt-1 text-xs text-slate-500">
                A token from API Setup lasts about 24 hours. For anything lasting, create a System User token with <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>.
                It is checked with Meta, then stored encrypted in transit and never shown again.
              </p>
            </div>
            <div>
              <label htmlFor="phone-id" className={label}>Phone number ID <span className="font-medium normal-case text-slate-400">(optional)</span></label>
              <input id="phone-id" inputMode="numeric" className={field} placeholder="Leave empty to use the first number" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
            </div>
            <button type="submit" disabled={busy !== null || !waba || !token}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851] disabled:opacity-50">
              {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />} Check and connect
            </button>
          </form>

          {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

          {summary && (
            <div role="status" className="space-y-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" aria-hidden /> Connected {summary.phone_number}{summary.business_name ? ` (${summary.business_name})` : ""}</p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                <li>Quality: {summary.quality}. Limit: {summary.messaging_limit} customers per 24 hours.</li>
                <li>{summary.templates.approved} of {summary.templates.total} templates approved.</li>
                <li>{summary.webhook_subscribed ? "Webhooks are subscribed." : "Could not subscribe webhooks automatically: subscribe the app in Meta → WhatsApp → Configuration."}</li>
                {summary.looks_like_test_number && <li>This is a Meta test number. It can only message people you add and verify under API Setup → To.</li>}
                {summary.token_expires_warning && <li className="font-semibold text-amber-800">{summary.token_expires_warning}</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
