"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { bodyVariables } from "@/lib/whatsapp/template-builder";

export interface SendableTemplate {
  id: string;
  name: string;
  language: string;
  body_text: string | null;
  category: string;
}

/**
 * Shown when the customer's 24-hour window is closed. WhatsApp only allows an
 * approved template then, so the composer is replaced by a template picker.
 */
export function TemplateSender({
  phone, contactName, templates, onSent,
}: { phone: string; contactName?: string | null; templates: SendableTemplate[]; onSent: (preview: string, messageId: string | null) => void }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [values, setValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const count = useMemo(() => new Set(bodyVariables(template?.body_text ?? "")).size, [template]);
  // Variable 1 is almost always the customer's name, so pre-fill it.
  const filled = Array.from({ length: count }, (_, i) => values[i] ?? (i === 0 ? contactName ?? "" : ""));
  const preview = (template?.body_text ?? "").replace(/\{\{(\d+)\}\}/g, (_m, n) => filled[Number(n) - 1] || `{{${n}}}`);
  const missing = filled.some((v) => !v.trim());

  async function send() {
    if (!template || missing) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, template: template.name, params: filled, language: template.language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the template.");
      onSent(preview, data.message_id ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900">
        This customer last wrote more than 24 hours ago, so WhatsApp only allows an approved template message. If they reply, you can chat freely again.
      </div>
      {templates.length === 0 ? (
        <p className="text-sm text-slate-600">
          You have no approved templates yet. <a href="/wa/templates" className="font-bold text-[#128C7E] underline">Create one</a> and wait for Meta to approve it.
        </p>
      ) : (
        <>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="tpl-pick">Template</label>
          <select id="tpl-pick" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues([]); }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium sm:text-sm">
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.category === "MARKETING" ? " (promotion)" : ""}</option>)}
          </select>
          {count > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {filled.map((v, i) => (
                <input key={i} aria-label={`Value for {{${i + 1}}}`} placeholder={`Value for {{${i + 1}}}`} value={v}
                  onChange={(e) => setValues((arr) => { const n = [...filled]; n[i] = e.target.value; return n.length ? n : arr; })}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-base sm:text-sm" />
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">{preview}</div>
          {error && <p role="alert" className="text-xs font-bold text-rose-600">{error}</p>}
          <button type="button" onClick={send} disabled={sending || missing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851] disabled:opacity-50 sm:w-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send template
          </button>
          {template?.category === "MARKETING" && <p className="text-[11px] text-slate-500">Promotions are billed by Meta at its marketing rate and only go to people who agreed to promotions.</p>}
        </>
      )}
    </div>
  );
}
