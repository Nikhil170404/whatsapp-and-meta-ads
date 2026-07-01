"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export function WaConnectClient({ initialConnection }: { initialConnection: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [polling, setPolling] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const wabaIdRef = useRef<string | null>(null);
  const phoneIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for connection status — used on mobile where FB.login callback may not fire
  const startPolling = () => {
    setPolling(true);
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/whatsapp/status");
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            stopPolling();
            setIsLoading(false);
            setShowSuccessModal(true);
            return;
          }
        }
      } catch {}
      if (attempts >= 20) { // stop after 60s
        stopPolling();
        setIsLoading(false);
        setError("Connection timed out. If you completed setup, try refreshing the page.");
      }
    }, 3000);
  };

  const stopPolling = () => {
    setPolling(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) return;

    window.fbAsyncInit = function() {
      window.FB.init({
        appId            : process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
        autoLogAppEvents : true,
        xfbml            : true,
        version          : 'v25.0'
      });
    };

    const js = document.createElement('script');
    js.id = 'facebook-jssdk';
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.async = true;
    js.defer = true;
    js.crossOrigin = "anonymous";
    document.body.appendChild(js);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' && data.data) {
             if (data.data.waba_id) wabaIdRef.current = data.data.waba_id;
             if (data.data.phone_number_id) phoneIdRef.current = data.data.phone_number_id;
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const launchWhatsAppSignup = () => {
    if (!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || !process.env.NEXT_PUBLIC_FB_CONFIG_ID) {
      setError("Missing Facebook App ID or Config ID in settings.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Detect mobile — on mobile FB.login opens a new tab so the callback may never fire
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    window.FB.login((response: any) => {
      stopPolling(); // callback fired — stop polling
      if (response.authResponse) {
        exchangeCodeForToken(response.authResponse.code, wabaIdRef.current, phoneIdRef.current);
      } else {
        setIsLoading(false);
        if (response.status !== 'connected') {
          setError("Setup cancelled or not completed. Please try again.");
        }
      }
    }, {
      config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { "sessionInfoVersion": "3", "version": "v4" }
    });

    // On mobile, show waiting state immediately then begin polling after popup opens
    if (isMobile) {
      setPolling(true);
      setTimeout(() => startPolling(), 2000);
    }
  };

  const exchangeCodeForToken = async (code: string, wabaId: string | null, phoneNumberId: string | null) => {
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wabaId, phoneNumberId }),
      });

      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/signin?redirect=/wa/connect";
        return;
      }
      if (!res.ok) throw new Error(data.details || data.error || "Failed to exchange token.");

      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
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
          {/* Body */}
          <div className="px-8 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              WhatsApp Connected!
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your WhatsApp Business Account is now linked to ReplyKaro. You can start creating automations and sending broadcasts.
            </p>
          </div>

          {/* Footer */}
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
        <div className="grid gap-6 md:grid-cols-2 relative z-10">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</p>
            <p className="font-bold text-slate-900">{initialConnection.phone_number}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">WABA ID</p>
            <p className="font-bold text-slate-900">{initialConnection.waba_id}</p>
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
        <h2 className="text-2xl font-black text-slate-900 mb-3">WhatsApp Embedded Signup</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto">
          Connect your WhatsApp Business Account in just 1 click.
        </p>
      </div>
      <div className="max-w-xs mx-auto space-y-4">
        {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold leading-relaxed">{error}</div>}
        {polling && (
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium text-center">
            Waiting for Facebook to complete setup… Please finish the steps in the tab that opened.
          </div>
        )}
        <button
          onClick={launchWhatsAppSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-[#1877F2] hover:bg-[#166fe5] transition-colors text-white rounded-xl font-bold disabled:opacity-70"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{polling ? "Verifying connection…" : "Connecting…"}</>
          ) : "Login with Facebook"}
        </button>
      </div>
    </div>
  );
}
