"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Phone, Key, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaConnectClient({ initialConnection }: { initialConnection: any }) {
  const [phoneNumberId, setPhoneNumberId] = useState(initialConnection?.phone_number_id || "");
  const [wabaId, setWabaId] = useState(initialConnection?.waba_id || "");
  const [accessToken, setAccessToken] = useState(initialConnection?.access_token || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, wabaId, accessToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      setSuccess("Successfully connected to WhatsApp Business API!");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    // API logic to delete connection
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
              {initialConnection.phone_number}
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
      <div className="mb-8">
        <h2 className="text-xl font-black text-slate-900">Manual Setup</h2>
        <p className="text-slate-500 text-sm mt-1">Get these details from your <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-[#25D366] hover:underline">Meta App Dashboard</a> &rarr; WhatsApp &rarr; API Setup.</p>
      </div>

      <form onSubmit={handleConnect} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number ID</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              required
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
              placeholder="e.g. 109960479657119"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">WhatsApp Business Account ID (WABA)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              required
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
              placeholder="e.g. 211547778929846"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Permanent Access Token</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Key className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              required
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
              placeholder="EAA..."
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">Generate a System User token in Business Settings with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 text-green-700 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#25D366]/20"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verify & Connect
            </>
          )}
        </button>
      </form>
    </div>
  );
}
