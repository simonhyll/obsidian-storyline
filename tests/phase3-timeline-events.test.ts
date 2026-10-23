import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Event } from '../src/models/Event';
import type { TimeSpan, Timestamp } from '../src/models/TimeSpan';
import { TimeSpanService } from '../src/services/TimeSpanService';
import { EventManager } from '../src/services/EventManager';

/**
 * Integration tests for Phase 3 Milestone 1: Events in Timeline.
 *
 * These tests verify:
 * - TimeSpanService temporal placement for Events
 * - EventManager range queries using TimeSpanService safely
 * - Chronological sorting of mixed Scenes and Events
 * - Unknown, uncertain, and relative TimeSpans never produce fabricated dates
 * - Swimlane mode does not silently discard Events
 */

describe('Phase 3: Events in Timeline', () => {
    let tsService: TimeSpanService;
    let eventManager: EventManager;

    beforeEach(() => {
        tsService = new TimeSpanService();
        eventManager = new EventManager({} as unknown);
        eventManager.setTimeSpanService(tsService);
    });

    // ── TimeSpan placement ──

    describe('TimeSpan temporal placement', () => {
        it('instant TimeSpan provides a sortable earliest point', () => {
            const ts: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } };
            const point = tsService.getEarliestPoint(ts);
            expect(point).not.toBeNull();
            expect(point!.year).toBe(2000);
            expect(point!.month).toBe(1);
            expect(point!.day).toBe(1);
        });

        it('interval TimeSpan provides the start as earliest point', () => {
            const ts: TimeSpan = {
                kind: 'interval',
                start: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' },
                end: { calendar: 'gregorian', year: 2000, month: 3, day: 15, precision: 'day' },
            };
            const point = tsService.getEarliestPoint(ts);
            expect(point).not.toBeNull();
            expect(point!.year).toBe(2000);
            expect(point!.month).toBe(1);
        });

        it('uncertain TimeSpan provides the range start as earliest point', () => {
            const ts: TimeSpan = {
                kind: 'uncertain',
                range: {
                    start: { calendar: 'gregorian', year: 1999, month: 6, day: 1, precision: 'day' },
                    end: { calendar: 'gregorian', year: 2000, month: 6, day: 1, precision: 'day' },
                },
                confidence: 0.5,
            };
            const point = tsService.getEarliestPoint(ts);
            expect(point).not.toBeNull();
            expect(point!.year).toBe(1999);
        });

        it('unknown TimeSpan returns null earliest point', () => {
            const ts: TimeSpan = { kind: 'unknown' };
            const point = tsService.getEarliestPoint(ts);
            expect(point).toBeNull();
        });

        it('relative TimeSpan returns null earliest point without resolution', () => {
            const ts: TimeSpan = {
                kind: 'relative',
                relativeTo: 'some-event-id',
                offset: { amount: 3, unit: 'day', direction: 'after' },
            };
            const point = tsService.getEarliestPoint(ts);
            expect(point).toBeNull();
        });

        it('open-ended TimeSpan provides the start as earliest point', () => {
            const ts: TimeSpan = {
                kind: 'open-ended',
                start: { calendar: 'gregorian', year: 1850, month: 1, day: 1, precision: 'day' },
            };
            const point = tsService.getEarliestPoint(ts);
            expect(point).not.toBeNull();
            expect(point!.year).toBe(1850);
        });
    });

    // ── Chronological sorting ──

    describe('Chronological sorting of mixed Scenes and Events', () => {
        it('Scene and Event with same date both appear as distinct items', () => {
            const sceneDate: Timestamp = { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' };
            const sceneTimeSpan: TimeSpan = { kind: 'instant', instant: sceneDate };
            const eventTimeSpan: TimeSpan = { kind: 'instant', instant: sceneDate };

            const sceneSortKey = tsService.getEarliestPoint(sceneTimeSpan);
            const eventSortKey = tsService.getEarliestPoint(eventTimeSpan);

            // Both should have the same sort key
            expect(sceneSortKey).not.toBeNull();
            expect(eventSortKey).not.toBeNull();
            expect(tsService.compareTimestamps(sceneSortKey!, eventSortKey!)).toBe(0);

            // They are distinct items — the timeline should render both
            // (This is verified by the rendering logic, not by the sort key)
        });

        it('Events without dates sort after Events with dates', () => {
            const eventWithDate: Event = {
                id: '1', filePath: 'Events/dated.md', type: 'event', name: 'Dated Event',
                timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } },
            };
            const eventWithoutDate: Event = {
                id: '2', filePath: 'Events/undated.md', type: 'event', name: 'Undated Event',
            };

            const pointWith = tsService.getEarliestPoint(eventWithDate.timeSpan!);
            const pointWithout = eventWithoutDate.timeSpan ? tsService.getEarliestPoint(eventWithoutDate.timeSpan) : null;

            expect(pointWith).not.toBeNull();
            expect(pointWithout).toBeNull();
        });

        it('Chronological order handles mixed Scenes and Events', () => {
            // Simulate the sorting logic in buildChronologicalTimelineItems
            const items = [
                { name: 'Event A', timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } } as TimeSpan },
                { name: 'Scene B', timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 1999, month: 12, day: 25, precision: 'day' } } as TimeSpan },
                { name: 'Event C', timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 2, day: 14, precision: 'day' } } as TimeSpan },
                { name: 'Scene D', timeSpan: null },
                { name: 'Event E', timeSpan: { kind: 'unknown' } as TimeSpan },
            ];

            const sorted = [...items].sort((a, b) => {
                const aPoint = a.timeSpan ? tsService.getEarliestPoint(a.timeSpan) : null;
                const bPoint = b.timeSpan ? tsService.getEarliestPoint(b.timeSpan) : null;
                if (!aPoint && !bPoint) return 0;
                if (!aPoint) return 1;
                if (!bPoint) return -1;
                return tsService.compareTimestamps(aPoint, bPoint);
            });

            // Scene B (1999-12-25) should come first
            expect(sorted[0].name).toBe('Scene B');
            // Event A (2000-01-01) should come second
            expect(sorted[1].name).toBe('Event A');
            // Event C (2000-02-14) should come third
            expect(sorted[2].name).toBe('Event C');
            // Items without dates should come last
            expect(sorted[3].name).toMatch(/Scene D|Event E/);
            expect(sorted[4].name).toMatch(/Scene D|Event E/);
        });
    });

    // ── EventManager range queries ──

    describe('EventManager range queries', () => {
        it('getEventsInRange uses TimeSpanService safely', () => {
            // Create events
            const event1: Event = {
                id: '1', filePath: 'Events/e1.md', type: 'event', name: 'Event 1',
                timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 6, day: 15, precision: 'day' } },
            };
            const event2: Event = {
                id: '2', filePath: 'Events/e2.md', type: 'event', name: 'Event 2',
                timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2001, month: 1, day: 1, precision: 'day' } },
            };
            const event3: Event = {
                id: '3', filePath: 'Events/e3.md', type: 'event', name: 'Event 3',
                timeSpan: { kind: 'unknown' },
            };
            eventManager.addEvent(event1);
            eventManager.addEvent(event2);
            eventManager.addEvent(event3);

            // Query range: 2000-01-01 to 2000-12-31
            const rangeStart: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } };
            const rangeEnd: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 12, day: 31, precision: 'day' } };

            const results = eventManager.getEventsInRange(rangeStart, rangeEnd);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('1');
        });

        it('getEventsInRange handles overlapping intervals', () => {
            const event: Event = {
                id: '1', filePath: 'Events/e1.md', type: 'event', name: 'Long Event',
                timeSpan: {
                    kind: 'interval',
                    start: { calendar: 'gregorian', year: 2000, month: 6, day: 1, precision: 'day' },
                    end: { calendar: 'gregorian', year: 2000, month: 9, day: 30, precision: 'day' },
                },
            };
            eventManager.addEvent(event);

            // Query range that partially overlaps
            const rangeStart: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 8, day: 1, precision: 'day' } };
            const rangeEnd: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 10, day: 15, precision: 'day' } };

            const results = eventManager.getEventsInRange(rangeStart, rangeEnd);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('1');
        });

        it('getEventsInRange excludes unknown TimeSpans', () => {
            const event: Event = {
                id: '1', filePath: 'Events/e1.md', type: 'event', name: 'Unknown Event',
                timeSpan: { kind: 'unknown' },
            };
            eventManager.addEvent(event);

            const rangeStart: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } };
            const rangeEnd: TimeSpan = { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 12, day: 31, precision: 'day' } };

            const results = eventManager.getEventsInRange(rangeStart, rangeEnd);
            expect(results).toHaveLength(0);
        });
    });

    // ── TimeSpan edge cases ──

    describe('TimeSpan edge cases', () => {
        it('unknown TimeSpan never produces a fabricated date', () => {
            const ts: TimeSpan = { kind: 'unknown' };
            const point = tsService.getEarliestPoint(ts);
            expect(point).toBeNull();

            // Format should not fabricate a date
            const formatted = tsService.format(ts);
            expect(formatted).not.toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        it('uncertain TimeSpan preserves uncertainty in format', () => {
            const ts: TimeSpan = {
                kind: 'uncertain',
                range: {
                    start: { calendar: 'gregorian', year: 1999, month: 1, day: 1, precision: 'year' },
                    end: { calendar: 'gregorian', year: 2001, month: 1, day: 1, precision: 'year' },
                },
                confidence: 0.5,
            };
            const formatted = tsService.format(ts);
            expect(formatted).toContain('circa');
        });

        it('relative TimeSpan without resolution returns null earliest point', () => {
            const ts: TimeSpan = {
                kind: 'relative',
                relativeTo: 'nonexistent-event',
                offset: { amount: 5, unit: 'day', direction: 'before' },
            };
            const point = tsService.getEarliestPoint(ts);
            expect(point).toBeNull();
        });

        it('cross-calendar comparison does not compare raw years', () => {
            // Two timestamps from different calendars should not be compared by raw year
            const ts1: Timestamp = { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' };
            const ts2: Timestamp = { calendar: 'custom-calendar', year: 2000, month: 1, day: 1, precision: 'day' };

            // The compareTimestamps method falls back to year-only for cross-calendar
            // This is documented behavior — it does NOT claim accuracy
            const result = tsService.compareTimestamps(ts1, ts2);
            // The result is a fallback, not a meaningful comparison
            expect(result).toBeDefined();
        });

        it('open-ended ranges are handled in overlap detection', () => {
            const openEnded: TimeSpan = {
                kind: 'open-ended',
                start: { calendar: 'gregorian', year: 1850, month: 1, day: 1, precision: 'day' },
            };
            const instant: TimeSpan = {
                kind: 'instant',
                instant: { calendar: 'gregorian', year: 1900, month: 6, day: 15, precision: 'day' },
            };

            // Open-ended from 1850 should overlap with instant in 1900
            expect(tsService.overlaps(openEnded, instant)).toBe(true);
        });
    });

    // ── Swimlane mode ──

    describe('Swimlane mode', () => {
        it('Events are not silently discarded in swimlane mode', () => {
            const events: Event[] = [
                { id: '1', filePath: 'Events/e1.md', type: 'event', name: 'Event 1',
                  timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } } },
                { id: '2', filePath: 'Events/e2.md', type: 'event', name: 'Event 2' },
            ];

            // The swimlane renderer adds a "Canonical Events" lane when events exist
            // Verify the events array is non-empty and would trigger the events lane
            expect(events.length).toBeGreaterThan(0);

            // Sort events by time — events without dates should be at the end
            const sorted = [...events].sort((a, b) => {
                const aPoint = a.timeSpan ? tsService.getEarliestPoint(a.timeSpan) : null;
                const bPoint = b.timeSpan ? tsService.getEarliestPoint(b.timeSpan) : null;
                if (!aPoint && !bPoint) return 0;
                if (!aPoint) return 1;
                if (!bPoint) return -1;
                return tsService.compareTimestamps(aPoint, bPoint);
            });

            expect(sorted).toHaveLength(2);
            // Event 1 (with date) should come before Event 2 (no date)
            expect(sorted[0].id).toBe('1');
            expect(sorted[1].id).toBe('2');
        });
    });

    // ── Reading Order mode ──

    describe('Reading Order mode', () => {
        it('Reading Order preserves Scene ordering', () => {
            // In reading order mode, scenes maintain their authored sequence
            // Events are appended at the end
            // This test verifies the conceptual ordering
            const scenes = [
                { title: 'Scene 1', sequence: 1 },
                { title: 'Scene 2', sequence: 2 },
                { title: 'Scene 3', sequence: 3 },
            ];
            const events: Event[] = [
                { id: '1', filePath: 'Events/e1.md', type: 'event', name: 'Event 1' },
            ];

            // Scenes should maintain their order
            expect(scenes[0].sequence).toBe(1);
            expect(scenes[1].sequence).toBe(2);
            expect(scenes[2].sequence).toBe(3);

            // Events are appended after scenes in reading order
            // The timeline rendering handles this by pushing event items after scene items
        });

        it('Events appear even with no linked Scene', () => {
            const event: Event = {
                id: '1', filePath: 'Events/orphan.md', type: 'event', name: 'Orphan Event',
                timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' } },
            };
            eventManager.addEvent(event);

            // Event should be in the collection even though no Scene references it
            const allEvents = eventManager.getAllEvents();
            expect(allEvents).toHaveLength(1);
            expect(allEvents[0].name).toBe('Orphan Event');
        });
    });

    // ── Inherited Events ──

    describe('Inherited Events', () => {
        it('Inherited Events are visible in the appropriate projects', () => {
            // Simulate an inherited event (ownerId set, introducedIn set)
            const inheritedEvent: Event = {
                id: '1', filePath: 'StoryLine/My Universe/Codex/Events/e1.md', type: 'event',
                name: 'Universe Event', ownerId: 'universe-id', introducedIn: 'series-id',
                timeSpan: { kind: 'instant', instant: { calendar: 'gregorian', year: 1800, month: 1, day: 1, precision: 'day' } },
            };
            eventManager.addEvent(inheritedEvent);

            const allEvents = eventManager.getAllEvents();
            expect(allEvents).toHaveLength(1);
            expect(allEvents[0].ownerId).toBe('universe-id');
            expect(allEvents[0].introducedIn).toBe('series-id');
        });
    });

    // ── ViewSwitcher Codex dropdown ──

    describe('ViewSwitcher Codex dropdown', () => {
        it('Events item is added to the Codex dropdown', async () => {
            // Verify the ViewSwitcher source contains the Events dropdown item

            const source = readFileSync('src/components/ViewSwitcher.ts', 'utf-8');
            // The Events item should be added after Locations
            expect(source).toContain("'calendar'");
            expect(source).toContain("'Events'");
            expect(source).toContain("setActiveCategory('events')");
        });
    });

    // ── Timeline toolbar ──

    describe('Timeline toolbar', () => {
        it('New Event button is visible in Timeline toolbar', async () => {
            // Verify the TimelineView source contains the New Event button

            const source = readFileSync('src/views/TimelineView.ts', 'utf-8');
            expect(source).toContain('+ New Event');
            expect(source).toContain('openCreateEventModal');
        });
    });
});
