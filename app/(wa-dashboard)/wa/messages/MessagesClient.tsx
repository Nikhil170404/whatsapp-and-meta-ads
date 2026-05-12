"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { MessageSquare, Search, X, Send, ChevronLeft } from "lucide-react";

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

export function MessagesClient({ initialMessages }: { initialMessages: Message[] }) {
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversations = useMemo<Record<string, Conversation>>(() => {
    const groups: Record<string, Message[]> = {};
    for (const msg of initialMessages) {
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
  }, [initialMessages]);

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
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Messages</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">View your WhatsApp inbound and outbound messages.</p>
      </div>

      <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex min-h-0">
        {/* Conversation sidebar */}
        <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col ${showMobileChat ? "hidden md:flex" : "flex"}`}>
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
            {filteredPhones.length > 0 ? (
              filteredPhones.map((phone) => {
                const convo = conversations[phone];
                const isActive = selectedPhone === phone;
                return (
                  <button
                    key={phone}
                    onClick={() => selectConversation(phone)}
                    className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${isActive ? "bg-[#25D366]/5 border-l-4 border-l-[#25D366]" : ""}`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p className={`font-bold text-sm truncate ${isActive ? "text-[#25D366]" : "text-slate-900"}`}>{phone}</p>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0">
                        {new Date(convo.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{convo.lastMessage.content}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${convo.lastMessage.direction === "inbound" ? "bg-slate-100 text-slate-500" : "bg-[#25D366]/10 text-[#25D366]"}`}>
                        {convo.lastMessage.direction === "inbound" ? "Received" : "Sent"}
                      </span>
                      <span className="text-[10px] text-slate-400">{convo.messages.length} msgs</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm font-medium">{search ? `No results for "${search}"` : "No conversations yet"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col bg-slate-50/30 min-w-0 ${!showMobileChat && !selectedPhone ? "hidden md:flex" : "flex"}`}>
          {activeConvo ? (
            <>
              {/* Chat header */}
              <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold shrink-0">
                  {activeConvo.phone.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{activeConvo.phone}</h3>
                  <p className="text-xs text-slate-400">{activeConvo.messages.length} messages</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.direction === "outbound"
                        ? "bg-[#25D366] text-white rounded-br-none"
                        : "bg-white border border-slate-100 shadow-sm rounded-bl-none text-slate-900"
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className={`text-[10px] font-bold mt-1 flex justify-end items-center gap-1 ${msg.direction === "outbound" ? "text-white/70" : "text-slate-400"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {msg.direction === "outbound" && msg.status && (
                          <span className="opacity-80 capitalize">• {msg.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input — read-only hint */}
              <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="flex gap-2 items-center p-3 bg-slate-50 rounded-xl">
                  <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-400 font-medium flex-1">
                    Replies are sent via <a href="/wa/automations" className="text-[#25D366] font-bold hover:underline">Automations</a> or <a href="/wa/broadcasts" className="text-[#25D366] font-bold hover:underline">Broadcasts</a>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-6 text-slate-300">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Select a conversation</h2>
              <p className="text-slate-500 max-w-sm text-sm">
                {sortedPhones.length > 0
                  ? "Click a conversation on the left to view messages."
                  : "Connect your WhatsApp account to start receiving messages."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
