import { BarChart3, FileText, LayoutDashboard, MessageSquare, Power, Send, Users, Zap } from "lucide-react";

// Mirrors the real dashboard: same navigation and the Automations screen layout.
// Figures and names are sample data, labelled as such.
const NAV = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Automations", icon: Zap, active: true },
  { name: "Messages", icon: MessageSquare },
  { name: "Broadcasts", icon: Send },
  { name: "Analytics", icon: BarChart3 },
  { name: "Contacts", icon: Users },
  { name: "Templates", icon: FileText },
];

const ROWS = [
  { name: "Price Inquiry", trigger: "Keyword: “price”", sent: 214, on: true },
  { name: "Business Hours", trigger: "Keyword: “hours”", sent: 128, on: true },
  { name: "Order Status", trigger: "Keyword: “order”", sent: 96, on: true },
  { name: "Welcome message", trigger: "First message only", sent: 57, on: true },
  { name: "Talk to Human", trigger: "Keyword: “human”", sent: 31, on: false },
];

export function DashboardPreview() {
  return (
    <figure>
      <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="flex">
          <aside className="hidden w-52 shrink-0 border-r border-slate-100 p-3 sm:block" aria-hidden>
            <p className="px-3 pb-3 pt-1 text-sm font-semibold">Reply<span className="text-[#25D366]">Karo</span></p>
            {NAV.map(({ name, icon: Icon, active }) => (
              <div key={name} className={`mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium ${active ? "bg-[#25D366]/10 text-[#128C7E]" : "text-slate-500"}`}>
                <Icon className="h-4 w-4" />{name}
              </div>
            ))}
          </aside>
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">Automations</p>
                <p className="text-xs text-slate-500">Auto-reply to incoming messages</p>
              </div>
              <span className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">+ New</span>
            </div>
            <ul className="mt-4 space-y-2">
              {ROWS.map((r) => (
                <li key={r.name} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${r.on ? "bg-[#25D366]/10 text-[#128C7E]" : "bg-slate-100 text-slate-400"}`}><Zap className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-slate-500">{r.trigger}</span>
                  </span>
                  <span className="hidden text-xs text-slate-500 sm:block">{r.sent} replies</span>
                  <Power className={`h-4 w-4 ${r.on ? "text-[#25D366]" : "text-slate-300"}`} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500">The Automations screen in your dashboard. Sample data shown.</figcaption>
    </figure>
  );
}
