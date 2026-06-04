"use client";

import { useState, useEffect } from "react";
import { ArrowUpCircle, ArrowDownCircle, AlertTriangle, ExternalLink, Info, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Wallet {
  balance_paise: number;
  total_topped_up_paise: number;
  total_spent_paise: number;
}

interface Transaction {
  id: string;
  type: "topup" | "debit";
  description: string;
  amount_paise: number;
  created_at: string;
}

interface WalletClientProps {
  wallet: Wallet;
  transactions: Transaction[];
  billingType: string;
  waConnected: boolean;
  razorpayKeyId: string;
}

const PRESET_AMOUNTS_INR = [200, 500, 1000, 2000];

function paisaToRupees(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function WalletClient({
  wallet,
  transactions,
  billingType: initialBillingType,
  waConnected,
  razorpayKeyId,
}: WalletClientProps) {
  const [billingType, setBillingType] = useState(initialBillingType);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(500);
  const [customAmount, setCustomAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(wallet.balance_paise);
  const [isLoading, setIsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Razorpay script
  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleBillingTypeChange = async (type: string) => {
    if (type === billingType) return;
    setBillingLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/whatsapp/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_billing_type", billing_type: type }),
      });
      if (!res.ok) throw new Error("Failed to update billing type");
      setBillingType(type);
    } catch {
      setErrorMessage("Failed to update billing type. Please try again.");
    } finally {
      setBillingLoading(false);
    }
  };

  const getTopUpAmount = (): number => {
    if (customAmount && Number(customAmount) > 0) return Number(customAmount);
    return selectedAmount || 0;
  };

  const handleTopUp = async () => {
    const amountInr = getTopUpAmount();
    if (!amountInr || amountInr < 1) {
      setErrorMessage("Please select or enter a valid amount.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Create Razorpay order
      const orderRes = await fetch("/api/whatsapp/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_order", amount_inr: amountInr }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Failed to create order");

      const options = {
        key: razorpayKeyId,
        amount: order.amount, // in paise
        currency: "INR",
        name: "ReplyKaro",
        description: "Wallet Top-Up",
        order_id: order.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/whatsapp/wallet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "verify_payment",
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                amount_inr: amountInr,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

            setWalletBalance(verifyData.new_balance_paise ?? walletBalance + amountInr * 100);
            setSuccessMessage(`₹${amountInr} added to your wallet successfully!`);
            setCustomAmount("");
            setSelectedAmount(500);
          } catch (err: any) {
            setErrorMessage(err.message || "Payment verification failed.");
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {},
        theme: { color: "#25D366" },
        modal: {
          ondismiss: () => setIsLoading(false),
        },
      };

      new window.Razorpay(options).open();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate payment.");
      setIsLoading(false);
    }
  };

  const isLowBalance = walletBalance < 10000;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900">Message Wallet</h1>
        <p className="text-slate-500 mt-1 font-medium">
          Top up to send WhatsApp messages via UPI or Indian payments
        </p>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="p-4 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl text-[#25D366] font-semibold text-sm flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 font-semibold text-sm">
          {errorMessage}
        </div>
      )}

      {/* Billing Type Toggle */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Billing Method</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Direct Billing */}
          <button
            onClick={() => handleBillingTypeChange("direct")}
            disabled={billingLoading}
            className={`text-left p-5 rounded-[2rem] border-2 transition-all duration-200 ${
              billingType === "direct"
                ? "border-[#25D366] bg-[#25D366]/5 shadow-md shadow-[#25D366]/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-black text-slate-900 text-sm">Direct Billing</p>
              {billingType === "direct" && (
                <span className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              You pay Meta directly with your international card. ReplyKaro charges <strong>₹0 markup</strong>.
            </p>
          </button>

          {/* Managed Billing */}
          <button
            onClick={() => handleBillingTypeChange("managed")}
            disabled={billingLoading}
            className={`text-left p-5 rounded-[2rem] border-2 transition-all duration-200 ${
              billingType === "managed"
                ? "border-[#25D366] bg-[#25D366]/5 shadow-md shadow-[#25D366]/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-black text-slate-900 text-sm">Managed Billing</p>
              {billingType === "managed" && (
                <span className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Top up here using <strong>UPI, NetBanking</strong>, or any Indian payment. We pay Meta on your behalf.
            </p>
          </button>
        </div>
        {billingLoading && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving preference…
          </div>
        )}
      </div>

      {/* ---- MANAGED BILLING SECTION ---- */}
      {billingType === "managed" && (
        <>
          {/* Balance Card */}
          <div className="bg-[#25D366] rounded-[2rem] p-8 text-white shadow-xl shadow-[#25D366]/30 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white" />
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-bold text-white/70 uppercase tracking-widest mb-1">Wallet Balance</p>
              <p className="text-5xl font-black tracking-tighter">₹{paisaToRupees(walletBalance)}</p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Total Topped Up</p>
                  <p className="font-black text-white/90 mt-0.5">₹{paisaToRupees(wallet.total_topped_up_paise)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Total Spent</p>
                  <p className="font-black text-white/90 mt-0.5">₹{paisaToRupees(wallet.total_spent_paise)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low Balance Warning */}
          {isLowBalance && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-700 text-sm">Low balance!</p>
                <p className="text-amber-600 text-xs mt-0.5">Top up to keep messaging. Balance below ₹100 may pause message delivery.</p>
              </div>
            </div>
          )}

          {/* Rate Card */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              <strong className="text-slate-700">Meta message rates (India):</strong>{" "}
              Marketing: <strong className="text-slate-700">₹0.95</strong> &nbsp;·&nbsp;
              Utility: <strong className="text-slate-700">₹0.16</strong> &nbsp;·&nbsp;
              Incoming: <strong className="text-slate-700">Free</strong>
            </p>
          </div>

          {/* Top-Up Section */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm space-y-5">
            <p className="font-black text-slate-900 text-base">Add Money to Wallet</p>

            {/* Preset Amounts */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Select Amount</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS_INR.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                      selectedAmount === amt && !customAmount
                        ? "bg-[#25D366] text-white shadow-md shadow-[#25D366]/25"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    ₹{amt.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Or Enter Custom Amount</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                  className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                />
              </div>
            </div>

            {/* Add to Wallet Button */}
            <button
              onClick={handleTopUp}
              disabled={isLoading || !getTopUpAmount()}
              className="w-full py-4 bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white font-black rounded-2xl text-sm shadow-lg shadow-[#25D366]/25 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4" />
                  Add ₹{getTopUpAmount().toLocaleString("en-IN")} to Wallet
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 text-center font-medium">
              Payments processed securely via Razorpay. Supports UPI, NetBanking, Cards & more.
            </p>
          </div>

          {/* Transaction History */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <p className="font-black text-slate-900 text-base mb-4">Transaction History</p>
            {transactions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <ArrowUpCircle className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-400 font-semibold text-sm">No transactions yet</p>
                <p className="text-slate-300 text-xs mt-1">Your top-ups and message charges will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === "topup" ? "bg-[#25D366]/10" : "bg-rose-50"
                    }`}>
                      {tx.type === "topup" ? (
                        <ArrowUpCircle className="w-4 h-4 text-[#25D366]" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{formatDate(tx.created_at)}</p>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${tx.type === "topup" ? "text-[#25D366]" : "text-rose-500"}`}>
                      {tx.type === "topup" ? "+" : "-"}₹{paisaToRupees(tx.amount_paise)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- DIRECT BILLING SECTION ---- */}
      {billingType === "direct" && (
        <div className="space-y-4">
          {/* Info Card */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-blue-500">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 15h3M14 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Direct Billing via Meta</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Pay Meta directly using your international Visa or Mastercard. No middleman, zero markup from ReplyKaro.
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-6">
              {[
                { step: "1", text: "Go to Meta Business Manager" },
                { step: "2", text: "Add your Visa or Mastercard under Payment Settings" },
                { step: "3", text: "Meta auto-charges you monthly based on usage" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-black flex items-center justify-center shrink-0">
                    {step}
                  </span>
                  <p className="text-sm font-semibold text-slate-700">{text}</p>
                </div>
              ))}
            </div>

            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#1877F2] hover:bg-[#166fe5] transition-colors text-white font-bold rounded-xl text-sm"
            >
              Open Meta Business Manager
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Tip */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <p className="text-xs font-semibold text-amber-700 leading-relaxed">
              <strong>Don't have an international card?</strong> Switch to Managed Billing above to top up with UPI, NetBanking, or any Indian payment method.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
