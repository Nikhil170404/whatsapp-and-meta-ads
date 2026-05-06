"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, Send, Loader2, Zap, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueData {
    pending: number;
    processing: number;
    failed: number;
    nextSendAt: string | null;
    estimatedMinutes: number | null;
    hourlyLimit: number;
    // Rolling window data
    sentThisHour: number;
    sentDMs: number;
    sentComments: number;
    slotsAvailable: number;
    queueDepth: number;
    estimatedClearMinutes: number | null;
}

export function QueueStatus({ className }: { className?: string }) {
    const [queue, setQueue] = useState<QueueData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchQueue() {
            try {
                const res = await fetch("/api/queue-status");
                if (res.ok) {
                    const data = await res.json();
                    setQueue(data);
                }
            } catch (error) {
                console.error("Failed to fetch queue status:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchQueue();
        const interval = setInterval(fetchQueue, 15000); // Refresh every 15s for live feel
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-white/50 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-8 flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-6 w-6 text-slate-300 animate-spin" />
            </div>
        );
    }

    if (!queue) return null;

    const hasActivity = queue.pending > 0 || queue.processing > 0 || queue.sentThisHour > 0 || queue.failed > 0;

    if (!hasActivity) {
        return (
            <div className="bg-white/50 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
                        <Send className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Queue Status</p>
                        <p className="text-lg font-black text-slate-900 tracking-tight">All Clear</p>
                    </div>
                </div>
                <p className="text-sm text-slate-400 font-medium">No messages in queue. Ready for action.</p>
            </div>
        );
    }

    const usagePercent = queue.hourlyLimit > 0 ? Math.min(100, Math.round((queue.sentThisHour / queue.hourlyLimit) * 100)) : 0;
    const isHighUsage = usagePercent >= 80;
    const isMediumUsage = usagePercent >= 50;

    // Format clear time
    const formatClearTime = (minutes: number | null) => {
        if (minutes === null || minutes <= 0) return "Processing now...";
        if (minutes < 60) return `~${minutes} min`;
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `~${hrs}h ${mins}m` : `~${hrs}h`;
    };

    return (
        <div className="bg-white/50 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <Gauge className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Live Throughput</p>
                        <p className="text-lg font-black text-slate-900 tracking-tight">Queue Monitor</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live</span>
                </div>
            </div>

            {/* Throughput Meter */}
            <div className="space-y-3">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                            {queue.sentThisHour}
                            <span className="text-lg text-slate-300 font-bold">/{queue.hourlyLimit}</span>
                        </p>
                        <p className="text-xs font-bold text-slate-400 mt-1">sent in last 60 min</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1.5">
                            <Zap className={cn("h-4 w-4", isHighUsage ? "text-amber-500" : "text-emerald-500")} />
                            <span className={cn(
                                "text-sm font-black tracking-tight",
                                isHighUsage ? "text-amber-600" : isMediumUsage ? "text-indigo-600" : "text-emerald-600"
                            )}>
                                {queue.slotsAvailable} slots free
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out",
                            isHighUsage
                                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                : isMediumUsage
                                    ? "bg-gradient-to-r from-indigo-400 to-violet-500"
                                    : "bg-gradient-to-r from-emerald-400 to-teal-500"
                        )}
                        style={{ width: `${usagePercent}%` }}
                    />
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_3s_ease-in-out_infinite] -translate-x-full" />
                </div>

                {/* Split counts */}
                <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                    <span>{queue.sentDMs} DMs</span>
                    <span className="opacity-30">•</span>
                    <span>{queue.sentComments} Replies</span>
                    <span className="opacity-30">•</span>
                    <span>{usagePercent}% capacity</span>
                </div>
            </div>

            {/* Queue Depth Card */}
            {queue.queueDepth > 0 && (
                <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500/5 via-primary/5 to-indigo-500/5 rounded-2xl border border-indigo-200/50 p-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_3s_ease-in-out_infinite] -translate-x-full" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                                <Send className="h-4.5 w-4.5 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-slate-900 tracking-tight">
                                        {queue.queueDepth.toLocaleString()} message{queue.queueDepth !== 1 ? "s" : ""} queued
                                    </p>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                </div>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">
                                    {queue.estimatedClearMinutes
                                        ? `Clears in ${formatClearTime(queue.estimatedClearMinutes)}`
                                        : "Processing now..."}
                                    <span className="mx-2 opacity-30">•</span>
                                    <span className="text-primary/70">{queue.hourlyLimit}/hr rolling speed</span>
                                </p>
                            </div>
                        </div>

                        <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-100">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Auto-Send
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing Card */}
            {queue.processing > 0 && (
                <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-400/5 to-amber-500/5 rounded-2xl border border-amber-200/50 p-4">
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <Loader2 className="h-4.5 w-4.5 text-amber-600 animate-spin" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">
                                {queue.processing} message{queue.processing !== 1 ? "s" : ""} sending now
                            </p>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">
                                Actively being delivered
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Failed Card */}
            {queue.failed > 0 && (
                <div className="bg-rose-50/80 rounded-2xl border border-rose-200/50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-rose-700">
                                {queue.failed} message{queue.failed !== 1 ? "s" : ""} failed
                            </p>
                            <p className="text-xs text-rose-400 font-medium">
                                Will auto-retry on next cycle
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
