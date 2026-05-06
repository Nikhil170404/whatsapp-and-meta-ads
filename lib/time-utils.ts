/**
 * Time Utilities
 * Helper functions for time-based calculations used in rate limiting
 * @module lib/time-utils
 */

/**
 * Get the start of the current hour
 */
export function getHourStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
}

/**
 * Get the start of the current month
 */
export function getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get the start of the next hour
 */
export function getNextHourStart(): Date {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    return nextHour;
}

/**
 * Get the start of the next month
 */
export function getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Get milliseconds until the next hour
 */
export function msUntilNextHour(): number {
    return getNextHourStart().getTime() - Date.now();
}

/**
 * Get milliseconds until the next month
 */
export function msUntilNextMonth(): number {
    return getNextMonthStart().getTime() - Date.now();
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
}

/**
 * Check if a date is within the current hour
 */
export function isWithinCurrentHour(date: Date): boolean {
    const hourStart = getHourStart();
    const nextHour = getNextHourStart();
    return date >= hourStart && date < nextHour;
}

/**
 * Check if a date is within the current month
 */
export function isWithinCurrentMonth(date: Date): boolean {
    const monthStart = getMonthStart();
    const nextMonth = getNextMonthStart();
    return date >= monthStart && date < nextMonth;
}
