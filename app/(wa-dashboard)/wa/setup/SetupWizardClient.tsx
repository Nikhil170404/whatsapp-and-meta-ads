"use client";

import Link from "next/link";
import { CheckCircle2, MessageSquare, Zap, Users, ArrowRight } from "lucide-react";

interface SetupSteps {
  connected: boolean;
  hasAutomation: boolean;
  hasContacts: boolean;
}

const STEPS = [
  {
    number: 1,
    key: "connected" as keyof SetupSteps,
    title: "Connect WhatsApp",
    description: "Link your WhatsApp Business Account to start sending and receiving messages.",
    href: "/wa/connect",
    cta: "Connect Now",
    icon: MessageSquare,
    iconColor: "text-[#25D366]",
    iconBg: "bg-[#25D366]/10",
  },
  {
    number: 2,
    key: "hasAutomation" as keyof SetupSteps,
    title: "Create your first automation",
    description: "Set up keyword-based auto-replies so you never miss a customer message.",
    href: "/wa/automations",
    cta: "Create Automation",
    icon: Zap,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
  },
  {
    number: 3,
    key: "hasContacts" as keyof SetupSteps,
    title: "Add your first contact",
    description: "Import contacts or add them manually to start broadcasting messages.",
    href: "/wa/contacts",
    cta: "Add Contact",
    icon: Users,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
];

export function SetupWizardClient({ steps }: { steps: SetupSteps }) {
  const completedCount = [steps.connected, steps.hasAutomation, steps.hasContacts].filter(Boolean).length;
  const progressPct = Math.round((completedCount / 3) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center pt-4">
        <div className="w-14 h-14 rounded-2xl bg-[#25D366] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#25D366]/20">
          <MessageSquare className="w-7 h-7 text-white fill-current" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          Welcome to ReplyKaro
        </h1>
        <p className="text-slate-500 font-medium mt-2 text-sm">
          Complete these 3 steps to get started with WhatsApp automation.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Setup Progress</span>
          <span className="text-sm font-black text-slate-900">{completedCount} / 3 complete</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#25D366] rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {completedCount === 3 ? (
          <p className="text-xs font-bold text-[#25D366] mt-2">All done! You&apos;re ready to go.</p>
        ) : (
          <p className="text-xs text-slate-400 font-medium mt-2">{3 - completedCount} step{3 - completedCount !== 1 ? "s" : ""} remaining</p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const isDone = steps[step.key];
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className={`relative bg-white rounded-2xl border p-5 transition-all ${
                isDone
                  ? "border-[#25D366]/30 bg-[#25D366]/5"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Step badge */}
                <div className={`relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-black shadow-sm ${
                  isDone ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`w-7 h-7 rounded-lg ${step.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${step.iconColor}`} />
                    </div>
                    <h3 className={`text-base font-black ${isDone ? "text-[#25D366]" : "text-slate-900"}`}>
                      {step.title}
                    </h3>
                    {isDone && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#25D366] text-white font-black uppercase tracking-wider shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 font-medium mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                  {!isDone && (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all active:scale-95"
                    >
                      {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Skip link */}
      <div className="text-center pb-4">
        <Link
          href="/wa"
          className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1.5"
        >
          Skip for now &rarr; Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
