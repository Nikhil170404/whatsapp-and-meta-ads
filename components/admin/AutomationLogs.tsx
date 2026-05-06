"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { toast } from "sonner";

export function AutomationLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/automation-logs");
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (err) {
            toast.error("Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <History className="text-primary w-5 h-5" />
                    Polling History (Deep Recovery)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="py-10 text-center text-muted-foreground">Loading polling history...</div>
                ) : logs.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground italic">No polling history found yet.</div>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                                    <th className="h-10 px-4 text-left font-medium text-neutral-400 whitespace-nowrap">Time</th>
                                    <th className="h-10 px-4 text-left font-medium text-neutral-400">Creator</th>
                                    <th className="h-10 px-4 text-left font-medium text-neutral-400">Type</th>
                                    <th className="h-10 px-4 text-center font-medium text-neutral-400">Comments</th>
                                    <th className="h-10 px-4 text-center font-medium text-neutral-400">Queued</th>
                                    <th className="h-10 px-4 text-left font-medium text-neutral-400">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b border-neutral-800 transition-colors hover:bg-neutral-800/30">
                                        <td className="p-4 whitespace-nowrap font-medium text-xs text-neutral-300">
                                            {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-4 text-xs font-bold text-indigo-400">
                                            @{log.owner?.instagram_username || 'unknown'}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant={log.run_type === 'manual_sync' ? 'default' : 'secondary'} className="text-[10px] px-1 h-5">
                                                {log.run_type === 'manual_sync' ? 'MANUAL' : 'AUTO'}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-center font-bold text-white">
                                            {log.comments_found}
                                        </td>
                                        <td className="p-4 text-center text-emerald-400 font-bold">
                                            {log.dms_queued}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant={log.status === 'success' ? 'outline' : 'destructive'} className="text-[10px] px-1 h-5">
                                                {log.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
