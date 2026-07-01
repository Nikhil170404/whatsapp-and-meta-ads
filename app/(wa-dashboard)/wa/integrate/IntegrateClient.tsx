"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, Code2, Zap, ShoppingCart, Calendar, AlertCircle, Eye, EyeOff } from "lucide-react";

const BASE_URL = "https://replykaro.com";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-xs overflow-x-auto leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

const USE_CASES = [
  {
    icon: ShoppingCart,
    label: "E-commerce Order",
    color: "bg-orange-50 border-orange-100 text-orange-600",
    description: "Send order confirmation with details when a purchase is made.",
    snippet: (key: string) =>
`curl -X POST ${BASE_URL}/api/v1/send \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "template": "order_confirmed",
    "params": ["Rahul", "#ORD-1234", "₹1,499"]
  }'`,
  },
  {
    icon: Calendar,
    label: "Appointment Reminder",
    color: "bg-blue-50 border-blue-100 text-blue-600",
    description: "Remind patients/clients 24 hours before their appointment.",
    snippet: (key: string) =>
`curl -X POST ${BASE_URL}/api/v1/send \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "template": "appointment_reminder",
    "params": ["Dr. Sharma", "Tomorrow at 10:30 AM"]
  }'`,
  },
  {
    icon: Zap,
    label: "Simple Text Alert",
    color: "bg-green-50 border-green-100 text-green-600",
    description: "Send a plain text message (no template needed).",
    snippet: (key: string) =>
`curl -X POST ${BASE_URL}/api/v1/send \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "type": "text",
    "text": "Hello from your store! Your item is ready for pickup."
  }'`,
  },
];

const CODE_SNIPPETS = {
  curl: (key: string) =>
`curl -X POST ${BASE_URL}/api/v1/send \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "template": "your_template_name",
    "params": ["param1", "param2"],
    "language": "en_US"
  }'`,

  javascript: (key: string) =>
`const response = await fetch("${BASE_URL}/api/v1/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    phone: "+919876543210",
    template: "your_template_name",
    params: ["param1", "param2"],
    language: "en_US",
  }),
});

const data = await response.json();
console.log(data); // { success: true, message_id: "wamid.xxx" }`,

  node: (key: string) =>
`const axios = require("axios");

async function sendWhatsApp(phone, templateName, params) {
  const { data } = await axios.post(
    "${BASE_URL}/api/v1/send",
    { phone, template: templateName, params, language: "en_US" },
    { headers: { Authorization: "Bearer ${key}" } }
  );
  return data;
}

// Usage
sendWhatsApp("+919876543210", "order_confirmed", ["Rahul", "#1234", "₹999"]);`,

  php: (key: string) =>
`<?php
$ch = curl_init("${BASE_URL}/api/v1/send");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => [
    "Authorization: Bearer ${key}",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "phone"    => "+919876543210",
    "template" => "order_confirmed",
    "params"   => ["Rahul", "#1234", "₹999"],
    "language" => "en_US",
  ]),
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);
var_dump($result);`,

  python: (key: string) =>
`import requests

def send_whatsapp(phone, template, params, language="en_US"):
    r = requests.post(
        "${BASE_URL}/api/v1/send",
        headers={"Authorization": "Bearer ${key}"},
        json={"phone": phone, "template": template, "params": params, "language": language},
    )
    r.raise_for_status()
    return r.json()

# Usage
send_whatsapp("+919876543210", "order_confirmed", ["Rahul", "#1234", "₹999"])`,
};

type Lang = keyof typeof CODE_SNIPPETS;

export function IntegrateClient({ initialKey, lastUsed }: { initialKey: string | null; lastUsed: string | null }) {
  const [apiKey, setApiKey] = useState<string | null>(initialKey);
  const [generating, setGenerating] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("curl");
  const [activeUseCase, setActiveUseCase] = useState(0);

  const displayKey = apiKey ?? "rk_live_••••••••••••••••••••••••••••••••";
  const maskedKey = apiKey ? `rk_live_${"•".repeat(32)}` : displayKey;

  const generateKey = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate key");
      setApiKey(data.key.api_key);
      setKeyVisible(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const LANGS: { id: Lang; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "javascript", label: "JavaScript" },
    { id: "node", label: "Node.js" },
    { id: "php", label: "PHP" },
    { id: "python", label: "Python" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Website Integration</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">Connect your website, app, or backend to WhatsApp in minutes.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* API Key Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Your API Key</h2>
            <p className="text-xs text-slate-400 font-medium">Keep this secret — treat it like a password</p>
          </div>
        </div>

        {apiKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm text-slate-700 truncate">
                {keyVisible ? apiKey : maskedKey}
              </div>
              <button onClick={() => setKeyVisible(!keyVisible)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={copyKey} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                {keyCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {lastUsed && (
              <p className="text-xs text-slate-400 font-medium">
                Last used: {new Date(lastUsed).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}

            <button
              onClick={generateKey}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating…" : "Regenerate Key"}
            </button>
            <p className="text-xs text-amber-600 font-medium">⚠ Regenerating invalidates the current key immediately.</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm font-medium mb-4">No API key yet. Generate one to get started.</p>
            <button
              onClick={generateKey}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-60 transition-all mx-auto"
            >
              <Code2 className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Generating…" : "Generate API Key"}
            </button>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-[#25D366]/5 to-emerald-50 border border-[#25D366]/20 rounded-[2rem] p-6 md:p-8">
        <h2 className="text-base font-black text-slate-900 mb-4">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Generate API key", body: "Click \"Generate API Key\" above to get your unique key." },
            { step: "2", title: "Add to your code", body: "Call POST /api/v1/send from your backend with the phone number and template name." },
            { step: "3", title: "Messages sent!", body: "ReplyKaro looks up your WhatsApp connection and sends the message instantly." },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#25D366] text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{step}</div>
              <div>
                <p className="text-sm font-bold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Reference */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
        <h2 className="text-base font-black text-slate-900 mb-1">API Reference</h2>
        <p className="text-xs text-slate-400 font-medium mb-5">
          <span className="bg-slate-100 px-2 py-0.5 rounded-lg font-mono text-slate-600">POST {BASE_URL}/api/v1/send</span>
        </p>

        {/* Request body reference */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-xs font-mono text-slate-700 space-y-1.5">
          <div><span className="text-slate-400">// Required</span></div>
          <div><span className="text-violet-600">"phone"</span>: <span className="text-green-600">"+919876543210"</span>  <span className="text-slate-400">// with country code</span></div>
          <div className="mt-2"><span className="text-slate-400">// Template message (approved Meta template)</span></div>
          <div><span className="text-violet-600">"template"</span>: <span className="text-green-600">"order_confirmed"</span></div>
          <div><span className="text-violet-600">"params"</span>: <span className="text-orange-500">["Rahul", "#1234", "₹999"]</span>  <span className="text-slate-400">// fills {`{{1}}`} {`{{2}}`} {`{{3}}`}</span></div>
          <div><span className="text-violet-600">"language"</span>: <span className="text-green-600">"en_US"</span>  <span className="text-slate-400">// optional, default en_US</span></div>
          <div className="mt-2"><span className="text-slate-400">// OR simple text (no template needed)</span></div>
          <div><span className="text-violet-600">"type"</span>: <span className="text-green-600">"text"</span></div>
          <div><span className="text-violet-600">"text"</span>: <span className="text-green-600">"Your message here"</span></div>
        </div>

        {/* Language tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          {LANGS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveLang(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeLang === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <CodeBlock code={CODE_SNIPPETS[activeLang](apiKey ?? "YOUR_API_KEY")} lang={activeLang} />

        {/* Response */}
        <div className="mt-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Response</p>
          <CodeBlock code={`// Success (200)
{ "success": true, "message_id": "wamid.HBgNOTkxNzA..." }

// Error (4xx / 5xx)
{ "error": "No active WhatsApp connection found for this API key." }`} />
        </div>
      </div>

      {/* Use case examples */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
        <h2 className="text-base font-black text-slate-900 mb-5">Common Use Cases</h2>
        <div className="flex gap-2 flex-wrap mb-5">
          {USE_CASES.map((uc, i) => (
            <button
              key={i}
              onClick={() => setActiveUseCase(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activeUseCase === i ? `${uc.color} border-current` : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <uc.icon className="w-3.5 h-3.5" />
              {uc.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500 font-medium mb-4">{USE_CASES[activeUseCase].description}</p>
        <CodeBlock code={USE_CASES[activeUseCase].snippet(apiKey ?? "YOUR_API_KEY")} />
      </div>

      {/* Webhook guide */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
        <h2 className="text-base font-black text-slate-900 mb-2">Webhook (Incoming Messages)</h2>
        <p className="text-sm text-slate-500 font-medium mb-5">
          To receive incoming WhatsApp messages on your server, configure a webhook URL in your Meta App.
        </p>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-slate-700">{BASE_URL}/api/webhooks/whatsapp</code>
              <button
                onClick={() => navigator.clipboard.writeText(`${BASE_URL}/api/webhooks/whatsapp`)}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
          <ol className="space-y-3 text-sm text-slate-600 font-medium">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Go to <strong>Meta Developer Dashboard</strong> → Your App → WhatsApp → Configuration</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Set the Callback URL to the webhook URL above and Verify Token to your token from Connect page</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Subscribe to <strong>messages</strong> and <strong>message_deliveries</strong> fields</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
              <span>Click Verify & Save — ReplyKaro's automation engine will now process incoming messages</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Rate limits */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
        <p className="text-sm font-bold text-amber-800 mb-1">Rate Limits</p>
        <p className="text-xs text-amber-700 font-medium">
          The API allows <strong>100 requests per minute</strong> per API key. This matches Meta&apos;s own messaging throughput limits.
          For high-volume sends, use the Broadcasts feature instead — it handles queuing automatically.
        </p>
      </div>

      {/* Meta Policy Compliance Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-black text-blue-900">Meta WhatsApp Messaging Policy — Required for API Use</p>
        <div className="space-y-2 text-xs text-blue-800 font-medium">
          <p>
            <span className="font-black">1. Opt-in required.</span> You must obtain explicit consent from each phone number before sending any WhatsApp message via this API.
            Add a WhatsApp opt-in checkbox on your website, order form, or sign-up page. Store the consent timestamp.
          </p>
          <p>
            <span className="font-black">2. Templates only for outbound messages.</span> If you are initiating a conversation (the customer has not messaged you in the last 24 hours), you must use an approved Meta template. Sending free-text outside the 24-hour window will be rejected by Meta.
          </p>
          <p>
            <span className="font-black">3. Honour opt-outs.</span> If a customer replies <span className="font-mono bg-blue-100 px-1 rounded">STOP</span>, you must never message them again until they re-subscribe. ReplyKaro automatically blocks opted-out contacts from receiving broadcasts.
          </p>
          <p>
            <span className="font-black">4. No prohibited content.</span> Do not send spam, adult content, weapons, gambling promotions, or misleading offers. Your account will be banned by Meta if reports exceed quality thresholds.
          </p>
          <p>
            <span className="font-black">5. Daily limits.</span> New numbers are limited to 1,000 unique recipients per day (Tier 1). This limit is enforced by Meta, not by ReplyKaro.
          </p>
        </div>
        <a
          href="https://www.whatsapp.com/legal/business-policy/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 underline"
        >
          Read the full Meta WhatsApp Business Messaging Policy →
        </a>
      </div>
    </div>
  );
}
