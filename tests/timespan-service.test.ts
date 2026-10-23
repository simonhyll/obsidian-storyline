/**
 * TimeSpanService Tests
 *
 * Tests for parsing, comparison, overlap detection, formatting,
 * relative date resolution, and legacy migration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimeSpanService } from '../src/services/TimeSpanService';
import {
    createInstantTimeSpan,
    createIntervalTimeSpan,
    createUncertainTimeSpan,
    createUnknownTimeSpan,
    createRelativeTimeSpan,
} from '../src/models/TimeSpan';

describe('TimeSpanService', () => {
    let service: TimeSpanService;

    beforeEach(() => {
        service = new TimeSpanService();
    });

    describe('Parsing', () => {
        it('parses ISO date as instant', () => {
            const result = service.parse('2024-01-15');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('instant');
            if (result!.kind === 'instant') {
                expect(result!.instant.year).toBe(2024);
                expect(result!.instant.month).toBe(1);
                expect(result!.instant.day).toBe(15);
            }
        });

        it('parses year-month as instant', () => {
            const result = service.parse('2024-06');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('instant');
            if (result!.kind === 'instant') {
                expect(result!.instant.year).toBe(2024);
                expect(result!.instant.month).toBe(6);
            }
        });

        it('parses year-only as instant', () => {
            const result = service.parse('1850');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('instant');
            if (result!.kind === 'instant') {
                expect(result!.instant.year).toBe(1850);
            }
        });

        it('parses interval with "to" syntax', () => {
            const result = service.parse('2024-01-01 to 2024-03-31');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('interval');
            if (result!.kind === 'interval') {
                expect(result!.start.year).toBe(2024);
                expect(result!.start.month).toBe(1);
                expect(result!.end.month).toBe(3);
                expect(result!.end.day).toBe(31);
            }
        });

        it('parses open-ended interval', () => {
            const result = service.parse('2024-01-01 to ?');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('open-ended');
            if (result!.kind === 'open-ended') {
                expect(result!.start.year).toBe(2024);
            }
        });

        it('parses uncertain date with "circa"', () => {
            const result = service.parse('circa 1850');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('uncertain');
            if (result!.kind === 'uncertain') {
                expect(result!.confidence).toBe(0.5);
            }
        });

        it('parses uncertain date with tilde', () => {
            const result = service.parse('~2024-01-15');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('uncertain');
        });

        it('parses unknown date', () => {
            const result = service.parse('unknown');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('unknown');
        });

        it('parses relative date', () => {
            const result = service.parse('3 days before event:abc-123');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('relative');
            if (result!.kind === 'relative') {
                expect(result!.relativeTo).toBe('abc-123');
                expect(result!.offset.amount).toBe(3);
                expect(result!.offset.unit).toBe('day');
                expect(result!.offset.direction).toBe('before');
            }
        });

        it('returns null for unparseable input', () => {
            const result = service.parse('not a date');
            expect(result).toBeNull();
        });

        it('returns null for empty input', () => {
            const result = service.parse('');
            expect(result).toBeNull();
        });
    });

    describe('Formatting', () => {
        it('formats instant', () => {
            const ts = createInstantTimeSpan(2024, 1, 15);
            const formatted = service.format(ts);
            expect(formatted).toBe('2024-01-15');
        });

        it('formats interval', () => {
            const ts = createIntervalTimeSpan(2024, 1, 1, 2024, 3, 31);
            expect(ts.kind).toBe('interval');
            const formatted = service.format(ts);
            expect(formatted).toContain('2024-01-01');
            expect(formatted).toContain('2024-03-31');
        });

        it('formats open-ended', () => {
            const ts = createIntervalTimeSpan(2024, 1, 1);
            expect(ts.kind).toBe('open-ended');
            const formatted = service.format(ts);
            expect(formatted).toContain('to ?');
        });

        it('formats uncertain', () => {
            const ts = createUncertainTimeSpan(1849, 1851);
            const formatted = service.format(ts);
            expect(formatted).toContain('circa');
        });

        it('formats unknown', () => {
            const ts = createUnknownTimeSpan('Some time in the past');
            const formatted = service.format(ts);
            expect(formatted).toBe('Some time in the past');
        });

        it('formats unknown with no display', () => {
            const ts = createUnknownTimeSpan();
            const formatted = service.format(ts);
            expect(formatted).toBe('Unknown');
        });

        it('formats relative', () => {
            const ts = createRelativeTimeSpan('event-123', 3, 'day', 'before');
            const formatted = service.format(ts);
            expect(formatted).toBe('3 days before event-123');
        });
    });

    describe('Comparison', () => {
        it('compares two instants', () => {
            const a = createInstantTimeSpan(2024, 1, 1);
            const b = createInstantTimeSpan(2024, 6, 1);
            expect(service.compare(a, b)).toBeLessThan(0);
            expect(service.compare(b, a)).toBeGreaterThan(0);
        });

        it('compares equal instants', () => {
            const a = createInstantTimeSpan(2024, 1, 15);
            const b = createInstantTimeSpan(2024, 1, 15);
            expect(service.compare(a, b)).toBe(0);
        });

        it('compares interval vs instant using earliest point', () => {
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 12, 31);
            expect(interval.kind).toBe('interval');
            const instant = createInstantTimeSpan(2023, 6, 1);
            expect(service.compare(instant, interval)).toBeLessThan(0);
        });

        it('sorts unknown last', () => {
            const instant = createInstantTimeSpan(2024, 1, 1);
            const unknown = createUnknownTimeSpan();
            expect(service.compare(unknown, instant)).toBeGreaterThan(0);
        });

        it('sorts two unknowns as equal', () => {
            const a = createUnknownTimeSpan();
            const b = createUnknownTimeSpan();
            expect(service.compare(a, b)).toBe(0);
        });
    });

    describe('Overlap Detection', () => {
        it('detects overlapping intervals', () => {
            const a = createIntervalTimeSpan(2024, 1, 1, 2024, 6, 30);
            const b = createIntervalTimeSpan(2024, 3, 1, 2024, 9, 30);
            expect(a.kind).toBe('interval');
            expect(b.kind).toBe('interval');
            expect(service.overlaps(a, b)).toBe(true);
        });

        it('detects non-overlapping intervals', () => {
            const a = createIntervalTimeSpan(2024, 1, 1, 2024, 3, 31);
            const b = createIntervalTimeSpan(2024, 4, 1, 2024, 6, 30);
            expect(a.kind).toBe('interval');
            expect(b.kind).toBe('interval');
            expect(service.overlaps(a, b)).toBe(false);
        });

        it('instant overlaps interval containing it', () => {
            const instant = createInstantTimeSpan(2024, 3, 15);
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 6, 30);
            expect(interval.kind).toBe('interval');
            expect(service.overlaps(instant, interval)).toBe(true);
        });

        it('instant does not overlap interval not containing it', () => {
            const instant = createInstantTimeSpan(2024, 7, 1);
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 6, 30);
            expect(interval.kind).toBe('interval');
            expect(service.overlaps(instant, interval)).toBe(false);
        });

        it('unknown does not overlap anything', () => {
            const unknown = createUnknownTimeSpan();
            const instant = createInstantTimeSpan(2024, 1, 1);
            expect(service.overlaps(unknown, instant)).toBe(false);
        });

        it('open-ended overlaps future instant', () => {
            const open = createIntervalTimeSpan(2024, 1, 1);
            expect(open.kind).toBe('open-ended');
            const future = createInstantTimeSpan(2025, 6, 1);
            expect(service.overlaps(open, future)).toBe(true);
        });

        it('uncertain overlaps interval within range', () => {
            const uncertain = createUncertainTimeSpan(2024, 2026);
            const interval = createIntervalTimeSpan(2024, 6, 1, 2025, 6, 1);
            expect(interval.kind).toBe('interval');
            expect(service.overlaps(uncertain, interval)).toBe(true);
        });
    });

    describe('Contains', () => {
        it('interval contains instant within it', () => {
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 12, 31);
            expect(interval.kind).toBe('interval');
            const instant = createInstantTimeSpan(2024, 6, 15);
            expect(service.contains(interval, instant)).toBe(true);
        });

        it('interval does not contain instant outside it', () => {
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 6, 30);
            expect(interval.kind).toBe('interval');
            const instant = createInstantTimeSpan(2025, 1, 1);
            expect(service.contains(interval, instant)).toBe(false);
        });

        it('larger interval contains smaller interval', () => {
            const large = createIntervalTimeSpan(2024, 1, 1, 2024, 12, 31);
            expect(large.kind).toBe('interval');
            const small = createIntervalTimeSpan(2024, 3, 1, 2024, 6, 30);
            expect(small.kind).toBe('interval');
            expect(service.contains(large, small)).toBe(true);
        });

        it('smaller interval does not contain larger', () => {
            const large = createIntervalTimeSpan(2024, 1, 1, 2024, 12, 31);
            expect(large.kind).toBe('interval');
            const small = createIntervalTimeSpan(2024, 3, 1, 2024, 6, 30);
            expect(small.kind).toBe('interval');
            expect(service.contains(small, large)).toBe(false);
        });
    });

    describe('Relative Date Resolution', () => {
        it('resolves relative date to instant', () => {
            const relative = createRelativeTimeSpan('event-123', 3, 'day', 'after');
            const resolved = service.resolveRelative(relative, (id) => {
                if (id === 'event-123') {
                    return createInstantTimeSpan(2024, 1, 10);
                }
                return null;
            });
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') expect(resolved.instant.day).toBe(13);
        });

        it('resolves before direction', () => {
            const relative = createRelativeTimeSpan('event-123', 5, 'day', 'before');
            const resolved = service.resolveRelative(relative, (id) => {
                if (id === 'event-123') {
                    return createInstantTimeSpan(2024, 1, 10);
                }
                return null;
            });
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') expect(resolved.instant.day).toBe(5);
        });

        it('returns unknown when reference not found', () => {
            const relative = createRelativeTimeSpan('nonexistent', 3, 'day', 'after');
            const resolved = service.resolveRelative(relative, () => null);
            expect(resolved.kind).toBe('unknown');
        });

        it('resolves non-relative unchanged', () => {
            const instant = createInstantTimeSpan(2024, 1, 1);
            const resolved = service.resolveRelative(instant, () => null);
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') expect(resolved.instant.year).toBe(2024);
        });

        it('resolves chained relative dates', () => {
            const relative = createRelativeTimeSpan('event-b', 1, 'day', 'after');
            const resolved = service.resolveRelative(relative, (id) => {
                if (id === 'event-b') {
                    return createRelativeTimeSpan('event-a', 2, 'day', 'after');
                }
                if (id === 'event-a') {
                    return createInstantTimeSpan(2024, 1, 1);
                }
                return null;
            });
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') expect(resolved.instant.day).toBe(4);
        });
    });

    describe('Legacy Migration', () => {
        it('converts storyDate to instant', () => {
            const result = service.convertLegacyToTimeSpan('2024-01-15');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('instant');
            if (result!.kind === 'instant') expect(result!.instant.year).toBe(2024);
        });

        it('converts storyDate and storyTime to instant with time', () => {
            const result = service.convertLegacyToTimeSpan('2024-01-15', '14:30');
            expect(result).not.toBeNull();
            expect(result!.kind).toBe('instant');
            if (result!.kind === 'instant') {
                expect(result!.instant.hour).toBe(14);
                expect(result!.instant.minute).toBe(30);
            }
        });

        it('returns null for empty inputs', () => {
            const result = service.convertLegacyToTimeSpan();
            expect(result).toBeNull();
        });

        it('returns null for unparseable date', () => {
            const result = service.convertLegacyToTimeSpan('not a date');
            expect(result).toBeNull();
        });
    });

    describe('Calendar Registration', () => {
        it('registers and retrieves custom calendar', () => {
            const customCalendar = {
                id: 'fantasy',
                name: 'Fantasy Calendar',
                format: () => 'Fantasy Date',
                parse: () => null,
                compare: () => 0,
                equals: () => false,
            };
            service.registerCalendar(customCalendar);
            const retrieved = service.getCalendar('fantasy');
            expect(retrieved).not.toBeNull();
            expect(retrieved!.name).toBe('Fantasy Calendar');
        });

        it('returns null for non-existent calendar', () => {
            const retrieved = service.getCalendar('nonexistent');
            expect(retrieved).toBeNull();
        });

        it('has gregorian calendar by default', () => {
            const gregorian = service.getCalendar('gregorian');
            expect(gregorian).not.toBeNull();
            expect(gregorian!.name).toBe('Gregorian');
        });
    });
});
