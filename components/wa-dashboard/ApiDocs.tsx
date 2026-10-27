"use client";

import { useState } from "react";
import { Bot, Check, Copy } from "lucide-react";

const ENDPOINTS = [
  ["GET", "/api/v1/status", "Connection, quality rating, daily limit, plan"],
  ["POST", "/api/v1/send", "Send a text, template or OTP code"],
  ["GET · POST · PATCH", "/api/v1/contacts", "List, add (consent required), opt out or in"],
  ["GET · POST", "/api/v1/templates", "List and create templates (checked, then sent to Meta)"],
  ["GET · POST", "/api/v1/automations", "List and create auto-replies and menus"],
  ["PATCH · DELETE", "/api/v1/automations/{id}", "Turn on or off, edit, delete"],
  ["GET · POST", "/api/v1/broadcasts", "List; create a draft (add ?preview=true to preview first)"],
  ["POST", "/api/v1/broadcasts/{id}/send", "Send a draft broadcast"],
  ["GET", "/api/v1/messages", "Recent messages, optionally ?phone=…"],
];

function Copyable({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 pr-12 text-xs leading-relaxed text-slate-100"><code>{code}</code></pre>
      <button type="button" aria-label="Copy"
        onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } }}
        className="absolute right-3 top-3 rounded-lg bg-slate-700 p-2 text-slate-200 hover:bg-slate-600">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function ApiDocs({ baseUrl, apiKey }: { baseUrl: string; apiKey: string | null }) {
  const key = apiKey ?? "YOUR_API_KEY";
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Bot className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Use with AI assistants (MCP)</h2>
            <p className="text-xs text-slate-500">Let an assistant manage WhatsApp for you: reply setup, templates, contacts, broadcasts.</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Connect any MCP-compatible assistant to this address, using your API key as a bearer token. It can do everything in the dashboard.
          Sending a message or a broadcast always names the real recipients, and broadcasts need an explicit confirmation before anything is sent.
        </p>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Server address</p>
        <Copyable code={`${baseUrl}/api/mcp`} />
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Claude Code</p>
        <Copyable code={`claude mcp add --transport http replykaro ${baseUrl}/api/mcp \\\n  --header "Authorization: Bearer ${key}"`} />
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Other clients (JSON)</p>
        <Copyable code={JSON.stringify({ mcpServers: { replykaro: { type: "http", url: `${baseUrl}/api/mcp`, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)} />
        <ul className="mt-5 list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li>The key gives full access to your account. Never paste it into a public place. Regenerating it disconnects every assistant using it.</li>
          <li>Messages customers send you can contain instructions. Assistants are told to treat them as data, but review what an assistant plans to send.</li>
          <li>Needs a paid plan.</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8">
        <h2 className="text-lg font-bold text-slate-900">REST API</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">Every endpoint takes <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">Authorization: Bearer {key.length > 20 ? "rk_live_…" : key}</code> and returns JSON. Errors carry a plain-language <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">error</code> and a machine-readable <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">code</code>.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><th className="py-2 pr-4">Method</th><th className="py-2 pr-4">Path</th><th className="py-2">What it does</th></tr></thead>
            <tbody>
              {ENDPOINTS.map(([m, p, d]) => (
                <tr key={p} className="border-b border-slate-50 align-top">
                  <td className="py-2.5 pr-4 text-xs font-bold text-slate-500 whitespace-nowrap">{m}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-800 whitespace-nowrap">{p}</td>
                  <td className="py-2.5 text-slate-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
