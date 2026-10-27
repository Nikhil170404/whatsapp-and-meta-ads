"use client";

import { useState } from "react";

const TYPES = [
  { value: "access", label: "Get a copy of my data" },
  { value: "correction", label: "Correct my data" },
  { value: "erasure", label: "Erase my data" },
  { value: "withdraw_consent", label: "Withdraw my consent" },
  { value: "grievance", label: "Raise a grievance" },
];

export function DataRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/dsr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: form.get("requester"),
          request_type: form.get("request_type"),
          details: form.get("details") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus("done");
      setMessage(`Request received. We will respond by ${new Date(data.respond_by).toLocaleDateString("en-IN", { dateStyle: "long" })}. Reference: ${data.id}`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-medium">{message}</p>;
  }

  const field = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]";
  return (
    <form onSubmit={onSubmit} className="space-y-4 not-prose">
      <div>
        <label htmlFor="requester" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your email or phone number</label>
        <input id="requester" name="requester" required minLength={5} maxLength={120} className={field} />
      </div>
      <div>
        <label htmlFor="request_type" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">What would you like to do?</label>
        <select id="request_type" name="request_type" required className={field}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="details" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Details (optional)</label>
        <textarea id="details" name="details" rows={4} maxLength={2000} className={field} />
      </div>
      {status === "error" && <p role="alert" className="text-sm font-bold text-rose-600">{message}</p>}
      <button type="submit" disabled={status === "sending"} className="px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all">
        {status === "sending" ? "Sending..." : "Submit request"}
      </button>
    </form>
  );
}
