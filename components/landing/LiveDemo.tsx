"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Phone, Send, Video } from "lucide-react";

interface Rule {
  keywords: string[];
  chip: string;
  reply: string;
}

// Same shape as a real keyword automation: trigger words in, reply out.
const RULES: Rule[] = [
  { chip: "Price", keywords: ["price", "cost", "rate", "how much"], reply: "Our plans start at ₹499. Want the full catalog? Reply CATALOG." },
  { chip: "Hours", keywords: ["hours", "open", "timing", "close"], reply: "We are open Mon–Sat, 10 AM to 7 PM. Message us anytime and we will reply in business hours." },
  { chip: "Order status", keywords: ["order", "track", "delivery", "shipping"], reply: "Please share your order ID (for example #12345) and we will check the status for you. 📦" },
  { chip: "Talk to a human", keywords: ["human", "agent", "person", "support"], reply: "Connecting you to a teammate now. Typical wait: about 30 minutes. 🙏" },
  { chip: "STOP", keywords: ["stop", "unsubscribe"], reply: "You have been unsubscribed and will not receive more messages. Reply START to opt back in." },
];

const FALLBACK = "Thanks for your message! Try one of the keywords above: price, hours, order or human.";

interface Msg {
  id: number;
  from: "customer" | "business";
  text: string;
  time: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function LiveDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "business", text: "Hi, welcome to Sunrise Store! 👋 Tap a keyword below or type your own question. Reply STOP any time to opt out.", time: "" },
  ]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const el = endRef.current?.parentElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function send(text: string) {
    const clean = text.trim().slice(0, 120);
    if (!clean || typing) return;
    const lower = clean.toLowerCase();
    const rule = RULES.find((r) => r.keywords.some((k) => lower === k || lower.includes(k)));

    setMessages((m) => [...m, { id: idRef.current++, from: "customer", text: clean, time: now() }]);
    setInput("");
    setTyping(true);
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => [...m, { id: idRef.current++, from: "business", text: rule?.reply ?? FALLBACK, time: now() }]);
      }, 900)
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-[#25D366]/25 via-emerald-200/20 to-transparent blur-2xl" aria-hidden />
      <div className="rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/20">
        <div className="overflow-hidden rounded-[1.9rem] bg-[#ECE5DD]">
          {/* Header */}
          <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">S</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">Sunrise Store</p>
              <p className="text-[11px] text-emerald-100/80">{typing ? "typing…" : "Business account"}</p>
            </div>
            <Video className="h-4 w-4 opacity-80" aria-hidden />
            <Phone className="h-4 w-4 opacity-80" aria-hidden />
          </div>

          {/* Messages */}
          <div className="h-[340px] space-y-2 overflow-y-auto px-3 py-4" role="log" aria-live="polite" aria-label="Live WhatsApp automation demo">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-xl px-3 py-2 text-[13px] leading-snug shadow-sm ${
                    m.from === "customer" ? "rounded-tr-sm bg-[#DCF8C6] text-slate-800" : "rounded-tl-sm bg-white text-slate-800"
                  }`}
                >
                  {m.text}
                  <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-slate-400">
                    {m.time}
                    {m.from === "customer" && <CheckCheck className="h-3 w-3 text-sky-500" aria-hidden />}
                  </span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3 shadow-sm" aria-hidden>
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick replies */}
          <div className="flex gap-1.5 overflow-x-auto bg-[#ECE5DD] px-3 pb-2 [scrollbar-width:none]">
            {RULES.map((r) => (
              <button
                key={r.chip}
                type="button"
                onClick={() => send(r.chip === "Talk to a human" ? "human" : r.chip)}
                disabled={typing}
                className="shrink-0 rounded-full border border-[#25D366]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#075E54] transition active:scale-95 disabled:opacity-50"
              >
                {r.chip}
              </button>
            ))}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2.5"
          >
            <label htmlFor="demo-input" className="sr-only">Type a message to try the automation</label>
            <input
              id="demo-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={120}
              placeholder="Type “price” and press send"
              className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#25D366]/40 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Live demo. This is the same keyword matching your customers will see.
      </p>
    </div>
  );
}
