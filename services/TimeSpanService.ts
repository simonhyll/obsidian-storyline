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
    private parseTimestamp(input: string): Timestamp | null {
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
     */
    private getEarliestPoint(ts: TimeSpan): Timestamp | null {
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
     */
    private compareTimestamps(a: Timestamp, b: Timestamp): number {
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
     */
    private shiftTimestamp(ts: Timestamp, amount: number, unit: TemporalOffset['unit']): Timestamp {
        const result: Timestamp = { ...ts };

        switch (unit) {
            case 'day':
                if (result.day !== undefined) {
                    result.day += amount;
                }
                break;
            case 'week':
                if (result.day !== undefined) {
                    result.day += amount * 7;
                }
                break;
            case 'month':
                if (result.month !== undefined) {
                    result.month += amount;
                    // Handle month overflow
                    while (result.month > 12) {
                        result.month -= 12;
                        result.year += 1;
                    }
                    while (result.month < 1) {
                        result.month += 12;
                        result.year -= 1;
                    }
                }
                break;
            case 'year':
                result.year += amount;
                break;
            case 'season':
                // Approximate: 1 season = 3 months
                if (result.month !== undefined) {
                    result.month += amount * 3;
                    while (result.month > 12) {
                        result.month -= 12;
                        result.year += 1;
                    }
                    while (result.month < 1) {
                        result.month += 12;
                        result.year -= 1;
                    }
                }
                break;
        }

        return result;
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
