"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, AlertTriangle, XCircle, Stethoscope } from "lucide-react";
import { isPlaceholderName } from "@/lib/auth/display-name";

interface DiagnosticCheck { name: string; status: "pass" | "fail" | "warn"; detail: string; }

export function WaConnectClient({
  initialConnection,
  previousError,
}: {
  initialConnection: any;
  previousError?: string | null;
}) {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(!initialConnection);
  const [error, setError] = useState<string | null>(searchParams.get("error") || previousError || null);
  const [checks, setChecks] = useState<DiagnosticCheck[] | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(searchParams.get("success") === "1");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const res = await fetch("/api/whatsapp/diagnose");
      const json = await res.json();
      setChecks(json.checks || []);
    } catch {
      setChecks([{ name: "Diagnostics", status: "fail", detail: "Could not run diagnostics." }]);
    }
    setIsDiagnosing(false);
  };

  // Silently try to connect using the token already stored from Facebook login
  useEffect(() => {
    if (initialConnection) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/auto-connect", { method: "POST" });
        if (cancelled) return;
        if (res.ok) setShowSuccessModal(true);
      } catch {}
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [initialConnection]);

  const launchWhatsAppSignup = () => {
    setIsLoading(true);
    setError(null);
    // Full-page redirect to Facebook OAuth — works identically on mobile and desktop.
    // Facebook redirects back to /wa/connect?code=... which the server exchanges.
    window.location.href = "/api/whatsapp/embedded-signup";
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    await fetch("/api/whatsapp/connect", { method: "DELETE" });
    window.location.reload();
  };

  if (showSuccessModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
          <div className="px-8 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">WhatsApp Connected!</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your WhatsApp Business Account is now linked to ReplyKaro. You can start creating automations and sending broadcasts.
            </p>
          </div>
          <div className="px-6 pb-8 flex flex-col gap-3">
            <button
              onClick={() => { window.location.href = "/wa"; }}
              className="w-full py-3 bg-[#25D366] hover:bg-[#1DA851] transition-colors text-white font-bold rounded-xl text-sm"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => { window.location.href = "/wa/wallet"; }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-semibold rounded-xl text-sm"
            >
              Set up Wallet (UPI / Indian Payments)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Meta stores a placeholder when it has not published the real value yet, so
  // don't present those strings as though they were the user's actual data.
  const hasRealNumber = !isPlaceholderName(initialConnection?.phone_number);
  const hasRealBusinessName = !isPlaceholderName(initialConnection?.display_name);

  if (initialConnection?.status === 'active') {
    return (
      <div className="bg-white rounded-[2rem] border border-[#25D366]/20 p-8 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Connected to WhatsApp</h2>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
              API Active
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 relative z-10">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</p>
            {hasRealNumber ? (
              <p className="font-bold text-slate-900">{initialConnection.phone_number}</p>
            ) : (
              <>
                <p className="font-bold text-slate-400">Not published by Meta</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-relaxed">
                  Meta only returns the number once it passes business verification. The IDs below still work.
                </p>
              </>
            )}
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Business Name</p>
            <p className={`font-bold ${hasRealBusinessName ? "text-slate-900" : "text-slate-400"}`}>
              {hasRealBusinessName ? initialConnection.display_name : "Not published by Meta"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Phone Number ID</p>
            <p className="font-bold text-slate-900 text-xs break-all font-mono">{initialConnection.phone_number_id}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Used for sending messages</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">WABA ID</p>
            <p className="font-bold text-slate-900 text-xs break-all font-mono">{initialConnection.waba_id}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Your WhatsApp Business Account</p>
          </div>
        </div>

        {initialConnection.last_error && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl relative z-10">
            <p className="text-xs font-bold text-amber-600 uppercase mb-1">Last Webhook Error</p>
            <p className="text-sm font-medium text-amber-800 break-words">{initialConnection.last_error}</p>
            {initialConnection.last_error_at && (
              <p className="text-xs text-amber-500 mt-1">{new Date(initialConnection.last_error_at).toLocaleString()}</p>
            )}
            <p className="text-xs text-amber-600 mt-2 font-medium">
              If this says "not in allowed list" — go to Meta Developer Dashboard → WhatsApp → API Setup → add your personal number as a test recipient.
            </p>
          </div>
        )}

        {confirmDisconnect ? (
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <p className="text-sm text-slate-600 font-medium">This will remove your WhatsApp connection.</p>
            <div className="flex gap-2">
              <button onClick={handleDisconnect} disabled={isLoading}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition-colors">
                {isLoading ? "Disconnecting…" : "Yes, disconnect"}
              </button>
              <button onClick={() => setConfirmDisconnect(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDisconnect(true)} className="mt-8 px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-sm transition-colors">
            Disconnect Account
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-3">Connect WhatsApp</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto">
          Connect your WhatsApp Business Account to start sending messages and automations.
        </p>
      </div>
      <div className="max-w-xs mx-auto space-y-4">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium leading-relaxed space-y-2">
            <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Could not link a WhatsApp account</p>
            <p className="text-rose-600 text-xs break-words">{error}</p>
          </div>
        )}

        {checks && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Diagnostics</p>
            {checks.map((c) => (
              <div key={c.name} className="flex gap-2.5 items-start">
                {c.status === "pass" && <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />}
                {c.status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                {c.status === "fail" && <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500 break-words leading-relaxed">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={launchWhatsAppSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-[#1877F2] hover:bg-[#166fe5] transition-colors text-white rounded-xl font-bold disabled:opacity-70"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Connecting…</>
          ) : "Login with Facebook"}
        </button>

        <button
          onClick={runDiagnostics}
          disabled={isDiagnosing}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-500 hover:text-slate-800 font-semibold text-xs disabled:opacity-60 transition-colors"
        >
          {isDiagnosing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Checking…</>
            : <><Stethoscope className="w-3.5 h-3.5" />Why is my account not connecting?</>}
        </button>
      </div>
    </div>
  );
}
