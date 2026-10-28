import { Check } from "lucide-react";

/** Small, true-to-product pieces of the interface. Each is marked data-ui: the product's own conventions apply inside. */

const panel = "flex min-h-[210px] w-full flex-col justify-center bg-lp-field sm:max-w-[360px] p-5 text-base text-slate-800";

export function RuleFragment() {
  return (
    <div data-ui className={panel}>
      <p className="text-[14px] font-semibold text-slate-700">When a customer says</p>
      <p className="mt-1 flex flex-wrap gap-1.5">{["price", "cost", "how much"].map((k) => <span key={k} className="rounded bg-white px-2 py-1 font-semibold">{k}</span>)}</p>
      <p className="mt-3 text-[14px] font-semibold text-slate-700">Reply with</p>
      <p className="mt-1 rounded bg-white p-2.5 leading-snug">Our plans start at ₹499. Want the full catalogue?</p>
    </div>
  );
}

export function BroadcastFragment() {
  const rows = [["Sent", 120, 100], ["Delivered", 118, 98], ["Read", 74, 62]] as const;
  return (
    <div data-ui className={panel}>
      <p className="font-semibold">Diwali offer <span className="font-normal text-slate-700">· example</span></p>
      <div className="mt-3 space-y-2">
        {rows.map(([k, n, w]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-20 text-[14px] text-slate-700">{k}</span>
            <span className="h-2 flex-1 bg-white"><span className="block h-2 bg-[#25D366]" style={{ width: `${w}%` }} /></span>
            <span className="w-8 text-right font-semibold tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InboxFragment() {
  const rows = [["Priya", "What time do you close?", "Auto-replied"], ["Rahul", "Can I change my booking?", "With Meera"], ["Anita", "Thanks, got it", "Done"]];
  return (
    <div data-ui className={panel}>
      {rows.map(([n, m, s]) => (
        <div key={n} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white font-bold">{n[0]}</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{n}</span><span className="block truncate text-[14px] text-slate-700">{m}</span></span>
          <span className="shrink-0 text-[14px] font-semibold text-[#075E54]">{s}</span>
        </div>
      ))}
    </div>
  );
}

export function ConsentFragment() {
  return (
    <div data-ui className={panel}>
      <p className="font-semibold">+91 98•••• 4521</p>
      <ul className="mt-2 space-y-1.5">
        {[["Service messages", "agreed"], ["Promotions", "agreed"]].map(([k, v]) => (
          <li key={k} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#128C7E]" aria-hidden /><span className="flex-1">{k}</span><span className="text-slate-700">{v}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-[14px] text-slate-700">Recorded 12 Oct 2026, 4:12 PM · via your sign-up form</p>
    </div>
  );
}

/** The flow canvas, drawn small: the same blocks and lines as the editor. */
export function FlowFragment() {
  const box = "absolute w-[150px] rounded-md bg-white px-3 py-2 text-[14px] leading-tight text-slate-800";
  const tag = (t: string, c: string) => <span className={`mb-0.5 block text-[12px] font-bold ${c}`}>{t}</span>;
  return (
    <div data-ui className="relative mx-auto h-[420px] w-full max-w-[460px] bg-[#EFF4F1]" role="img" aria-label="A flow with a greeting, a name question, a buttons block and a saved lead">
      <svg className="absolute inset-0 h-full w-full" fill="none" stroke="#94a3b8" strokeWidth="2" aria-hidden>
        <path d="M80 56 V88" /><path d="M80 142 V176" /><path d="M80 238 V270" />
        <path d="M80 238 C80 262 250 250 250 286" />
      </svg>
      <div className={box} style={{ left: 8, top: 8 }}>{tag("Start", "text-emerald-700")}A customer says “book”</div>
      <div className={box} style={{ left: 8, top: 88 }}>{tag("Message", "text-sky-700")}Hi {"{{contact_name}}"}!</div>
      <div className={box} style={{ left: 8, top: 176 }}>{tag("Question · name", "text-amber-700")}What is your name?</div>
      <div className={box} style={{ left: 8, top: 270, width: 170 }}>{tag("Buttons", "text-violet-700")}What do you need?<span className="mt-1 flex gap-1"><span className="rounded bg-violet-100 px-1.5 py-0.5 text-[12px]">Pricing</span><span className="rounded bg-violet-100 px-1.5 py-0.5 text-[12px]">Demo</span></span></div>
      <div className={box} style={{ left: 176, top: 286 }}>{tag("Save lead", "text-green-700")}Name and answers saved</div>
      <div className={box} style={{ left: 176, top: 350 }}>{tag("Hand to a person", "text-pink-700")}Your team is flagged</div>
    </div>
  );
}
