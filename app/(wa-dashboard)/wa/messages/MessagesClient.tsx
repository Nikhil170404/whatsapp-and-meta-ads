"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { MessageSquare, Search, X, Send, ChevronLeft, AlertCircle, Zap, Loader2 } from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  from_phone?: string;
  to_phone?: string;
  content: string;
  status?: string;
  created_at: string;
}

interface Conversation {
  phone: string;
  messages: Message[];
  lastMessage: Message;
}

const QUICK_REPLIES = [
  { label: "👋 Hi", text: "Hi! How can I help you today?" },
  { label: "✅ Thanks", text: "Thank you for reaching out! We'll get back to you shortly." },
  { label: "📦 Order", text: "Your order is being processed. You'll receive an update soon." },
  { label: "💰 Price", text: "For pricing details, please visit our website or reply with your requirements." },
  { label: "🕐 Soon", text: "Our team will contact you within 24 hours. Thank you for your patience!" },
  { label: "❌ Unavail", text: "This item is currently unavailable. We'll notify you when it's back in stock." },
];

export function MessagesClient({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useMemo<Record<string, Conversation>>(() => {
    const groups: Record<string, Message[]> = {};
    for (const msg of messages) {
      const phone = msg.direction === "inbound" ? msg.from_phone! : msg.to_phone!;
      if (!groups[phone]) groups[phone] = [];
      groups[phone].push(msg);
    }
    const result: Record<string, Conversation> = {};
    for (const [phone, msgs] of Object.entries(groups)) {
      const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      result[phone] = { phone, messages: sorted, lastMessage: sorted[0] };
    }
    return result;
  }, [messages]);

  const sortedPhones = useMemo(() => {
    return Object.keys(conversations).sort((a, b) => {
      const ta = new Date(conversations[a].lastMessage.created_at).getTime();
      const tb = new Date(conversations[b].lastMessage.created_at).getTime();
      return tb - ta;
    });
  }, [conversations]);

  const filteredPhones = useMemo(() => {
    if (!search.trim()) return sortedPhones;
    const q = search.toLowerCase();
    return sortedPhones.filter((p) => p.toLowerCase().includes(q) || conversations[p].messages.some((m) => m.content.toLowerCase().includes(q)));
  }, [sortedPhones, search, conversations]);

  const activeConvo = selectedPhone ? conversations[selectedPhone] : null;
  const activeMessages = useMemo(() => {
    if (!activeConvo) return [];
    return [...activeConvo.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [activeConvo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPhone, activeMessages.length]);

  const selectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setShowMobileChat(true);
    setSendError(null);
    setInput("");
    setShowQuickReplies(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedPhone || sending) return;
    const text = input.trim();
    setInput("");
    setSendError(null);
    setSending(true);
    setShowQuickReplies(false);

    // Optimistic message
    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      direction: "outbound",
      to_phone: selectedPhone,
      content: text,
      status: "sending",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedPhone, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, id: data.message?.id ?? optimistic.id, status: "sent" } : m));
    } catch (e: any) {
      setSendError(e.message);
      // Remove optimistic on error
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Messages</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">View and reply to WhatsApp conversations.</p>
      </div>

      <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex min-h-0">
        {/* Conversation list */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col shrink-0 ${showMobileChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#25D366] transition-all border border-transparent focus:border-[#25D366]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {sortedPhones.length === 0 ? (
              <div className="p-5 space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-700">Webhook not set up yet</p>
                  </div>
                  <p className="text-xs text-amber-600 font-medium leading-relaxed">
                    Messages appear here once your webhook is configured in Meta Dashboard.
                  </p>
                </div>
              </div>
            ) : filteredPhones.length > 0 ? (
              filteredPhones.map((phone) => {
                const convo = conversations[phone];
                const isActive = selectedPhone === phone;
                return (
                  <button
                    key={phone}
                    onClick={() => selectConversation(phone)}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${isActive ? "bg-[#25D366]/5 border-l-4 border-l-[#25D366]" : ""}`}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-sm shrink-0">
                        {phone.charAt(phone.length - 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5 gap-2">
                          <p className={`font-bold text-sm truncate ${isActive ? "text-[#25D366]" : "text-slate-900"}`}>{phone}</p>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0">
                            {new Date(convo.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{convo.lastMessage.content}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${convo.lastMessage.direction === "inbound" ? "bg-slate-100 text-slate-500" : "bg-[#25D366]/10 text-[#25D366]"}`}>
                            {convo.lastMessage.direction === "inbound" ? "↙ In" : "↗ Out"}
                          </span>
                          <span className="text-[10px] text-slate-400">{convo.messages.length} msgs</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-medium">No results for "{search}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col bg-[#f0f2f5] min-w-0 ${!showMobileChat && !selectedPhone ? "hidden md:flex" : "flex"}`}>
          {activeConvo ? (
            <>
              {/* Chat header */}
              <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-sm">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold shrink-0">
                  {activeConvo.phone.charAt(activeConvo.phone.length - 2)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm">{activeConvo.phone}</h3>
                  <p className="text-xs text-slate-400">{activeConvo.messages.length} messages</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      msg.direction === "outbound"
                        ? "bg-[#d9fdd3] text-slate-800 rounded-br-none"
                        : "bg-white border border-slate-100 rounded-bl-none text-slate-900"
                    } ${msg.status === "sending" ? "opacity-60" : ""}`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className="text-[10px] font-medium mt-1 flex justify-end items-center gap-1 text-slate-400">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {msg.direction === "outbound" && (
                          <span>{msg.status === "sending" ? "⌛" : msg.status === "read" ? "✓✓" : "✓"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Send area */}
              <div className="bg-white border-t border-slate-100 shrink-0">
                {/* Quick replies */}
                {showQuickReplies && (
                  <div className="px-4 py-2 border-b border-slate-50 flex gap-2 overflow-x-auto">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr.label}
                        onClick={() => { setInput(qr.text); setShowQuickReplies(false); inputRef.current?.focus(); }}
                        className="shrink-0 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] rounded-xl text-xs font-bold hover:bg-[#25D366]/20 transition-colors whitespace-nowrap"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}

                {sendError && (
                  <div className="px-4 py-2 bg-rose-50 border-b border-rose-100">
                    <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {sendError}
                    </p>
                  </div>
                )}

                <div className="p-3 flex items-end gap-2">
                  <button
                    onClick={() => setShowQuickReplies(v => !v)}
                    className={`p-2.5 rounded-xl transition-colors shrink-0 ${showQuickReplies ? "bg-[#25D366]/10 text-[#25D366]" : "text-slate-400 hover:bg-slate-100"}`}
                    title="Quick replies"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type a message..."
                    className="flex-1 resize-none bg-slate-50 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:bg-white transition-all min-h-[42px] max-h-32"
                    style={{ height: "auto" }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 128) + "px";
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="p-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#1DA851] disabled:opacity-40 transition-all shrink-0 active:scale-95"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 px-4 pb-2 text-center">
                  Only works within 24h of the customer&apos;s last message (WhatsApp policy)
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-6 text-slate-300">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Select a conversation</h2>
              <p className="text-slate-500 max-w-sm text-sm">
                {sortedPhones.length > 0 ? "Click a conversation to open it." : "Set up your webhook to start receiving messages."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
