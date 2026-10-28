"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, CreditCard, FileText, ChevronDown, ListChecks, MapPin, RotateCcw, Send, Tag, Timer, UserPlus, Headset } from "lucide-react";
import { continueAfterWait, resumeFlow, startFlow, type Action, type Ctx, type Inbound, type Session } from "@/lib/flows/engine";
import { sanitize } from "@/lib/flows/validate";
import type { FlowDefinition, FlowButton, FlowRow } from "@/lib/flows/types";
import { humanWait } from "./nodeMeta";

type Line =
  | { id: number; from: "bot" | "user"; kind: "text"; text: string }
  | { id: number; from: "bot"; kind: "image"; url: string; text?: string }
  | { id: number; from: "bot"; kind: "file"; name: string; text?: string }
  | { id: number; from: "bot"; kind: "buttons"; text: string; buttons: FlowButton[]; answered?: boolean }
  | { id: number; from: "bot"; kind: "list"; text: string; label: string; rows: FlowRow[]; answered?: boolean }
  | { id: number; from: "bot"; kind: "location"; text: string; answered?: boolean }
  | { id: number; from: "bot"; kind: "pay"; text: string; label: string; url: string }
  | { id: number; from: "note"; kind: "note"; text: string; icon: "tag" | "lead" | "handoff" | "wait" };

type NewLine = Line extends infer L ? (L extends Line ? Omit<L, "id"> : never) : never;

const CTX: Ctx = { contactName: "Priya", phone: "919876543210" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noteIcon = { tag: Tag, lead: UserPlus, handoff: Headset, wait: Timer } as const;

interface Props {
  definition: FlowDefinition;
  exitKeywords: string[];
  /** Called with the block the preview is on, so the canvas can highlight it. */
  onVisit: (nodeId: string | null) => void;
}

/**
 * A WhatsApp-style preview that runs the same engine as the real thing, so what you see here is
 * what customers get: same messages, same checks, same retries. Waits are skipped.
 */
export function Simulator({ definition, exitKeywords, onVisit }: Props) {
  const def = useMemo(() => sanitize(definition), [definition]);
  const [lines, setLines] = useState<Line[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [openList, setOpenList] = useState<number | null>(null);
  const [showVars, setShowVars] = useState(false);
  const [startedWith, setStartedWith] = useState("");
  const run = useRef(0);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const defKey = JSON.stringify(def);

  useEffect(() => { endRef.current?.parentElement?.scrollTo({ top: endRef.current.offsetTop, behavior: "smooth" }); }, [lines, typing]);

  const push = (l: NewLine) => setLines((prev) => [...prev, { ...l, id: nextId.current++ } as Line]);

  /** Plays what the engine asked for, one message at a time, with a typing pause like WhatsApp. */
  const play = useCallback(async (runId: number, first: { actions: Action[]; session: Session; visited: string[] }) => {
    let step = first;
    for (let guard = 0; guard < 30; guard++) {
      for (const a of step.actions) {
        if (run.current !== runId) return;
        if (["text", "image", "video", "document", "buttons", "list", "location_request", "cta_url"].includes(a.type)) {
          setTyping(true);
          const len = a.type === "text" ? a.text.length : 40;
          await sleep(Math.min(900, 350 + len * 8));
          if (run.current !== runId) return;
          setTyping(false);
          if (a.type === "text") push({ from: "bot", kind: "text", text: a.text });
          else if (a.type === "video") push({ from: "bot", kind: "file", name: "Video", text: a.caption });
          else if (a.type === "document") push({ from: "bot", kind: "file", name: a.filename, text: a.caption });
          else if (a.type === "image") push({ from: "bot", kind: "image", url: a.url, text: a.caption });
          else if (a.type === "buttons") push({ from: "bot", kind: "buttons", text: a.text, buttons: a.buttons });
          else if (a.type === "list") push({ from: "bot", kind: "list", text: a.text, label: a.buttonLabel, rows: a.rows });
          else if (a.type === "location_request") push({ from: "bot", kind: "location", text: a.text });
          else if (a.type === "cta_url") push({ from: "bot", kind: "pay", text: a.text, label: a.label, url: a.url });
        } else if (a.type === "delay") push({ from: "note", kind: "note", icon: "wait", text: `Waits ${humanWait(a.seconds)} (skipped in preview)` });
        else if (a.type === "tag") push({ from: "note", kind: "note", icon: "tag", text: `Label added: ${a.label}` });
        else if (a.type === "lead") push({ from: "note", kind: "note", icon: "lead", text: `Lead saved (${Object.keys(a.fields).filter((k) => a.fields[k]).join(", ") || "no details yet"})` });
        else if (a.type === "webhook") push({ from: "note", kind: "note", icon: "lead", text: "Details sent to your URL (skipped in preview)" });
        else if (a.type === "handoff") push({ from: "note", kind: "note", icon: "handoff", text: "Handed over to a person. The bot stops here." });
      }
      setSession(step.session);
      onVisit(step.visited.at(-1) ?? null);
      if (step.session.status !== "waiting") return;
      step = continueAfterWait(def, step.session, CTX);
    }
  }, [def, onVisit]);

  const restart = useCallback(() => {
    const id = ++run.current;
    setLines([]); setTyping(false); setText(""); setOpenList(null); setSession(null);
    setStartedWith(defKey);
    onVisit(null);
    void play(id, startFlow(def, CTX));
  }, [def, defKey, onVisit, play]);

  useEffect(() => { restart(); /* start when opened */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { run.current++; onVisit(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (inbound: Inbound, shown: string, answeredLine?: number) => {
    if (!session || typing || session.status === "completed" || session.status === "handoff" || session.status === "abandoned") return;
    setOpenList(null);
    if (answeredLine !== undefined) setLines((prev) => prev.map((l) => (l.id === answeredLine && "answered" in l ? { ...l, answered: true } : l)));
    push({ from: "user", kind: "text", text: shown });
    const id = ++run.current;
    if (inbound.kind === "text" && exitKeywords.includes(inbound.text.trim().toLowerCase())) {
      setTyping(true); await sleep(400); setTyping(false);
      push({ from: "bot", kind: "text", text: "Okay, I've stopped. Message us any time to start again." });
      setSession({ ...session, status: "completed", endedReason: "cancelled", currentNodeId: null });
      return;
    }
    await play(id, resumeFlow(def, session, inbound, CTX));
  };

  const live = session && (session.status === "active");
  const lastInteractive = [...lines].reverse().find((l) => l.from === "bot" && (l.kind === "buttons" || l.kind === "list" || l.kind === "location")) as Line | undefined;
  const ended = session && ["completed", "handoff", "abandoned"].includes(session.status);
  const stale = startedWith !== "" && startedWith !== defKey;
  const vars = Object.entries(session?.variables ?? {}).filter(([, v]) => v);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {stale && (
        <button type="button" onClick={restart} className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> You changed the flow. Restart the preview to see it.
        </button>
      )}
      <div className="mx-auto flex min-h-0 w-full max-w-[340px] flex-1 flex-col overflow-hidden rounded-[2rem] border-[8px] border-slate-900 bg-[#ECE5DD] shadow-xl">
        <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">Y</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold leading-tight">Your business</p><p className="text-[11px] text-emerald-100/80">{typing ? "typing…" : "Preview as Priya"}</p></div>
          <button type="button" onClick={restart} aria-label="Restart preview" className="rounded-full p-2 transition hover:bg-white/15"><RotateCcw className="h-4 w-4" /></button>
        </div>

        <div role="log" aria-live="polite" aria-label="Flow preview" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {lines.map((l) => {
            if (l.kind === "note") {
              const Icon = noteIcon[l.icon];
              return <div key={l.id} className="flex animate-in fade-in justify-center"><span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm"><Icon className="h-3 w-3 shrink-0" aria-hidden /> {l.text}</span></div>;
            }
            const mine = l.from === "user";
            return (
              <div key={l.id} className={`flex animate-in fade-in slide-in-from-bottom-2 duration-300 ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[84%] space-y-1.5">
                  <div className={`rounded-xl px-3 py-2 text-[13px] leading-snug shadow-sm ${mine ? "rounded-tr-sm bg-[#DCF8C7] text-slate-800" : "rounded-tl-sm bg-white text-slate-800"}`}>
                    {l.kind === "image" && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={l.url} alt="" className="mb-1.5 max-h-40 w-full rounded-lg object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />)}
                    {l.kind === "file" && <span className="mb-1.5 flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-[13px] font-semibold text-slate-700"><FileText className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{l.name}</span></span>}
                    <span className="whitespace-pre-wrap">{"text" in l ? l.text : ""}</span>
                    {mine && <CheckCheck className="ml-1.5 inline h-3 w-3 text-sky-500" aria-hidden />}
                  </div>
                  {l.kind === "buttons" && l.buttons.map((b) => (
                    <button key={b.id} type="button" disabled={!live || l.answered || lastInteractive?.id !== l.id} onClick={() => answer({ kind: "reply", id: b.id, title: b.title }, b.title, l.id)}
                      className="block w-full rounded-xl bg-white px-3 py-2 text-center text-[13px] font-semibold text-sky-600 shadow-sm transition active:scale-[0.98] enabled:hover:bg-sky-50 disabled:text-slate-400">
                      {b.title || "(no label)"}
                    </button>
                  ))}
                  {l.kind === "list" && (
                    <>
                      <button type="button" disabled={!live || l.answered || lastInteractive?.id !== l.id} onClick={() => setOpenList(openList === l.id ? null : l.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-sky-600 shadow-sm transition active:scale-[0.98] disabled:text-slate-400">
                        <ListChecks className="h-4 w-4" aria-hidden /> {l.label || "View options"} <ChevronDown className={`h-3.5 w-3.5 transition ${openList === l.id ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      {openList === l.id && (
                        <div className="animate-in fade-in slide-in-from-top-1 overflow-hidden rounded-xl bg-white shadow-md">
                          {l.rows.map((r) => (
                            <button key={r.id} type="button" onClick={() => answer({ kind: "reply", id: r.id, title: r.title }, r.title, l.id)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                              <span className="block text-[13px] font-semibold text-slate-800">{r.title}</span>
                              {r.description && <span className="block text-[11px] text-slate-500">{r.description}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {l.kind === "pay" && (
                    <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-sky-700 shadow-sm"><CreditCard className="h-4 w-4" aria-hidden /> {l.label}</span>
                  )}
                  {l.kind === "location" && (
                    <button type="button" disabled={!live || l.answered || lastInteractive?.id !== l.id} onClick={() => answer({ kind: "location", latitude: 18.5204, longitude: 73.8567, name: "Shivajinagar", address: "Pune" }, "📍 Shivajinagar, Pune", l.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-sky-600 shadow-sm transition active:scale-[0.98] disabled:text-slate-400">
                      <MapPin className="h-4 w-4" aria-hidden /> Send location
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {typing && <div className="flex justify-start"><div className="flex gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3 shadow-sm" aria-hidden>{[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}</div></div>}
          {ended && !typing && <p className="pt-1 text-center text-[11px] font-semibold text-slate-500">{session!.status === "handoff" ? "A person takes over from here." : session!.endedReason === "loop" ? "The flow stopped because it was looping. Check your connections." : "The conversation ended. Press restart to try again."}</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(""); void answer({ kind: "text", text: t }, t); } }} className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2.5">
          <label htmlFor="sim-input" className="sr-only">Reply as the customer</label>
          <input id="sim-input" value={text} onChange={(e) => setText(e.target.value)} disabled={!live || typing} placeholder={live ? "Type a reply…" : "Conversation ended"} maxLength={300}
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#25D366]/40 disabled:opacity-60 sm:text-sm" />
          <button type="submit" aria-label="Send" disabled={!text.trim() || !live || typing} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition active:scale-95 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </div>

      <div className="mx-auto mt-3 w-full max-w-[340px]">
        <button type="button" onClick={() => setShowVars((v) => !v)} aria-expanded={showVars} className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
          What was collected ({vars.length}) <ChevronDown className={`h-4 w-4 transition ${showVars ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {showVars && (
          <dl className="mt-1.5 animate-in fade-in space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
            {vars.length === 0 ? <p className="text-slate-400">Nothing yet. Answers appear here as you reply.</p> : vars.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">{k}</dt><dd className="truncate text-slate-800">{v}</dd></div>)}
          </dl>
        )}
      </div>
    </div>
  );
}
