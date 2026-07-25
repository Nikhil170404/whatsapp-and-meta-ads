"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { MessageSquare, Search, X, Send, ChevronLeft, AlertCircle, Zap, Loader2, UserCheck, ChevronDown, UserX, ArrowDownLeft, ArrowUpRight, CheckCheck, Check } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/ui/relative-time";

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

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const QUICK_REPLIES = [
  "Hi! How can I help you today?",
  "Sure, I'll check and get back to you!",
  "Please give us 30 minutes to respond.",
  "Can we call you to discuss further?",
  "Thank you for contacting us!",
];

export function MessagesClient({ initialMessages, teamMembers = [] }: { initialMessages: Message[]; teamMembers?: TeamMember[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState<Record<string, string | null>>({});
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useMemo<Record<string, Conversation>>(() => {
    const groups: Record<string, Message[]> = {};
    for (const msg of messages) {
      const phone = (msg.direction === "inbound" ? msg.from_phone : msg.to_phone) ?? msg.from_phone ?? msg.to_phone;
      if (!phone) continue;
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

  useEffect(() => {
    if (!showAssignDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-assign-dropdown]")) setShowAssignDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignDropdown]);

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

  const handleAssign = async (memberId: string | null) => {
    if (!selectedPhone) return;
    setAssigning(true);
    setShowAssignDropdown(false);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${selectedPhone}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign conversation");
      }
      setAssignedMembers((prev) => ({ ...prev, [selectedPhone]: memberId }));
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const currentAssignedId = selectedPhone ? (assignedMembers[selectedPhone] ?? null) : null;
  const currentAssignedMember = teamMembers.find((m) => m.id === currentAssignedId) ?? null;

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
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-slate-600">No conversations yet</p>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Messages will appear here once customers message your WhatsApp Business number.
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
                          <RelativeTime date={convo.lastMessage.created_at} className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0" />
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{convo.lastMessage.content}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${convo.lastMessage.direction === "inbound" ? "bg-slate-100 text-slate-500" : "bg-[#25D366]/10 text-[#25D366]"}`}>
                            {convo.lastMessage.direction === "inbound" ? <><ArrowDownLeft className="w-2.5 h-2.5" /> In</> : <><ArrowUpRight className="w-2.5 h-2.5" /> Out</>}
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

                {/* Assign to agent */}
                {teamMembers.length > 0 && (
                  <div className="relative shrink-0" data-assign-dropdown>
                    <button
                      onClick={() => setShowAssignDropdown((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-all"
                    >
                      {assigning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-[#25D366]" />
                      )}
                      <span className="hidden sm:inline max-w-[80px] truncate">
                        {currentAssignedMember ? currentAssignedMember.name : "Assign"}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showAssignDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl border border-slate-100 shadow-lg z-20 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Assign to agent</p>
                        </div>
                        <div className="py-1 max-h-48 overflow-y-auto">
                          {teamMembers.map((member) => (
                            <button
                              key={member.id}
                              onClick={() => handleAssign(member.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${currentAssignedId === member.id ? "bg-[#25D366]/5" : ""}`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-xs shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{member.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                              </div>
                              {currentAssignedId === member.id && (
                                <div className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                        {currentAssignedId && (
                          <div className="border-t border-slate-50 py-1">
                            <button
                              onClick={() => handleAssign(null)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-rose-50 transition-colors text-rose-500"
                            >
                              <UserX className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-bold">Unassign</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                          <span className="inline-flex items-center">
                            {msg.status === "sending" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : msg.status === "read" ? <CheckCheck className="w-3 h-3 text-[#53bdeb]" /> : <Check className="w-3 h-3" />}
                          </span>
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
                  <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide">
                    {QUICK_REPLIES.map((reply, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(reply); setShowQuickReplies(false); }}
                        className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-[#25D366]/10 text-slate-700 text-xs font-medium rounded-full transition-colors whitespace-nowrap"
                      >
                        {reply}
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
