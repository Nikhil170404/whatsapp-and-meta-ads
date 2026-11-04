"use client";

import { useCallback, useEffect, useState } from "react";

interface Link { link_id: string; com_url: string; status: string; linked_at: string; last_push_at: string | null; last_error: string | null }

export function UnifiedLinkClient() {
  const [link, setLink] = useState<Link | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [address, setAddress] = useState("https://www.replykaro.com/api/webhooks/wa-bridge");
  const [linkId, setLinkId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/bridge/link");
    if (r.ok) { const j = await r.json(); setLink(j.link); setWaiting(j.waiting || 0); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/bridge/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, linkId, secret }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Could not connect"); return; }
    setSecret(""); setLinkId(""); setMsg("Connected. New WhatsApp messages now appear in ReplyKaro Unified."); load();
  }
  async function disconnect() {
    if (!confirm("Disconnect from ReplyKaro Unified? WhatsApp keeps working here.")) return;
    await fetch("/api/bridge/link", { method: "DELETE" }); load();
  }

  const box = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#128C7E]";
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Connect to ReplyKaro Unified</h1>
        <p className="mt-1 text-sm text-slate-600">See WhatsApp chats next to Instagram and Messenger in one inbox. You can reply and take over from there. Everything keeps working here too.</p>
      </div>

      {link && link.status !== "revoked" && (
        <div className={`rounded-2xl border p-4 text-sm ${link.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          <p className="font-semibold">{link.status === "active" ? "Connected" : "Needs attention"}</p>
          <p className="mt-1 break-all text-xs">{link.com_url}</p>
          <p className="mt-1 text-xs">{link.last_push_at ? `Last sent ${new Date(link.last_push_at).toLocaleString()}` : "Nothing sent yet"}{waiting ? ` · ${waiting} waiting` : ""}</p>
          {link.last_error && <p className="mt-1 text-xs">{link.last_error}</p>}
          <button onClick={disconnect} className="mt-3 text-xs font-semibold underline">Disconnect</button>
        </div>
      )}

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900">{link && link.status !== "revoked" ? "Replace the connection" : "Paste the three values"}</h2>
        <p className="text-xs text-slate-500">On replykaro.com open Unified, then Channels, and create a WhatsApp link. Copy the address, Link ID and secret here. The secret is shown there only once.</p>
        <label className="block space-y-1"><span className="text-sm font-medium">Address</span><input className={box} value={address} onChange={(e) => setAddress(e.target.value)} required /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Link ID</span><input className={box} value={linkId} onChange={(e) => setLinkId(e.target.value)} required /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Secret</span><input className={box} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} required /></label>
        {msg && <p role="status" className="text-sm text-slate-700">{msg}</p>}
        <button disabled={busy} className="rounded-xl bg-[#128C7E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Connecting…" : "Connect"}</button>
      </form>
    </div>
  );
}
