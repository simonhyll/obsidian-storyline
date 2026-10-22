import { describe, it, expect } from 'vitest';
import {
    createInstantTimeSpan,
    createIntervalTimeSpan,
    createUncertainTimeSpan,
    createUnknownTimeSpan,
    createRelativeTimeSpan,
    DEFAULT_CALENDAR,
    type TimeSpan,
    type InstantTimeSpan,
    type IntervalTimeSpan,
    type OpenEndedTimeSpan,
    type UncertainTimeSpan,
    type UnknownTimeSpan,
    type RelativeTimeSpan,
} from '../models/TimeSpan';

describe('TimeSpan', () => {
    describe('discriminated union types', () => {
        it('instant requires instant field', () => {
            const ts: InstantTimeSpan = {
                kind: 'instant',
                instant: { calendar: 'gregorian', year: 2024, precision: 'year' },
            };
            expect(ts.kind).toBe('instant');
            expect(ts.instant).toBeDefined();
        });

        it('interval requires start and end fields', () => {
            const ts: IntervalTimeSpan = {
                kind: 'interval',
                start: { calendar: 'gregorian', year: 2024, precision: 'year' },
                end: { calendar: 'gregorian', year: 2025, precision: 'year' },
            };
            expect(ts.kind).toBe('interval');
            expect(ts.start).toBeDefined();
            expect(ts.end).toBeDefined();
        });

        it('open-ended requires start field only', () => {
            const ts: OpenEndedTimeSpan = {
                kind: 'open-ended',
                start: { calendar: 'gregorian', year: 2024, precision: 'year' },
            };
            expect(ts.kind).toBe('open-ended');
            expect(ts.start).toBeDefined();
        });

        it('uncertain requires range field', () => {
            const ts: UncertainTimeSpan = {
                kind: 'uncertain',
                range: {
                    start: { calendar: 'gregorian', year: 2024, precision: 'year' },
                    end: { calendar: 'gregorian', year: 2026, precision: 'year' },
                },
                confidence: 0.7,
            };
            expect(ts.kind).toBe('uncertain');
            expect(ts.range).toBeDefined();
        });

        it('unknown has no temporal fields', () => {
            const ts: UnknownTimeSpan = {
                kind: 'unknown',
                display: 'Unknown date',
            };
            expect(ts.kind).toBe('unknown');
        });

        it('relative requires relativeTo and offset', () => {
            const ts: RelativeTimeSpan = {
                kind: 'relative',
                relativeTo: 'event-123',
                offset: { amount: 3, unit: 'day', direction: 'before' },
            };
            expect(ts.kind).toBe('relative');
            expect(ts.relativeTo).toBe('event-123');
            expect(ts.offset).toBeDefined();
        });
    });

    describe('factory functions', () => {
        it('createInstantTimeSpan creates valid instant', () => {
            const ts = createInstantTimeSpan(2024, 6, 15);
            expect(ts.kind).toBe('instant');
            expect(ts.instant).toBeDefined();
            expect(ts.instant!.year).toBe(2024);
            expect(ts.instant!.month).toBe(6);
            expect(ts.instant!.day).toBe(15);
            expect(ts.instant!.calendar).toBe(DEFAULT_CALENDAR);
        });

        it('createIntervalTimeSpan creates interval with end', () => {
            const ts = createIntervalTimeSpan(2024, 1, 1, 2025, 12, 31);
            expect(ts.kind).toBe('interval');
            expect(ts.start).toBeDefined();
            if (ts.kind === 'interval') {
                expect(ts.end).toBeDefined();
            }
        });

        it('createIntervalTimeSpan creates open-ended without end', () => {
            const ts = createIntervalTimeSpan(2024);
            expect(ts.kind).toBe('open-ended');
            expect(ts.start).toBeDefined();
        });

        it('createUncertainTimeSpan creates valid uncertain span', () => {
            const ts = createUncertainTimeSpan(2024, 2026, 0.8);
            expect(ts.kind).toBe('uncertain');
            expect(ts.range).toBeDefined();
            expect(ts.confidence).toBe(0.8);
        });

        it('createUnknownTimeSpan creates valid unknown span', () => {
            const ts = createUnknownTimeSpan('Some unknown time');
            expect(ts.kind).toBe('unknown');
            expect(ts.display).toBe('Some unknown time');
        });

        it('createRelativeTimeSpan creates valid relative span', () => {
            const ts = createRelativeTimeSpan('scene-abc', 7, 'week', 'after');
            expect(ts.kind).toBe('relative');
            expect(ts.relativeTo).toBe('scene-abc');
            expect(ts.offset!.amount).toBe(7);
            expect(ts.offset!.unit).toBe('week');
            expect(ts.offset!.direction).toBe('after');
        });
    });

    describe('TimeSpan union type', () => {
        it('accepts all variants', () => {
            const spans: TimeSpan[] = [
                createInstantTimeSpan(2024),
                createIntervalTimeSpan(2024, 1, 1, 2025),
                createIntervalTimeSpan(2024), // open-ended
                createUncertainTimeSpan(2024, 2026),
                createUnknownTimeSpan(),
                createRelativeTimeSpan('evt-1', 1, 'day', 'before'),
            ];
            expect(spans.length).toBe(6);
        });

        it('supports kind-based narrowing', () => {
            const ts: TimeSpan = createInstantTimeSpan(2024);
            if (ts.kind === 'instant') {
                // TypeScript should narrow to InstantTimeSpan here
                expect(ts.instant).toBeDefined();
            }
        });
    });
});
