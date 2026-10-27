"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { buildChatLink } from "@/lib/whatsapp/chat-link";

const PRESETS = [
  { label: "Say hello", text: "Hi! I would like to know more." },
  { label: "Get a price", text: "Hi, please share the price list." },
  { label: "Book a visit", text: "Hi, I would like to book an appointment." },
  { label: "Order", text: "Hi, I would like to place an order." },
];

export function LinksClient({ phoneNumber, businessName }: { phoneNumber: string | null; businessName: string | null }) {
  const [message, setMessage] = useState(PRESETS[0].text);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const link = buildChatLink(phoneNumber, message);

  useEffect(() => {
    if (!link) { setQr(null); return; }
    let cancelled = false;
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [link]);

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  }

  if (!phoneNumber) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Connect WhatsApp first</h1>
        <p className="mt-2 text-sm text-slate-600">Your chat link and QR code use your WhatsApp Business number.</p>
        <Link href="/wa/connect" className="mt-5 inline-block rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851]">Connect WhatsApp</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Chat link &amp; QR code</h1>
        <p className="mt-1 text-sm text-slate-500">Let customers start a WhatsApp chat with {businessName ?? "your business"} in one tap. Put the link on your website, Instagram bio or ads, and print the QR code on posters, bills or shop windows.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 sm:p-6">
          <div>
            <label htmlFor="prefill" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Message customers start with</label>
            <textarea id="prefill" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-base font-medium focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 sm:text-sm" />
            <p className="mt-1 text-xs text-slate-500">This text is typed for them. They can edit it before sending. It also helps your automations: start it with a keyword like “price” to trigger the right reply.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setMessage(p.text)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">{p.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Your link</p>
            <div className="break-all rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">{link}</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1DA851]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
              </button>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                  Test it <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 text-center sm:p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">QR code</p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code that opens a WhatsApp chat" className="mx-auto h-64 w-64 rounded-2xl border border-slate-100" />
          ) : (
            <div className="mx-auto h-64 w-64 animate-pulse rounded-2xl bg-slate-100" />
          )}
          <p className="mt-3 text-xs text-slate-500">Customers scan it with their phone camera. Test it before printing.</p>
          {qr && (
            <a href={qr} download="whatsapp-chat-qr.png" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
              <Download className="h-4 w-4" /> Download PNG
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
