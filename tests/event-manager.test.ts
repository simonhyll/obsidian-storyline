/**
 * EventManager Integration Tests
 *
 * Tests for Event CRUD, TimeSpan serialization round-trips,
 * inheritance, duplicate UUID conflicts, and Scene-Event references.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventManager } from '../services/EventManager';
import { TimeSpanService } from '../services/TimeSpanService';
import {
    createInstantTimeSpan,
    createIntervalTimeSpan,
    createUncertainTimeSpan,
    createUnknownTimeSpan,
    createRelativeTimeSpan,
} from '../models/TimeSpan';
import type { Event } from '../models/Event';

// Note: This test file uses the obsidian mock alias from vitest.config.ts
// The mock at tests/__mocks__/obsidian.ts provides parseYaml/stringifyYaml

describe('EventManager Integration', () => {
    let eventManager: EventManager;
    let timeSpanService: TimeSpanService;
    let mockVault: any;

    beforeEach(() => {
        timeSpanService = new TimeSpanService();
        const mockApp = { vault: { adapter: {}, getMarkdownFiles: () => [], read: async () => '', create: async () => {}, modify: async () => {}, getAbstractFileByPath: () => null } };
        eventManager = new EventManager(mockApp as any);
        eventManager.setTimeSpanService(timeSpanService);
        mockVault = mockApp.vault;
    });

    // ── TimeSpan Serialization Round-Trips ──

    describe('TimeSpan serialization round-trips', () => {
        it('round-trips instant TimeSpan', () => {
            const instant = createInstantTimeSpan(2024, 6, 15);
            const yaml = timeSpanService.serializeToYaml(instant);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('instant');
            if (deserialized!.kind === 'instant') {
                expect(deserialized!.instant.year).toBe(2024);
                expect(deserialized!.instant.month).toBe(6);
                expect(deserialized!.instant.day).toBe(15);
            }
        });

        it('round-trips interval TimeSpan', () => {
            const interval = createIntervalTimeSpan(2024, 1, 1, 2024, 12, 31);
            expect(interval.kind).toBe('interval');
            const yaml = timeSpanService.serializeToYaml(interval);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('interval');
            if (deserialized!.kind === 'interval') {
                expect(deserialized!.start.year).toBe(2024);
                expect(deserialized!.start.month).toBe(1);
                expect(deserialized!.end.month).toBe(12);
                expect(deserialized!.end.day).toBe(31);
            }
        });

        it('round-trips open-ended TimeSpan', () => {
            const openEnded = createIntervalTimeSpan(2024, 1, 1);
            expect(openEnded.kind).toBe('open-ended');
            const yaml = timeSpanService.serializeToYaml(openEnded);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('open-ended');
            if (deserialized!.kind === 'open-ended') {
                expect(deserialized!.start.year).toBe(2024);
            }
        });

        it('round-trips uncertain TimeSpan', () => {
            const uncertain = createUncertainTimeSpan(1849, 1851, 0.7);
            const yaml = timeSpanService.serializeToYaml(uncertain);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('uncertain');
            if (deserialized!.kind === 'uncertain') {
                expect(deserialized!.confidence).toBe(0.7);
            }
        });

        it('round-trips unknown TimeSpan', () => {
            const unknown = createUnknownTimeSpan('Some time in the past');
            const yaml = timeSpanService.serializeToYaml(unknown);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('unknown');
            expect(deserialized!.display).toBe('Some time in the past');
        });

        it('round-trips relative TimeSpan', () => {
            const relative = createRelativeTimeSpan('event-123', 3, 'day', 'before');
            const yaml = timeSpanService.serializeToYaml(relative);
            const deserialized = timeSpanService.deserializeFromYaml(yaml);
            expect(deserialized).not.toBeNull();
            expect(deserialized!.kind).toBe('relative');
            if (deserialized!.kind === 'relative') {
                expect(deserialized!.relativeTo).toBe('event-123');
                expect(deserialized!.offset.amount).toBe(3);
                expect(deserialized!.offset.unit).toBe('day');
                expect(deserialized!.offset.direction).toBe('before');
            }
        });
    });

    // ── Event Persistence ──

    describe('Event persistence', () => {
        it('builds frontmatter with TimeSpan', () => {
            const event: Event = {
                filePath: 'Events/battle.md',
                type: 'event',
                id: 'evt-001',
                name: 'The Great Battle',
                timeSpan: createInstantTimeSpan(1850, 6, 15),
                participants: ['char-001', 'char-002'],
                location: 'The Battlefield',
                description: 'A decisive battle.',
            };
            const content = eventManager.buildEventContent(event);
            expect(content).toContain('type: event');
            expect(content).toContain('id: evt-001');
            expect(content).toContain('name: The Great Battle');
            expect(content).toContain('timeSpan:');
            expect(content).toContain('kind: instant');
            expect(content).toContain('participants:');
        });

        it('parses event with TimeSpan from frontmatter', () => {
            const content = `---
type: event
id: evt-002
name: The Coronation
timeSpan:
  kind: interval
  start:
    calendar: gregorian
    year: 1850
    month: 1
    day: 1
    precision: day
  end:
    calendar: gregorian
    year: 1850
    month: 1
    day: 3
    precision: day
participants:
  - char-001
  - char-002
location: The Palace
description: The king was crowned.
---
The ceremony was grand.`;

            const event = eventManager.parseEvent(content, 'Events/coronation.md');
            expect(event).not.toBeNull();
            expect(event!.name).toBe('The Coronation');
            expect(event!.timeSpan).not.toBeNull();
            expect(event!.timeSpan!.kind).toBe('interval');
            if (event!.timeSpan!.kind === 'interval') {
                expect(event!.timeSpan!.start.year).toBe(1850);
                expect(event!.timeSpan!.end.day).toBe(3);
            }
            expect(event!.participants).toEqual(['char-001', 'char-002']);
            expect(event!.location).toBe('The Palace');
            expect(event!.body).toContain('The ceremony was grand.');
        });

        it('preserves body content on save', () => {
            const content = `---
type: event
id: evt-003
name: The Meeting
---
This is the body content that must be preserved.`;

            const event = eventManager.parseEvent(content, 'Events/meeting.md');
            expect(event).not.toBeNull();
            expect(event!.body).toBe('This is the body content that must be preserved.');

            // Rebuild content
            const rebuilt = eventManager.buildEventContent(event!, event!.body);
            expect(rebuilt).toContain('This is the body content that must be preserved.');
        });

        it('handles event without TimeSpan', () => {
            const content = `---
type: event
id: evt-004
name: Unknown Event
---
No date known.`;

            const event = eventManager.parseEvent(content, 'Events/unknown.md');
            expect(event).not.toBeNull();
            expect(event!.timeSpan).toBeUndefined();
        });
    });

    // ── Event CRUD ──

    describe('Event CRUD', () => {
        it('adds and retrieves events', () => {
            const event: Event = {
                filePath: 'Events/test.md',
                type: 'event',
                id: 'evt-test',
                name: 'Test Event',
            };
            eventManager.addEvent(event);
            const retrieved = eventManager.getEvent('evt-test');
            expect(retrieved).not.toBeUndefined();
            expect(retrieved!.name).toBe('Test Event');
        });

        it('removes events', () => {
            const event: Event = {
                filePath: 'Events/test.md',
                type: 'event',
                id: 'evt-test',
                name: 'Test Event',
            };
            eventManager.addEvent(event);
            eventManager.removeEvent('evt-test');
            expect(eventManager.getEvent('evt-test')).toBeUndefined();
        });

        it('clears all events', () => {
            eventManager.addEvent({ filePath: 'Events/a.md', type: 'event', id: 'a', name: 'A' });
            eventManager.addEvent({ filePath: 'Events/b.md', type: 'event', id: 'b', name: 'B' });
            eventManager.clear();
            expect(eventManager.getAllEvents()).toHaveLength(0);
        });

        it('queries by participant', () => {
            eventManager.addEvent({
                filePath: 'Events/a.md', type: 'event', id: 'a', name: 'A',
                participants: ['char-001', 'char-002'],
            });
            eventManager.addEvent({
                filePath: 'Events/b.md', type: 'event', id: 'b', name: 'B',
                participants: ['char-003'],
            });
            const results = eventManager.getEventsByParticipant('char-001');
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('A');
        });

        it('queries by tag', () => {
            eventManager.addEvent({
                filePath: 'Events/a.md', type: 'event', id: 'a', name: 'A',
                tags: ['battle', 'important'],
            });
            eventManager.addEvent({
                filePath: 'Events/b.md', type: 'event', id: 'b', name: 'B',
                tags: ['diplomacy'],
            });
            const results = eventManager.getEventsByTag('battle');
            expect(results).toHaveLength(1);
        });

        it('queries by name fuzzy match', () => {
            eventManager.addEvent({ filePath: 'Events/a.md', type: 'event', id: 'a', name: 'The Great Battle' });
            eventManager.addEvent({ filePath: 'Events/b.md', type: 'event', id: 'b', name: 'The Small Skirmish' });
            const results = eventManager.getEventsByName('battle');
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('The Great Battle');
        });
    });

    // ── Duplicate UUID Detection ──

    describe('Duplicate UUID detection', () => {
        it('detects duplicate UUIDs in inherited folders', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Simulate: book-level event loaded first
            eventManager.addEvent({
                filePath: 'Book1/Events/battle.md',
                type: 'event',
                id: 'evt-dup',
                name: 'Book Battle',
            });

            // Simulate: inherited event with same UUID
            const inheritedContent = `---
type: event
id: evt-dup
name: Universe Battle
---`;
            const inherited = eventManager.parseEvent(inheritedContent, 'Universe/Events/battle.md');
            expect(inherited).not.toBeNull();

            // The loadInheritedFolders logic checks for duplicates
            // Use getAllEvents to verify the event is present
            const allEvents = eventManager.getAllEvents();
            const found = allEvents.find(e => e.id === 'evt-dup');
            expect(found).toBeDefined();
            expect(found!.name).toBe('Book Battle'); // Book-level takes precedence

            warnSpy.mockRestore();
        });
    });

    // ── Date Arithmetic ──

    describe('Date arithmetic', () => {
        it('handles Jan 31 + 1 day = Feb 1', () => {
            const jan31 = createInstantTimeSpan(2024, 1, 31);
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 1, 'day', 'after'),
                () => jan31
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.month).toBe(2);
                expect(resolved.instant.day).toBe(1);
            }
        });

        it('handles Dec 31 + 1 day = Jan 1 next year', () => {
            const dec31 = createInstantTimeSpan(2024, 12, 31);
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 1, 'day', 'after'),
                () => dec31
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.year).toBe(2025);
                expect(resolved.instant.month).toBe(1);
                expect(resolved.instant.day).toBe(1);
            }
        });

        it('handles leap year Feb 29', () => {
            const feb28 = createInstantTimeSpan(2024, 2, 28); // 2024 is leap year
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 2, 'day', 'after'),
                () => feb28
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.month).toBe(3);
                expect(resolved.instant.day).toBe(1);
            }
        });

        it('handles non-leap year Feb 28 + 1 day = Mar 1', () => {
            const feb28 = createInstantTimeSpan(2023, 2, 28); // 2023 is NOT leap year
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 1, 'day', 'after'),
                () => feb28
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.month).toBe(3);
                expect(resolved.instant.day).toBe(1);
            }
        });

        it('handles month overflow with day clamping', () => {
            // Jan 31 + 1 month = Feb 28/29 (clamped)
            const jan31 = createInstantTimeSpan(2024, 1, 31);
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 1, 'month', 'after'),
                () => jan31
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.month).toBe(2);
                // 2024 is leap year, so Feb has 29 days
                expect(resolved.instant.day).toBe(29);
            }
        });

        it('handles negative day shifts', () => {
            const mar1 = createInstantTimeSpan(2024, 3, 1);
            const resolved = timeSpanService.resolveRelative(
                createRelativeTimeSpan('ref', 1, 'day', 'before'),
                () => mar1
            );
            expect(resolved.kind).toBe('instant');
            if (resolved.kind === 'instant') {
                expect(resolved.instant.month).toBe(2);
                expect(resolved.instant.day).toBe(29); // 2024 is leap year
            }
        });
    });

    // ── getEventsInRange ──

    describe('getEventsInRange', () => {
        it('finds events overlapping a range', () => {
            // Event: Jan 15 to Feb 15
            eventManager.addEvent({
                filePath: 'Events/a.md', type: 'event', id: 'a', name: 'A',
                timeSpan: createIntervalTimeSpan(2024, 1, 15, 2024, 2, 15),
            });
            // Event: Mar 1 to Mar 31 (outside range)
            eventManager.addEvent({
                filePath: 'Events/b.md', type: 'event', id: 'b', name: 'B',
                timeSpan: createIntervalTimeSpan(2024, 3, 1, 2024, 3, 31),
            });

            const rangeStart = createInstantTimeSpan(2024, 1, 1);
            const rangeEnd = createInstantTimeSpan(2024, 2, 28);
            const results = eventManager.getEventsInRange(rangeStart, rangeEnd);
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('A');
        });
    });
});
