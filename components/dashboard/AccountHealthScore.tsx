"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, ShieldAlert, ShieldCheck, Shield, Zap, HelpCircle } from "lucide-react";

type HealthData = {
    score: number;
    label: string;
    color: "green" | "teal" | "amber" | "orange" | "red";
    breakdown: {
        [key: string]: {
            score: number;
            maxPoints: number;
            value: string;
            label: string;
            tooltip?: string;
        };
    };
};

const colorConfig = {
    green: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500", icon: ShieldCheck, border: "border-emerald-100", ring: "ring-emerald-500/20" },
    teal: { bg: "bg-teal-50", text: "text-teal-600", dot: "bg-teal-500", icon: ShieldCheck, border: "border-teal-100", ring: "ring-teal-500/20" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500", icon: Shield, border: "border-amber-100", ring: "ring-amber-500/20" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500", icon: ShieldAlert, border: "border-orange-100", ring: "ring-orange-500/20" },
    red: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500", icon: ShieldAlert, border: "border-rose-100", ring: "ring-rose-500/20" },
};

export function AccountHealthScore() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    const fetchHealth = async () => {
        try {
            const res = await fetch("/api/account-health");
            if (res.ok) {
                setData(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch account health", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        setMounted(true);
        const interval = setInterval(fetchHealth, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) {
        return (
            <Card className="border-slate-100 shadow-sm rounded-[2rem]">
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-6 items-center">
                    <Skeleton className="h-32 w-32 rounded-full" />
                    <div className="space-y-4 flex-grow w-full">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const styles = colorConfig[data.color];
    const Icon = styles.icon;

    return (
        <Card className={`group relative border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]`}>
            {/* Header with decorative background */}
            <div className={`absolute top-0 right-0 w-64 h-64 ${styles.bg} rounded-full -mr-32 -mt-32 blur-[80px] opacity-50 transition-opacity group-hover:opacity-80`} />
            
            <CardHeader className="relative z-10 pb-4 border-b border-slate-50/50">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className={`flex items-center gap-2.5 text-xl font-black tracking-tight ${styles.text}`}>
                            <div className={`p-2 rounded-xl ${styles.bg} ${styles.ring} ring-1`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            Account Safety Score
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium text-xs mt-1.5 flex items-center gap-2">
                            <Zap className="h-3 w-3 text-amber-500" />
                            Live algorithmic risk monitoring
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="relative z-10 pt-8 flex flex-col md:flex-row gap-10 items-center">
                {/* Left Side: Score Gauge */}
                <div className="flex flex-col items-center justify-center min-w-[180px]">
                    <div className="relative flex items-center justify-center w-40 h-40">
                        {/* SVG Gauge Background */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="50%" cy="50%" r="70"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-slate-50"
                            />
                            <circle
                                cx="50%" cy="50%" r="70"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={440}
                                strokeDashoffset={440 - (440 * (mounted ? data.score : 0)) / 100}
                                strokeLinecap="round"
                                className={`${styles.text} transition-all duration-[1500ms] cubic-bezier(0.4, 0, 0.2, 1)`}
                            />
                        </svg>
                        
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="flex items-baseline gap-0.5">
                                <span className={`text-5xl font-black tracking-tighter ${styles.text}`}>
                                    {data.score}
                                </span>
                                <span className="text-sm font-bold text-slate-400">/100</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className={`mt-6 px-5 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm ring-1 ${styles.border} ${styles.bg} ${styles.text} animate-in fade-in zoom-in duration-700`}>
                        {data.label} STATUS
                    </div>
                </div>

                {/* Right Side: Breakdown List */}
                <div className="flex-grow w-full space-y-2.5">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
                        <div className="w-1 h-3 bg-slate-200 rounded-full" />
                        Risk Factor Breakdown
                    </div>
                    
                    {Object.entries(data.breakdown).map(([key, factor]) => {
                        const pct = factor.score / factor.maxPoints;
                        const statusColor = pct >= 0.8 ? "text-emerald-500" : pct >= 0.5 ? "text-amber-500" : "text-rose-500";
                        const dotColor = pct >= 0.8 ? "bg-emerald-500" : pct >= 0.5 ? "bg-amber-500" : "bg-rose-500";
                        const barBg = pct >= 0.8 ? "bg-emerald-50" : pct >= 0.5 ? "bg-amber-50" : "bg-rose-50";

                        return (
                            <div key={key} className="group/item relative flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-lg hover:shadow-slate-100/50 border border-transparent hover:border-slate-100 transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pct >= 0.8 ? 'animate-pulse' : ''}`} />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-bold text-slate-700 leading-none">{factor.label}</span>
                                            {factor.tooltip && (
                                                <div className="group/tip relative flex items-center">
                                                    <HelpCircle className="h-3 w-3 text-slate-300 cursor-help transition-colors group-hover/tip:text-slate-500" />
                                                    {/* Custom Tooltip */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2.5 bg-slate-900 text-[10px] font-bold text-white rounded-xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                                        {factor.tooltip}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                            {factor.value}
                                        </span>
                                    </div>
                                    <div className={`flex flex-col items-end min-w-[50px]`}>
                                        <span className={`text-[13px] font-black ${statusColor}`}>
                                            {factor.score}<span className="text-slate-400/50 ml-0.5">/{factor.maxPoints}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            
            {/* Legend / Security Footer */}
            <div className="mt-8 px-8 py-5 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal
                    </span>
                    <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" /> Warning
                    </span>
                    <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500" /> Risk
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" />
                    Secure Data
                </div>
            </div>
        </Card>
    );
}
