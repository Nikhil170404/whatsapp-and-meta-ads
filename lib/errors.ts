/**
 * Centralized Error Handling System
 * Provides consistent error types and handling across the application
 */

export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        code: string,
        statusCode: number = 500,
        isOperational: boolean = true,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;

        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

// Specific error types
export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, "VALIDATION_ERROR", 400, true, context);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = "Authentication required") {
        super(message, "AUTHENTICATION_ERROR", 401, true);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = "Permission denied") {
        super(message, "AUTHORIZATION_ERROR", 403, true);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, "NOT_FOUND", 404, true, { resource });
    }
}

export class RateLimitError extends AppError {
    public readonly retryAfter?: number;

    constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
        super(message, "RATE_LIMIT_ERROR", 429, true, { retryAfter });
        this.retryAfter = retryAfter;
    }
}

export class InstagramAPIError extends AppError {
    public readonly igErrorCode?: number;
    public readonly igErrorSubcode?: number;

    constructor(
        message: string,
        igErrorCode?: number,
        igErrorSubcode?: number
    ) {
        super(message, "INSTAGRAM_API_ERROR", 502, true, { igErrorCode, igErrorSubcode });
        this.igErrorCode = igErrorCode;
        this.igErrorSubcode = igErrorSubcode;
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, "DATABASE_ERROR", 500, true, context);
    }
}

export class PaymentError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, "PAYMENT_ERROR", 402, true, context);
    }
}

// Error response formatter for API routes
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export function formatErrorResponse(error: unknown): ErrorResponse {
    if (error instanceof AppError) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.context,
            },
        };
    }

    // Handle Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
        return {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request data",
                details: { issues: (error as { issues: unknown[] }).issues },
            },
        };
    }

    // Unknown errors
    console.error("Unexpected error:", error);
    return {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
        },
    };
}

// Helper to get status code from error
export function getErrorStatusCode(error: unknown): number {
    if (error instanceof AppError) {
        return error.statusCode;
    }

    // Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
        return 400;
    }

    return 500;
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

// Async error wrapper for API routes
export function withErrorHandling<T>(
    handler: () => Promise<T>
): Promise<T> {
    return handler().catch((error) => {
        if (error instanceof AppError && error.isOperational) {
            throw error; // Re-throw operational errors
        }
        // Log and wrap unexpected errors
        console.error("Unexpected error in handler:", error);
        throw new AppError(
            "An unexpected error occurred",
            "INTERNAL_ERROR",
            500,
            false
        );
    });
}
