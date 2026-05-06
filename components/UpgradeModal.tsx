"use client";

import { useState } from "react";
import { X, Zap, Crown, Check, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan: string;
    limitType: "automations" | "dms" | "accounts";
    currentUsage: number;
    maxAllowed: number;
    nextPlan?: {
        name: string;
        price: string;
        benefits: string[];
    };
}

export default function UpgradeModal({
    isOpen,
    onClose,
    currentPlan,
    limitType,
    currentUsage,
    maxAllowed,
    nextPlan,
}: UpgradeModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const remaining = Math.max(0, maxAllowed - currentUsage);
    const pct = Math.min(100, Math.round((currentUsage / maxAllowed) * 100));
    const isAtLimit = currentUsage >= maxAllowed;

    const getLimitMessage = () => {
        switch (limitType) {
            case "automations":
                return `You've used all ${maxAllowed} automations on your plan.`;
            case "dms":
                return isAtLimit
                    ? `Monthly DM quota reached (${currentUsage.toLocaleString()}/${maxAllowed.toLocaleString()}). DMs are queued.`
                    : `Only ${remaining.toLocaleString()} DMs left this month (${pct}% used).`;
            case "accounts":
                return `You've connected ${currentUsage}/${maxAllowed} accounts.`;
            default:
                return "You've reached your plan limit.";
        }
    };

    const handleUpgrade = () => {
        setLoading(true);
        router.push("/dashboard/billing");
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Bottom sheet on mobile, centered modal on sm+ */}
            <div className="bg-white w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div
                        className={cn(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-lg",
                            isAtLimit
                                ? "bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/30"
                                : "bg-gradient-to-br from-primary to-purple-600 shadow-primary/30"
                        )}
                    >
                        {isAtLimit ? (
                            <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        ) : (
                            <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors touch-manipulation"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Title */}
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1.5">
                    {isAtLimit ? "Limit Reached 🚫" : "Upgrade Required 🚀"}
                </h2>
                <p className="text-sm text-slate-500 font-medium mb-5">{getLimitMessage()}</p>

                {/* Progress bar for DMs */}
                {limitType === "dms" && (
                    <div className="mb-5">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"
                                )}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 font-medium mt-1.5">
                            <span>{currentUsage.toLocaleString()} used</span>
                            <span>{maxAllowed.toLocaleString()} limit</span>
                        </div>
                    </div>
                )}

                {/* Current Plan Badge */}
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl mb-5">
                    <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Current Plan</p>
                        <p className="text-sm font-black text-slate-900">{currentPlan}</p>
                    </div>
                </div>

                {/* Next Plan Suggestion */}
                {nextPlan && (
                    <div className="border-2 border-primary/20 bg-primary/5 rounded-2xl p-4 sm:p-5 mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[10px] text-primary font-black uppercase tracking-widest">Recommended</p>
                                <p className="text-base sm:text-lg font-black text-slate-900">{nextPlan.name}</p>
                            </div>
                            <p className="text-lg sm:text-xl font-black text-primary">{nextPlan.price}</p>
                        </div>
                        <ul className="space-y-2">
                            {nextPlan.benefits.map((benefit, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                    <span>{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* CTA Buttons */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl font-bold border-slate-200 text-sm touch-manipulation"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className={cn(
                            "flex-1 h-12 rounded-xl font-black gap-2 text-sm touch-manipulation",
                            isAtLimit
                                ? "bg-rose-500 text-white hover:bg-rose-600"
                                : "bg-primary text-white hover:opacity-90",
                            loading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {loading ? "Loading..." : "View Plans"}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
