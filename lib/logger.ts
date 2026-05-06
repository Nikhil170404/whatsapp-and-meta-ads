/**
 * Structured Logging System
 * Production-ready logging with proper levels, context, and formatting
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
    [key: string]: unknown;
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// Determine log level from environment
const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
    (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
        // JSON format for production (better for log aggregation)
        return JSON.stringify(entry);
    }

    // Pretty format for development
    const emoji = {
        debug: "🐛",
        info: "ℹ️",
        warn: "⚠️",
        error: "❌",
    }[entry.level];

    let output = `${emoji} [${entry.level.toUpperCase()}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
        output += ` | ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
        output += `\n   Error: ${entry.error.message}`;
        if (entry.error.stack && !isProduction) {
            output += `\n   Stack: ${entry.error.stack}`;
        }
    }

    return output;
}

function createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return entry;
}

// Main logger object
export const logger = {
    debug(message: string, context?: LogContext) {
        if (!shouldLog("debug")) return;
        console.debug(formatLog(createLogEntry("debug", message, context)));
    },

    info(message: string, context?: LogContext) {
        if (!shouldLog("info")) return;
        console.info(formatLog(createLogEntry("info", message, context)));
    },

    warn(message: string, context?: LogContext, error?: Error) {
        if (!shouldLog("warn")) return;
        console.warn(formatLog(createLogEntry("warn", message, context, error)));
    },

    error(message: string, context?: LogContext, error?: Error) {
        if (!shouldLog("error")) return;
        console.error(formatLog(createLogEntry("error", message, context, error)));
    },

    // Specialized loggers for common operations
    webhook: {
        received(type: string, context?: LogContext) {
            logger.info(`Webhook received: ${type}`, { ...context, category: "webhook" });
        },
        processed(type: string, success: boolean, context?: LogContext) {
            const level = success ? "info" : "warn";
            logger[level](`Webhook processed: ${type}`, { ...context, success, category: "webhook" });
        },
        error(type: string, error: Error, context?: LogContext) {
            logger.error(`Webhook error: ${type}`, { ...context, category: "webhook" }, error);
        },
    },

    dm: {
        queued(userId: string, automationId: string, scheduledAt: Date) {
            logger.info("DM queued", { userId, automationId, scheduledAt: scheduledAt.toISOString(), category: "dm" });
        },
        sent(userId: string, recipientId: string, automationId: string) {
            logger.info("DM sent", { userId, recipientId, automationId, category: "dm" });
        },
        failed(userId: string, recipientId: string, error: Error) {
            logger.error("DM failed", { userId, recipientId, category: "dm" }, error);
        },
        rateLimited(userId: string, remaining: { hourly: number; monthly: number }) {
            logger.warn("Rate limit hit", { userId, remaining, category: "dm" });
        },
    },

    auth: {
        login(userId: string, username: string) {
            logger.info("User logged in", { userId, username, category: "auth" });
        },
        logout(userId: string) {
            logger.info("User logged out", { userId, category: "auth" });
        },
        tokenRefreshed(userId: string) {
            logger.info("Token refreshed", { userId, category: "auth" });
        },
        error(action: string, error: Error, context?: LogContext) {
            logger.error(`Auth error: ${action}`, { ...context, category: "auth" }, error);
        },
    },

    payment: {
        initiated(userId: string, amount: number, planType: string) {
            logger.info("Payment initiated", { userId, amount, planType, category: "payment" });
        },
        completed(userId: string, paymentId: string, amount: number) {
            logger.info("Payment completed", { userId, paymentId, amount, category: "payment" });
        },
        failed(userId: string, error: Error, context?: LogContext) {
            logger.error("Payment failed", { userId, ...context, category: "payment" }, error);
        },
    },

    api: {
        request(method: string, path: string, context?: LogContext) {
            logger.debug(`API ${method} ${path}`, { ...context, category: "api" });
        },
        response(method: string, path: string, status: number, durationMs: number) {
            const level = status >= 400 ? "warn" : "debug";
            logger[level](`API ${method} ${path} -> ${status}`, { durationMs, category: "api" });
        },
    },
};

export default logger;
