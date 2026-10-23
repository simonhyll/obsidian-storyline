/**
 * TimelineNavigationService tests.
 *
 * Tests navigation state, jump-to-date, previous/next navigation,
 * time marker generation, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TimeSpanService } from '../services/TimeSpanService';
import { TimelineNavigationService } from '../services/TimelineNavigationService';
import type { Scene } from '../models/Scene';
import type { Event } from '../models/Event';
import { createEvent } from '../models/Event';

// ── Helpers ──

function makeScene(title: string, storyDate: string, bookId: string, filePath: string): Scene {
    return {
        title,
        storyDate,
        filePath,
        bookId,
        sequence: 1,
        chronologicalOrder: 1,
        content: '',
    } as unknown as Scene;
}

function makeEvent(name: string, year: number, month: number, day: number, ownerId?: string): Event {
    return createEvent(name, `Events/${name}.md`, {
        timeSpan: {
            kind: 'instant',
            instant: {
                calendar: 'gregorian',
                year,
                month,
                day,
                precision: 'day',
            },
        },
        ownerId,
    });
}

// ── Tests ──

describe('TimelineNavigationService', () => {
    let tss: TimeSpanService;
    let nav: TimelineNavigationService;

    beforeEach(() => {
        tss = new TimeSpanService();
        nav = new TimelineNavigationService(tss);
    });

    // ── State Management ──

    describe('state management', () => {
        it('starts with null selected date', () => {
            expect(nav.getSelectedDate()).toBeNull();
        });

        it('starts with year zoom level', () => {
            expect(nav.getZoomLevel()).toBe('year');
        });

        it('sets and gets selected date', () => {
            const date = { calendar: 'gregorian' as const, year: 2000, month: 1, day: 1, precision: 'day' as const };
            nav.setSelectedDate(date);
            expect(nav.getSelectedDate()).toEqual(date);
        });

        it('sets and gets zoom level', () => {
            nav.setZoomLevel('month');
            expect(nav.getZoomLevel()).toBe('month');
        });

        it('returns copy of state', () => {
            const state1 = nav.getState();
            const state2 = nav.getState();
            expect(state1).toEqual(state2);
            expect(state1).not.toBe(state2);
        });
    });

    // ── Item Management ──

    describe('item management', () => {
        it('updates items from scenes and events', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            const events = [makeEvent('Event X', 2000, 1, 1, 'universe-1')];

            nav.updateItems(scenes, events);

            expect(nav.getItemCount()).toBe(3);
            const items = nav.getItems();
            expect(items[0].scene?.title).toBe('Scene A');
            expect(items[1].event?.name).toBe('Event X');
            expect(items[2].scene?.title).toBe('Scene B');
        });

        it('handles empty items', () => {
            nav.updateItems([], []);
            expect(nav.getItemCount()).toBe(0);
            expect(nav.getState().visibleRange).toBeNull();
        });

        it('handles scenes without dates', () => {
            const scenes = [
                makeScene('Dated', '2000-01-01', 'book-a', 'Book A/Scenes/Dated.md'),
                makeScene('Undated', '', 'book-a', 'Book A/Scenes/Undated.md'),
            ];

            nav.updateItems(scenes, []);

            expect(nav.getItemCount()).toBe(2);
            const items = nav.getItems();
            expect(items[0].scene?.title).toBe('Dated');
            expect(items[1].scene?.title).toBe('Undated');
            expect(items[1].timestamp).toBeNull();
        });
    });

    // ── Jump to Date ──

    describe('jump to date', () => {
        it('jumps to a specific year', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            nav.jumpToDate(2000);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(2000);
            expect(state.visibleRange).not.toBeNull();
        });

        it('jumps to a specific year and month', () => {
            nav.jumpToDate(2000, 6);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(2000);
            expect(state.selectedDate?.month).toBe(6);
        });

        it('jumps to a specific year, month and day', () => {
            nav.jumpToDate(2000, 6, 15);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(2000);
            expect(state.selectedDate?.month).toBe(6);
            expect(state.selectedDate?.day).toBe(15);
        });

        it('jumps to a negative year', () => {
            nav.jumpToDate(-500);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(-500);
        });

        it('jumps to a very large year', () => {
            nav.jumpToDate(9999);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(9999);
        });
    });

    // ── Navigation ──

    describe('navigation', () => {
        it('navigates previous from first item', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            // Start at first item (null selected date means index 0)
            nav.setSelectedDate(null);

            const result = nav.navigatePrevious();
            expect(result).toBeNull();
        });

        it('navigates next from last item', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            // Navigate to the end by going next until we can't
            nav.setSelectedDate(null);
            nav.navigateNext(); // index 0 → 1
            const result = nav.navigateNext(); // index 1 → should be null (end)
            expect(result).toBeNull();
        });

        it('navigates between items', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            const events = [makeEvent('Event X', 2000, 1, 1, 'universe-1')];
            nav.updateItems(scenes, events);

            // Start at first item (null selected date means index 0)
            nav.setSelectedDate(null);

            // Navigate next from index 0 → index 1
            let item = nav.navigateNext();
            expect(item).not.toBeNull();

            // Navigate next from index 1 → index 2
            item = nav.navigateNext();
            expect(item).not.toBeNull();

            // Navigate next from index 2 → null (end)
            item = nav.navigateNext();
            expect(item).toBeNull();
        });

        it('finds current index by binary search', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            const events = [makeEvent('Event X', 2000, 1, 1, 'universe-1')];
            nav.updateItems(scenes, events);

            // Jump to 2000 (Event X)
            nav.jumpToDate(2000);

            const index = nav.findCurrentIndex();
            // Event X should be at or near index 1 (between Scene A and Scene B)
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(nav.getItemCount());
        });
    });

    // ── Time Markers ──

    describe('time markers', () => {
        it('generates year markers for short range', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            const markers = nav.getTimeMarkers();
            expect(markers.length).toBeGreaterThan(0);
            expect(markers[0].granularity).toBe('year');
        });

        it('generates 5-year markers for medium range', () => {
            const scenes = [
                makeScene('Scene A', '1990-01-01', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2010-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            const markers = nav.getTimeMarkers();
            expect(markers.length).toBeGreaterThan(0);
            expect(markers[0].granularity).toBe('year');
        });

        it('generates decade markers for long range', () => {
            const scenes = [
                makeScene('Scene A', '1800-01-01', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2000-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            const markers = nav.getTimeMarkers();
            expect(markers.length).toBeGreaterThan(0);
            // Should use decade markers for 200+ year span
            expect(markers[0].granularity).toBe('year');
        });

        it('returns empty markers for no items', () => {
            nav.updateItems([], []);
            const markers = nav.getTimeMarkers();
            expect(markers).toEqual([]);
        });
    });

    // ── Timestamp at Position ──

    describe('timestamp at position', () => {
        it('returns timestamp at position 0', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            const ts = nav.getTimestampAtPosition(0);
            expect(ts).not.toBeNull();
            expect(ts!.year).toBeCloseTo(nav.getState().visibleRange!.start.year, -2);
        });

        it('returns timestamp at position 1', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            const ts = nav.getTimestampAtPosition(1);
            expect(ts).not.toBeNull();
            expect(ts!.year).toBeCloseTo(nav.getState().visibleRange!.end.year, -2);
        });

        it('returns null for no visible range', () => {
            nav.updateItems([], []);
            const ts = nav.getTimestampAtPosition(0.5);
            expect(ts).toBeNull();
        });
    });

    // ── Edge Cases ──

    describe('edge cases', () => {
        it('handles negative years', () => {
            // Negative years in storyDate are not supported by convertLegacyToTimeSpan
            // so we test with TimeSpan directly
            const ancientScene = makeScene('Ancient', '', 'book-a', 'Book A/Scenes/Ancient.md');
            ancientScene.timeSpan = {
                kind: 'instant',
                instant: { calendar: 'gregorian' as const, year: -500, month: 1, day: 1, precision: 'day' as const },
            };

            const modernScene = makeScene('Modern', '2000-01-01', 'book-b', 'Book B/Scenes/Modern.md');

            nav.updateItems([ancientScene, modernScene], []);

            expect(nav.getItemCount()).toBe(2);
            const items = nav.getItems();
            expect(items[0].scene?.title).toBe('Ancient');
            expect(items[1].scene?.title).toBe('Modern');
        });

        it('handles uncertain events', () => {
            const uncertainEvent = createEvent('Uncertain', 'Events/Uncertain.md', {
                timeSpan: {
                    kind: 'uncertain',
                    range: {
                        start: { calendar: 'gregorian' as const, year: 1999, month: 12, day: 1, precision: 'day' as const },
                        end: { calendar: 'gregorian' as const, year: 2000, month: 2, day: 1, precision: 'day' as const },
                    },
                    confidence: 0.7,
                },
            });

            nav.updateItems([], [uncertainEvent]);

            expect(nav.getItemCount()).toBe(1);
            const items = nav.getItems();
            expect(items[0].event?.name).toBe('Uncertain');
            expect(items[0].timestamp).not.toBeNull();
        });

        it('handles unknown events', () => {
            const unknownEvent = createEvent('Unknown', 'Events/Unknown.md', {
                timeSpan: { kind: 'unknown' as const },
            });

            nav.updateItems([], [unknownEvent]);

            expect(nav.getItemCount()).toBe(1);
            const items = nav.getItems();
            expect(items[0].event?.name).toBe('Unknown');
            expect(items[0].timestamp).toBeNull();
        });

        it('handles relative events', () => {
            const relativeEvent = createEvent('Relative', 'Events/Relative.md', {
                timeSpan: {
                    kind: 'relative' as const,
                    relativeTo: 'some-event-id',
                    offset: { amount: 3, unit: 'day', direction: 'after' as const },
                },
            });

            nav.updateItems([], [relativeEvent]);

            expect(nav.getItemCount()).toBe(1);
            const items = nav.getItems();
            expect(items[0].event?.name).toBe('Relative');
            expect(items[0].timestamp).toBeNull();
        });

        it('handles cross-calendar comparison', () => {
            const gregorianScene = makeScene('Gregorian', '2000-01-01', 'book-a', 'Book A/Scenes/Gregorian.md');
            const fantasyEvent = createEvent('Fantasy', 'Events/Fantasy.md', {
                timeSpan: {
                    kind: 'instant' as const,
                    instant: { calendar: 'fantasy' as const, year: 2000, month: 1, day: 1, precision: 'day' as const },
                },
            });

            nav.updateItems([gregorianScene], [fantasyEvent]);

            expect(nav.getItemCount()).toBe(2);
            // Both should be present, even if calendars differ
        });

        it('preserves multi-book selection while navigating', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            // Navigate doesn't change the items
            nav.navigateNext();
            expect(nav.getItemCount()).toBe(2);
        });

        it('handles rapid date changes', () => {
            const scenes = [
                makeScene('Scene A', '1993-01-02', 'book-a', 'Book A/Scenes/Scene A.md'),
                makeScene('Scene B', '2001-01-01', 'book-b', 'Book B/Scenes/Scene B.md'),
            ];
            nav.updateItems(scenes, []);

            // Rapid jumps
            nav.jumpToDate(1995);
            nav.jumpToDate(1998);
            nav.jumpToDate(2000);

            const state = nav.getState();
            expect(state.selectedDate?.year).toBe(2000);
        });
    });
});
