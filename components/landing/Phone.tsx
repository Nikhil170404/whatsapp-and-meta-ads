"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCheck, Phone as PhoneIcon, Send, Video } from "lucide-react";

export interface Line { from: "customer" | "business"; text: string; buttons?: string[]; time?: string }
export interface Script { name: string; lines: Line[]; note?: string }

/** The conversations the page tells, one per stage. They are the same messages the product sends. */
export const SCRIPTS: Script[] = [
  { name: "Sunrise Store", lines: [{ from: "business", text: "Hi, welcome to Sunrise Store! Ask me anything, or tap a word below. Reply STOP at any time to opt out." }] },
  { name: "Sunrise Store", lines: [
    { from: "customer", text: "price?" },
    { from: "business", text: "Our plans start at ₹499. Want the full catalogue? Reply CATALOG." },
    { from: "customer", text: "What time do you close?" },
    { from: "business", text: "We are open Monday to Saturday, 10 AM to 7 PM." },
  ] },
  { name: "Sunrise Salon", lines: [
    { from: "business", text: "What would you like to book?", buttons: ["Haircut", "Colour", "Talk to a person"] },
    { from: "customer", text: "Haircut" },
    { from: "business", text: "Great. What is your name?" },
    { from: "customer", text: "Priya" },
    { from: "business", text: "Thanks Priya! What is your email so we can send a confirmation?" },
    { from: "customer", text: "priya@example.com" },
    { from: "business", text: "Booked. We saved your details and will confirm shortly." },
  ], note: "Lead saved: Priya, priya@example.com" },
  { name: "Sunrise Store", lines: [
    { from: "business", text: "Hi Priya, our Diwali offer starts tomorrow: 20% off all hair care. Reply STOP to opt out." },
    { from: "customer", text: "STOP" },
    { from: "business", text: "You have been unsubscribed and will not receive more messages. Reply START to opt back in." },
  ], note: "Opt-out recorded with date and time" },
];

const CHIPS: Record<string, string> = {
  price: "Our plans start at ₹499. Want the full catalogue? Reply CATALOG.",
  hours: "We are open Monday to Saturday, 10 AM to 7 PM.",
  order: "Please share your order ID (for example #12345) and we will check the status.",
  human: "Connecting you to a teammate now. Typical wait: about 30 minutes.",
  stop: "You have been unsubscribed and will not receive more messages. Reply START to opt back in.",
};
const matchReply = (t: string) => {
  const l = t.toLowerCase();
  if (/stop|unsubscribe/.test(l)) return CHIPS.stop;
  if (/price|cost|rate|how much/.test(l)) return CHIPS.price;
  if (/hours|open|time|close|timing/.test(l)) return CHIPS.hours;
  if (/order|track|deliver|ship/.test(l)) return CHIPS.order;
  if (/human|agent|person|support/.test(l)) return CHIPS.human;
  return "Thanks for your message! Try: price, hours, order or human.";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Shown extends Line { id: number }

/** A WhatsApp-style phone. Scripted stages play themselves; stage 0 is live and answers what you type. */
export function Phone({ stage, className = "" }: { stage: number; className?: string }) {
  const script = SCRIPTS[stage] ?? SCRIPTS[0];
  const live = stage === 0;
  const [shown, setShown] = useState<Shown[]>([]);
  const [typing, setTyping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useRef(0);
  const run = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [shown, typing]);

  // Play the stage's script. A new stage cancels the old one.
  useEffect(() => {
    const mine = ++run.current;
    setShown([]); setTyping(false); setNote(null); setBusy(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      for (const l of script.lines) {
        if (run.current !== mine) return;
        if (!reduced) {
          setTyping(l.from === "business");
          await sleep(l.from === "business" ? 750 : 450);
          if (run.current !== mine) return;
          setTyping(false);
        }
        setShown((s) => [...s, { ...l, id: id.current++ }]);
      }
      if (run.current === mine && script.note) { await sleep(reduced ? 0 : 500); if (run.current === mine) setNote(script.note); }
    })();
    return () => { run.current++; };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text: string) => {
    const clean = text.trim().slice(0, 120);
    if (!clean || busy) return;
    const mine = ++run.current;
    setBusy(true); setInput("");
    setShown((s) => [...s, { from: "customer", text: clean, id: id.current++ }]);
    setTyping(true); await sleep(850);
    if (run.current !== mine) return;
    setTyping(false);
    setShown((s) => [...s, { from: "business", text: matchReply(clean), id: id.current++ }]);
    setBusy(false);
  };

  return (
    <div data-ui className={`mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.25rem] bg-lp-dark p-2.5 ${className}`}>
      <div className="flex h-[420px] flex-col lg:h-[min(560px,calc(100svh-9rem))] lg:min-h-[420px] overflow-hidden rounded-[1.75rem] bg-[#E4EBE7]">
        <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold" aria-hidden>{script.name[0]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{script.name}</p>
            <p className="text-[13px] text-emerald-100/90">{typing ? "typing…" : "Business account"}</p>
          </div>
          <Video className="h-4 w-4 opacity-80" aria-hidden /><PhoneIcon className="h-4 w-4 opacity-80" aria-hidden />
        </div>

        <div ref={box} role="log" aria-live="polite" aria-label="WhatsApp conversation" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {shown.map((m) => (
            <div key={m.id} className={`flex animate-fade-up ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[84%] space-y-1.5">
                <p className={`rounded-xl px-3 py-2 text-[14px] leading-snug text-slate-800 ${m.from === "customer" ? "rounded-tr-sm bg-[#DCF8C6]" : "rounded-tl-sm bg-white"}`}>
                  {m.text}
                  {m.from === "customer" && <CheckCheck className="ml-1.5 inline h-3 w-3 text-sky-500" aria-hidden />}
                </p>
                {m.buttons?.map((b) => <span key={b} className="block rounded-xl bg-white px-3 py-2 text-center text-[14px] font-semibold text-sky-700">{b}</span>)}
              </div>
            </div>
          ))}
          {typing && <div className="flex"><div className="flex gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3" aria-hidden>{[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}</div></div>}
          {note && <p className="animate-fade-up pt-1 text-center"><span className="inline-block rounded-full bg-white/85 px-3 py-1 text-[13px] font-semibold text-[#075E54]">{note}</span></p>}
        </div>

        {live ? (
          <>
            <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {["Price", "Hours", "Order status", "Talk to a human", "STOP"].map((c) => (
                <button key={c} type="button" disabled={busy} onClick={() => send(c === "Talk to a human" ? "human" : c)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#075E54] transition active:scale-95 disabled:opacity-50">{c}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2.5">
              <label htmlFor={inputId} className="sr-only">Type a message to try the automation</label>
              <input id={inputId} value={input} onChange={(e) => setInput(e.target.value)} maxLength={120} placeholder="Type “price” and press send" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-base text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#25D366]/50 sm:text-sm" />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-lp-ink transition active:scale-95 disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </>
        ) : <div className="h-3 bg-[#E4EBE7]" aria-hidden />}
      </div>
    </div>
  );
}
