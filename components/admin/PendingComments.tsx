"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Send, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, Zap, Instagram, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PendingComments() {
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [processingCreator, setProcessingCreator] = useState<string | null>(null);
    const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
    const [repairingAll, setRepairingAll] = useState(false);
    const [togglingSync, setTogglingSync] = useState<string | null>(null);
    const [syncStatuses, setSyncStatuses] = useState<Record<string, boolean>>({});

    // Initialize sync statuses from pending data
    useEffect(() => {
        const statuses: Record<string, boolean> = {};
        pending.forEach(c => {
            statuses[c.user_id] = c.users?.is_sync_enabled ?? true;
        });
        setSyncStatuses(statuses);
    }, [pending]);

    const toggleSync = async (creatorId: string, currentState: boolean) => {
        setTogglingSync(creatorId);
        try {
            const res = await fetch("/api/admin/users/sync-toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: creatorId, is_sync_enabled: !currentState })
            });
            if (res.ok) {
                setSyncStatuses(prev => ({ ...prev, [creatorId]: !currentState }));
                toast.success(`Sync for this creator ${!currentState ? "Enabled" : "Paused"}`);
            } else {
                toast.error("Failed to update sync status");
            }
        } catch (err) {
            toast.error("Network error toggling sync");
        } finally {
            setTogglingSync(null);
        }
    };
    const [repairProgress, setRepairProgress] = useState({ current: 0, total: 0 });
    const [automations, setAutomations] = useState<any[]>([]);
    const [selectedAutomations, setSelectedAutomations] = useState<Record<string, string>>({}); // commentId -> automationId
    const [globalAutomationId, setGlobalAutomationId] = useState<string>("");

    const fetchPending = async () => {
        setLoading(true);
        try {
            const [pendingRes, automationsRes] = await Promise.all([
                fetch("/api/admin/comments/pending"),
                fetch("/api/admin/automations")
            ]);
            
            const [pendingData, automationsData] = await Promise.all([
                pendingRes.json(),
                automationsRes.json()
            ]);

            setPending(pendingData.pending || []);
            setAutomations(automationsData.automations || []);
        } catch (err) {
            toast.error("Failed to fetch pending data");
        } finally {
            setLoading(false);
        }
    };

    const processComment = async (comment: any, skipToast = false) => {
        const commentId = comment.id;
        const mediaId = comment.media_id;
        const ownerId = comment.user_id;
        const forcedAutomationId = selectedAutomations[commentId];

        setProcessingId(commentId);
        try {
            const res = await fetch("/api/admin/comments/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    targetMediaId: mediaId, 
                    userId: ownerId, 
                    commentId, // Platform UUID (for DB updates)
                    instagramCommentId: comment.instagram_comment_id, // External ID (for logs)
                    commentText: comment.text,
                    commenterUsername: comment.username,
                    forcedAutomationId // UI Override
                }),
            });
            if (res.ok) {
                if (!skipToast) toast.success("Comment processed!");
                setPending(prev => prev.filter(c => c.id !== commentId));
            } else {
                if (!skipToast) toast.error("Process failed");
            }
        } catch (err) {
            if (!skipToast) toast.error("Error processing");
        } finally {
            setProcessingId(null);
        }
    };

    const repairAll = async () => {
        if (pending.length === 0) return;
        setRepairingAll(true);
        const total = pending.length;
        setRepairProgress({ current: 0, total });

        // Clone to avoid concurrent modification issues during iteration
        const toRepair = [...pending];

        for (let i = 0; i < toRepair.length; i++) {
            const comment = toRepair[i];
            setRepairProgress({ current: i + 1, total });
            await processComment(comment, true);
            // Throttle to avoid rate limits or overwhelming the server
            await new Promise(r => setTimeout(r, 400));
        }

        setRepairingAll(false);
        fetchPending();
        toast.success(`Repair All complete! Processed ${total} items.`);
    };

    const processAllForCreator = async (userId: string, username: string, fullAccount: boolean = false) => {
        setProcessingCreator(userId);
        try {
            const res = await fetch("/api/admin/comments/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, fullAccountMode: fullAccount }),
            });
            if (res.ok) {
                toast.success(fullAccount ? `Mega Sync started for @${username}!` : `Standard Sync started for @${username}!`);
                fetchPending();
            } else {
                toast.error("Process failed");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setProcessingCreator(null);
        }
    };

    const grouped = useMemo(() => {
        return pending.reduce((acc: any, comment: any) => {
            const creator = comment.users?.instagram_username || comment.owner?.instagram_username || "unknown";
            if (!acc[creator]) {
                acc[creator] = { 
                    username: creator, 
                    userId: comment.user_id, 
                    is_sync_enabled: comment.users?.is_sync_enabled ?? true,
                    comments: [] 
                };
            }
            acc[creator].comments.push(comment);
            return acc;
        }, {});
    }, [pending]);

    useEffect(() => {
        fetchPending();
    }, []);

    if (loading) return (
        <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-neutral-900 animate-pulse rounded-xl" />)}
        </div>
    );

    return (
        <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="border-b border-neutral-800 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-500" />
                        Unsent Comments (24h)
                    </CardTitle>
                    <p className="text-xs text-neutral-500 mt-1">Grouped by creator. Action required to maintain engagement metrics.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Global Automation Selector */}
                    <div className="flex items-center gap-2 mr-2 bg-neutral-950/50 p-1 px-2 rounded-lg border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 font-bold uppercase">Global Automation:</span>
                        <select 
                            className="h-7 text-[10px] bg-transparent border-none text-indigo-400 outline-none w-32 font-bold cursor-pointer"
                            value={globalAutomationId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setGlobalAutomationId(val);
                                // Bulk update all individual selectors
                                const newSelected: Record<string, string> = {};
                                pending.forEach(c => {
                                    newSelected[c.id] = val;
                                });
                                setSelectedAutomations(newSelected);
                            }}
                            disabled={repairingAll}
                        >
                            <option value="">Auto-Match</option>
                            {automations.map(a => (
                                <option key={a.id} value={a.id} className="bg-neutral-900 text-white">
                                    @{a.users?.instagram_username || 'unknown'} {a.trigger_keyword ? `[${a.trigger_keyword}]` : "[Any Post]"} {a.media_id ? `(${a.media_id.substring(a.media_id.length - 4)})` : `(..${a.id.substring(0,4)})`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button 
                        size="sm" 
                        variant="outline"
                        className="bg-green-600/10 hover:bg-green-600/20 text-green-500 border-green-600/30 font-bold border-2"
                        onClick={repairAll}
                        disabled={repairingAll || pending.length === 0}
                    >
                        {repairingAll ? (
                            <Wrench className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        {repairingAll ? `Repairing ${repairProgress.current}/${repairProgress.total}...` : `Repair All (${pending.length})`}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={fetchPending} className="text-neutral-400 hover:text-white" disabled={repairingAll}>
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {Object.keys(grouped).length === 0 ? (
                    <div className="p-12 text-center text-neutral-500 italic">All systems nominal. No missed comments.</div>
                ) : (
                    <div className="divide-y divide-neutral-800">
                        {Object.values(grouped).map((group: any) => (
                            <div key={group.username} className="group overflow-hidden">
                                <div className="p-4 bg-neutral-900/50 flex items-center justify-between hover:bg-neutral-800/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-500">
                                            <Instagram className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white">@{group.username}</h4>
                                            <p className="text-[10px] text-neutral-500">{group.comments.length} items grouped</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold cursor-pointer transition-all ${syncStatuses[group.userId] !== false ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
                                            onClick={() => toggleSync(group.userId, syncStatuses[group.userId] !== false)}
                                        >
                                            {togglingSync === group.userId ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <div className={`w-1.5 h-1.5 rounded-full ${syncStatuses[group.userId] !== false ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                                            )}
                                            {syncStatuses[group.userId] !== false ? "SYNC ACTIVE" : "SYNC PAUSED"}
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700 h-8 text-[11px]"
                                            onClick={() => processAllForCreator(group.userId, group.username, false)}
                                            disabled={processingCreator === group.userId || repairingAll || syncStatuses[group.userId] === false}
                                        >
                                            Standard Sync
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 text-[11px] shadow-lg shadow-indigo-500/20"
                                            onClick={() => processAllForCreator(group.userId, group.username, true)}
                                            disabled={processingCreator === group.userId || repairingAll || syncStatuses[group.userId] === false}
                                        >
                                            <Zap className={cn("w-3 h-3 mr-1", processingCreator === group.userId && "animate-pulse")} />
                                            Mega Sync
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-neutral-500 hover:text-white h-8 w-8 p-0"
                                            onClick={() => setExpandedCreator(expandedCreator === group.username ? null : group.username)}
                                        >
                                            {expandedCreator === group.username ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {expandedCreator === group.username && (
                                    <div className="bg-neutral-950/40 p-2 space-y-1">
                                        {group.comments.map((comment: any) => (
                                            <div key={comment.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-800/50 bg-neutral-900/30">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-xs text-white">@{comment.username}</span>
                                                        <span className="text-[9px] text-neutral-500 uppercase">
                                                            {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-400 line-clamp-1 italic">"{comment.text}"</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Automation Selector Dropdown */}
                                                    <select 
                                                        className="h-7 text-[10px] bg-neutral-800 border-neutral-700 rounded px-1 text-neutral-300 outline-none w-36"
                                                        value={selectedAutomations[comment.id] || ""}
                                                        onChange={(e) => setSelectedAutomations(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                                        disabled={processingId === comment.id || repairingAll}
                                                    >
                                                        <option value="">Auto-Match</option>
                                                        {automations.filter(a => a.user_id === comment.user_id).map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.trigger_keyword ? `[${a.trigger_keyword}]` : "[Any Post]"} {a.media_id ? `(${a.media_id.substring(a.media_id.length - 4)})` : `(..${a.id.substring(0,4)})`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        className="h-7 text-[10px] text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                                                        onClick={() => processComment(comment)}
                                                        disabled={processingId === comment.id || repairingAll}
                                                    >
                                                        <Send className="w-3 h-3 mr-1.5" />
                                                        Repair
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
