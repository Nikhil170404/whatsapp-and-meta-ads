"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Phone, ShieldCheck, Loader2 } from "lucide-react";

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
  
  const wabaIdRef = useRef<string | null>(null);
  const phoneIdRef = useRef<string | null>(null);

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

    // Get current origin for redirect URI (e.g., http://localhost:3000)
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectUri = `${currentOrigin}/wa/connect`;

    window.FB.login((response: any) => {
      if (response.authResponse) {
        exchangeCodeForToken(response.authResponse.code, wabaIdRef.current, phoneIdRef.current, redirectUri);
      } else {
        setIsLoading(false);
        setError("User cancelled login or did not fully authorize.");
      }
    }, {
      config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      // Adding redirect_uri explicitly helps fix the "URL blocked" error
      redirect_uri: redirectUri,
      extras: { "sessionInfoVersion": "3", "version": "v4" }
    });
  };

  const exchangeCodeForToken = async (code: string, wabaId: string | null, phoneNumberId: string | null, redirectUri: string) => {
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wabaId, phoneNumberId, redirectUri }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Failed to exchange token.");

      setSuccess("Successfully connected!");
      setTimeout(() => window.location.reload(), 2000);
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
        {success && <div className="p-4 rounded-xl bg-green-50 text-green-700 text-sm font-bold">{success}</div>}
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
