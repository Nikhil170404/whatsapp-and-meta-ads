"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Phone, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Add Facebook SDK types to global window
declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export function WaConnectClient({ initialConnection }: { initialConnection: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Store the IDs received from the Embedded Signup popup
  const wabaIdRef = useRef<string | null>(null);
  const phoneIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Load Facebook SDK
    if (document.getElementById('facebook-jssdk')) return;
    
    window.fbAsyncInit = function() {
      window.FB.init({
        appId            : process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
        autoLogAppEvents : true,
        xfbml            : true,
        version          : 'v21.0'
      });
    };

    const js = document.createElement('script');
    js.id = 'facebook-jssdk';
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.async = true;
    js.defer = true;
    js.crossOrigin = "anonymous";
    document.body.appendChild(js);

    // Setup listener for Embedded Signup session info
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log("Embedded Signup Event:", data);
          if (data.event === 'FINISH' && data.data) {
             // Store the shared IDs
             if (data.data.waba_id) wabaIdRef.current = data.data.waba_id;
             if (data.data.phone_number_id) phoneIdRef.current = data.data.phone_number_id;
          }
        }
      } catch (err) {
        // Ignore parsing errors for other non-json messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const launchWhatsAppSignup = () => {
    setIsLoading(true);
    setError(null);

    // Launch Facebook login
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Send code to backend for token exchange, along with the IDs from the popup
        exchangeCodeForToken(code, wabaIdRef.current, phoneIdRef.current);
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

      if (!res.ok) {
        throw new Error(data.error || "Failed to exchange token and connect account.");
      }

      setSuccess("Successfully connected to WhatsApp Business API!");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm("Are you sure you want to disconnect? Automations will stop working.")) {
      setIsLoading(true);
      await fetch("/api/whatsapp/connect", { method: "DELETE" });
      window.location.reload();
    }
  };

  if (initialConnection && initialConnection.status === 'active') {
    return (
      <div className="bg-white rounded-[2rem] border border-[#25D366]/20 p-8 shadow-lg shadow-[#25D366]/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#25D366]/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Connected to WhatsApp</h2>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
              API connection is active
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 relative z-10">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Display Phone Number</p>
            <p className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#25D366]" />
              {initialConnection.phone_number || "Verified Number"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">WABA ID</p>
            <p className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#25D366]" />
              {initialConnection.waba_id}
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 relative z-10">
          <button 
            onClick={handleDisconnect}
            className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors text-sm"
          >
            Disconnect Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-3">WhatsApp Embedded Signup</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto">
          Connect your WhatsApp Business Account in just 1 click. You will be prompted to log into Facebook, create or select a WhatsApp Business Account, and verify your phone number.
        </p>
      </div>

      <div className="max-w-xs mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 text-green-700 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <button
          onClick={launchWhatsAppSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1877F2]/20"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Login with Facebook
            </>
          )}
        </button>
        <p className="text-xs text-center text-slate-400 font-medium">
          Make sure you have a verified Meta Business Portfolio.
        </p>
      </div>
    </div>
  );
}
