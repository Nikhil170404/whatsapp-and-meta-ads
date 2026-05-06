"use client";

import { useState } from "react";
import {
    X,
    ChevronRight,
    ChevronLeft,
    Zap,
    MessageSquare,
    Link as LinkIcon,
    Plus,
    Check,
    Smartphone,
    Info,
    Users,
    Trash2,
    Shuffle,
    Heart,
    Gift,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";
import { hasFeature } from "@/lib/pricing";

interface Media {
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
}

interface AutomationWizardProps {
    selectedMedia: Media | null;
    initialData?: any;
    globalFanRewards?: Array<{ points: number; title: string; link: string }>;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    saving: boolean;
    planType?: string;
}

export default function AutomationWizard({ selectedMedia, initialData, globalFanRewards, onClose, onSave, saving, planType }: AutomationWizardProps) {
    const [step, setStep] = useState(1);

    // State for different steps
    const [triggerType, setTriggerType] = useState<"specific" | "any" | "next" | "story">(
        initialData
            ? (initialData.trigger_type === "story_reply" ? "story" :
                (initialData.trigger_type === "all_posts" || initialData.media_id === "ALL_MEDIA" ? "any" :
                    (initialData.trigger_type === "next_posts" || initialData.media_id === "NEXT_MEDIA" ? "next" :
                        (initialData.media_id === "DIRECT_MESSAGE" ? "specific" : "specific"))))
            : (selectedMedia?.id === "STORY_AUTOMATION" ? "story" :
                (selectedMedia?.id === "ALL_MEDIA" ? "any" :
                    (selectedMedia?.id === "NEXT_MEDIA" ? "next" :
                        (selectedMedia?.id === "DIRECT_MESSAGE" ? "specific" : "specific"))))
    );
    const [matchingType, setMatchingType] = useState<"any" | "keyword">(
        initialData
            ? (initialData.trigger_keyword === null ? "any" : "keyword")
            : "keyword"
    );
    const [keywords, setKeywords] = useState(initialData?.trigger_keyword || "");
    const [replyToComments, setReplyToComments] = useState(!!initialData?.comment_reply || !!(initialData?.comment_reply_templates?.length));

    // Comment reply templates
    const defaultTemplates = [
        "Check your DMs! 📬",
        "Just sent you a message! 💌",
        "Sent! Check your inbox 🔥",
        "DM sent! Go check it out ✨",
        "You've got mail! 📩",
    ];
    const [commentReplyTemplates, setCommentReplyTemplates] = useState<string[]>(
        initialData?.comment_reply_templates?.length
            ? initialData.comment_reply_templates
            : initialData?.comment_reply
                ? [initialData.comment_reply]
                : ["Check your DMs! 📬"]
    );
    const [newReplyTemplate, setNewReplyTemplate] = useState("");

    const [openingDM, setOpeningDM] = useState(initialData?.reply_message || "Hey! Thanks for being part of my community 😊\n\nClick below and I'll send you the details in just a sec ✨");
    const [buttonText, setButtonText] = useState(initialData?.button_text || "Show me more");
    const [showOpeningDM, setShowOpeningDM] = useState(true);

    const [finalDM, setFinalDM] = useState(initialData?.final_message || "Here is the link you requested! ✨");
    const [finalButtonText, setFinalButtonText] = useState(initialData?.final_button_text || "Open Link");
    const [linkUrl, setLinkUrl] = useState(initialData?.link_url || "");
    const [requireFollow, setRequireFollow] = useState(initialData?.require_follow ?? true);
    const [followGateMessage, setFollowGateMessage] = useState(initialData?.follow_gate_message || "Hey! 👋 To unlock this, please follow us first!");
    const [respondToReplies, setRespondToReplies] = useState(initialData?.respond_to_replies || false);
    const [ignoreSelfComments, setIgnoreSelfComments] = useState(initialData?.ignore_self_comments ?? true);
    const [additionalButtons, setAdditionalButtons] = useState<Array<{ button_text: string; link_url: string }>>(
        initialData?.additional_buttons || []
    );

    // Fan Engine state
    const [fanMode, setFanMode] = useState(initialData?.fan_mode || false);
    const [fanRewards, setFanRewards] = useState<Array<{ points: number; title: string; link: string }>>(
        globalFanRewards?.length ? globalFanRewards : (initialData?.fan_rewards?.length ? initialData.fan_rewards : [])
    );

    // Follow-up DM state
    const [followupEnabled, setFollowupEnabled] = useState(initialData?.followup_enabled || false);
    const [followupMessage, setFollowupMessage] = useState(
        initialData?.followup_message || "Hey! 👋 Just checking in — did you get a chance to look at the link I sent? Let me know if you have any questions!"
    );
    const [newRewardPoints, setNewRewardPoints] = useState("");
    const [newRewardTitle, setNewRewardTitle] = useState("");
    const [newRewardLink, setNewRewardLink] = useState("");

    const nextStep = () => setStep(s => Math.min(s + 1, 4));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleSave = () => {
        let finalTriggerType = (triggerType === "story" || selectedMedia?.media_type === "STORY") ? "story_reply" : (matchingType === "any" ? "any" : "keyword");
        let finalMediaId = triggerType === "story" ? "STORY_AUTOMATION" : (triggerType === "specific" ? (selectedMedia?.id || initialData?.media_id) : null);

        // Distinguish Any vs Next vs Direct DM
        if (triggerType === "any" && selectedMedia?.id !== "DIRECT_MESSAGE") {
            finalTriggerType = "all_posts";
            finalMediaId = "ALL_MEDIA";
        } else if (triggerType === "next") {
            finalTriggerType = "next_posts";
            finalMediaId = "NEXT_MEDIA";
        } else if (selectedMedia?.id === "DIRECT_MESSAGE" || finalMediaId === "DIRECT_MESSAGE") {
            // Force Direct DMs to stay as keyword/any and use DIRECT_MESSAGE ID
            finalTriggerType = matchingType === "any" ? "any" : "keyword";
            finalMediaId = "DIRECT_MESSAGE";
        }

        const isDirectDm = selectedMedia?.id === "ALL_MEDIA" || selectedMedia?.id === "DIRECT_MESSAGE" || finalMediaId === "ALL_MEDIA" || finalMediaId === "DIRECT_MESSAGE";

        onSave({
            id: initialData?.id,
            trigger_type: finalTriggerType,
            trigger_keyword: (triggerType === "story" || matchingType === "any") ? null : keywords,
            reply_message: openingDM,
            comment_reply: !isDirectDm && replyToComments && triggerType !== "story" && commentReplyTemplates.length > 0 ? commentReplyTemplates[0] : null,
            comment_reply_templates: !isDirectDm && replyToComments && triggerType !== "story" ? commentReplyTemplates : null,
            button_text: buttonText,
            link_url: linkUrl,
            final_message: finalDM,
            final_button_text: finalButtonText,
            require_follow: requireFollow,
            follow_gate_message: requireFollow ? followGateMessage : null,
            respond_to_replies: respondToReplies,
            ignore_self_comments: ignoreSelfComments,
            media_id: finalMediaId,
            fan_mode: fanMode,
            fan_rewards: fanMode ? fanRewards : [],
            additional_buttons: additionalButtons,
            followup_enabled: followupEnabled,
            followup_message: followupEnabled ? followupMessage : null,
        });
    };

    const getPlanBadge = () => {
        const type = (planType || "").toLowerCase();
        if (type.includes("starter")) return { label: "STARTER", color: "bg-amber-500 text-white" };
        if (type.includes("pro")) return { label: "PRO", color: "bg-primary text-white" };
        return { label: "FREE", color: "bg-emerald-500 text-white" };
    };

    const activeBadge = getPlanBadge();

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-900/40 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="flex h-full items-end md:items-center justify-center p-0 md:p-6 lg:p-12">
                {/* Wizard Container */}
                <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl bg-white md:rounded-[2.5rem] shadow-[0_20px_100px_-20px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">

                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 md:px-8 md:pt-6 md:pb-5 border-b border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                                    {initialData ? "Edit Automation" : "Create Automation"}
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mt-0.5">
                                    {step === 1 ? "Trigger" : step === 2 ? "Matching" : step === 3 ? "Auto-Reply" : "Logic Settings"}
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Step progress bar */}
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={cn(
                                    "h-2.5 flex-1 rounded-full transition-all duration-500",
                                    s < step ? "bg-primary" : s === step ? "bg-primary" : "bg-slate-100"
                                )} />
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-1.5">Step {step} of 4</p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-5 md:space-y-8 flex flex-col">

                        {/* STEP 1: TRIGGER TYPE */}
                        {step === 1 && (
                            <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300 flex-1 flex flex-col justify-center">
                                <h3 className="text-lg md:text-xl font-bold text-slate-900">
                                    {selectedMedia?.media_type === "STORY" || triggerType === "story" ? "Setup story trigger" : "Select a trigger"}
                                </h3>
                                <div className="space-y-3">
                                    {selectedMedia?.id !== "STORY_AUTOMATION" && selectedMedia?.id !== "ALL_MEDIA" && selectedMedia?.id !== "NEXT_MEDIA" && selectedMedia?.id !== "DIRECT_MESSAGE" && (
                                        <>
                                            <button
                                                onClick={() => setTriggerType("specific")}
                                                className={cn(
                                                    "w-full text-left p-3 md:p-4 rounded-2xl border-2 transition-all flex items-start gap-3 md:gap-4",
                                                    triggerType === "specific" ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-slate-100 hover:border-slate-200"
                                                )}
                                            >
                                                <div className={cn("mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all", triggerType === "specific" ? "border-primary" : "border-slate-300")}>
                                                    {triggerType === "specific" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {selectedMedia?.media_type === "STORY" ? "A specific story" : "A specific post or reel"}
                                                    </p>
                                                    {selectedMedia && triggerType === "specific" && (
                                                        <div className="mt-3 md:mt-4 flex gap-3 p-2 md:p-3 bg-white rounded-xl border border-primary/10 items-center">
                                                            <div className="w-10 h-10 md:w-12 md:h-16 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                                                                <SafeImage
                                                                    src={selectedMedia.thumbnail_url || selectedMedia.media_url}
                                                                    className="w-full h-full object-cover"
                                                                    alt=""
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] md:text-xs text-slate-500 line-clamp-2 leading-relaxed">{selectedMedia.caption || "No caption provided"}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </button>

                                            {selectedMedia?.media_type !== "STORY" && (
                                                <button
                                                    onClick={() => setTriggerType("any")}
                                                    className={cn(
                                                        "w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 relative overflow-hidden",
                                                        triggerType === "any" ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200 opacity-60"
                                                    )}
                                                >
                                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", triggerType === "any" ? "border-primary" : "border-slate-300")}>
                                                        {triggerType === "any" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-900">Any post or reel</p>
                                                    </div>
                                                    <Badge className={cn("border-none font-bold text-[10px] py-0.5", (planType || "").toLowerCase().includes("free") ? "bg-green-500 text-white" : "bg-primary text-white")}>
                                                        {(planType || "").toLowerCase().includes("free") ? "FREE" : "PRO"}
                                                    </Badge>
                                                </button>
                                            )}

                                            {selectedMedia?.media_type !== "STORY" && (
                                                <button
                                                    onClick={() => setTriggerType("next")}
                                                    className={cn(
                                                        "w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 relative overflow-hidden",
                                                        triggerType === "next" ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200 opacity-60"
                                                    )}
                                                >
                                                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", triggerType === "next" ? "border-primary" : "border-slate-300")}>
                                                        {triggerType === "next" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-900">Next post or reel</p>
                                                    </div>
                                                    <Badge className={cn("border-none font-bold text-[10px] py-0.5", (planType || "").toLowerCase().includes("free") ? "bg-green-500 text-white" : "bg-primary text-white")}>
                                                        {(planType || "").toLowerCase().includes("free") ? "FREE" : "PRO"}
                                                    </Badge>
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {(selectedMedia?.id === "ALL_MEDIA" || selectedMedia?.id === "NEXT_MEDIA" || selectedMedia?.id === "DIRECT_MESSAGE" || selectedMedia?.id === "STORY_AUTOMATION") && (
                                        <div className="p-5 md:p-8 bg-primary/5 rounded-2xl md:rounded-[2.5rem] border-2 border-primary/20 text-center space-y-3 md:space-y-4 animate-in zoom-in duration-300">
                                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl md:rounded-2xl shadow-sm border border-primary/10 flex items-center justify-center mx-auto">
                                                {selectedMedia?.id === "STORY_AUTOMATION" ? (
                                                    <Shuffle className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
                                                ) : selectedMedia?.id === "DIRECT_MESSAGE" ? (
                                                    <MessageSquare className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                                                ) : (
                                                    <Zap className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <h4 className="text-base md:text-xl font-black text-slate-900 leading-tight">
                                                    {selectedMedia?.id === "ALL_MEDIA" ? "Any Post Automation" :
                                                        selectedMedia?.id === "NEXT_MEDIA" ? "Next Post Automation" :
                                                            selectedMedia?.id === "STORY_AUTOMATION" ? "Any Story Automation" :
                                                                "Direct DM Automation"}
                                                </h4>
                                                <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
                                                    {selectedMedia?.id === "ALL_MEDIA" ? "This rule will apply to any post or reel you have already published on your account." :
                                                        selectedMedia?.id === "NEXT_MEDIA" ? "This rule will automatically apply to the very next post or reel you upload to Instagram." :
                                                            selectedMedia?.id === "STORY_AUTOMATION" ? "This rule will automatically respond to anyone who replies to your Instagram stories." :
                                                                "This rule will apply to anyone who sends you a DM directly, regardless of which post they saw."}
                                                </p>
                                            </div>
                                            <Badge className="bg-primary/10 text-primary border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                                                {selectedMedia?.id === "STORY_AUTOMATION" ? "STORY TRIGGER" :
                                                    selectedMedia?.id === "DIRECT_MESSAGE" ? "DM TRIGGER" :
                                                        "POST TRIGGER"}
                                            </Badge>
                                        </div>
                                    )}


                                </div>
                            </div>
                        )}

                        {/* STEP 2: COMMENT/REPLY MATCHING */}
                        {step === 2 && (
                            <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300 text-slate-900">
                                <h3 className="text-lg md:text-xl font-bold">
                                    {(selectedMedia?.media_type === "STORY" || triggerType === "story")
                                        ? "And this reply has..."
                                        : (selectedMedia?.id === "DIRECT_MESSAGE" ? "When someone DMs me..." : "When someone interacts...")
                                    }
                                </h3>

                                <div className="space-y-4">
                                    <div className={cn("p-6 rounded-3xl border-2 transition-all space-y-4", matchingType === "keyword" ? "border-primary bg-primary/5" : "border-slate-100")}>
                                        <button onClick={() => setMatchingType("keyword")} className="w-full flex items-center gap-3">
                                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", matchingType === "keyword" ? "border-primary" : "border-slate-300")}>
                                                {matchingType === "keyword" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                            </div>
                                            <span className="text-sm font-bold">A specific word or words</span>
                                        </button>

                                        {matchingType === "keyword" && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <input
                                                    type="text"
                                                    value={keywords}
                                                    onChange={(e) => setKeywords(e.target.value)}
                                                    placeholder="Enter a word or multiple..."
                                                    className="w-full h-12 px-6 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary shadow-sm text-sm font-semibold placeholder:text-slate-400"
                                                />
                                                <p className="text-[11px] text-slate-400 font-bold px-1 tracking-wide uppercase">Use commas to separate words</p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {["Price", "Link", "Shop", "Info"].map(tag => (
                                                        <button
                                                            key={tag}
                                                            onClick={() => setKeywords((prev: string) => prev ? `${prev}, ${tag}` : tag)}
                                                            className="px-4 py-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-full text-[11px] font-bold text-slate-600 transition-colors shadow-sm"
                                                        >
                                                            + {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setMatchingType("any")}
                                        className={cn("w-full p-6 text-left rounded-3xl border-2 transition-all flex items-center gap-3", matchingType === "any" ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200")}
                                    >
                                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", matchingType === "any" ? "border-primary" : "border-slate-300")}>
                                            {matchingType === "any" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                        </div>
                                        <span className="text-sm font-bold">Any word</span>
                                    </button>
                                </div>

                                <div className={cn(
                                    "rounded-[32px] border transition-all overflow-hidden",
                                    replyToComments ? "border-primary/30 bg-primary/5" : "border-slate-100 bg-slate-50/50",
                                    (selectedMedia?.media_type === "STORY" || triggerType === "story" || selectedMedia?.id === "DIRECT_MESSAGE") && "hidden" // Hide public comment reply for stories and global DMs
                                )}>
                                    <div className="flex items-center justify-between p-6 group">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center transition-colors",
                                                replyToComments ? "bg-primary text-white" : "bg-white text-slate-400 group-hover:text-primary"
                                            )}>
                                                <MessageSquare className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Public reply to comments</p>
                                                <p className="text-[11px] text-slate-400 font-medium">Randomly picks from your templates</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setReplyToComments(!replyToComments)}
                                            className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", replyToComments ? "bg-primary" : "bg-slate-200")}
                                        >
                                            <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", replyToComments ? "translate-x-[20px]" : "translate-x-0")} />
                                        </button>
                                    </div>

                                    {/* Reply Templates Section */}
                                    {replyToComments && (
                                        <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {/* Templates List */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Shuffle className="h-3 w-3" />
                                                        Reply Templates ({commentReplyTemplates.length})
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 font-medium">Random pick per reply</span>
                                                </div>

                                                {commentReplyTemplates.map((template, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 group/item">
                                                        <div className="flex-1 px-4 py-2.5 bg-white rounded-xl border border-slate-100 text-sm font-medium text-slate-700 flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            {template}
                                                        </div>
                                                        <button
                                                            onClick={() => setCommentReplyTemplates(prev => prev.filter((_, i) => i !== idx))}
                                                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover/item:opacity-100"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add Custom Template */}
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newReplyTemplate}
                                                    onChange={(e) => setNewReplyTemplate(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && newReplyTemplate.trim()) {
                                                            setCommentReplyTemplates(prev => [...prev, newReplyTemplate.trim()]);
                                                            setNewReplyTemplate("");
                                                        }
                                                    }}
                                                    placeholder="Type a reply template..."
                                                    className="flex-1 h-10 px-4 bg-white rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary text-sm font-medium placeholder:text-slate-400"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (newReplyTemplate.trim()) {
                                                            setCommentReplyTemplates(prev => [...prev, newReplyTemplate.trim()]);
                                                            setNewReplyTemplate("");
                                                        }
                                                    }}
                                                    disabled={!newReplyTemplate.trim()}
                                                    className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black shadow-sm shadow-primary/20 transition-all disabled:opacity-40 flex items-center gap-1.5"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Add
                                                </button>
                                            </div>

                                            {/* Quick Add Suggestions */}
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Add</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {defaultTemplates
                                                        .filter(t => !commentReplyTemplates.includes(t))
                                                        .map(suggestion => (
                                                            <button
                                                                key={suggestion}
                                                                onClick={() => setCommentReplyTemplates(prev => [...prev, suggestion])}
                                                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-full text-[11px] font-bold text-slate-600 transition-colors shadow-sm"
                                                            >
                                                                + {suggestion}
                                                            </button>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100 group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">
                                                {selectedMedia?.id === "DIRECT_MESSAGE" || triggerType === "story" || selectedMedia?.media_type === "STORY" ? "Reply to every message" : "Reply to every comment"}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                {selectedMedia?.id === "DIRECT_MESSAGE" || triggerType === "story" || selectedMedia?.media_type === "STORY" ? "Respond even if they keep messaging" : "Auto-respond even if they comment again"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setRespondToReplies(!respondToReplies)}
                                        className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", respondToReplies ? "bg-primary" : "bg-slate-200")}
                                    >
                                        <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", respondToReplies ? "translate-x-[20px]" : "translate-x-0")} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100 group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                            <Smartphone className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">
                                                {selectedMedia?.id === "DIRECT_MESSAGE" || triggerType === "story" || selectedMedia?.media_type === "STORY" ? "Ignore my own replies" : "Ignore my own comments"}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                {selectedMedia?.id === "DIRECT_MESSAGE" || triggerType === "story" || selectedMedia?.media_type === "STORY" ? "Prevents self-automation in DMs" : "Prevents self-automation loops"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIgnoreSelfComments(!ignoreSelfComments)}
                                        className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", ignoreSelfComments ? "bg-primary" : "bg-slate-200")}
                                    >
                                        <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", ignoreSelfComments ? "translate-x-[20px]" : "translate-x-0")} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: OPENING DM */}
                        {step === 3 && (
                            <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-300 text-slate-900">
                                <h3 className="text-lg md:text-xl font-bold">They will get...</h3>

                                <div className="bg-slate-50/50 border border-slate-100 rounded-[32px] p-6 space-y-6 relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-110 transition-transform" />

                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-3">
                                            <Zap className="h-5 w-5 text-primary" />
                                            <span className="text-sm font-bold">{selectedMedia?.id === "DIRECT_MESSAGE" ? "DM Message" : "Reply Message"}</span>
                                        </div>
                                        <button
                                            onClick={() => setShowOpeningDM(!showOpeningDM)}
                                            className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", showOpeningDM ? "bg-primary" : "bg-slate-200")}
                                        >
                                            <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", showOpeningDM ? "translate-x-[20px]" : "translate-x-0")} />
                                        </button>
                                    </div>

                                    {showOpeningDM && (
                                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 relative z-10">
                                            <div className="relative">
                                                <textarea
                                                    value={openingDM}
                                                    onChange={(e) => setOpeningDM(e.target.value)}
                                                    rows={5}
                                                    className={cn(
                                                        "w-full p-6 bg-white rounded-2xl border-none ring-1 focus:ring-2 shadow-sm text-sm font-medium resize-none leading-relaxed",
                                                        openingDM.length > 640 ? "ring-rose-500 focus:ring-rose-500" : (openingDM.length > 580 ? "ring-amber-400 focus:ring-amber-400" : "ring-slate-100 focus:ring-primary")
                                                    )}
                                                />
                                                <div className="flex items-center justify-between mt-2 px-1">
                                                    <p className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider",
                                                        openingDM.length > 640 ? "text-rose-500" : (openingDM.length > 580 ? "text-amber-500" : "text-slate-400")
                                                    )}>
                                                        {openingDM.length > 640 ? "⛔ Too long. Use fewer words." : (openingDM.length > 580 ? "⚠️ Nearing limit" : "Character count")}
                                                    </p>
                                                    <span className={cn(
                                                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                                                        openingDM.length > 640 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {openingDM.length}/640
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-400 font-bold px-1 uppercase tracking-widest">Button Text</p>
                                                <input
                                                    type="text"
                                                    value={buttonText}
                                                    onChange={(e) => setButtonText(e.target.value)}
                                                    className="w-full h-12 px-6 bg-white rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-sm font-bold text-center text-primary"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {/* Follow-Gate Toggle */}
                                    <div className={cn(
                                        "group rounded-[32px] border transition-all overflow-hidden",
                                        requireFollow ? "border-primary/30 bg-primary/5" : "border-slate-100 bg-slate-50/50"
                                    )}>
                                        <div className="flex items-center justify-between p-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center transition-colors",
                                                    requireFollow ? "bg-primary text-white" : "bg-white text-slate-400 group-hover:text-primary"
                                                )}>
                                                    <Users className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold">Require Follow First</span>
                                                    <p className="text-[11px] text-slate-400">Users must follow to unlock content</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge className={cn("border-none font-bold text-[10px] py-0.5 shadow-sm", activeBadge.color)}>
                                                    {activeBadge.label}
                                                </Badge>
                                                <button
                                                    onClick={() => setRequireFollow(!requireFollow)}
                                                    className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", requireFollow ? "bg-primary" : "bg-slate-200")}
                                                >
                                                    <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", requireFollow ? "translate-x-[20px]" : "translate-x-0")} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Follow-Gate Preview & Editor */}
                                        {requireFollow && (
                                            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {/* Preview Card */}
                                                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                                                    <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 px-4 py-2 border-b border-slate-100">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">📱 DM Preview</span>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        {/* Simulated Card */}
                                                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                                                            <div className="flex gap-3">
                                                                <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden">
                                                                    {selectedMedia?.thumbnail_url || selectedMedia?.media_url ? (
                                                                        <SafeImage src={selectedMedia.thumbnail_url || selectedMedia.media_url} className="w-full h-full object-cover" alt="" />
                                                                    ) : (
                                                                        <Zap className="w-6 h-6" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-slate-900 text-sm">🔒 Follow to Unlock</p>
                                                                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{followGateMessage}</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex gap-2">
                                                                <div className="flex-1 bg-primary text-white text-center py-2 rounded-lg text-xs font-bold">
                                                                    Follow & Get Access
                                                                </div>
                                                                <div className="flex-1 bg-white border border-slate-200 text-slate-700 text-center py-2 rounded-lg text-xs font-bold">
                                                                    I'm Following ✓
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Editable Message */}
                                                <div className="space-y-2">
                                                    <p className="text-[11px] text-slate-400 font-bold px-1 uppercase tracking-widest">Follow-Gate Message</p>
                                                    <textarea
                                                        value={followGateMessage}
                                                        onChange={(e) => setFollowGateMessage(e.target.value)}
                                                        rows={2}
                                                        placeholder="Hey! 👋 To unlock this, please follow us first!"
                                                        className="w-full p-4 bg-white rounded-xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-sm font-medium resize-none leading-relaxed"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* STEP 4: FINAL REWARD */}
                        {step === 4 && (
                            <div className="space-y-5 md:space-y-8 animate-in slide-in-from-right-4 duration-300 text-slate-900">
                                <h3 className="text-lg md:text-xl font-bold">And then, they will get...</h3>

                                <div className="space-y-4 md:space-y-6">
                                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl md:rounded-[32px] p-5 md:p-8 space-y-5 md:space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <LinkIcon className="h-5 w-5 text-primary" />
                                            <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Final Reward (The Link)</span>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-bold px-1 mb-2 uppercase tracking-wide">Final Message</p>
                                                <textarea
                                                    value={finalDM}
                                                    onChange={(e) => setFinalDM(e.target.value)}
                                                    placeholder="Write a message..."
                                                    rows={3}
                                                    className={cn(
                                                        "w-full p-6 bg-white rounded-2xl border-none ring-1 focus:ring-2 shadow-sm text-sm font-medium resize-none leading-relaxed",
                                                        finalDM.length > (linkUrl ? 640 : 1000) ? "ring-rose-500 focus:ring-rose-500" : (finalDM.length > (linkUrl ? 580 : 900) ? "ring-amber-400 focus:ring-amber-400" : "ring-slate-100 focus:ring-primary")
                                                    )}
                                                />
                                                <div className="flex items-center justify-between mt-2 px-1">
                                                    <p className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider",
                                                        finalDM.length > (linkUrl ? 640 : 1000) ? "text-rose-500" : (finalDM.length > (linkUrl ? 580 : 900) ? "text-amber-500" : "text-slate-400")
                                                    )}>
                                                        {finalDM.length > (linkUrl ? 640 : 1000) ? "⛔ Too long. Use fewer words." : (finalDM.length > (linkUrl ? 580 : 900) ? "⚠️ Nearing limit" : (linkUrl ? "Card limit" : "Text limit"))}
                                                    </p>
                                                    <span className={cn(
                                                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                                                        finalDM.length > (linkUrl ? 640 : 1000) ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {finalDM.length}/{linkUrl ? 640 : 1000}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-[11px] text-slate-400 font-bold px-1">DESTINATION URL</p>
                                                <div className="relative group">
                                                    <LinkIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                                                    <input
                                                        type="url"
                                                        value={linkUrl}
                                                        onChange={(e) => setLinkUrl(e.target.value)}
                                                        placeholder="https://yourwebsite.com/guide"
                                                        className="w-full h-14 pl-14 pr-6 bg-white rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-sm font-bold text-slate-600"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-400 font-bold px-1 uppercase tracking-widest">Button Text</p>
                                                <input
                                                    type="text"
                                                    value={finalButtonText}
                                                    onChange={(e) => setFinalButtonText(e.target.value)}
                                                    placeholder="Open Link"
                                                    className="w-full h-12 px-6 bg-white rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-sm font-bold text-center text-primary"
                                                />
                                            </div>

                                            {/* Additional Buttons (Multi-Button Support) */}
                                            {additionalButtons.map((btn, idx) => (
                                                <div key={idx} className="space-y-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Button {idx + 2}</p>
                                                        <button
                                                            onClick={() => setAdditionalButtons(prev => prev.filter((_, i) => i !== idx))}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <input
                                                            type="text"
                                                            value={btn.button_text}
                                                            onChange={(e) => {
                                                                const newBtns = [...additionalButtons];
                                                                newBtns[idx].button_text = e.target.value;
                                                                setAdditionalButtons(newBtns);
                                                            }}
                                                            placeholder="Button Label"
                                                            className="w-full h-10 px-4 bg-white rounded-xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-xs font-bold"
                                                        />
                                                        <input
                                                            type="url"
                                                            value={btn.link_url}
                                                            onChange={(e) => {
                                                                const newBtns = [...additionalButtons];
                                                                newBtns[idx].link_url = e.target.value;
                                                                setAdditionalButtons(newBtns);
                                                            }}
                                                            placeholder="https://..."
                                                            className="w-full h-10 px-4 bg-white rounded-xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary shadow-sm text-xs font-medium"
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {additionalButtons.length < 2 && (
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={() => setAdditionalButtons(prev => [...prev, { button_text: "", link_url: "" }])}
                                                    className="w-full h-12 border-dashed border-primary/30 text-primary hover:bg-primary/5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                                                >
                                                    <Plus className="h-4 w-4" /> Add Another Button
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Follow-up DM Section */}
                                    <div className={cn(
                                        "group rounded-[32px] border transition-all overflow-hidden",
                                        followupEnabled ? "border-primary/30 bg-primary/5" : "border-slate-100 bg-slate-50/50",
                                        !(planType || "").toLowerCase().includes("starter") && !(planType || "").toLowerCase().includes("pro") && "opacity-60"
                                    )}>
                                        <div className="flex items-center justify-between p-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center transition-colors",
                                                    followupEnabled ? "bg-primary text-white" : "bg-white text-slate-400 group-hover:text-primary"
                                                )}>
                                                    <Clock className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold">Follow up DM after 24h</span>
                                                    <p className="text-[11px] text-slate-400">Re-engage leads who didn't click</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {!(planType || "").toLowerCase().includes("starter") && !(planType || "").toLowerCase().includes("pro") && (
                                                    <Badge className="border-none font-bold text-[10px] py-0.5 shadow-sm bg-amber-500 text-white">STARTER+</Badge>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if ((planType || "").toLowerCase().includes("starter") || (planType || "").toLowerCase().includes("pro")) {
                                                            setFollowupEnabled(!followupEnabled);
                                                        }
                                                    }}
                                                    disabled={!(planType || "").toLowerCase().includes("starter") && !(planType || "").toLowerCase().includes("pro")}
                                                    className={cn(
                                                        "w-12 h-6.5 rounded-full transition-all flex items-center px-1",
                                                        followupEnabled ? "bg-primary" : "bg-slate-200",
                                                        (!(planType || "").toLowerCase().includes("starter") && !(planType || "").toLowerCase().includes("pro")) && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", followupEnabled ? "translate-x-[20px]" : "translate-x-0")} />
                                                </button>
                                            </div>
                                        </div>

                                        {followupEnabled && (
                                            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                    <Info className="h-4 w-4 text-blue-500 shrink-0" />
                                                    <p className="text-[10px] font-medium text-blue-700 leading-tight">
                                                        Sends 24 hours after the opening DM is delivered if the user hasn't interacted with your final link.
                                                    </p>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between px-1">
                                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Follow-up Message</p>
                                                        <div className="flex items-center gap-1">
                                                            <Shuffle className="h-3 w-3 text-slate-400" />
                                                            <span className="text-[10px] text-slate-400 font-medium italic">Spintax supported</span>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={followupMessage}
                                                        onChange={(e) => setFollowupMessage(e.target.value)}
                                                        rows={4}
                                                        placeholder="Hey! 👋 Just checking in..."
                                                        className={cn(
                                                            "w-full p-4 bg-white rounded-2xl border-none ring-1 focus:ring-2 shadow-sm text-sm font-medium resize-none leading-relaxed",
                                                            followupMessage.length > 900 ? "ring-rose-500 focus:ring-rose-500" : (followupMessage.length > 800 ? "ring-amber-400 focus:ring-amber-400" : "ring-slate-100 focus:ring-primary")
                                                        )}
                                                    />
                                                    <div className="flex items-center justify-between mt-1 px-1">
                                                        <p className="text-[10px] text-slate-400">
                                                            Hint: Use <code className="bg-slate-100 px-1 rounded">{'{'}Hi|Hey|Hello{'}'}</code> for randomization
                                                        </p>
                                                        <span className={cn(
                                                            "text-[10px] font-black px-2 py-0.5 rounded-full",
                                                            followupMessage.length > 900 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {followupMessage.length}/1000
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    <button
                                                        onClick={() => setFollowupMessage("Checking in! 👋 Did you get a chance to see that link I sent earlier? Let me know if you need any help!")}
                                                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 transition-colors shadow-sm"
                                                    >
                                                        Template 1
                                                    </button>
                                                    <button
                                                        onClick={() => setFollowupMessage("Quick question — were you able to open the link? 📬 I don't want you to miss out on this!")}
                                                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 transition-colors shadow-sm"
                                                    >
                                                        Template 2
                                                    </button>
                                                    <button
                                                        onClick={() => setFollowupMessage("Hey! Just wanted to make sure you saw my last message. The link is still active if you want to check it out! ✨")}
                                                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-600 transition-colors shadow-sm"
                                                    >
                                                        Template 3
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fan Mode Toggle */}
                                    <div className={cn(
                                        "group rounded-[32px] border transition-all overflow-hidden",
                                        fanMode ? "border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50" : "border-slate-100 bg-slate-50/50"
                                    )}>
                                        <div className="flex items-center justify-between p-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center transition-colors",
                                                    fanMode ? "bg-gradient-to-br from-rose-500 to-orange-500 text-white" : "bg-white text-slate-400 group-hover:text-rose-500"
                                                )}>
                                                    <Heart className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold">Fan Mode</span>
                                                    <p className="text-[11px] text-slate-400">Track loyal fans — auto points, tiers & streaks</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge className="border-none font-bold text-[10px] py-0.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white">NEW</Badge>
                                                <button
                                                    onClick={() => {
                                                        const isTurningOn = !fanMode;
                                                        setFanMode(isTurningOn);
                                                        // Auto-fill default tiers if turning on and empty
                                                        if (isTurningOn && fanRewards.length === 0) {
                                                            setFanRewards([
                                                                { points: 20, title: "Bronze Tier Bonus", link: "https://example.com/bronze" },
                                                                { points: 50, title: "Silver Tier Bonus", link: "https://example.com/silver" },
                                                                { points: 100, title: "Gold Tier Bonus", link: "https://example.com/gold" },
                                                            ]);
                                                        }
                                                    }}
                                                    className={cn("w-12 h-6.5 rounded-full transition-all flex items-center px-1", fanMode ? "bg-gradient-to-r from-rose-500 to-orange-500" : "bg-slate-200")}
                                                >
                                                    <div className={cn("w-[18px] h-[18px] bg-white rounded-full shadow transition-all", fanMode ? "translate-x-[20px]" : "translate-x-0")} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Reward Milestones */}
                                        {fanMode && (
                                            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center gap-2">
                                                    <Gift className="h-4 w-4 text-rose-500" />
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reward Milestones (Optional)</p>
                                                </div>
                                                <p className="text-[11px] text-slate-400">Fans unlock rewards at these point thresholds. Auto-sent via DM link.</p>

                                                {/* Existing rewards list */}
                                                {fanRewards.map((reward, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 group/item">
                                                        <div className="flex-1 px-4 py-2 bg-white rounded-xl border border-slate-100 text-sm font-medium text-slate-700 flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-100 to-orange-100 text-rose-600 flex items-center justify-center shrink-0">
                                                                <input
                                                                    type="number"
                                                                    value={reward.points || ""}
                                                                    onChange={(e) => {
                                                                        const newRewards = [...fanRewards];
                                                                        newRewards[idx].points = parseInt(e.target.value) || 0;
                                                                        setFanRewards(newRewards);
                                                                    }}
                                                                    className="w-full bg-transparent border-none text-center text-[11px] font-black p-0 outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <input
                                                                    type="text"
                                                                    value={reward.title}
                                                                    onChange={(e) => {
                                                                        const newRewards = [...fanRewards];
                                                                        newRewards[idx].title = e.target.value;
                                                                        setFanRewards(newRewards);
                                                                    }}
                                                                    placeholder="Reward title..."
                                                                    className="w-full text-sm font-bold text-slate-800 bg-transparent border-none p-0 h-5 outline-none focus:ring-0 placeholder:text-slate-300"
                                                                />
                                                                <input
                                                                    type="url"
                                                                    value={reward.link}
                                                                    onChange={(e) => {
                                                                        const newRewards = [...fanRewards];
                                                                        newRewards[idx].link = e.target.value;
                                                                        setFanRewards(newRewards);
                                                                    }}
                                                                    placeholder="https://..."
                                                                    className="w-full text-[10px] text-slate-400 bg-transparent border-none p-0 h-4 outline-none focus:ring-0 placeholder:text-slate-300"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setFanRewards(prev => prev.filter((_, i) => i !== idx))}
                                                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover/item:opacity-100"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Add new reward */}
                                                <div className="space-y-2 p-3 sm:p-4 bg-white rounded-2xl border border-dashed border-slate-200">
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <input
                                                            type="number"
                                                            value={newRewardPoints}
                                                            onChange={(e) => setNewRewardPoints(e.target.value)}
                                                            placeholder="Points"
                                                            className="w-full sm:w-20 min-w-0 h-10 px-3 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-400 text-sm font-bold text-center"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={newRewardTitle}
                                                            onChange={(e) => setNewRewardTitle(e.target.value)}
                                                            placeholder="Reward title..."
                                                            className="flex-1 min-w-0 h-10 px-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-400 text-sm font-medium"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <input
                                                            type="url"
                                                            value={newRewardLink}
                                                            onChange={(e) => setNewRewardLink(e.target.value)}
                                                            placeholder="https://reward-link.com"
                                                            className="flex-1 min-w-0 h-10 px-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-400 text-sm font-medium"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const parsedPoints = parseInt(newRewardPoints);
                                                                if (!isNaN(parsedPoints) && parsedPoints > 0 && newRewardTitle.trim() && newRewardLink.trim()) {
                                                                    setFanRewards(prev => [...prev, {
                                                                        points: parsedPoints,
                                                                        title: newRewardTitle.trim(),
                                                                        link: newRewardLink.trim()
                                                                    }].sort((a, b) => a.points - b.points));
                                                                    setNewRewardPoints("");
                                                                    setNewRewardTitle("");
                                                                    setNewRewardLink("");
                                                                }
                                                            }}
                                                            disabled={!newRewardPoints || parseInt(newRewardPoints) <= 0 || !newRewardTitle.trim() || !newRewardLink.trim()}
                                                            className="w-full sm:w-auto h-10 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-90 text-white text-xs font-black shadow-sm transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" /> Add
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer */}
                    <div
                        className="px-4 pt-4 md:px-6 md:pt-5 border-t border-slate-100 bg-white flex items-center gap-3"
                        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                    >
                        {step > 1 && (
                            <Button variant="ghost" className="font-bold text-slate-400 hover:text-slate-600 h-12 px-5 rounded-2xl border border-slate-200 bg-white shrink-0" onClick={prevStep}>
                                <ChevronLeft className="h-4 w-4 md:mr-2" /> Back
                            </Button>
                        )}

                        {step < 4 ? (
                            <Button
                                className="font-black h-12 rounded-2xl bg-primary text-white hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 flex-1"
                                disabled={step === 3 && openingDM.length > 640}
                                onClick={() => {
                                    if (step === 1 && triggerType === "story") {
                                        setStep(3); // Skip Matching for Story
                                    } else {
                                        nextStep();
                                    }
                                }}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                className="font-black h-12 rounded-2xl bg-primary text-white hover:opacity-90 transition-all shadow-xl shadow-primary/30 disabled:opacity-40 flex-1"
                                onClick={handleSave}
                                disabled={saving || openingDM.length > 640 || finalDM.length > (linkUrl ? 640 : 1000)}
                            >
                                {saving ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update Automation" : "Launch Automation")}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
