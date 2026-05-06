export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          facebook_user_id: string;
          display_name: string | null;
          fb_access_token: string | null;
          fb_token_expires_at: string | null;
          profile_picture_url: string | null;
          email: string | null;
          plan_type: "free" | "starter" | "pro" | "expired";
          plan_expires_at: string | null;
          razorpay_subscription_id: string | null;
          subscription_status: "active" | "halted" | "cancelled" | "completed" | "inactive" | null;
          subscription_interval: "monthly" | "yearly" | null;
          created_at: string;
          updated_at: string;
          notification_settings: Json | null;
          referral_code: string | null;
          referred_by: string | null;
          total_referral_earnings: number;
          payout_info: string | null;
        };
        Insert: {
          id?: string;
          facebook_user_id: string;
          display_name?: string | null;
          fb_access_token?: string | null;
          fb_token_expires_at?: string | null;
          email?: string | null;
          plan_type?: "free" | "starter" | "pro" | "expired";
          plan_expires_at?: string | null;
          razorpay_subscription_id?: string | null;
          subscription_status?: "active" | "halted" | "cancelled" | "completed" | "inactive" | null;
          subscription_interval?: "monthly" | "yearly" | null;
          created_at?: string;
          updated_at?: string;
          notification_settings?: Json | null;
          referral_code?: string | null;
          referred_by?: string | null;
          total_referral_earnings?: number;
          payout_info?: string | null;
        };
        Update: {
          id?: string;
          facebook_user_id?: string;
          display_name?: string | null;
          fb_access_token?: string | null;
          fb_token_expires_at?: string | null;
          email?: string | null;
          plan_type?: "free" | "starter" | "pro" | "expired";
          plan_expires_at?: string | null;
          razorpay_subscription_id?: string | null;
          subscription_status?: "active" | "halted" | "cancelled" | "completed" | "inactive" | null;
          subscription_interval?: "monthly" | "yearly" | null;
          created_at?: string;
          updated_at?: string;
          notification_settings?: Json | null;
          referral_code?: string | null;
          referred_by?: string | null;
          total_referral_earnings?: number;
          payout_info?: string | null;
        };
      };
      keywords: {
        Row: {
          id: string;
          user_id: string;
          keyword: string;
          reply_message: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          keyword: string;
          reply_message: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          keyword?: string;
          reply_message?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      automations: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          media_type: string;
          media_url: string | null;
          media_thumbnail_url: string | null;
          media_caption: string | null;
          trigger_keyword: string | null;
          trigger_type: "keyword" | "any";
          reply_message: string;
          comment_reply: string | null;
          comment_reply_templates: string[] | null;
          button_text: string | null;
          link_url: string | null;
          require_follow: boolean;
          is_active: boolean;
          comment_count: number;
          dm_sent_count: number;
          dm_failed_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          media_type?: string;
          media_url?: string | null;
          media_thumbnail_url?: string | null;
          media_caption?: string | null;
          trigger_keyword?: string | null;
          trigger_type?: "keyword" | "any";
          reply_message: string;
          comment_reply?: string | null;
          comment_reply_templates?: string[] | null;
          button_text?: string | null;
          link_url?: string | null;
          require_follow?: boolean;
          is_active?: boolean;
          comment_count?: number;
          dm_sent_count?: number;
          dm_failed_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          media_type?: string;
          media_url?: string | null;
          media_thumbnail_url?: string | null;
          media_caption?: string | null;
          trigger_keyword?: string | null;
          trigger_type?: "keyword" | "any";
          reply_message?: string;
          comment_reply?: string | null;
          comment_reply_templates?: string[] | null;
          button_text?: string | null;
          link_url?: string | null;
          require_follow?: boolean;
          is_active?: boolean;
          comment_count?: number;
          dm_sent_count?: number;
          dm_failed_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      dm_logs: {
        Row: {
          id: string;
          user_id: string;
          external_item_id: string;
          facebook_user_id: string;
          display_name: string | null;
          keyword_matched: string | null;
          log_text: string | null;
          success: boolean;
          sent_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          external_item_id: string;
          facebook_user_id: string;
          display_name?: string | null;
          keyword_matched?: string | null;
          log_text?: string | null;
          success?: boolean;
          sent_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          external_item_id?: string;
          facebook_user_id?: string;
          display_name?: string | null;
          keyword_matched?: string | null;
          log_text?: string | null;
          success?: boolean;
          sent_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          razorpay_payment_id: string;
          razorpay_order_id: string | null;
          razorpay_signature: string | null;
          razorpay_subscription_id: string | null;
          amount: number;
          currency: string;
          status: "created" | "paid" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          razorpay_payment_id: string;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          razorpay_subscription_id?: string | null;
          amount: number;
          currency?: string;
          status?: "created" | "paid" | "failed";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          razorpay_payment_id?: string;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          razorpay_subscription_id?: string | null;
          amount?: number;
          currency?: string;
          status?: "created" | "paid" | "failed";
          created_at?: string;
        };
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string;
          hour_bucket: string;
          dm_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hour_bucket: string;
          dm_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hour_bucket?: string;
          dm_count?: number;
          created_at?: string;
        };
      };
      webhook_queue: {
        Row: {
          id: string;
          user_id: string;
          payload: Json;
          status: "pending" | "processing" | "completed" | "failed";
          attempts: number;
          max_attempts: number;
          scheduled_at: string;
          processed_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          payload: Json;
          status?: "pending" | "processing" | "completed" | "failed";
          attempts?: number;
          max_attempts?: number;
          scheduled_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          payload?: Json;
          status?: "pending" | "processing" | "completed" | "failed";
          attempts?: number;
          max_attempts?: number;
          scheduled_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          razorpay_subscription_id: string;
          plan_id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          razorpay_subscription_id: string;
          plan_id: string;
          status: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          razorpay_subscription_id?: string;
          plan_id?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          payment_id: string | null;
          invoice_number: string | null;
          amount: number;
          currency: string;
          tax_amount: number;
          billing_details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          payment_id?: string | null;
          invoice_number?: string | null;
          amount: number;
          currency?: string;
          tax_amount?: number;
          billing_details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          payment_id?: string | null;
          invoice_number?: string | null;
          amount?: number;
          currency?: string;
          tax_amount?: number;
          billing_details?: Json | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      increment_rate_limit: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_rate_limit: {
        Args: { p_user_id: string };
        Returns: number;
      };
      decrement_rate_limit: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
  };
};

// Helper types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Keyword = Database["public"]["Tables"]["keywords"]["Row"];
export type Automation = Database["public"]["Tables"]["automations"]["Row"];
export type DmLog = Database["public"]["Tables"]["dm_logs"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
