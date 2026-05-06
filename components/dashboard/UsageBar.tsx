"use client";

import { useEffect, useState } from "react";
import { Zap, ArrowRight, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageData {
    used: number;
    limit: number;
    percentage: number;
    isUnlimited: boolean;
    planName: string;
    planType: string;
    hourlyLimit?: number;
    nextResetDate?: string;
}

interface UsageBarProps {
    className?: string;
    compact?: boolean;
}

export function UsageBar({ className, compact = false }: UsageBarProps) {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsage() {
            try {
                const res = await fetch("/api/usage");
                if (res.ok) {
                    const data = await res.json();
                    setUsage(data);
                }
            } catch (error) {
                console.error("Failed to fetch usage:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchUsage();
    }, []);

    if (loading) {
        return (
            <div className={cn("animate-pulse", className)}>
                <div className="h-16 bg-slate-100 rounded-2xl" />
            </div>
        );
    }

    if (!usage || usage.isUnlimited) return null;

    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + "K";
        return num.toString();
    };

    const remaining = Math.max(0, usage.limit - usage.used);
    const pct = usage.percentage;

    const barColor = pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-primary";
    const badgeColor =
        pct >= 95
            ? "text-rose-600 bg-rose-50 border border-rose-200"
            : pct >= 75
            ? "text-amber-600 bg-amber-50 border border-amber-200"
            : "text-primary bg-primary/10 border border-primary/20";

    const resetDateText = usage.nextResetDate
        ? `Resets ${new Date(usage.nextResetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "";

    // ── Compact sidebar variant ──
    if (compact) {
        return (
            <div className={cn("px-4", className)}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Monthly DMs</span>
                    <span className={cn("font-bold px-1.5 py-0.5 rounded-md text-[10px]", badgeColor)}>
                        {pct}%
                    </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{formatNumber(usage.used)} used</span>
                    <span>{formatNumber(remaining)} left</span>
                </div>
                {pct >= 80 && (
                    <a
                        href="/dashboard/billing"
                        className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
                    >
                        Upgrade <ArrowRight className="h-3 w-3" />
                    </a>
                )}
            </div>
        );
    }

    // ── Full variant ──
    return (
        <div
            className={cn(
                "rounded-2xl border",
                pct >= 95
                    ? "bg-rose-50/60 border-rose-200"
                    : pct >= 75
                    ? "bg-amber-50/40 border-amber-200"
                    : "bg-slate-50/50 border-slate-100",
                className
            )}
        >
            {/* Critical banner */}
            {pct >= 95 && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                        Limit almost reached — DMs will be queued
                    </p>
                </div>
            )}

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div
                            className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center",
                                pct >= 95
                                    ? "bg-rose-100"
                                    : pct >= 75
                                    ? "bg-amber-100"
                                    : "bg-primary/10"
                            )}
                        >
                            {pct >= 75 ? (
                                <AlertTriangle className={cn("w-4 h-4", pct >= 95 ? "text-rose-500" : "text-amber-500")} />
                            ) : (
                                <Zap className="w-4 h-4 text-primary" />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-700">Monthly DMs</p>
                            <p className="text-[10px] text-slate-400">{usage.planName}</p>
                        </div>
                    </div>
                    <span className={cn("text-xs font-black px-2 py-1 rounded-lg", badgeColor)}>{pct}%</span>
                </div>

                {/* Bar */}
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${pct}%` }}
                    />
                </div>

                {/* Counts row */}
                <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-500">
                        <span className="font-black text-slate-700">{formatNumber(usage.used)}</span>
                        {" / "}
                        {formatNumber(usage.limit)}
                    </span>
                    <div className="flex items-center gap-2">
                        {remaining > 0 && (
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {formatNumber(remaining)} left
                            </span>
                        )}
                        {resetDateText && (
                            <span className="text-[10px] font-bold text-slate-400">{resetDateText}</span>
                        )}
                    </div>
                </div>

                {/* Upgrade prompt */}
                {pct >= 80 && (
                    <a
                        href="/dashboard/billing"
                        className={cn(
                            "mt-3 flex items-center justify-between w-full px-3 py-2.5 rounded-xl font-black text-xs transition-all",
                            pct >= 95
                                ? "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/30"
                                : "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20"
                        )}
                    >
                        <span>
                            {pct >= 100
                                ? "Quota reached — Upgrade to resume"
                                : pct >= 95
                                ? "Almost out — Upgrade now"
                                : "Upgrade for more DMs"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
                    </a>
                )}
            </div>
        </div>
    );
}
