import { MessageCircle, Tag, Zap, Send } from "lucide-react";

/** A static picture of the real automation model: trigger keyword → reply → label. */
export function FlowPreview() {
  const steps = [
    { Icon: MessageCircle, title: "Customer sends", body: "Message contains “price”", tone: "bg-slate-900 text-white" },
    { Icon: Zap, title: "Automation matches", body: "Keyword trigger · active 24/7", tone: "bg-[#25D366] text-white" },
    { Icon: Send, title: "Reply sent instantly", body: "“Plans start at ₹499…”", tone: "bg-white text-slate-900 ring-1 ring-slate-200" },
    { Icon: Tag, title: "Contact labelled", body: "Consent logged · label: lead", tone: "bg-white text-slate-900 ring-1 ring-slate-200" },
  ];
  return (
    <ol className="relative mx-auto max-w-sm space-y-3" aria-label="Example automation flow">
      <span className="absolute bottom-6 left-[1.4rem] top-6 w-px bg-gradient-to-b from-[#25D366] to-slate-200" aria-hidden />
      {steps.map(({ Icon, title, body, tone }) => (
        <li key={title} className="relative flex items-center gap-4">
          <span className={`z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="block text-xs text-slate-500">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
