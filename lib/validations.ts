import { z } from "zod";

// ==========================================
// Common Validators
// ==========================================

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==========================================
// Automation Schemas
// ==========================================

export const triggerTypeSchema = z.enum(["keyword", "any", "story_reply", "all_posts"]);

export const createAutomationSchema = z.object({
  media_id: z.string().min(1, "Media ID is required"),
  media_type: z.string().default("REELS"),
  media_url: z.string().url().optional(),
  media_thumbnail_url: z.string().url().optional(),
  media_caption: z.string().max(2200).optional(),

  trigger_keyword: z.string().max(255).optional().nullable(),
  trigger_type: triggerTypeSchema.default("any"),

  reply_message: z.string()
    .min(1, "Reply message is required")
    .max(1000, "Reply message must be under 1000 characters"),
  comment_reply: z.string().max(1000).optional().nullable(),
  comment_reply_templates: z.array(z.string().max(1000)).max(20).optional().nullable(),

  button_text: z.string().max(20, "Button text must be under 20 characters").optional().nullable(),
  link_url: z.string().url("Invalid URL format")
    .refine((url) => /^https?:\/\//i.test(url), { message: "Only http/https URLs allowed" })
    .optional().nullable(),

  require_follow: z.boolean().default(false),
  follow_gate_message: z.string().max(500).optional().nullable(),
  final_message: z.string().max(500).optional().nullable(),
  final_button_text: z.string().max(20).optional().nullable(),

  is_active: z.boolean().default(true),
});

export const updateAutomationSchema = createAutomationSchema.partial().extend({
  respond_to_replies: z.boolean().optional(),
  ignore_self_comments: z.boolean().optional(),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

// ==========================================
// User Schemas
// ==========================================

export const planTypeSchema = z.enum(["free", "starter", "pro", "expired"]);

export const userProfileSchema = z.object({
  instagram_username: z.string().min(1).max(30),
  plan_type: planTypeSchema.optional(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

// ==========================================
// Payment Schemas
// ==========================================

export const createOrderSchema = z.object({
  planType: z.enum(["starter", "pro"]),
});

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1, "Payment ID is required"),
  razorpay_order_id: z.string().min(1, "Order ID is required"),
  razorpay_signature: z.string().min(1, "Signature is required"),
  planType: z.enum(["starter", "pro"]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ==========================================
// Lead/Contact Schemas
// ==========================================

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[+]?[\d\s-]{10,15}$/, "Invalid phone number").optional(),
  message: z.string().max(1000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

// ==========================================
// Webhook Schemas (Internal validation)
// ==========================================

export const instagramWebhookSchema = z.object({
  object: z.literal("instagram"),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.unknown(),
    })).optional(),
    messaging: z.array(z.unknown()).optional(),
  })),
});

export const commentWebhookValueSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  from: z.object({
    id: z.string(),
    username: z.string().optional(),
  }).optional(),
  media: z.object({
    id: z.string(),
  }).optional(),
  parent_id: z.string().optional(),
});

export type InstagramWebhookPayload = z.infer<typeof instagramWebhookSchema>;
export type CommentWebhookValue = z.infer<typeof commentWebhookValueSchema>;

// ==========================================
// API Query Schemas
// ==========================================

export const reelsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  after: z.string().optional(),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(["day", "week", "month", "all"]).default("month"),
  automationId: z.string().uuid().optional(),
});

export type ReelsQueryInput = z.infer<typeof reelsQuerySchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

// ==========================================
// Validation Helper Functions
// ==========================================

/**
 * Safely parse and validate input with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Parse and validate, throwing ValidationError on failure
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Format Zod errors for API response
 */
export function formatZodError(error: z.ZodError): {
  message: string;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return {
    message: "Validation failed",
    errors,
  };
}
