"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    MessageSquare,
    Loader2,
    Play,
    Search,
    Send,
    Trash2,
    Eye,
    EyeOff,
    CornerDownRight,
    X,
    Check,
    ChevronLeft,
    Clock,
    Heart,
    AlertCircle,
    RefreshCw,
    RotateCcw,
    Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Media {
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp: string;
    permalink: string;
}

interface Comment {
    id: string;
    text: string;
    timestamp: string;
    username: string;
    like_count?: number;
    hidden?: boolean;
    parent_id?: string;
    dm_sent?: boolean;
}

type ToastType = "success" | "error";

interface Toast {
    message: string;
    type: ToastType;
}

interface CommentManagerProps {
    instagramUsername: string;
}

export default function CommentManager({ instagramUsername }: CommentManagerProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const myUsername = instagramUsername.toLowerCase();

    // Post selection state
    const [posts, setPosts] = useState<Media[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Media | null>(null);
    const [postSearch, setPostSearch] = useState("");

    // Comments state
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentNextCursor, setCommentNextCursor] = useState<string | null>(null);

    // Action states
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [newCommentText, setNewCommentText] = useState("");
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncResults, setSyncResults] = useState<{ queued: number; skipped: number } | null>(null);
    const [rateLimitData, setRateLimitData] = useState<any>(null);

    // Toast
    const [toast, setToast] = useState<Toast | null>(null);

    // Read post ID from URL on mount
    const postIdFromUrl = searchParams.get("post");

    useEffect(() => {
        fetchPosts();
        fetchUserSettings();
        fetchRateLimits();
        
        const interval = setInterval(fetchRateLimits, 60000); // Refresh every minute
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchRateLimits() {
        try {
            const res = await fetch("/api/user/rate-limits");
            if (res.ok) {
                const data = await res.json();
                setRateLimitData(data);
            }
        } catch (error) {
            console.error("Error fetching rate limits:", error);
        }
    }

    async function fetchUserSettings() {
        try {
            const res = await fetch("/api/user/settings");
            if (res.ok) {
                // Settings fetched successfully
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    }

    // Auto-select post from URL once posts finish loading
    useEffect(() => {
        if (postIdFromUrl && posts.length > 0 && !selectedPost) {
            const match = posts.find((p) => p.id === postIdFromUrl);
            if (match) {
                setSelectedPost(match);
                fetchComments(match.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postIdFromUrl, posts]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    function showToast(message: string, type: ToastType) {
        setToast({ message, type });
    }

    // =========================================
    // Data Fetching
    // =========================================

    async function fetchPosts() {
        setLoadingPosts(true);
        try {
            // Fetch all posts by following pagination
            let allMedia: Media[] = [];
            let cursor: string | null = null;
            let hasMore = true;

            while (hasMore) {
                const url: string = cursor ? `/api/reels?after=${cursor}` : "/api/reels";
                const res: Response = await fetch(url);
                if (!res.ok) break;

                const data: { media?: Media[]; nextCursor?: string | null } = await res.json();
                if (data.media && data.media.length > 0) {
                    allMedia = [...allMedia, ...data.media];
                }
                cursor = data.nextCursor ?? null;
                hasMore = !!cursor;
            }

            setPosts(allMedia);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoadingPosts(false);
        }
    }

    async function fetchComments(mediaId: string, cursor?: string) {
        setLoadingComments(true);
        try {
            const url = cursor
                ? `/api/comments?media_id=${mediaId}&after=${cursor}`
                : `/api/comments?media_id=${mediaId}`;
            const res = await fetch(url);

            if (!res.ok) {
                showToast("Failed to fetch comments", "error");
                return;
            }

            const data = await res.json();
            if (cursor) {
                setComments((prev) => [...prev, ...(data.comments || [])]);
            } else {
                setComments(data.comments || []);
            }
            setCommentNextCursor(data.nextCursor || null);
        } catch (error) {
            console.error("Error fetching comments:", error);
            showToast("Error loading comments", "error");
        } finally {
            setLoadingComments(false);
        }
    }

    function selectPost(post: Media) {
        setSelectedPost(post);
        setComments([]);
        setCommentNextCursor(null);
        setReplyingTo(null);
        fetchComments(post.id);
        handleSyncAll(post.id); // AUTO-SYNC FOR THIS POST ONLY
        // Persist in URL so refresh stays on this post
        router.replace(`/dashboard/comments?post=${post.id}`, { scroll: false });
    }

    function goBack() {
        setSelectedPost(null);
        setComments([]);
        router.replace("/dashboard/comments", { scroll: false });
    }

    // =========================================
    // Comment Actions
    // =========================================

    async function handleReply(commentId: string) {
        if (!replyText.trim()) return;
        setActionLoading(`reply-${commentId}`);
        try {
            const res = await fetch(`/api/comments/${commentId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: replyText }),
            });

            if (res.ok) {
                showToast("Reply sent successfully!", "success");
                setReplyingTo(null);
                setReplyText("");
                // Refresh comments to show the new reply
                if (selectedPost) fetchComments(selectedPost.id);
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to reply", "error");
            }
        } catch {
            showToast("Network error", "error");
        } finally {
            setActionLoading(null);
        }
    }

    async function handleCreateComment() {
        if (!newCommentText.trim() || !selectedPost) return;
        setActionLoading("create-comment");
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ media_id: selectedPost.id, message: newCommentText }),
            });

            if (res.ok) {
                showToast("Comment posted!", "success");
                setNewCommentText("");
                fetchComments(selectedPost.id);
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to post comment", "error");
            }
        } catch {
            showToast("Network error", "error");
        } finally {
            setActionLoading(null);
        }
    }



    async function handleDelete(commentId: string) {
        if (!confirm("Are you sure you want to delete this comment? This cannot be undone.")) return;
        setActionLoading(`delete-${commentId}`);
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                showToast("Comment deleted!", "success");
                setComments((prev) => prev.filter((c) => c.id !== commentId));
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to delete", "error");
            }
        } catch {
            showToast("Network error", "error");
        } finally {
            setActionLoading(null);
        }
    }

    async function handleHide(commentId: string, currentlyHidden: boolean) {
        setActionLoading(`hide-${commentId}`);
        try {
            const res = await fetch(`/api/comments/${commentId}/hide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hide: !currentlyHidden }),
            });

            if (res.ok) {
                showToast(`Comment ${currentlyHidden ? "unhidden" : "hidden"}!`, "success");
                setComments((prev) =>
                    prev.map((c) => (c.id === commentId ? { ...c, hidden: !currentlyHidden } : c))
                );
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to update", "error");
            }
        } catch {
            showToast("Network error", "error");
        } finally {
            setActionLoading(null);
        }
    }


    async function handleSyncAll(mediaId?: string) {
        setIsSyncingAll(true);
        setSyncResults(null);
        try {
            const res = await fetch("/api/comments/sync-all", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mediaId })
            });
            if (!res.ok) throw new Error("Sync failed");
            const data = await res.json();
            setSyncResults({ queued: data.queued, skipped: data.skipped });
            showToast(`Sync Complete: Queued ${data.queued} new DMs`, "success");
            // If we have a selected post, refresh it
            if (selectedPost) fetchComments(selectedPost.id);
        } catch (error: any) {
            showToast(error.message || "Sync failed", "error");
        } finally {
            setIsSyncingAll(false);
        }
    }

    // =========================================
    // Helpers
    // =========================================

    function timeAgo(timestamp: string) {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 30) return then.toLocaleDateString();
        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return "Just now";
    }

    const filteredPosts = posts.filter((p) =>
        (p.caption || "").toLowerCase().includes(postSearch.toLowerCase())
    );

    // =========================================
    // Render
    // =========================================

    // Loading state
    if (loadingPosts) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">
                    Loading your posts...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            {/* Toast Notification */}
            {toast && (
                <div
                    className={cn(
                        "fixed top-6 right-6 z-[100] px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 animate-in slide-in-from-right-5 fade-in duration-300",
                        toast.type === "success"
                            ? "bg-green-500 text-white"
                            : "bg-rose-500 text-white"
                    )}
                >
                    {toast.type === "success" ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    {toast.message}
                </div>
            )}

            {/* If no post selected — show post picker */}
            {!selectedPost ? (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-1">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                Select a Post
                            </h2>
                            <p className="text-xs text-slate-400 font-semibold">
                                Choose a post to view and manage its comments
                            </p>
                        </div>
                    </div>

                    {/* Search & Global Sync */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by caption..."
                                value={postSearch}
                                onChange={(e) => setPostSearch(e.target.value)}
                                className="w-full bg-white border border-slate-100 rounded-xl h-10 pl-10 pr-4 text-sm font-bold text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                            />
                        </div>

                        {/* Engagement Health Card */}
                        {rateLimitData && (
                            <div className="flex items-center gap-4 bg-white border border-slate-100 rounded-xl px-4 h-10 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                                        Hourly Usage
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={cn(
                                                    "h-full transition-all duration-500",
                                                    (rateLimitData.hourly.used / rateLimitData.hourly.limit) > 0.8 ? "bg-rose-500" : "bg-primary"
                                                )}
                                                style={{ width: `${Math.min(100, (rateLimitData.hourly.used / rateLimitData.hourly.limit) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600">
                                            {rateLimitData.hourly.used}/{rateLimitData.hourly.limit}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-[1px] h-4 bg-slate-100" />

                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                                        DM Queue
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className={cn(
                                            "text-[10px] font-bold",
                                            rateLimitData.queue.pending > 0 ? "text-primary" : "text-slate-600"
                                        )}>
                                            {rateLimitData.queue.pending} Pending
                                        </span>
                                        {rateLimitData.queue.pending > 0 && (
                                            <span className="text-[8px] text-slate-400 animate-pulse italic">
                                                • Delivering...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Post Grid */}
                    {filteredPosts.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-20 text-center">
                            <Play className="h-16 w-16 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 text-base font-bold">No posts found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredPosts.map((post) => (
                                <button
                                    key={post.id}
                                    onClick={() => selectPost(post)}
                                    className="relative group rounded-2xl overflow-hidden bg-white border-2 border-transparent hover:border-primary/40 shadow-sm hover:shadow-lg transition-all duration-300 text-left"
                                >
                                    <div className="aspect-square overflow-hidden relative">
                                        <img
                                            src={
                                                post.thumbnail_url ||
                                                post.media_url ||
                                                "/placeholder-reel.jpg"
                                            }
                                            alt={post.caption || "Post"}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                        {/* Hover label */}
                                        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                            <div className="flex items-center gap-1.5 text-white">
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    View Comments
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Caption */}
                                    <div className="p-3">
                                        <p className="text-[11px] text-slate-500 font-semibold line-clamp-2 leading-relaxed">
                                            {post.caption || "No caption"}
                                        </p>
                                        <p className="text-[9px] text-slate-300 font-bold mt-1 uppercase tracking-wider">
                                            {post.media_type === "REELS" ? "🎬 Reel" : "📸 Photo"}
                                            {" · "}
                                            {timeAgo(post.timestamp)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Post selected — show comments */
                <div className="space-y-6">
                    {/* Back Button + Post Preview */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={goBack}
                            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all active:scale-90"
                        >
                            <ChevronLeft className="h-5 w-5 text-slate-600" />
                        </button>

                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                                <img
                                    src={
                                        selectedPost.thumbnail_url ||
                                        selectedPost.media_url ||
                                        "/placeholder-reel.jpg"
                                    }
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-black text-slate-900 tracking-tight truncate">
                                    Comments
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold truncate">
                                    {selectedPost.caption?.substring(0, 60) || "No caption"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSyncAll(selectedPost.id)}
                                disabled={isSyncingAll}
                                className={cn(
                                    "h-10 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-primary/10",
                                    isSyncingAll
                                        ? "bg-slate-100 text-slate-400"
                                        : "bg-primary text-white hover:bg-primary/90"
                                )}
                            >
                                {isSyncingAll ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Sync Post
                            </button>
                            <button
                                onClick={() => fetchComments(selectedPost.id)}
                                disabled={loadingComments}
                                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all active:scale-90"
                                title="Refresh comments"
                            >
                                <RefreshCw
                                    className={cn(
                                        "h-4 w-4 text-slate-500",
                                        loadingComments && "animate-spin"
                                    )}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Comment Count */}
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {comments.length} Comment{comments.length !== 1 ? "s" : ""}{" "}
                            {loadingComments ? "· Loading..." : ""}
                        </p>
                    </div>

                    {/* Comments List */}
                    {loadingComments && comments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                                Fetching comments...
                            </p>
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-16 text-center">
                            <MessageSquare className="h-14 w-14 text-slate-100 mx-auto mb-3" />
                            <p className="text-slate-400 text-sm font-bold">
                                No comments on this post
                            </p>
                            <p className="text-slate-300 text-xs mt-1">
                                Comments will appear here when people engage
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Create Comment Input */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <Plus className="h-3 w-3 inline mr-1" />
                                    Add a Comment
                                </p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            placeholder="Write a comment..."
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleCreateComment()}
                                            className="w-full h-10 pl-4 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreateComment}
                                        disabled={actionLoading === "create-comment" || !newCommentText.trim()}
                                        className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black shadow-sm shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {actionLoading === "create-comment" ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5" />
                                        )}
                                        Post
                                    </button>
                                </div>
                            </div>
                            {comments.map((comment) => {
                                const isReplying = replyingTo === comment.id;
                                const isLoading = actionLoading?.includes(comment.id);
                                const isOwnComment = myUsername && comment.username?.toLowerCase() === myUsername;

                                return (
                                    <div
                                        key={comment.id}
                                        className={cn(
                                            "bg-white rounded-2xl border p-4 transition-all duration-200",
                                            comment.hidden
                                                ? "border-amber-200 bg-amber-50/30"
                                                : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                                        )}
                                    >
                                        {/* Comment Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                                                    {(comment.username || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate">
                                                        @{comment.username || "unknown"}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {timeAgo(comment.timestamp)}
                                                        {(comment.like_count ?? 0) > 0 && (
                                                            <>
                                                                <span>·</span>
                                                                <Heart className="h-2.5 w-2.5" />
                                                                {comment.like_count}
                                                            </>
                                                        )}
                                                        {comment.dm_sent && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="flex items-center gap-1 text-green-500 font-black uppercase tracking-tighter text-[9px] bg-green-50 px-1.5 py-0.5 rounded border border-green-100 shadow-sm">
                                                                    <Check className="h-2.5 w-2.5" />
                                                                    Sent
                                                                </span>
                                                            </>
                                                        )}
                                                        {comment.hidden && (
                                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[8px] font-black uppercase">
                                                                Hidden
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        setReplyingTo(isReplying ? null : comment.id);
                                                        setReplyText("");
                                                    }}
                                                    disabled={!!isLoading}
                                                    className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
                                                    title="Reply"
                                                >
                                                    <CornerDownRight className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleHide(comment.id, !!comment.hidden)
                                                    }
                                                    disabled={!!isLoading}
                                                    className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-500 transition-all"
                                                    title={comment.hidden ? "Unhide" : "Hide"}
                                                >
                                                    {comment.hidden ? (
                                                        <Eye className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(comment.id)}
                                                    disabled={!!isLoading}
                                                    className="w-7 h-7 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Comment Text */}
                                        <p className="mt-2 text-sm text-slate-700 font-medium leading-relaxed pl-[42px]">
                                            {comment.text}
                                        </p>

                                        {/* Reply Input */}
                                        {isReplying && (
                                            <div className="mt-3 pl-[42px] flex items-center gap-2">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Write a reply..."
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && replyText.trim()) {
                                                                handleReply(comment.id);
                                                            }
                                                        }}
                                                        className="w-full h-9 pl-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            setReplyingTo(null);
                                                            setReplyText("");
                                                        }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => handleReply(comment.id)}
                                                    disabled={
                                                        actionLoading === `reply-${comment.id}` ||
                                                        !replyText.trim()
                                                    }
                                                    className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-sm shadow-primary/20 transition-all disabled:opacity-50 active:scale-90"
                                                >
                                                    {actionLoading === `reply-${comment.id}` ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Load More button */}
                            {commentNextCursor && (
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={() =>
                                            selectedPost &&
                                            fetchComments(selectedPost.id, commentNextCursor)
                                        }
                                        disabled={loadingComments}
                                        className="h-10 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {loadingComments ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            "Load More Comments"
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
