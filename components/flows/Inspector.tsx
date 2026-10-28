"use client";

import { useRef } from "react";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { FLOW_LIMITS, VARIABLE_RE, type FlowNode, type NodeDataMap } from "@/lib/flows/types";
import type { FlowIssue } from "@/lib/flows/validate";
import { NODE_META, humanWait } from "./nodeMeta";

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 transition focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm";
const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500";
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={`text-[11px] tabular-nums ${value.length > max ? "font-bold text-rose-600" : "text-slate-400"}`}>{value.length}/{max}</span>;
}

/** A text area with variable chips that insert at the cursor. */
function TextField({ id, value, onChange, max, rows = 3, placeholder, variables }: { id: string; value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string; variables: string[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = ref.current;
    if (!el) return onChange(`${value}${token}`);
    const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length;
    onChange(value.slice(0, a) + token + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
  };
  return (
    <div>
      <textarea id={id} ref={ref} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${input} resize-y`} />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {variables.map((v) => (
          <button key={v} type="button" onClick={() => insert(`{{${v}}}`)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-[#25D366]/15 hover:text-[#128C7E]">
            + {v.replace(/_/g, " ")}
          </button>
        ))}
        <span className="ml-auto"><Counter value={value} max={max} /></span>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>;
}

interface Props {
  node: FlowNode;
  issues: FlowIssue[];
  /** Names of answers collected in the flow, for inserting into messages. */
  variables: string[];
  onChange: (data: any) => void;
  onDelete: () => void;
  onClose?: () => void;
  /** Where each output of this block goes, so it can be set from a list instead of by dragging. */
  links: { handle: string; label: string; target: string | null; optional?: boolean }[];
  targets: { id: string; label: string }[];
  onLink: (handle: string, target: string | null) => void;
}

export function Inspector({ node, issues, variables, onChange, onDelete, onClose, links, targets, onLink }: Props) {
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const d = node.data as any;
  const set = (patch: Record<string, unknown>) => onChange({ ...d, ...patch });
  const chips = [...new Set(["contact_name", ...variables])];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900">{meta.label}</h3>
          <p className="text-xs text-slate-500">{meta.help}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1.5" aria-label="Problems with this block">
          {issues.map((i, k) => (
            <li key={k} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ${i.level === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {i.message}
            </li>
          ))}
        </ul>
      )}

      {node.type === "start" && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Every conversation begins here. Set what starts it under <strong>Trigger</strong>, then connect this block to your first message.</p>}

      {node.type === "message" && (
        <>
          <div><label htmlFor="f-text" className={label}>Message</label><TextField id="f-text" value={d.text ?? ""} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.textMessage} rows={5} placeholder="Hi {{contact_name}}! Thanks for getting in touch." variables={chips} /></div>
          <div><label htmlFor="f-img" className={label}>Picture (optional)</label><input id="f-img" className={input} value={d.imageUrl ?? ""} placeholder="https://yourshop.com/offer.jpg" onChange={(e) => set({ imageUrl: e.target.value })} /><Hint>A public link. The message becomes the picture&apos;s caption.</Hint></div>
        </>
      )}

      {node.type === "buttons" && (() => {
        const dd = d as NodeDataMap["buttons"];
        return (
          <>
            <div><label htmlFor="f-text" className={label}>Question</label><TextField id="f-text" value={dd.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.interactiveBody} placeholder="What would you like to do?" variables={chips} /></div>
            <div>
              <div className="mb-1 flex items-center justify-between"><span className={label}>Buttons ({dd.buttons.length}/{FLOW_LIMITS.buttons})</span>
                {dd.buttons.length < FLOW_LIMITS.buttons && <button type="button" onClick={() => set({ buttons: [...dd.buttons, { id: uid("b"), title: "" }] })} className="inline-flex items-center gap-1 text-xs font-bold text-[#128C7E] hover:underline"><Plus className="h-3.5 w-3.5" /> Add</button>}
              </div>
              <div className="space-y-2">
                {dd.buttons.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <input aria-label={`Button ${i + 1} label`} className={input} value={b.title} maxLength={FLOW_LIMITS.buttonTitle + 10} placeholder={`Button ${i + 1}`} onChange={(e) => set({ buttons: dd.buttons.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x)) })} />
                    <Counter value={b.title} max={FLOW_LIMITS.buttonTitle} />
                    {dd.buttons.length > 1 && <button type="button" aria-label="Remove button" onClick={() => set({ buttons: dd.buttons.filter((x) => x.id !== b.id) })} className="rounded-lg p-2 text-rose-400 hover:bg-rose-50"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
              </div>
              <Hint>Each button gets its own connection on the block. Need more than 3 choices? Use a Menu.</Hint>
            </div>
            <div><label htmlFor="f-var" className={label}>Save the answer as (optional)</label><input id="f-var" className={input} value={dd.variable ?? ""} placeholder="interest" onChange={(e) => set({ variable: e.target.value.toLowerCase() })} />{dd.variable && !VARIABLE_RE.test(dd.variable) && <Hint>Lowercase letters, numbers and underscores only.</Hint>}</div>
          </>
        );
      })()}

      {node.type === "list" && (() => {
        const dd = d as NodeDataMap["list"];
        return (
          <>
            <div><label htmlFor="f-text" className={label}>Message above the menu</label><TextField id="f-text" value={dd.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.interactiveBody} placeholder="Which service do you need?" variables={chips} /></div>
            <div><label htmlFor="f-btn" className={label}>Menu button label</label><input id="f-btn" className={input} value={dd.buttonLabel} maxLength={FLOW_LIMITS.listButton + 10} onChange={(e) => set({ buttonLabel: e.target.value })} /><div className="mt-1 text-right"><Counter value={dd.buttonLabel} max={FLOW_LIMITS.listButton} /></div></div>
            <div>
              <div className="mb-1 flex items-center justify-between"><span className={label}>Options ({dd.rows.length}/{FLOW_LIMITS.listRows})</span>
                {dd.rows.length < FLOW_LIMITS.listRows && <button type="button" onClick={() => set({ rows: [...dd.rows, { id: uid("r"), title: "" }] })} className="inline-flex items-center gap-1 text-xs font-bold text-[#128C7E] hover:underline"><Plus className="h-3.5 w-3.5" /> Add</button>}
              </div>
              <div className="space-y-2">
                {dd.rows.map((r, i) => (
                  <div key={r.id} className="space-y-1.5 rounded-xl border border-slate-200 p-2.5">
                    <div className="flex items-center gap-2">
                      <input aria-label={`Option ${i + 1} title`} className={input} value={r.title} maxLength={FLOW_LIMITS.listRowTitle + 10} placeholder={`Option ${i + 1}`} onChange={(e) => set({ rows: dd.rows.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)) })} />
                      <Counter value={r.title} max={FLOW_LIMITS.listRowTitle} />
                      {dd.rows.length > 1 && <button type="button" aria-label="Remove option" onClick={() => set({ rows: dd.rows.filter((x) => x.id !== r.id) })} className="rounded-lg p-2 text-rose-400 hover:bg-rose-50"><X className="h-4 w-4" /></button>}
                    </div>
                    <input aria-label={`Option ${i + 1} description`} className={`${input} !py-2 text-xs`} value={r.description ?? ""} maxLength={FLOW_LIMITS.listRowDescription + 10} placeholder="Short description (optional)" onChange={(e) => set({ rows: dd.rows.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)) })} />
                  </div>
                ))}
              </div>
            </div>
            <div><label htmlFor="f-var" className={label}>Save the choice as (optional)</label><input id="f-var" className={input} value={dd.variable ?? ""} placeholder="service" onChange={(e) => set({ variable: e.target.value.toLowerCase() })} /></div>
          </>
        );
      })()}

      {node.type === "question" && (() => {
        const dd = d as NodeDataMap["question"];
        return (
          <>
            <div><label htmlFor="f-text" className={label}>Question</label><TextField id="f-text" value={dd.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.textMessage} placeholder="What's your name?" variables={chips} /></div>
            <div><label htmlFor="f-in" className={label}>What kind of answer?</label>
              <select id="f-in" className={input} value={dd.input} onChange={(e) => set({ input: e.target.value })}>
                <option value="text">Anything (free text)</option><option value="name">A name</option><option value="email">An email address</option><option value="phone">A phone number</option><option value="number">A number</option>
              </select>
              <Hint>ReplyKaro checks the answer. If it does not match, the customer is asked again instead of saving a wrong value.</Hint>
            </div>
            <div><label htmlFor="f-var" className={label}>Save the answer as</label><input id="f-var" className={input} value={dd.variable} placeholder="email" onChange={(e) => set({ variable: e.target.value.toLowerCase().replace(/\s+/g, "_") })} /><Hint>Use it later in a message with {"{{"}{dd.variable || "email"}{"}}"}. It is also saved with the lead.</Hint></div>
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700"><input type="checkbox" className="h-4 w-4 accent-[#25D366]" checked={!!dd.skippable} onChange={(e) => set({ skippable: e.target.checked })} /> Customer can type “skip”</label>
            <div><label htmlFor="f-retry" className={label}>Message if the answer is not valid (optional)</label><input id="f-retry" className={input} value={dd.retryText ?? ""} placeholder="Leave empty for a clear default" onChange={(e) => set({ retryText: e.target.value })} /></div>
            <div><label htmlFor="f-tries" className={label}>Ask again up to</label><select id="f-tries" className={input} value={dd.maxRetries ?? 2} onChange={(e) => set({ maxRetries: Number(e.target.value) })}>{Array.from({ length: FLOW_LIMITS.maxRetries + 1 }, (_, n) => <option key={n} value={n}>{n} time{n === 1 ? "" : "s"}</option>)}</select><Hint>After that the flow follows the “If they give up” connection, or ends politely.</Hint></div>
          </>
        );
      })()}

      {node.type === "location" && (
        <>
          <div><label htmlFor="f-text" className={label}>Message</label><TextField id="f-text" value={d.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.interactiveBody} variables={chips} /></div>
          <div><label htmlFor="f-var" className={label}>Save the location as</label><input id="f-var" className={input} value={d.variable} onChange={(e) => set({ variable: e.target.value.toLowerCase() })} /><Hint>The customer taps a button to share it. Saved as latitude,longitude, plus {d.variable || "location"}_name and {d.variable || "location"}_address when they include them.</Hint></div>
        </>
      )}

      {node.type === "condition" && (
        <>
          <div><label htmlFor="f-cv" className={label}>Check this answer</label>
            <select id="f-cv" className={input} value={d.variable} onChange={(e) => set({ variable: e.target.value })}>
              <option value="">Choose…</option>{variables.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div><label htmlFor="f-op" className={label}>It…</label>
            <select id="f-op" className={input} value={d.op} onChange={(e) => set({ op: e.target.value })}>
              <option value="equals">is exactly</option><option value="contains">contains</option><option value="exists">is filled in</option><option value="not_exists">is empty</option>
            </select>
          </div>
          {(d.op === "equals" || d.op === "contains") && <div><label htmlFor="f-cval" className={label}>Value</label><input id="f-cval" className={input} value={d.value ?? ""} onChange={(e) => set({ value: e.target.value })} /><Hint>Capital letters do not matter.</Hint></div>}
        </>
      )}

      {node.type === "wait" && (() => {
        const seconds: number = d.seconds || 0;
        const unit = seconds >= 3600 && seconds % 3600 === 0 ? 3600 : seconds >= 60 && seconds % 60 === 0 ? 60 : 1;
        return (
          <>
            <div className="flex gap-2">
              <div className="flex-1"><label htmlFor="f-wv" className={label}>Wait for</label><input id="f-wv" type="number" min={1} className={input} value={seconds / unit || ""} onChange={(e) => set({ seconds: Math.round(Number(e.target.value) * unit) })} /></div>
              <div className="w-32"><label htmlFor="f-wu" className={label}>Unit</label><select id="f-wu" className={input} value={unit} onChange={(e) => set({ seconds: Math.round((seconds / unit) * Number(e.target.value)) })}><option value={1}>seconds</option><option value={60}>minutes</option><option value={3600}>hours</option></select></div>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">The next message goes out {seconds ? `${humanWait(seconds)} later` : "after the wait"}.{seconds < 3 && " Short pauses make replies feel natural."}</p>
            <Hint>WhatsApp only allows these messages within 24 hours of the customer&apos;s last reply, so waits can be up to 23 hours.</Hint>
          </>
        );
      })()}

      {node.type === "tag" && <div><label htmlFor="f-tag" className={label}>Label</label><input id="f-tag" className={input} value={d.label} placeholder="interested" onChange={(e) => set({ label: e.target.value })} /><Hint>Added to the contact, so you can find and message this group later.</Hint></div>}

      {node.type === "lead" && (
        <>
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Saves everything collected so far (name, email, answers) as a lead you can see and download under <strong>Leads</strong>.</p>
          <div><label htmlFor="f-note" className={label}>Note (optional)</label><input id="f-note" className={input} value={d.note ?? ""} placeholder="Lead from website chat" onChange={(e) => set({ note: e.target.value })} /></div>
        </>
      )}

      {node.type === "handoff" && (
        <>
          <div><label htmlFor="f-text" className={label}>Tell the customer</label><TextField id="f-text" value={d.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.textMessage} variables={chips} /></div>
          <div><label htmlFor="f-note" className={label}>Note for your team (optional)</label><input id="f-note" className={input} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value })} /><Hint>The bot stops and the conversation is flagged for a person in your inbox.</Hint></div>
        </>
      )}

      {node.type === "webhook" && (
        <>
          <div><label htmlFor="f-wh" className={label}>Address to send to</label><input id="f-wh" type="url" inputMode="url" className={input} value={d.url} placeholder="https://hooks.zapier.com/hooks/catch/…" onChange={(e) => set({ url: e.target.value.trim() })} />
            <Hint>Paste the “webhook” address from Zapier, Make, n8n or your own system. It must start with https://.</Hint></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">What is sent</p>
            <p className="mt-1">The customer&apos;s number, name and every answer collected so far, as JSON. Example: <code className="rounded bg-white px-1">{`{"phone":"9198…","details":{"name":"Priya","email":"…"}}`}</code></p>
            <p className="mt-2">If your system is down, the conversation still continues.</p>
          </div>
        </>
      )}

      {node.type === "pay" && (
        <>
          <div><label htmlFor="f-text" className={label}>Message</label><TextField id="f-text" value={d.text} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.interactiveBody} variables={chips} placeholder="Your total is ₹499. Tap to pay." /></div>
          <div><label htmlFor="f-url" className={label}>Payment link</label><input id="f-url" type="url" inputMode="url" className={input} value={d.url} placeholder="https://rzp.io/l/your-link" onChange={(e) => set({ url: e.target.value.trim() })} />
            <Hint>Paste a link from your own payment provider: a Razorpay Payment Link, a PayU or Cashfree link, or a UPI payment page. The money goes straight to your account. ReplyKaro never touches it.</Hint></div>
          <div><label htmlFor="f-lbl" className={label}>Button label</label><div className="flex items-center gap-2"><input id="f-lbl" className={input} value={d.buttonLabel} maxLength={FLOW_LIMITS.buttonTitle + 10} onChange={(e) => set({ buttonLabel: e.target.value })} /><Counter value={d.buttonLabel ?? ""} max={FLOW_LIMITS.buttonTitle} /></div></div>
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">To know a customer paid, set your provider to notify you, or ask them to reply “paid” and use a Question block.</p>
        </>
      )}

      {node.type === "end" && <div><label htmlFor="f-text" className={label}>Closing message (optional)</label><TextField id="f-text" value={d.text ?? ""} onChange={(v) => set({ text: v })} max={FLOW_LIMITS.textMessage} variables={chips} /></div>}

      {links.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">What happens next</h4>
          <p className="mb-2 text-xs text-slate-500">Pick the next block here, or drag from the coloured dot on the block.</p>
          <div className="space-y-2">
            {links.map((l) => (
              <label key={l.handle} className="block">
                <span className="mb-0.5 block text-sm font-semibold text-slate-800">{l.label}{l.optional && <span className="font-normal text-slate-500"> (optional)</span>}</span>
                <select value={l.target ?? ""} onChange={(e) => onLink(l.handle, e.target.value || null)}
                  className={`w-full rounded-xl border bg-white px-3 py-2.5 text-base transition focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm ${!l.target && !l.optional ? "border-amber-400" : "border-slate-200"}`}>
                  <option value="">{l.optional ? "Nothing, end the conversation" : "Choose the next block…"}</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {node.type !== "start" && (
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50">
          <Trash2 className="h-4 w-4" aria-hidden /> Delete this block
        </button>
      )}
    </div>
  );
}
