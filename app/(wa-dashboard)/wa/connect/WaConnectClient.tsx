"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

export function WaConnectClient({ initialConnection }: { initialConnection: any }) {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(!initialConnection);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [showSuccessModal, setShowSuccessModal] = useState(searchParams.get("success") === "1");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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

  const needsReconnect = initialConnection?.status === 'active' &&
    (initialConnection?.waba_id === "unknown" || initialConnection?.phone_number_id === "unknown");

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

        {needsReconnect && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl relative z-10">
            <p className="text-sm font-bold text-amber-800 mb-1">Phone number not linked yet</p>
            <p className="text-xs text-amber-700 mb-3">Click "Re-connect" below to complete the setup and link your WhatsApp phone number.</p>
            <button
              onClick={launchWhatsAppSignup}
              disabled={isLoading}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold rounded-xl text-sm disabled:opacity-70 transition-colors flex items-center gap-2"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Connecting…</> : "Re-connect with Facebook"}
            </button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 relative z-10">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</p>
            <p className="font-bold text-slate-900">{(!initialConnection.phone_number || initialConnection.phone_number === "Verified Number" || initialConnection.phone_number === "unknown") ? "—" : initialConnection.phone_number}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">WABA ID</p>
            <p className="font-bold text-slate-900 text-xs break-all">{initialConnection.waba_id === "unknown" ? "—" : initialConnection.waba_id}</p>
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
          <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium leading-relaxed">
            {error}
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
      </div>
    </div>
  );
}
