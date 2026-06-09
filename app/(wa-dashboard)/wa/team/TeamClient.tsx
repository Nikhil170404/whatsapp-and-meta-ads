"use client";

import { useState } from "react";
import { Users, UserPlus, Trash2, Mail, Crown, AlertCircle, Loader2, X, Check } from "lucide-react";
import Link from "next/link";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface TeamClientProps {
  members: TeamMember[];
  isPaidPlan: boolean;
}

export function TeamClient({ members: initialMembers, isPaidPlan }: TeamClientProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch("/api/whatsapp/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite member");
      setMembers((prev) => [...prev, data.member]);
      setInviteSuccess(true);
      setInviteName("");
      setInviteEmail("");
      setTimeout(() => {
        setShowInviteForm(false);
        setInviteSuccess(false);
      }, 1500);
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch("/api/whatsapp/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Team Inbox</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Invite agents to handle conversations on your behalf.
          </p>
        </div>
        {isPaidPlan && (
          <button
            onClick={() => {
              setShowInviteForm(true);
              setInviteError(null);
              setInviteSuccess(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-2xl font-bold text-sm hover:bg-[#1DA851] transition-all active:scale-95 shadow-md shadow-[#25D366]/20"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Upgrade prompt for free plan */}
      {!isPaidPlan && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-900 mb-1">Team Inbox requires a paid plan</p>
            <p className="text-sm text-amber-700 mb-3">
              Upgrade to the Growth or Pro plan to invite team members and assign conversations.
            </p>
            <Link
              href="/wa/billing"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all active:scale-95"
            >
              <Crown className="w-4 h-4" />
              Upgrade Plan
            </Link>
          </div>
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && isPaidPlan && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#25D366]" />
              Invite a Team Member
            </h2>
            <button
              onClick={() => { setShowInviteForm(false); setInviteError(null); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                />
              </div>
            </div>

            {inviteError && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2.5 rounded-xl text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-medium">
                <Check className="w-4 h-4 shrink-0" />
                Member added successfully!
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-50 transition-all active:scale-95"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {inviting ? "Adding..." : "Add Member"}
              </button>
              <button
                type="button"
                onClick={() => { setShowInviteForm(false); setInviteError(null); }}
                className="px-5 py-2.5 text-slate-600 bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#25D366]" />
            <h2 className="font-bold text-slate-900 text-sm">Team Members</h2>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">No team members yet</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              {isPaidPlan
                ? "Invite your first team member to start assigning conversations."
                : "Upgrade to a paid plan to invite team members."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366]/20 to-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-sm shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{member.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                </div>

                {/* Role badge */}
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#25D366]/10 text-[#25D366] shrink-0">
                  {member.role}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(member.id)}
                  disabled={deletingId === member.id}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                  title="Remove member"
                >
                  {deletingId === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
