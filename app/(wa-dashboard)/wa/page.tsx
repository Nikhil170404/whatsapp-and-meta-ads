import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { MetaBillingCard } from "@/components/wa-dashboard/MetaBillingCard";
import { AccountHealthCard } from "@/components/wa-dashboard/AccountHealthCard";
import { getAccountHealth } from "@/lib/api/ops";
import { RelativeTime } from "@/components/ui/relative-time";
import { pickDisplayName } from "@/lib/auth/display-name";

const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

export default async function WaOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [
    { data: connection },
    { data: automations },
    { count: contactCount },
    { count: flowCount },
    { data: recentMessages },
    { data: userRow },
    { data: daily },
    { data: waiting },
  ] = await Promise.all([
    supabase.from("wa_connections").select("*").eq("user_id", session.id).maybeSingle(),
    supabase.from("wa_automations").select("id, name, is_active, trigger_type, trigger_keyword, sent_count").eq("user_id", session.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_flows").select("*", { count: "exact", head: true }).eq("user_id", session.id).eq("status", "published"),
    supabase.from("wa_messages").select("id, direction, from_phone, to_phone, content, created_at").eq("user_id", session.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("users").select("display_name, email").eq("id", session.id).maybeSingle(),
    supabase.rpc("message_daily_counts", { p_user: session.id, p_days: 7 }),
    supabase.from("wa_conversations").select("phone, human_note, needs_human_at").eq("user_id", session.id).not("needs_human_at", "is", null).order("needs_human_at", { ascending: false }).limit(5),
  ]);

  // The verified WhatsApp business name, not the Facebook account name.
  const name = pickDisplayName(connection?.display_name, userRow?.display_name ?? session.display_name, userRow?.email ?? session.email);

  const isConnected = connection?.status === "active";
  const isExpired = connection?.status === "expired";
  const health = isConnected ? await getAccountHealth(supabase, session.id) : null;
  const rules = automations ?? [];
  const running = rules.filter((a: any) => a.is_active).length;
  const msgs = recentMessages ?? [];
  const days: { day: string; inbound: number; outbound: number }[] = daily ?? [];
  const inTotal = days.reduce((n, d) => n + d.inbound, 0);
  const outTotal = days.reduce((n, d) => n + d.outbound, 0);
  const peak = Math.max(1, ...days.map((d) => d.inbound + d.outbound));
  const people: any[] = waiting ?? [];

  const steps = [
    { done: isConnected, label: "Connect your WhatsApp number", href: "/wa/connect" },
    { done: rules.length > 0 || (flowCount ?? 0) > 0, label: "Turn on a first reply or flow", href: "/wa/automations" },
    { done: (contactCount ?? 0) > 0, label: "Add or receive your first contact", href: "/wa/contacts" },
  ];
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {isExpired && (
        <div role="alert" className="flex flex-col gap-3 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="flex-1 text-sm"><strong className="font-semibold">Your WhatsApp connection expired, so replies are paused.</strong> Reconnect to resume.</p>
          <Link href="/wa/connect" className="inline-flex min-h-11 items-center justify-center bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-800">Reconnect</Link>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-lp-ink">{name}</h1>
          <p className="mt-1 text-base text-lp-soft">
            {!isConnected ? "WhatsApp is not connected yet." : running + (flowCount ?? 0) > 0 ? `${running} automation${running === 1 ? "" : "s"} and ${flowCount ?? 0} flow${flowCount === 1 ? "" : "s"} are answering customers.` : "Nothing is answering customers yet."}
          </p>
        </div>
        <Link href="/wa/flows" className="inline-flex min-h-11 items-center gap-2 bg-lp-accent px-5 text-sm font-semibold text-lp-ink transition hover:bg-lp-accent-hover active:scale-[0.98]">
          New flow <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {nextStep && !isExpired && (
        <section aria-labelledby="setup" className="bg-lp-field p-5 sm:p-6">
          <h2 id="setup" className="text-base font-semibold text-lp-ink">Finish setting up, {steps.filter((s) => s.done).length} of 3 done</h2>
          <ol className="mt-3 space-y-1">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex min-h-11 items-center gap-3 text-base ${s.done ? "text-lp-soft line-through" : "font-semibold text-lp-ink hover:underline"}`}>
                  <span aria-hidden className={`h-3 w-3 shrink-0 ${s.done ? "bg-lp-ink" : "border-2 border-lp-ink"}`} />
                  {s.label}{s.done && <span className="sr-only"> (done)</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {people.length > 0 && (
        <section aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-semibold text-lp-ink">Waiting for a person</h2>
          <ul className="mt-3 divide-y divide-slate-200 bg-white">
            {people.map((p) => (
              <li key={p.phone}>
                <Link href="/wa/messages" className="flex min-h-14 items-center gap-4 px-4 py-2 transition-colors hover:bg-lp-ground">
                  <span className="font-semibold tabular-nums text-lp-ink">+{p.phone}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-lp-soft">{p.human_note || "Asked for a person in a flow"}</span>
                  <RelativeTime date={p.needs_human_at} className="shrink-0 text-sm text-lp-soft" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The numbers that matter: plain figures, one chart */}
      <section aria-labelledby="week" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h2 id="week" className="text-lg font-semibold text-lp-ink">Last 7 days</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6">
            {[
              ["Customer messages", inTotal],
              ["Your replies", outTotal],
              ["Contacts", contactCount ?? 0],
              ["Live flows", flowCount ?? 0],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dd className="text-4xl font-semibold tracking-tight tabular-nums text-lp-ink">{(v as number).toLocaleString("en-IN")}</dd>
                <dt className="mt-1 text-sm text-lp-soft">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white p-5">
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-lp-soft">
            <span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 bg-lp-ink" />Customer messages</span>
            <span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 bg-[#25D366]" />Your replies</span>
          </p>
          {days.length === 0 ? (
            <p className="mt-6 py-10 text-center text-base text-lp-soft">No messages yet. They appear here as customers write in.</p>
          ) : (
            <div className="mt-4 flex h-44 items-end gap-2 sm:gap-4" role="img" aria-label={`Messages per day, last 7 days: ${inTotal} from customers and ${outTotal} replies`}>
              {days.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col justify-end gap-1 text-center">
                  <div className="flex flex-1 flex-col justify-end">
                    <span className="block w-full bg-[#25D366] transition-[height] duration-700" style={{ height: `${(d.outbound / peak) * 100}%` }} title={`${d.outbound} replies`} />
                    <span className="block w-full bg-lp-ink transition-[height] duration-700" style={{ height: `${(d.inbound / peak) * 100}%` }} title={`${d.inbound} customer messages`} />
                  </div>
                  <span className="text-xs text-lp-soft">{weekday(d.day)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {health && <AccountHealthCard health={health} />}
      {isConnected && <MetaBillingCard compact />}

      <section aria-labelledby="auto" className="grid gap-8 xl:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="auto" className="text-lg font-semibold text-lp-ink">Automatic replies</h2>
            <Link href="/wa/automations" className="py-2 text-sm font-semibold text-lp-ink underline-offset-4 hover:underline">Manage</Link>
          </div>
          {rules.length === 0 ? (
            <div className="mt-3 bg-white p-6">
              <p className="text-base font-semibold text-lp-ink">No automatic replies yet.</p>
              <p className="mt-1 text-base text-lp-soft">Start with the word customers use most, like “price”, and write the answer once.</p>
              <Link href="/wa/automations" className="mt-4 inline-flex min-h-11 items-center bg-lp-ink px-5 text-sm font-semibold text-white hover:bg-black">Create the first reply</Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 bg-white">
              {rules.map((a: any) => (
                <li key={a.id} className="flex min-h-14 items-center gap-4 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-lp-ink">{a.name}</span>
                    <span className="block truncate text-sm text-lp-soft">{a.trigger_type === "keyword" ? `When someone says “${a.trigger_keyword}”` : a.trigger_type === "any" ? "Any message" : "A new customer's first message"}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-lp-soft">{(a.sent_count ?? 0).toLocaleString("en-IN")} sent</span>
                  <span className={`shrink-0 text-sm font-semibold ${a.is_active ? "text-[#0E7A5F]" : "text-lp-soft"}`}>{a.is_active ? "On" : "Off"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-lp-ink">Recent messages</h2>
            <Link href="/wa/messages" className="py-2 text-sm font-semibold text-lp-ink underline-offset-4 hover:underline">Open inbox</Link>
          </div>
          {msgs.length === 0 ? (
            <p className="mt-3 bg-white p-6 text-base text-lp-soft">No messages yet. Send “hi” to your WhatsApp number to see the first one here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 bg-white">
              {msgs.map((m: any) => {
                const out = m.direction === "outbound";
                return (
                  <li key={m.id}>
                    <Link href="/wa/messages" className="flex min-h-14 items-center gap-4 px-4 py-2 transition-colors hover:bg-lp-ground">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-lp-soft">{out ? "You to" : "From"} <span className="tabular-nums">+{out ? m.to_phone : m.from_phone}</span></span>
                        <span className="block truncate text-base text-lp-ink">{m.content || "(no text)"}</span>
                      </span>
                      <RelativeTime date={m.created_at} className="shrink-0 text-sm text-lp-soft" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
