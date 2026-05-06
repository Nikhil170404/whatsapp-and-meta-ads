/**
 * Instagram API Types
 * Strongly-typed interfaces for Instagram webhook payloads and API responses
 * @module lib/instagram/types
 */

// ============================================
// Webhook Payload Types
// ============================================

export interface InstagramWebhookPayload {
    object: 'instagram';
    entry: InstagramWebhookEntry[];
}

export interface InstagramWebhookEntry {
    id: string;
    time: number;
    messaging?: InstagramMessagingEvent[];
    changes?: InstagramChangeEvent[];
}

// ============================================
// Comment Event Types  
// ============================================

export interface InstagramChangeEvent {
    field: 'comments' | 'mentions' | 'story_insights';
    value: InstagramCommentValue | InstagramMentionValue;
}

export interface InstagramCommentValue {
    media: {
        id: string;
        media_product_type?: string;
    };
    id: string;
    text: string;
    timestamp?: string;
    from: {
        id: string;
        username: string;
    };
    parent_id?: string;
}

export interface InstagramMentionValue {
    media_id: string;
    comment_id?: string;
}

// ============================================
// Messaging Event Types
// ============================================

export interface InstagramMessagingEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: InstagramMessage;
    postback?: InstagramPostback;
    read?: { watermark: number };
}

export interface InstagramMessage {
    mid: string;
    text?: string;
    attachments?: InstagramAttachment[];
    quick_reply?: {
        payload: string;
    };
    reply_to?: {
        mid?: string;
        story_id?: string;
    };
    is_echo?: boolean;
    is_deleted?: boolean;
}

export interface InstagramAttachment {
    type: 'image' | 'video' | 'audio' | 'file' | 'story_mention' | 'reel';
    payload: {
        url?: string;
        reel_video_id?: string;
    };
}

export interface InstagramPostback {
    mid: string;
    title: string;
    payload: string;
}

// ============================================
// DM Request/Response Types
// ============================================

export interface InstagramDMRequest {
    recipient: { id: string };
    message: InstagramDMMessage;
}

export interface InstagramDMMessage {
    text?: string;
    attachment?: {
        type: 'template';
        payload: InstagramTemplatePayload;
    };
}

export interface InstagramTemplatePayload {
    template_type: 'generic' | 'button';
    elements?: InstagramTemplateElement[];
    text?: string;
    buttons?: InstagramButton[];
}

export interface InstagramTemplateElement {
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: InstagramButton[];
}

export interface InstagramButton {
    type: 'web_url' | 'postback';
    url?: string;
    title: string;
    payload?: string;
}

export interface InstagramAPIResponse {
    message_id?: string;
    recipient_id?: string;
    error?: InstagramAPIError;
}

export interface InstagramAPIError {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
}

// ============================================
// User Profile Types
// ============================================

export interface InstagramUserProfile {
    id: string;
    username?: string;
    name?: string;
    profile_pic?: string;
    follower_count?: number;
    is_user_follow_business?: boolean;
    is_business_follow_user?: boolean;
}

// ============================================
// Media Types
// ============================================

export interface InstagramMedia {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    caption?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
}

// ============================================
// Comment Event Data (normalized)
// ============================================

export interface CommentEventData {
    id: string;
    text: string;
    from: {
        id: string;
        username: string;
    };
    media: {
        id: string;
    };
    parent_id?: string;
}

export interface MessagingEventData {
    sender: { id: string };
    recipient: { id: string };
    message?: InstagramMessage;
    postback?: InstagramPostback;
}

// ============================================
// Comment Management Types
// ============================================

export interface InstagramCommentDetail {
    id: string;
    text: string;
    timestamp: string;
    username: string;
    like_count?: number;
    hidden?: boolean;
    parent_id?: string;
    replies?: {
        data: InstagramCommentDetail[];
    };
}
