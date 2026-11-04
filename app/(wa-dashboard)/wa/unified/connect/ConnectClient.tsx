"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type State = { kind: "working" } | { kind: "done"; numberConnected: boolean } | { kind: "error"; message: string };

export function ConnectClient({ code, from }: { code: string; from: string }) {
  const [state, setState] = useState<State>({ kind: "working" });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // the code works once; never send it twice
    ran.current = true;
    fetch("/api/bridge/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, from }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setState({ kind: "error", message: j.error || "Could not connect." }); return; }
        setState({ kind: "done", numberConnected: !!j.numberConnected });
        if (j.numberConnected) setTimeout(() => { window.location.href = from; }, 1200);
      })
      .catch(() => setState({ kind: "error", message: "Could not connect. Check your internet and try again from ReplyKaro Unified." }));
  }, [code, from]);

  return (
    <div className="mx-auto max-w-lg space-y-5 p-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Connecting to ReplyKaro Unified</h1>
      {state.kind === "working" && <p role="status" className="text-sm text-slate-600">Linking your accounts. This takes a few seconds…</p>}
      {state.kind === "done" && state.numberConnected && <p role="status" className="text-sm text-emerald-700">Connected. Taking you back to ReplyKaro Unified…</p>}
      {state.kind === "done" && !state.numberConnected && (
        <div className="space-y-3">
          <p role="status" className="text-sm text-slate-700">Your accounts are linked. One more step: connect your WhatsApp number, so there is something to show.</p>
          <Link href="/wa/connect" className="inline-block rounded-xl bg-[#128C7E] px-5 py-2.5 text-sm font-semibold text-white">Connect my WhatsApp number</Link>
          <p><a href={from} className="text-xs text-slate-500 underline">Back to ReplyKaro Unified</a></p>
        </div>
      )}
      {state.kind === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-700">{state.message}</p>
          <a href={from || "https://www.replykaro.com"} className="text-sm underline">Back to ReplyKaro Unified</a>
        </div>
      )}
    </div>
  );
}
