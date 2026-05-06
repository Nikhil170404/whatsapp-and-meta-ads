"use client";

import { ShieldCheck, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface HealthBannerProps {
    webhookSubscribed?: boolean;
}

export function HealthBanner({ webhookSubscribed = true }: HealthBannerProps) {
    const [isResubscribing, setIsResubscribing] = useState(false);
    const router = useRouter();

    const handleResubscribe = async () => {
        setIsResubscribing(true);
        try {
            const res = await fetch("/api/webhooks/resubscribe", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                router.refresh(); 
            } else {
                alert(data.error || "Failed to resubscribe. Your account may be restricted or in developer mode.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setIsResubscribing(false);
        }
    };

    if (!webhookSubscribed) {
        return (
            <div className="relative overflow-hidden bg-rose-500 rounded-[2.5rem] p-6 lg:p-8 group shadow-2xl shadow-rose-500/20 border border-rose-400">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/30 shrink-0 shadow-xl">
                            <AlertTriangle className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-1 text-center lg:text-left">
                            <h3 className="text-xl font-black text-white tracking-tight">
                                Comment Automation is Paused
                            </h3>
                            <p className="text-white/80 font-medium text-sm leading-relaxed max-w-md">
                                Instagram couldn't connect your account fully. Click fix to re-sync and activate your comment replies.
                            </p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleResubscribe} 
                        disabled={isResubscribing}
                        className="w-full lg:w-auto lg:h-14 h-12 px-8 rounded-2xl bg-white text-rose-600 hover:bg-rose-50 font-black text-[13px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isResubscribing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Fix Connection"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-6 lg:p-8 group transition-all duration-700 hover:shadow-2xl hover:shadow-teal-500/10 border border-white/5">
            {/* Animated Background Blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -ml-32 -mb-32 group-hover:translate-x-10 transition-transform duration-1000" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/20 shrink-0 shadow-2xl">
                        <ShieldCheck className="h-7 w-7 text-teal-400" />
                    </div>
                    <div className="space-y-1 text-center lg:text-left">
                        <h3 className="text-xl font-black text-white tracking-tight">
                            Account Safety & Queue Health
                        </h3>
                        <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-md">
                            Monitor your real-time Meta API usage, queue depth, and automated safety limits.
                        </p>
                    </div>
                </div>

                <Link href="/dashboard/health" className="w-full lg:w-auto">
                    <Button className="w-full lg:h-14 h-12 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-[13px] uppercase tracking-widest shadow-xl backdrop-blur-md border border-white/10 gap-3 group/btn transition-all active:scale-95">
                        View Dashboard
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
