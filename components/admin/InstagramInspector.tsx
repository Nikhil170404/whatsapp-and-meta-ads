"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    Instagram, 
    ShieldAlert, 
    CheckCircle2, 
    Clock, 
    AlertCircle,
    Zap,
    MessageSquare,
    Eye
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InstagramInspector() {
    const [username, setUsername] = useState("");
    const [mediaId, setMediaId] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const handleInspect = async () => {
        if (!username || !mediaId) {
            toast.error("Please enter both Username and Media ID");
            return;
        }

        setLoading(true);
        setResults(null);
        try {
            const res = await fetch("/api/admin/instagram/inspect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, mediaId })
            });
            const data = await res.json();
            if (res.ok) {
                setResults(data);
                toast.success(`Fetched ${data.comments?.length || 0} live comments!`);
            } else {
                toast.error(data.error || "Inspection failed");
            }
        } catch (err) {
            toast.error("Network error during inspection");
        } finally {
            setLoading(false);
        }
    };

    const processIndividual = async (commentId: string, ownerId: string) => {
        setProcessing(commentId);
        try {
            const res = await fetch("/api/admin/comments/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetMediaId: mediaId, userId: ownerId }),
            });
            if (res.ok) {
                toast.success("Recovery triggered! The DM queue will process it.");
                // Mark as sent locally
                setResults((prev: any) => ({
                    ...prev,
                    comments: prev.comments.map((c: any) => 
                        c.id === commentId ? { ...c, dmSent: true, isInDatabase: true } : c
                    )
                }));
            } else {
                toast.error("Failed to process");
            }
        } catch (err) {
            toast.error("Process error");
        } finally {
            setProcessing(null);
        }
    };

    return (
        <Card className="w-full bg-neutral-900 border-neutral-800 h-full flex flex-col">
            <CardHeader className="border-b border-neutral-800 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                    <Search className="text-indigo-500 w-5 h-5" />
                    Live Instagram Inspector
                </CardTitle>
                <p className="text-xs text-neutral-500">Fetch and inspect real-time comments directly from Instagram.</p>
            </CardHeader>
            <CardContent className="p-4 space-y-4 flex-1 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">Creator Username</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">@</span>
                            <input 
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 p-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                                placeholder="eg: nain_kids_wear"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-500 px-1">Media ID</label>
                        <input 
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                            placeholder="eg: 178... (Long string of numbers)"
                            value={mediaId}
                            onChange={(e) => setMediaId(e.target.value)}
                        />
                    </div>
                </div>

                <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 shadow-lg shadow-indigo-500/10"
                    onClick={handleInspect}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Eye className="w-4 h-4 mr-2 animate-pulse" />
                            Fetching Live Data...
                        </>
                    ) : (
                        <>
                            <Instagram className="w-4 h-4 mr-2" />
                            Inspect Media Comments
                        </>
                    )}
                </Button>

                {results && (
                    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Summary Headers */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Live Comments</span>
                                <span className="text-xl font-bold text-white">{results.comments?.length || 0}</span>
                            </div>
                            <div className="p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Active Automations</span>
                                <span className="text-xl font-bold text-white">{results.automations?.length || 0}</span>
                            </div>
                        </div>

                        {/* Comments Table */}
                        <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/30">
                            <div className="max-h-[400px] overflow-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-neutral-800/80 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-left font-bold text-neutral-400">User</th>
                                            <th className="p-3 text-left font-bold text-neutral-400">Comment</th>
                                            <th className="p-3 text-center font-bold text-neutral-400">Status</th>
                                            <th className="p-3 text-right font-bold text-neutral-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800">
                                        {results.comments.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-10 text-center text-neutral-500">No comments found for this Media ID.</td>
                                            </tr>
                                        ) : (
                                            results.comments.map((comment: any) => (
                                                <tr key={comment.id} className={cn("group transition-colors", comment.dmSent ? "bg-emerald-500/5" : "hover:bg-neutral-800/20")}>
                                                    <td className="p-3 font-bold text-indigo-400 align-top">@{comment.from?.username || comment.username || 'user'}</td>
                                                    <td className="p-3 text-neutral-300 align-top italic line-clamp-2 max-w-[200px]">"{comment.text}"</td>
                                                    <td className="p-3 align-top text-center">
                                                        {comment.dmSent ? (
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 py-0 text-[9px]">SENT</Badge>
                                                        ) : comment.isInDatabase ? (
                                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-1 py-0 text-[9px]">PENDING</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-neutral-500/10 text-neutral-400 border-neutral-500/20 px-1 py-0 text-[9px]">OFF-SQL</Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-3 align-top text-right">
                                                        {!comment.dmSent && (
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost"
                                                                onClick={() => processIndividual(comment.id, comment.ownerId)}
                                                                disabled={processing === comment.id}
                                                                className="h-7 px-2 text-[10px] bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white"
                                                            >
                                                                {processing === comment.id ? <Zap className="w-3 h-3 animate-pulse" /> : "Process"}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
