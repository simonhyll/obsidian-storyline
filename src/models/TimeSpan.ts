/**
 * Shared TimeSpan Model
 *
 * A reusable temporal model for Events, Scenes, Codex entities, graph relationships,
 * and other timeline-compatible objects. This module defines the types only;
 * parsing, comparison, and calendar conversion are implemented in Phase 2.
 *
 * Design goals:
 * - No JavaScript Date for canonical representation
 * - Pluggable calendar system (Gregorian default)
 * - Support for instants, intervals, uncertain dates, and relative references
 * - Machine-readable temporal offsets
 * - Separation of canonical time from display formatting
 */

/**
 * Date precision levels.
 */
export type DatePrecision = 'year' | 'month' | 'day' | 'hour' | 'minute';

/**
 * Calendar-independent timestamp.
 * Uses explicit year/month/day fields to support very large historical and future time scales.
 */
export interface Timestamp {
    /** Calendar identifier, defaults to 'gregorian', extensible for custom calendars */
    calendar: string;
    /** Year - supports large values for BC/AD and fantasy calendars */
    year: number;
    /** Month (1-12), optional for year-level precision */
    month?: number;
    /** Day (1-31), optional for month-level precision */
    day?: number;
    /** Hour (0-23), optional for day-level precision */
    hour?: number;
    /** Minute (0-59), optional for hour-level precision */
    minute?: number;
    /** Granularity of this timestamp */
    precision?: DatePrecision;
}

/**
 * Structured temporal offset for relative dates.
 * Replaces free-form strings like "3 days before" with a parseable expression.
 */
export interface TemporalOffset {
    /** Numeric amount, e.g. 3, -1, 365 */
    amount: number;
    /** Time unit */
    unit: 'day' | 'week' | 'month' | 'year' | 'season';
    /** Direction relative to the reference */
    direction: 'before' | 'after';
}

/**
 * TimeSpan kind discriminator.
 */
export type TimeSpanKind = 'instant' | 'interval' | 'open-ended' | 'uncertain' | 'unknown' | 'relative';

/**
 * An exact point in time.
 */
export interface InstantTimeSpan {
    kind: 'instant';
    /** The exact timestamp */
    instant: Timestamp;
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * A time interval with a defined start and end.
 */
export interface IntervalTimeSpan {
    kind: 'interval';
    /** Interval start */
    start: Timestamp;
    /** Interval end */
    end: Timestamp;
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * An interval that has a start but no defined end.
 */
export interface OpenEndedTimeSpan {
    kind: 'open-ended';
    /** Interval start */
    start: Timestamp;
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * An approximate or uncertain date range with a confidence score.
 */
export interface UncertainTimeSpan {
    kind: 'uncertain';
    /** The possible range */
    range: { start: Timestamp; end: Timestamp };
    /** Confidence score 0-1 */
    confidence?: number;
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * A date that is completely unknown.
 */
export interface UnknownTimeSpan {
    kind: 'unknown';
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * A date defined relative to another event or scene.
 */
export interface RelativeTimeSpan {
    kind: 'relative';
    /** Event ID or scene ID reference */
    relativeTo: string;
    /** Structured offset */
    offset: TemporalOffset;
    /** Author-facing label, separate from canonical representation */
    display?: string;
}

/**
 * Reusable temporal representation as a discriminated union.
 *
 * Each variant requires its specific fields, making invalid combinations
 * impossible at compile time.
 *
 * Supports:
 * - Exact instants
 * - Time intervals
 * - Open-ended intervals (start only)
 * - Approximate or uncertain dates with confidence
 * - Unknown dates
 * - Relative dates via machine-readable offsets
 */
export type TimeSpan =
    | InstantTimeSpan
    | IntervalTimeSpan
    | OpenEndedTimeSpan
    | UncertainTimeSpan
    | UnknownTimeSpan
    | RelativeTimeSpan;

/**
 * Calendar adapter interface for pluggable calendar systems.
 * Implementation deferred to Phase 2.
 */
export interface CalendarAdapter {
    /** Calendar identifier, e.g. 'gregorian' */
    id: string;
    /** Human-readable name */
    name: string;
    /** Convert a timestamp to a display string */
    format(timestamp: Timestamp): string;
    /** Parse a display string to a timestamp */
    parse(input: string): Timestamp | null;
    /** Compare two timestamps within this calendar; returns negative/zero/positive */
    compare(a: Timestamp, b: Timestamp): number;
    /** Check if two timestamps are equal */
    equals(a: Timestamp, b: Timestamp): boolean;
}

/**
 * Default calendar identifier.
 */
export const DEFAULT_CALENDAR = 'gregorian';

/**
 * Create an instant TimeSpan.
 */
export function createInstantTimeSpan(year: number, month?: number, day?: number, calendar?: string): InstantTimeSpan {
    return {
        kind: 'instant',
        instant: {
            calendar: calendar || DEFAULT_CALENDAR,
            year,
            month,
            day,
            precision: day ? 'day' : month ? 'month' : 'year',
        },
    };
}

/**
 * Create an interval TimeSpan (must have both start and end).
 */
export function createIntervalTimeSpan(
    startYear: number,
    startMonth?: number,
    startDay?: number,
    endYear?: number,
    endMonth?: number,
    endDay?: number,
    calendar?: string
): IntervalTimeSpan | OpenEndedTimeSpan {
    const cal = calendar || DEFAULT_CALENDAR;
    const hasEnd = endYear !== undefined;

    if (hasEnd) {
        return {
            kind: 'interval',
            start: {
                calendar: cal,
                year: startYear,
                month: startMonth,
                day: startDay,
                precision: startDay ? 'day' : startMonth ? 'month' : 'year',
            },
            end: {
                calendar: cal,
                year: endYear!,
                month: endMonth,
                day: endDay,
                precision: endDay ? 'day' : endMonth ? 'month' : 'year',
            },
        };
    } else {
        return {
            kind: 'open-ended',
            start: {
                calendar: cal,
                year: startYear,
                month: startMonth,
                day: startDay,
                precision: startDay ? 'day' : startMonth ? 'month' : 'year',
            },
        };
    }
}

/**
 * Create an uncertain TimeSpan.
 */
export function createUncertainTimeSpan(
    startYear: number,
    endYear: number,
    confidence?: number,
    calendar?: string
): UncertainTimeSpan {
    const cal = calendar || DEFAULT_CALENDAR;
    return {
        kind: 'uncertain',
        range: {
            start: { calendar: cal, year: startYear, precision: 'year' },
            end: { calendar: cal, year: endYear, precision: 'year' },
        },
        confidence: confidence ?? 0.5,
    };
}

/**
 * Create an unknown TimeSpan.
 */
export function createUnknownTimeSpan(display?: string): UnknownTimeSpan {
    return {
        kind: 'unknown',
        display,
    };
}

/**
 * Create a relative TimeSpan.
 */
export function createRelativeTimeSpan(
    relativeTo: string,
    amount: number,
    unit: TemporalOffset['unit'],
    direction: 'before' | 'after'
): RelativeTimeSpan {
    return {
        kind: 'relative',
        relativeTo,
        offset: { amount, unit, direction },
    };
}