"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Megaphone, Plus, Receipt, Wand2, X } from "lucide-react";
import {
  applyFix, bodyVariables, defaultExamples, TEMPLATE_LIMITS, toMetaName, validateTemplate,
  type TemplateButton, type TemplateCategory, type TemplateInput,
} from "@/lib/whatsapp/template-builder";

const LANGUAGES = [
  { value: "en_US", label: "English" }, { value: "hi", label: "Hindi" }, { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" }, { value: "ta", label: "Tamil" }, { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" }, { value: "kn", label: "Kannada" },
];

type Kind = "UTILITY" | "MARKETING" | "OTP";

const KINDS: { kind: Kind; title: string; desc: string; icon: typeof Receipt; example: string }[] = [
  { kind: "UTILITY", title: "Updates", desc: "Orders, bookings, reminders, receipts", icon: Receipt, example: "Your order #123 has shipped" },
  { kind: "MARKETING", title: "Promotions", desc: "Offers, launches, announcements", icon: Megaphone, example: "Flat 20% off this weekend" },
  { kind: "OTP", title: "Verification code (OTP)", desc: "Login and signup codes, sent by API", icon: KeyRound, example: "123456 is your verification code" },
];

export interface EditorInitial {
  name?: string;
  category?: string;
  body_text?: string;
}

interface Props {
  initial?: EditorInitial;
  onCancel: () => void;
  onCreated: (template: any, metaError: string | null) => void;
}

const field = "w-full px-4 py-3 rounded-xl border border-slate-200 text-base sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]";
const label = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

export function TemplateEditor({ initial, onCancel, onCreated }: Props) {
  const startKind: Kind = initial?.category === "MARKETING" ? "MARKETING" : initial?.category === "AUTHENTICATION" ? "OTP" : "UTILITY";
  const [kind, setKind] = useState<Kind>(startKind);
  const [name, setName] = useState(initial?.name ?? "");
  const [language, setLanguage] = useState("en_US");
  const [header, setHeader] = useState("");
  const [body, setBody] = useState(initial?.body_text ?? "");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [expiry, setExpiry] = useState(10);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const category: TemplateCategory = kind === "OTP" ? "AUTHENTICATION" : kind;
  const varCount = new Set(bodyVariables(body)).size;
  const exampleValues = useMemo(() => {
    const d = defaultExamples(body);
    return Array.from({ length: varCount }, (_, i) => examples[i] ?? d[i] ?? "");
  }, [examples, body, varCount]);

  const input: TemplateInput = {
    name, category, language, header_text: header || undefined, body_text: body,
    footer_text: footer || undefined, buttons, examples: exampleValues,
  };
  const issues = useMemo(() => validateTemplate(input), [name, category, language, header, body, footer, buttons, exampleValues]); // eslint-disable-line react-hooks/exhaustive-deps
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const insertVariable = () => setBody((b) => `${b}${b && !/\s$/.test(b) ? " " : ""}{{${varCount + 1}}}`);

  const previewBody = body.replace(/\{\{(\d+)\}\}/g, (_m, n) => exampleValues[Number(n) - 1] || `{{${n}}}`);

  async function submit() {
    setTouched(true);
    if (errors.length) return;
    setSaving(true);
    setServerError(null);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toMetaName(name), category, language,
          template_type: kind === "OTP" ? "otp" : "standard",
          header_text: header || undefined, body_text: body, footer_text: footer || undefined,
          buttons, examples: exampleValues, expiry_minutes: expiry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the template.");
      onCreated(data.template, data.meta_error ?? null);
    } catch (e: any) {
      setServerError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const setButton = (i: number, b: TemplateButton) => setButtons((arr) => arr.map((x, j) => (j === i ? b : x)));
  const addButton = (type: TemplateButton["type"]) =>
    setButtons((arr) => [...arr, type === "QUICK_REPLY" ? { type, text: "" } : type === "URL" ? { type, text: "", url: "https://" } : { type, text: "", phone_number: "+91" }]);

  const shown = (f: string) => issues.filter((i) => i.field === f && (touched || i.level === "warning" || f === "body" || f === "header" || f === "footer" || f === "buttons"));

  return (
    <div className="bg-white rounded-3xl border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-5 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">New message template</h2>
        <button onClick={onCancel} aria-label="Close" className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 min-w-0">
          {/* Step 1: purpose */}
          <section>
            <p className={label}>1. What is this message for?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {KINDS.map(({ kind: k, title, desc, icon: Icon, example }) => (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                  className={`text-left p-4 rounded-2xl border-2 transition ${kind === k ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}>
                  <Icon className={`w-5 h-5 mb-2 ${kind === k ? "text-[#128C7E]" : "text-slate-400"}`} aria-hidden />
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  <p className="text-[11px] text-slate-400 mt-2 italic">“{example}”</p>
                </button>
              ))}
            </div>
            {kind === "MARKETING" && (
              <p className="mt-2 text-xs text-slate-500">Promotions are billed at Meta&apos;s higher marketing rate and are only sent to contacts who agreed to promotions.</p>
            )}
          </section>

          {/* Step 2: basics */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className={label}>2. Template name</label>
              <input id="tpl-name" className={field} placeholder="e.g. order shipped" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">
                {name.trim() ? <>Saved as <code className="font-mono">{toMetaName(name) || "…"}</code>. Only you see this name.</> : "Only you see this name. We format it for Meta automatically."}
              </p>
              {touched && shown("name").map((i) => <p key={i.message} className="text-xs font-semibold text-rose-600 mt-1">{i.message}</p>)}
            </div>
            <div>
              <label htmlFor="tpl-lang" className={label}>Language</label>
              <select id="tpl-lang" className={`${field} bg-white`} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <p className="text-xs text-slate-500 mt-1">Write the message in this language. Meta does not translate it.</p>
            </div>
          </section>

          {kind === "OTP" ? (
            <section className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Meta provides the wording for verification messages, so there is nothing to write. The message reads
                <strong className="text-slate-900"> “&lt;code&gt; is your verification code.”</strong> and includes a button to copy the code.
              </div>
              <div>
                <label htmlFor="tpl-expiry" className={label}>Code expires after (minutes)</label>
                <input id="tpl-expiry" type="number" min={TEMPLATE_LIMITS.expiryMin} max={TEMPLATE_LIMITS.expiryMax} className={`${field} sm:w-40`} value={expiry}
                  onChange={(e) => setExpiry(Math.min(TEMPLATE_LIMITS.expiryMax, Math.max(TEMPLATE_LIMITS.expiryMin, Number(e.target.value) || 10)))} />
                <p className="text-xs text-slate-500 mt-1">Between 1 and 90. Shown to the customer in the message footer.</p>
              </div>
            </section>
          ) : (
            <>
              <section>
                <label htmlFor="tpl-header" className={label}>Header <span className="font-medium normal-case text-slate-400">(optional)</span></label>
                <input id="tpl-header" className={field} maxLength={TEMPLATE_LIMITS.header + 20} placeholder="A short title in bold" value={header} onChange={(e) => setHeader(e.target.value)} />
                {shown("header").map((i) => <p key={i.message} className="text-xs font-semibold text-rose-600 mt-1">{i.message}</p>)}
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="tpl-body" className="text-xs font-bold text-slate-500 uppercase tracking-wider">3. Message</label>
                  <button type="button" onClick={insertVariable} className="inline-flex items-center gap-1 text-xs font-bold text-[#128C7E] hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add a changing value {`{{${varCount + 1}}}`}
                  </button>
                </div>
                <textarea id="tpl-body" rows={6} className={`${field} resize-y`} placeholder="Hi {{1}}, your order {{2}} has shipped and will arrive by {{3}}. Thank you for shopping with us!"
                  value={body} onChange={(e) => setBody(e.target.value)} />
                <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                  <span>Changing values like a name or order number are written {`{{1}}`}, {`{{2}}`}… in order.</span>
                  <span className={body.length > TEMPLATE_LIMITS.body ? "font-bold text-rose-600" : ""}>{body.length}/{TEMPLATE_LIMITS.body}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {shown("body").map((i) => (
                    <li key={i.message} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ${i.level === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                      <span className="flex-1">{i.message}</span>
                      {i.fix && (
                        <button type="button" onClick={() => setBody((b) => applyFix(b, i.fix!))} className="inline-flex items-center gap-1 font-bold underline shrink-0">
                          <Wand2 className="w-3 h-3" aria-hidden /> Fix it
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {varCount > 0 && (
                <section>
                  <p className={label}>Sample values</p>
                  <p className="text-xs text-slate-500 mb-3">Meta reviews your template using an example for each changing value. Use realistic ones. These are not sent to customers.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {exampleValues.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs font-mono text-slate-500">{`{{${i + 1}}}`}</span>
                        <input aria-label={`Sample value for variable ${i + 1}`} className={field} value={v}
                          onChange={(e) => setExamples((arr) => { const n = [...exampleValues]; n[i] = e.target.value; return n.length ? n : arr; })} />
                      </div>
                    ))}
                  </div>
                  {touched && shown("examples").map((i) => <p key={i.message} className="text-xs font-semibold text-rose-600 mt-1">{i.message}</p>)}
                </section>
              )}

              <section>
                <label htmlFor="tpl-footer" className={label}>Footer <span className="font-medium normal-case text-slate-400">(optional)</span></label>
                <input id="tpl-footer" className={field} placeholder={kind === "MARKETING" ? "Reply STOP to unsubscribe" : "Thank you for choosing us"} value={footer} onChange={(e) => setFooter(e.target.value)} />
                {shown("footer").map((i) => (
                  <p key={i.message} className={`text-xs font-semibold mt-1 ${i.level === "error" ? "text-rose-600" : "text-amber-700"}`}>{i.message}</p>
                ))}
                {kind === "MARKETING" && !footer && (
                  <button type="button" onClick={() => setFooter("Reply STOP to unsubscribe")} className="mt-1 text-xs font-bold text-[#128C7E] hover:underline">Use “Reply STOP to unsubscribe”</button>
                )}
              </section>

              <section>
                <p className={label}>Buttons <span className="font-medium normal-case text-slate-400">(optional)</span></p>
                <div className="space-y-2">
                  {buttons.map((b, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-20 shrink-0">
                          {b.type === "QUICK_REPLY" ? "Reply" : b.type === "URL" ? "Link" : "Call"}
                        </span>
                        <input aria-label="Button label" className={field} maxLength={TEMPLATE_LIMITS.buttonText + 10} placeholder="Button label" value={b.text} onChange={(e) => setButton(i, { ...b, text: e.target.value })} />
                        <button type="button" aria-label="Remove button" onClick={() => setButtons((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                      {b.type === "URL" && <input aria-label="Button web address" className={field} placeholder="https://yourstore.com/orders" value={b.url} onChange={(e) => setButton(i, { ...b, url: e.target.value })} />}
                      {b.type === "PHONE_NUMBER" && <input aria-label="Button phone number" className={field} placeholder="+919876543210" value={b.phone_number} onChange={(e) => setButton(i, { ...b, phone_number: e.target.value })} />}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([["QUICK_REPLY", "+ Quick reply"], ["URL", "+ Website link"], ["PHONE_NUMBER", "+ Call button"]] as const).map(([t, l]) => (
                    <button key={t} type="button" onClick={() => addButton(t)} disabled={buttons.length >= TEMPLATE_LIMITS.buttons}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">{l}</button>
                  ))}
                </div>
                {shown("buttons").map((i) => <p key={i.message} className="text-xs font-semibold text-rose-600 mt-1">{i.message}</p>)}
              </section>
            </>
          )}

          {serverError && <p role="alert" className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{serverError}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onCancel} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700">Cancel</button>
            <button type="button" onClick={submit} disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : errors.length === 0 ? <CheckCircle2 className="w-4 h-4" /> : null}
              {saving ? "Submitting..." : "Submit to Meta for approval"}
            </button>
            {touched && errors.length > 0 && <span className="text-xs font-semibold text-rose-600">Fix {errors.length} issue{errors.length > 1 ? "s" : ""} above first.</span>}
          </div>
          <p className="text-xs text-slate-500">Meta usually reviews templates within minutes and up to 24 hours. You can only send an approved template.</p>
        </div>

        {/* Live preview */}
        <aside aria-label="Message preview" className="lg:sticky lg:top-6 self-start">
          <p className={label}>Preview</p>
          <div className="rounded-2xl bg-[#ECE5DD] p-4">
            <div className="max-w-[280px] rounded-xl rounded-tl-sm bg-white p-3 shadow-sm">
              {kind === "OTP" ? (
                <>
                  <p className="text-sm text-slate-800"><strong>123456</strong> is your verification code. For your security, do not share this code.</p>
                  <p className="mt-1 text-[11px] text-slate-400">This code expires in {expiry} minutes.</p>
                  <div className="mt-3 border-t border-slate-100 pt-2 text-center text-sm font-semibold text-sky-600">Copy code</div>
                </>
              ) : (
                <>
                  {header && <p className="mb-1 text-sm font-bold text-slate-900">{header}</p>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{previewBody || <span className="text-slate-400">Your message appears here as you type.</span>}</p>
                  {footer && <p className="mt-1 text-[11px] text-slate-400">{footer}</p>}
                  {buttons.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {buttons.map((b, i) => <div key={i} className="text-center text-sm font-semibold text-sky-600">{b.text || "Button"}</div>)}
                    </div>
                  )}
                </>
              )}
              <p className="mt-1 text-right text-[10px] text-slate-400">12:00 PM</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs" aria-live="polite">
            {errors.length === 0 ? (
              <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Ready to submit</p>
            ) : (
              <p className="flex items-center gap-1.5 font-semibold text-rose-600"><AlertTriangle className="w-3.5 h-3.5" aria-hidden /> {errors.length} thing{errors.length > 1 ? "s" : ""} to fix</p>
            )}
            {warnings.length > 0 && <p className="text-amber-700">{warnings.length} suggestion{warnings.length > 1 ? "s" : ""}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
