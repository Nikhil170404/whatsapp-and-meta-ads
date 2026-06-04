"use client";

import { Users, Mail, Phone, CheckCircle2 } from "lucide-react";

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  page_id: string | null;
  whatsapp_sent: boolean;
  created_at: string;
}

interface Props {
  initialLeads: Lead[];
}

export function LeadsClient({ initialLeads }: Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Leads</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm">
          Contacts captured from your Meta ad lead forms.
        </p>
      </div>

      {initialLeads.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-[#25D366]" />
          </div>
          <p className="text-lg font-black text-slate-800 mb-1">No leads yet</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Leads captured from your Meta ad lead generation forms will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {initialLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-[2rem] border border-slate-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#25D366]" />
                </div>
                {lead.whatsapp_sent && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-[#25D366] bg-[#25D366]/10 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Sent to WhatsApp
                  </span>
                )}
              </div>

              <p className="text-base font-black text-slate-900 truncate mb-3">
                {lead.name || "Unknown"}
              </p>

              <div className="space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{lead.phone}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 font-medium mt-4">
                {new Date(lead.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
