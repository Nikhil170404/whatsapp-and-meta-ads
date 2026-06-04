"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, CreditCard } from "lucide-react";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export function WaConnectClient({ initialConnection }: { initialConnection: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [billingStep, setBillingStep] = useState<"choose" | "done">("choose");

  const wabaIdRef = useRef<string | null>(null);
  const phoneIdRef = useRef<string | null>(null);

  // Reset billing step whenever the success modal opens
  useEffect(() => {
    if (showSuccessModal) {
      setBillingStep("choose");
    }
  }, [showSuccessModal]);

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

    window.FB.login((response: any) => {
      if (response.authResponse) {
        exchangeCodeForToken(response.authResponse.code, wabaIdRef.current, phoneIdRef.current);
      } else {
        setIsLoading(false);
        setError("User cancelled login or did not fully authorize.");
      }
    }, {
      config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { "sessionInfoVersion": "3", "version": "v4" }
    });
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
    if (confirm("Disconnect account?")) {
      setIsLoading(true);
      await fetch("/api/whatsapp/connect", { method: "DELETE" });
      window.location.reload();
    }
  };

  const handleBillingChoice = async (billingType: "direct" | "managed") => {
    setIsLoading(true);
    try {
      await fetch("/api/whatsapp/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_billing_type", billing_type: billingType }),
      });
      if (billingType === "managed") {
        router.push("/wa/wallet");
      } else {
        setBillingStep("done");
      }
    } catch {
      // Still proceed even if the API call fails
      if (billingType === "managed") {
        router.push("/wa/wallet");
      } else {
        setBillingStep("done");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccessModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
          {/* Header bar matching Meta style */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
              <svg viewBox="0 0 36 36" fill="white" className="w-4 h-4"><path d="M18 2C9.16 2 2 9.16 2 18a16 16 0 0 0 8.56 14.11L18 34l7.44-1.89A16 16 0 0 0 34 18C34 9.16 26.84 2 18 2z"/></svg>
            </div>
            <div className="w-5 h-5 rounded-sm border border-slate-300 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3"><path d="M2 4l6 4 6-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/><rect x="1" y="3" width="14" height="10" rx="2" stroke="#94a3b8" strokeWidth="1.5"/></svg>
            </div>
            <div className="ml-1 w-5 h-5 text-yellow-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/></svg>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center">
            {/* Confetti avatar */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-purple-100" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-200 to-purple-200 flex items-center justify-center">
                  <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10"><circle cx="20" cy="14" r="7" fill="#94a3b8"/><path d="M6 36c0-7.73 6.27-14 14-14s14 6.27 14 14" fill="#94a3b8"/></svg>
                </div>
              </div>
              {/* Confetti dots */}
              {["top-1 left-3 bg-purple-400","top-3 right-2 bg-blue-400","bottom-2 left-1 bg-green-400","bottom-1 right-3 bg-yellow-400","top-6 left-0 bg-pink-400","bottom-6 right-0 bg-indigo-400"].map((cls, i) => (
                <div key={i} className={`absolute w-2 h-2 rounded-full ${cls}`} />
              ))}
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Your account is connected to Replykaro
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              We'll review your business to ensure that it complies with WhatsApp's{" "}
              <span className="text-blue-500 cursor-pointer">Commerce Policy</span> and get in touch
              with you within 24 hours if there's an issue.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex flex-col gap-3">
            {billingStep === "choose" ? (
              <>
                <div className="mb-1 text-center">
                  <h3 className="text-base font-black text-slate-900">How will you pay for WhatsApp messages?</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Meta charges ₹0.86 per marketing message. Choose how you'd like to handle this.
                  </p>
                </div>

                <button
                  onClick={() => handleBillingChoice("direct")}
                  disabled={isLoading}
                  className="w-full flex flex-col items-start gap-0.5 px-4 py-3.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 transition-colors rounded-xl text-left border border-slate-200"
                >
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    I have a Visa/Mastercard
                  </span>
                  <span className="text-xs text-slate-500 ml-6">Pay Meta directly, no extra charges</span>
                </button>

                <button
                  onClick={() => handleBillingChoice("managed")}
                  disabled={isLoading}
                  className="w-full flex flex-col items-start gap-0.5 px-4 py-3.5 bg-[#25D366]/5 hover:bg-[#25D366]/10 disabled:opacity-60 transition-colors rounded-xl text-left border border-[#25D366]/30"
                >
                  <span className="font-bold text-[#25D366] text-sm flex items-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 12h8M12 8v8" strokeLinecap="round"/></svg>
                    )}
                    Use UPI / Indian Payments
                  </span>
                  <span className="text-xs text-slate-500 ml-6">Top up wallet here, we pay Meta for you</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/wa/billing")}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#0a7c4a] hover:bg-[#086b3f] transition-colors text-white font-semibold rounded-xl text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  Add payment method
                </button>
                <button
                  onClick={() => { setShowSuccessModal(false); router.push("/wa"); }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 transition-colors text-white font-semibold rounded-xl text-sm"
                >
                  Finish
                </button>
              </>
            )}
          </div>

          <p className="pb-5 text-center text-[10px] text-slate-400">
            Replykaro's{" "}
            <span className="text-blue-500 cursor-pointer">Privacy Policy</span> and{" "}
            <span className="text-blue-500 cursor-pointer">Terms</span>
          </p>
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

        <button onClick={handleDisconnect} className="mt-8 px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm">
          Disconnect Account
        </button>
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
        <button
          onClick={launchWhatsAppSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-[#1877F2] hover:bg-[#166fe5] transition-colors text-white rounded-xl font-bold disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login with Facebook"}
        </button>
        <p className="text-[10px] text-center text-slate-400">
          Current Origin: {typeof window !== 'undefined' ? window.location.origin : ''}
        </p>
      </div>
    </div>
  );
}
