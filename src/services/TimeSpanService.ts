/**
 * TimeSpanService — Parsing, comparison, overlap detection, and display formatting.
 *
 * Implements the TimeSpanService interface from Phase 0. Provides:
 * - Gregorian calendar as the default calendar adapter
 * - String parsing for common date formats
 * - Comparison and overlap detection across all TimeSpan kinds
 * - Relative date resolution
 * - Display formatting
 */

import type {
    TimeSpan,
    Timestamp,
    TemporalOffset,
    CalendarAdapter,
    InstantTimeSpan,
    IntervalTimeSpan,
    OpenEndedTimeSpan,
    UncertainTimeSpan,
    UnknownTimeSpan,
    RelativeTimeSpan,
    DatePrecision,
} from '../models/TimeSpan';
import { DEFAULT_CALENDAR } from '../models/TimeSpan';

// ============================================================================
// Gregorian Calendar Adapter
// ============================================================================

/**
 * Default Gregorian calendar adapter.
 */
class GregorianCalendarAdapter implements CalendarAdapter {
    id = DEFAULT_CALENDAR;
    name = 'Gregorian';

    format(timestamp: Timestamp): string {
        const { year, month, day, hour, minute } = timestamp;
        let result = String(year);
        if (month !== undefined) {
            result += `-${String(month).padStart(2, '0')}`;
            if (day !== undefined) {
                result += `-${String(day).padStart(2, '0')}`;
                if (hour !== undefined) {
                    result += ` ${String(hour).padStart(2, '0')}`;
                    if (minute !== undefined) {
                        result += `:${String(minute).padStart(2, '0')}`;
                    } else {
                        result += ':00';
                    }
                }
            }
        }
        return result;
    }

    parse(input: string): Timestamp | null {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // ISO 8601 date: YYYY-MM-DD
        const isoDate = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
        if (isoDate) {
            const [, year, month, day, hour, minute] = isoDate;
            const ts: Timestamp = {
                calendar: DEFAULT_CALENDAR,
                year: parseInt(year, 10),
                month: parseInt(month, 10),
                day: parseInt(day, 10),
                precision: 'day',
            };
            if (hour !== undefined) {
                ts.hour = parseInt(hour, 10);
                ts.minute = minute !== undefined ? parseInt(minute, 10) : 0;
                ts.precision = minute !== undefined ? 'minute' : 'hour';
            }
            return ts;
        }

        // Year-month: YYYY-MM
        const isoYearMonth = trimmed.match(/^(\d{4})-(\d{1,2})$/);
        if (isoYearMonth) {
            const [, year, month] = isoYearMonth;
            return {
                calendar: DEFAULT_CALENDAR,
                year: parseInt(year, 10),
                month: parseInt(month, 10),
                precision: 'month',
            };
        }

        // Year only: YYYY
        const isoYear = trimmed.match(/^(\d{4})$/);
        if (isoYear) {
            return {
                calendar: DEFAULT_CALENDAR,
                year: parseInt(isoYear[1], 10),
                precision: 'year',
            };
        }

        return null;
    }

    compare(a: Timestamp, b: Timestamp): number {
        // Compare year
        if (a.year !== b.year) return a.year - b.year;
        // Compare month (undefined treated as 0 for comparison)
        const aMonth = a.month ?? 0;
        const bMonth = b.month ?? 0;
        if (aMonth !== bMonth) return aMonth - bMonth;
        // Compare day
        const aDay = a.day ?? 0;
        const bDay = b.day ?? 0;
        if (aDay !== bDay) return aDay - bDay;
        // Compare hour
        const aHour = a.hour ?? 0;
        const bHour = b.hour ?? 0;
        if (aHour !== bHour) return aHour - bHour;
        // Compare minute
        const aMinute = a.minute ?? 0;
        const bMinute = b.minute ?? 0;
        if (aMinute !== bMinute) return aMinute - bMinute;
        return 0;
    }

    equals(a: Timestamp, b: Timestamp): boolean {
        return this.compare(a, b) === 0;
    }
}

// ============================================================================
// TimeSpanService Implementation
// ============================================================================

export class TimeSpanService {
    private calendars = new Map<string, CalendarAdapter>();

    constructor() {
        // Register default Gregorian calendar
        this.calendars.set(DEFAULT_CALENDAR, new GregorianCalendarAdapter());
    }

    // ── Calendar Management ──

    registerCalendar(adapter: CalendarAdapter): void {
        this.calendars.set(adapter.id, adapter);
    }

    getCalendar(id: string): CalendarAdapter | null {
        return this.calendars.get(id) ?? null;
    }

    private getAdapterForTimestamp(ts: Timestamp): CalendarAdapter | null {
        return this.calendars.get(ts.calendar) ?? null;
    }

    // ── Validation ──

    /**
     * Validate a Gregorian timestamp. Returns an error message or null if valid.
     * Checks month range, day range (including leap years), and time values.
     */
    validateTimestamp(ts: Timestamp): string | null {
        if (ts.calendar !== DEFAULT_CALENDAR) {
            const adapter = this.getAdapterForTimestamp(ts);
            if (!adapter) return `Unknown calendar: ${ts.calendar}`;
            // Delegate to calendar adapter if it supports validation
            if ('validate' in adapter && typeof adapter.validate === 'function') {
                return (adapter as unknown).validate(ts);
            }
            return null;
        }

        // Gregorian validation
        if (ts.month !== undefined) {
            if (ts.month < 1 || ts.month > 12) {
                return `Invalid month: ${ts.month} (must be 1-12)`;
            }
            if (ts.day !== undefined) {
                const maxDay = this.getDaysInMonth(ts.year, ts.month);
                if (ts.day < 1 || ts.day > maxDay) {
                    return `Invalid day: ${ts.day} for ${ts.month}/${ts.year} (max ${maxDay})`;
                }
            }
        }
        if (ts.hour !== undefined) {
            if (ts.hour < 0 || ts.hour > 23) {
                return `Invalid hour: ${ts.hour} (must be 0-23)`;
            }
        }
        if (ts.minute !== undefined) {
            if (ts.minute < 0 || ts.minute > 59) {
                return `Invalid minute: ${ts.minute} (must be 0-59)`;
            }
        }
        return null;
    }

    /**
     * Validate a TimeSpan. Returns an error message or null if valid.
     */
    validateTimeSpan(timeSpan: TimeSpan): string | null {
        switch (timeSpan.kind) {
            case 'instant':
                return this.validateTimestamp(timeSpan.instant);
            case 'interval': {
                const startErr = this.validateTimestamp(timeSpan.start);
                if (startErr) return `Start: ${startErr}`;
                const endErr = this.validateTimestamp(timeSpan.end);
                if (endErr) return `End: ${endErr}`;
                // Check that start <= end (same calendar only)
                if (timeSpan.start.calendar === timeSpan.end.calendar) {
                    const adapter = this.getAdapterForTimestamp(timeSpan.start);
                    if (adapter) {
                        const cmp = adapter.compare(timeSpan.start, timeSpan.end);
                        if (cmp > 0) return 'Start date is after end date';
                    }
                }
                return null;
            }
            case 'open-ended':
                return this.validateTimestamp(timeSpan.start);
            case 'uncertain': {
                const rangeStartErr = this.validateTimestamp(timeSpan.range.start);
                if (rangeStartErr) return `Range start: ${rangeStartErr}`;
                const rangeEndErr = this.validateTimestamp(timeSpan.range.end);
                if (rangeEndErr) return `Range end: ${rangeEndErr}`;
                if (timeSpan.confidence !== undefined && (timeSpan.confidence < 0 || timeSpan.confidence > 1)) {
                    return `Confidence must be 0-1, got ${timeSpan.confidence}`;
                }
                return null;
            }
            case 'unknown':
                return null;
            case 'relative':
                if (!timeSpan.relativeTo) return 'Relative TimeSpan requires a reference ID';
                return null;
        }
    }

    // ── Parsing ──

    /**
     * Parse a string into a TimeSpan.
     *
     * Supported formats:
     * - "2024-01-15" → instant
     * - "2024-01-15 to 2024-03-20" → interval
     * - "2024-01-15 to ?" → open-ended
     * - "circa 2024" / "~2024" → uncertain (year-level)
     * - "unknown" → unknown
     * - "3 days before event:abc-123" → relative
     */
    parse(input: string): TimeSpan | null {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // Unknown
        if (trimmed.toLowerCase() === 'unknown') {
            return { kind: 'unknown', display: trimmed };
        }

        // Relative: "N units direction event:ID" or "N units direction scene:ID"
        const relativeMatch = trimmed.match(
            /^(\d+)\s+(day|week|month|year|season)s?\s+(before|after)\s+(event|scene):(.+)$/i
        );
        if (relativeMatch) {
            const [, amount, unit, direction, , refId] = relativeMatch;
            return {
                kind: 'relative',
                relativeTo: refId.trim(),
                offset: {
                    amount: parseInt(amount, 10),
                    unit: unit as TemporalOffset['unit'],
                    direction: direction.toLowerCase() as 'before' | 'after',
                },
                display: trimmed,
            };
        }

        // Uncertain: "circa YYYY" or "~YYYY" or "circa YYYY-MM-DD"
        const uncertainMatch = trimmed.match(/^(?:circa|~)\s*(.+)$/i);
        if (uncertainMatch) {
            const inner = uncertainMatch[1].trim();
            const ts = this.parseTimestamp(inner);
            if (ts) {
                // Create a range around the timestamp
                const rangeStart = this.shiftTimestamp(ts, -1, 'year');
                const rangeEnd = this.shiftTimestamp(ts, 1, 'year');
                return {
                    kind: 'uncertain',
                    range: { start: rangeStart, end: rangeEnd },
                    confidence: 0.5,
                    display: trimmed,
                };
            }
        }

        // Interval: "YYYY-MM-DD to YYYY-MM-DD" or "YYYY to YYYY"
        const intervalMatch = trimmed.match(/^(.+?)\s+to\s+(.+)$/i);
        if (intervalMatch) {
            const startStr = intervalMatch[1].trim();
            const endStr = intervalMatch[2].trim();

            const startTs = this.parseTimestamp(startStr);
            if (!startTs) return null;

            // Open-ended: "YYYY-MM-DD to ?"
            if (endStr.toLowerCase() === '?' || endStr.toLowerCase() === 'unknown') {
                return {
                    kind: 'open-ended',
                    start: startTs,
                    display: trimmed,
                };
            }

            const endTs = this.parseTimestamp(endStr);
            if (!endTs) return null;

            return {
                kind: 'interval',
                start: startTs,
                end: endTs,
                display: trimmed,
            };
        }

        // Instant: single date
        const ts = this.parseTimestamp(trimmed);
        if (ts) {
            return {
                kind: 'instant',
                instant: ts,
                display: trimmed,
            };
        }

        return null;
    }

    /**
     * Parse a timestamp string using the appropriate calendar adapter.
     */
    parseTimestamp(input: string): Timestamp | null {
        const gregorian = this.getCalendar(DEFAULT_CALENDAR);
        if (gregorian) {
            const result = gregorian.parse(input);
            if (result) return result;
        }
        // Try other registered calendars
        for (const adapter of this.calendars.values()) {
            if (adapter.id !== DEFAULT_CALENDAR) {
                const result = adapter.parse(input);
                if (result) return result;
            }
        }
        return null;
    }

    // ── Formatting ──

    /**
     * Format a TimeSpan to a display string.
     */
    format(timeSpan: TimeSpan): string {
        switch (timeSpan.kind) {
            case 'instant':
                return this.formatTimestamp(timeSpan.instant);
            case 'interval':
                return `${this.formatTimestamp(timeSpan.start)} to ${this.formatTimestamp(timeSpan.end)}`;
            case 'open-ended':
                return `${this.formatTimestamp(timeSpan.start)} to ?`;
            case 'uncertain':
                return `circa ${this.formatTimestamp(timeSpan.range.start)} to ${this.formatTimestamp(timeSpan.range.end)}`;
            case 'unknown':
                return timeSpan.display || 'Unknown';
            case 'relative':
                return this.formatRelative(timeSpan);
        }
    }

    /**
     * Format a single timestamp.
     */
    formatTimestamp(ts: Timestamp): string {
        const adapter = this.getAdapterForTimestamp(ts);
        if (adapter) return adapter.format(ts);
        // Fallback: simple year format
        return String(ts.year);
    }

    /**
     * Format a relative TimeSpan.
     */
    formatRelative(ts: RelativeTimeSpan): string {
        const { amount, unit, direction } = ts.offset;
        const unitLabel = unit === 'season' ? 'seasons' : `${unit}s`;
        return `${amount} ${unitLabel} ${direction} ${ts.relativeTo}`;
    }

    // ── Comparison ──

    /**
     * Compare two TimeSpans for sorting purposes.
     * Returns negative if a < b, zero if equal, positive if a > b.
     * Uses the earliest point of each TimeSpan for comparison.
     */
    compare(a: TimeSpan, b: TimeSpan): number {
        const aStart = this.getEarliestPoint(a);
        const bStart = this.getEarliestPoint(b);

        if (!aStart || !bStart) {
            // Unknown/relative without resolution sort last
            if (!aStart && !bStart) return 0;
            if (!aStart) return 1;
            return -1;
        }

        return this.compareTimestamps(aStart, bStart);
    }

    /**
     * Get the earliest comparable point from a TimeSpan.
     * Public for use by EventManager and TimelineView.
     */
    getEarliestPoint(ts: TimeSpan): Timestamp | null {
        switch (ts.kind) {
            case 'instant':
                return ts.instant;
            case 'interval':
                return ts.start;
            case 'open-ended':
                return ts.start;
            case 'uncertain':
                return ts.range.start;
            case 'unknown':
                return null;
            case 'relative':
                // Cannot resolve without a reference resolver
                return null;
        }
    }

    /**
     * Compare two timestamps using their calendar adapter.
     * Public for use by TimelineView.
     */
    compareTimestamps(a: Timestamp, b: Timestamp): number {
        // If same calendar, use that adapter
        if (a.calendar === b.calendar) {
            const adapter = this.getAdapterForTimestamp(a);
            if (adapter) return adapter.compare(a, b);
        }
        // Cross-calendar fallback: compare by year only
        if (a.year !== b.year) return a.year - b.year;
        return 0;
    }

    // ── Overlap Detection ──

    /**
     * Check if two TimeSpans overlap.
     */
    overlaps(a: TimeSpan, b: TimeSpan): boolean {
        // Unknown never overlaps with anything specific
        if (a.kind === 'unknown' || b.kind === 'unknown') return false;

        // Relative dates need resolution
        if (a.kind === 'relative' || b.kind === 'relative') {
            // Cannot determine overlap without resolving references
            return false;
        }

        const aRange = this.toRange(a);
        const bRange = this.toRange(b);

        if (!aRange || !bRange) return false;

        // Two ranges overlap if one starts before the other ends and vice versa
        const aStartsBeforeBEnds = this.compareTimestamps(aRange.start, bRange.end) <= 0;
        const bStartsBeforeAEnds = this.compareTimestamps(bRange.start, aRange.end) <= 0;

        return aStartsBeforeBEnds && bStartsBeforeAEnds;
    }

    /**
     * Convert a TimeSpan to a start/end range for overlap comparison.
     * Open-ended intervals use a very large year as the end.
     */
    private toRange(ts: TimeSpan): { start: Timestamp; end: Timestamp } | null {
        switch (ts.kind) {
            case 'instant': {
                const t = ts.instant;
                return { start: t, end: t };
            }
            case 'interval':
                return { start: ts.start, end: ts.end };
            case 'open-ended':
                return {
                    start: ts.start,
                    end: { ...ts.start, year: 999999, precision: 'year' },
                };
            case 'uncertain':
                return { start: ts.range.start, end: ts.range.end };
            case 'unknown':
            case 'relative':
                return null;
        }
    }

    // ── Contains ──

    /**
     * Check if one TimeSpan fully contains another.
     */
    contains(container: TimeSpan, contained: TimeSpan): boolean {
        if (container.kind === 'unknown' || contained.kind === 'unknown') return false;
        if (container.kind === 'relative' || contained.kind === 'relative') return false;

        const cRange = this.toRange(container);
        const dRange = this.toRange(contained);

        if (!cRange || !dRange) return false;

        // Container contains contained if container starts before or at contained's start
        // and container ends after or at contained's end
        const startsBefore = this.compareTimestamps(cRange.start, dRange.start) <= 0;
        const endsAfter = this.compareTimestamps(cRange.end, dRange.end) >= 0;

        return startsBefore && endsAfter;
    }

    // ── Relative Date Resolution ──

    /**
     * Resolve a relative TimeSpan to an absolute one.
     * If the reference cannot be resolved, returns the original TimeSpan unchanged.
     */
    resolveRelative(
        timeSpan: TimeSpan,
        referenceResolver: (id: string) => TimeSpan | null
    ): TimeSpan {
        if (timeSpan.kind !== 'relative') return timeSpan;

        // Resolve the reference, applying offsets bottom-up
        const resolved = this.resolveRelativeChain(timeSpan, referenceResolver, 0);
        return resolved;
    }

    /**
     * Recursively resolve a chain of relative TimeSpans, accumulating offsets.
     * Returns the final absolute timestamp as an instant, or unknown if unresolvable.
     */
    private resolveRelativeChain(
        timeSpan: TimeSpan,
        referenceResolver: (id: string) => TimeSpan | null,
        depth: number
    ): TimeSpan {
        if (depth > 10) return { kind: 'unknown', display: 'Resolution depth exceeded' };

        if (timeSpan.kind !== 'relative') {
            // Base case: non-relative TimeSpan
            const point = this.getEarliestPoint(timeSpan);
            if (!point) return { kind: 'unknown', display: 'Cannot extract timestamp' };
            return { kind: 'instant', instant: point };
        }

        // Get the reference
        const reference = referenceResolver(timeSpan.relativeTo);
        if (!reference) {
            return { kind: 'unknown', display: timeSpan.display || `Unresolved: ${timeSpan.relativeTo}` };
        }

        // Recursively resolve the reference first
        const resolvedRef = this.resolveRelativeChain(reference, referenceResolver, depth + 1);

        // If the reference resolved to unknown, propagate
        if (resolvedRef.kind === 'unknown') {
            return resolvedRef;
        }

        // Get the concrete timestamp from the resolved reference
        const refPoint = this.getEarliestPoint(resolvedRef);
        if (!refPoint) {
            return { kind: 'unknown', display: timeSpan.display || `Unresolved: ${timeSpan.relativeTo}` };
        }

        // Apply this level's offset
        const { amount, unit, direction } = timeSpan.offset;
        const shift = direction === 'before' ? -amount : amount;
        const result = this.shiftTimestamp(refPoint, shift, unit);

        return {
            kind: 'instant',
            instant: result,
            display: timeSpan.display,
        };
    }

    /**
     * Shift a timestamp by a given amount and unit.
     * Handles month/year boundaries correctly, including leap years.
     */
    shiftTimestamp(ts: Timestamp, amount: number, unit: TemporalOffset['unit']): Timestamp {
        const result: Timestamp = { ...ts };

        switch (unit) {
            case 'day':
            case 'week': {
                const days = unit === 'week' ? amount * 7 : amount;
                if (result.day !== undefined && result.month !== undefined) {
                    const shifted = this.addDays(result.year, result.month, result.day, days);
                    result.year = shifted.year;
                    result.month = shifted.month;
                    result.day = shifted.day;
                }
                break;
            }
            case 'month':
            case 'season': {
                const months = unit === 'season' ? amount * 3 : amount;
                if (result.month !== undefined) {
                    const shifted = this.addMonths(result.year, result.month, result.day, months);
                    result.year = shifted.year;
                    result.month = shifted.month;
                    if (shifted.day !== undefined) result.day = shifted.day;
                }
                break;
            }
            case 'year':
                result.year += amount;
                break;
        }

        return result;
    }

    /**
     * Add days to a date, handling month/year boundaries and leap years.
     */
    private addDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
        let y = year;
        let m = month;
        let d = day + days;

        // Handle negative days by normalizing
        while (d < 1) {
            m -= 1;
            if (m < 1) {
                m = 12;
                y -= 1;
            }
            d += this.getDaysInMonth(y, m);
        }

        // Handle overflow
        while (true) {
            const maxDay = this.getDaysInMonth(y, m);
            if (d <= maxDay) break;
            d -= maxDay;
            m += 1;
            if (m > 12) {
                m = 1;
                y += 1;
            }
        }

        return { year: y, month: m, day: d };
    }

    /**
     * Add months to a date, clamping the day to the target month's max.
     * E.g., Jan 31 + 1 month = Feb 28 (or Feb 29 in leap year).
     */
    private addMonths(year: number, month: number, day: number | undefined, months: number): { year: number; month: number; day?: number } {
        let y = year;
        let m = month + months;

        // Normalize month
        while (m > 12) {
            m -= 12;
            y += 1;
        }
        while (m < 1) {
            m += 12;
            y -= 1;
        }

        // Clamp day to target month's max
        let d = day;
        if (d !== undefined) {
            const maxDay = this.getDaysInMonth(y, m);
            d = Math.min(d, maxDay);
        }

        return { year: y, month: m, day: d };
    }

    /**
     * Get the number of days in a month, accounting for leap years.
     */
    getDaysInMonth(year: number, month: number): number {
        if (month === 2) {
            return this.isLeapYear(year) ? 29 : 28;
        }
        const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return daysInMonth[month] || 30;
    }

    /**
     * Check if a year is a leap year in the Gregorian calendar.
     */
    isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    // ── YAML Serialization/Deserialization ──

    /**
     * Serialize a TimeSpan to a plain object suitable for YAML serialization.
     * The format is lossless and can be round-tripped back to a TimeSpan.
     */
    serializeToYaml(timeSpan: TimeSpan): Record<string, unknown> {
        switch (timeSpan.kind) {
            case 'instant':
                return {
                    kind: 'instant',
                    instant: this.serializeTimestamp(timeSpan.instant),
                    display: timeSpan.display,
                };
            case 'interval':
                return {
                    kind: 'interval',
                    start: this.serializeTimestamp(timeSpan.start),
                    end: this.serializeTimestamp(timeSpan.end),
                    display: timeSpan.display,
                };
            case 'open-ended':
                return {
                    kind: 'open-ended',
                    start: this.serializeTimestamp(timeSpan.start),
                    display: timeSpan.display,
                };
            case 'uncertain':
                return {
                    kind: 'uncertain',
                    range: {
                        start: this.serializeTimestamp(timeSpan.range.start),
                        end: this.serializeTimestamp(timeSpan.range.end),
                    },
                    confidence: timeSpan.confidence,
                    display: timeSpan.display,
                };
            case 'unknown':
                return {
                    kind: 'unknown',
                    display: timeSpan.display,
                };
            case 'relative':
                return {
                    kind: 'relative',
                    relativeTo: timeSpan.relativeTo,
                    offset: {
                        amount: timeSpan.offset.amount,
                        unit: timeSpan.offset.unit,
                        direction: timeSpan.offset.direction,
                    },
                    display: timeSpan.display,
                };
        }
    }

    /**
     * Serialize a Timestamp to a plain object for YAML.
     */
    private serializeTimestamp(ts: Timestamp): Record<string, unknown> {
        const result: Record<string, unknown> = {
            calendar: ts.calendar,
            year: ts.year,
        };
        if (ts.month !== undefined) result.month = ts.month;
        if (ts.day !== undefined) result.day = ts.day;
        if (ts.hour !== undefined) result.hour = ts.hour;
        if (ts.minute !== undefined) result.minute = ts.minute;
        if (ts.precision !== undefined) result.precision = ts.precision;
        return result;
    }

    /**
     * Deserialize a TimeSpan from a plain object (parsed from YAML).
     * Returns null if the object is not a valid TimeSpan.
     */
    deserializeFromYaml(obj: unknown): TimeSpan | null {
        if (!obj || typeof obj !== 'object') return null;
        const data = obj as Record<string, unknown>;
        const kind = data.kind;

        if (typeof kind !== 'string') return null;

        switch (kind) {
            case 'instant': {
                const instant = this.deserializeTimestamp(data.instant);
                if (!instant) return null;
                return {
                    kind: 'instant',
                    instant,
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            }
            case 'interval': {
                const start = this.deserializeTimestamp(data.start);
                const end = this.deserializeTimestamp(data.end);
                if (!start || !end) return null;
                return {
                    kind: 'interval',
                    start,
                    end,
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            }
            case 'open-ended': {
                const start = this.deserializeTimestamp(data.start);
                if (!start) return null;
                return {
                    kind: 'open-ended',
                    start,
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            }
            case 'uncertain': {
                const rangeData = data.range;
                if (!rangeData || typeof rangeData !== 'object') return null;
                const rangeStart = this.deserializeTimestamp((rangeData as unknown).start);
                const rangeEnd = this.deserializeTimestamp((rangeData as unknown).end);
                if (!rangeStart || !rangeEnd) return null;
                return {
                    kind: 'uncertain',
                    range: { start: rangeStart, end: rangeEnd },
                    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            }
            case 'unknown':
                return {
                    kind: 'unknown',
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            case 'relative': {
                const offsetData = data.offset;
                if (!offsetData || typeof offsetData !== 'object') return null;
                const offset = offsetData as Record<string, unknown>;
                return {
                    kind: 'relative',
                    relativeTo: typeof data.relativeTo === 'string' ? data.relativeTo : '',
                    offset: {
                        amount: typeof offset.amount === 'number' ? offset.amount : 0,
                        unit: (typeof offset.unit === 'string' ? offset.unit : 'day') as TemporalOffset['unit'],
                        direction: (typeof offset.direction === 'string' ? offset.direction : 'after') as 'before' | 'after',
                    },
                    display: typeof data.display === 'string' ? data.display : undefined,
                };
            }
            default:
                return null;
        }
    }

    /**
     * Deserialize a Timestamp from a plain object.
     */
    private deserializeTimestamp(obj: unknown): Timestamp | null {
        if (!obj || typeof obj !== 'object') return null;
        const data = obj as Record<string, unknown>;
        if (typeof data.year !== 'number') return null;

        const ts: Timestamp = {
            calendar: typeof data.calendar === 'string' ? data.calendar : DEFAULT_CALENDAR,
            year: data.year,
        };
        if (typeof data.month === 'number') ts.month = data.month;
        if (typeof data.day === 'number') ts.day = data.day;
        if (typeof data.hour === 'number') ts.hour = data.hour;
        if (typeof data.minute === 'number') ts.minute = data.minute;
        if (typeof data.precision === 'string') ts.precision = data.precision as DatePrecision;
        else {
            // Infer precision from available fields
            if (ts.minute !== undefined) ts.precision = 'minute';
            else if (ts.hour !== undefined) ts.precision = 'hour';
            else if (ts.day !== undefined) ts.precision = 'day';
            else if (ts.month !== undefined) ts.precision = 'month';
            else ts.precision = 'year';
        }
        return ts;
    }

    // ── Legacy StoryDate/StoryTime Migration ──

    /**
     * Convert legacy storyDate and storyTime fields to a TimeSpan.
     * This allows gradual migration without breaking existing scenes.
     */
    convertLegacyToTimeSpan(storyDate?: string, storyTime?: string): TimeSpan | null {
        if (!storyDate && !storyTime) return null;

        const date = storyDate?.trim();
        const time = storyTime?.trim();

        if (date) {
            const parsed = this.parse(date);
            if (parsed) {
                // If we have a time component and the parsed result is an instant,
                // try to merge the time
                if (time && parsed.kind === 'instant') {
                    const timeMatch = time.match(/^(\d{1,2}):(\d{1,2})$/);
                    if (timeMatch) {
                        const [, hour, minute] = timeMatch;
                        return {
                            kind: 'instant',
                            instant: {
                                ...parsed.instant,
                                hour: parseInt(hour, 10),
                                minute: parseInt(minute, 10),
                                precision: 'minute',
                            },
                            display: `${date} ${time}`,
                        };
                    }
                }
                return parsed;
            }
        }

        // If date parsing fails but we have a time-only value, return unknown with display
        if (time) {
            return { kind: 'unknown', display: time };
        }

        return null;
    }
}
