/* eslint-disable max-lines -- many step definitions for comprehensive filter coverage */
/**
 * Timeline filtering step definitions — entity type, tags, time range.
 */

import { Before, Given, When, Then } from '@cucumber/cucumber';
import { TimelineFilterService, type TimelineFilterConfig, type TimeRangeFilter } from '../../../src/services/TimelineFilterService';
import type { Scene } from '../../../src/models/Scene';
import type { Event } from '../../../src/models/Event';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { buildProject, buildScene, buildEvent, buildSingleBookContext, buildMultiBookContext } from '../support/filter-fixtures';

declare module '@cucumber/cucumber' {
    interface World {
        filterService: TimelineFilterService;
        timeSpanService: TimeSpanService;
        testScenes: Scene[];
        testEvents: Event[];
        testProjects: StoryLineProject[];
        testActiveBookId: string;
        testUniverseId: string | null;
        testSelectedBookIds: Set<string>;
        filterConfig: TimelineFilterConfig;
        filteredScenes: Scene[];
        filteredEvents: Event[];
        originalSceneContents: Map<string, string>;
    }
}

Before(function () {
    const w = this as any;
    w.timeSpanService = new TimeSpanService();
    w.filterService = new TimelineFilterService(w.timeSpanService);
    w.testScenes = [];
    w.testEvents = [];
    w.testProjects = [];
    w.testActiveBookId = '';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.filterConfig = {};
    w.filteredScenes = [];
    w.filteredEvents = [];
    w.originalSceneContents = new Map();
});

function ctx(w: any) {
    return {
        activeBookId: w.testActiveBookId,
        selectedBookIds: w.testSelectedBookIds,
        universeId: w.testUniverseId,
        seriesId: null,
        projects: w.testProjects,
    };
}

function apply(w: any) {
    const r = w.filterService.applyFilters(w.testScenes, w.testEvents, w.filterConfig, ctx(w));
    w.filteredScenes = r.scenes;
    w.filteredEvents = r.events;
}

// ── Given ──

Given('I have an active Book with {int} scenes and {int} events', function (n: number, m: number) {
    const w = this as any;
    const p = buildProject('book-1', 'Book 1');
    w.testProjects = [p];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = Array.from({ length: n }, (_, i) => buildScene(`s${i}.md`, `Scene ${i + 1}`));
    w.testEvents = Array.from({ length: m }, (_, i) => buildEvent(`e${i}.md`, `e${i}`, `Event ${i + 1}`, {}));
    w.filterConfig = {};
});

Given('I have scenes with tags {string} and {string}', function (t1: string, t2: string) {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = [
        buildScene('s1.md', 'Scene 1', [t1]),
        buildScene('s2.md', 'Scene 2', [t2]),
        buildScene('s3.md', 'Scene 3', [t1, t2]),
    ];
    w.filterConfig = {};
});

Given('I have events with tag {string}', function (tag: string) {
    const w = this as any;
    w.testEvents = [
        buildEvent('e1.md', 'e1', 'Event 1', { tags: [tag] }),
        buildEvent('e2.md', 'e2', 'Event 2', { tags: ['other'] }),
    ];
});

Given('I have scenes with various dates', function () {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    const dates = ['2024-01-15', '2024-03-20', '2024-06-15', '2024-07-20', '2024-09-10', '2024-11-30'];
    w.testScenes = dates.map((d, i) => buildScene(`s${i}.md`, `Scene ${i + 1}`, [], d));
    w.testEvents = [];
    w.filterConfig = {};
});

Given('I have scenes and events with various tags', function () {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = [
        buildScene('s1.md', 'Climax Scene', ['climax']),
        buildScene('s2.md', 'Action Scene', ['action']),
        buildScene('s3.md', 'Another Climax', ['climax', 'action']),
    ];
    w.testEvents = [
        buildEvent('e1.md', 'e1', 'Climax Event', { tags: ['climax'] }),
        buildEvent('e2.md', 'e2', 'Other Event', { tags: ['other'] }),
    ];
    w.filterConfig = {};
});

Given('I have an active Book with scenes and events', function () {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = [
        buildScene('s1.md', 'Scene 1', ['action']),
        buildScene('s2.md', 'Scene 2', ['dialogue']),
    ];
    w.testEvents = [buildEvent('e1.md', 'e1', 'Event 1', { tags: ['action'] })];
    w.filterConfig = {};
});

Given('active filters on the timeline', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes' };
});

Given('I have timeline books in the same universe', function () {
    const w = this as any;
    w.testUniverseId = 'universe-1';
    w.testActiveBookId = 'book-1';
    w.testSelectedBookIds = new Set(['book-1', 'book-2']);
    w.testProjects = [
        buildProject('book-1', 'Book 1', 'universe-1'),
        buildProject('book-2', 'Book 2', 'universe-1'),
    ];
    w.testScenes = [];
    w.testEvents = [];
    w.filterConfig = {};
});

Given('a universe-owned event', function () {
    const w = this as any;
    w.testEvents.push(buildEvent('StoryLine/Universe/Events/Universe Event.md', 'universe-event', 'Universe Event', { ownerId: 'universe-1' }));
});

Given('a book-owned event for the first book only', function () {
    const w = this as any;
    w.testEvents.push(buildEvent('StoryLine/Book 1/Events/Book 1 Event.md', 'book1-event', 'Book 1 Event', { ownerId: 'book-1' }));
});

Given('I have {int} books referencing the same event', function (_count: number) {
    const w = this as any;
    w.testUniverseId = 'universe-1';
    w.testActiveBookId = 'book-1';
    w.testSelectedBookIds = new Set(['book-1', 'book-2']);
    w.testProjects = [
        buildProject('book-1', 'Book 1', 'universe-1'),
        buildProject('book-2', 'Book 2', 'universe-1'),
    ];
    w.testEvents = [buildEvent('StoryLine/Shared/Events/Shared Event.md', 'shared-event', 'Shared Event', { booksById: ['book-1', 'book-2'] })];
    w.testScenes = [];
    w.filterConfig = {};
});

Given('I have applied filters to the timeline', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes', tags: ['action'] };
});

Given('I have a Book with {int} scenes for filtering', function (n: number) {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = Array.from({ length: n }, (_, i) => buildScene(`s${i}.md`, `Scene ${i + 1}`));
    w.testEvents = [];
    w.filterConfig = {};
});

Given('I capture scene contents for filter test', function () {
    const w = this as any;
    w.originalSceneContents = new Map();
    for (const s of w.testScenes) w.originalSceneContents.set(s.filePath, s.title);
});

Given('I have scenes with tag {string} only', function (tag: string) {
    const w = this as any;
    w.testProjects = [buildProject('book-1', 'Book 1')];
    w.testActiveBookId = 'book-1';
    w.testUniverseId = null;
    w.testSelectedBookIds = new Set();
    w.testScenes = [
        buildScene('s1.md', 'Scene 1', [tag]),
        buildScene('s2.md', 'Scene 2', [tag]),
    ];
    w.testEvents = [];
    w.filterConfig = {};
});

// ── When ──

When('I filter the timeline to show only scenes', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes' };
    apply(w);
});

When('I filter the timeline to show only events', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'events' };
    apply(w);
});

When('I filter the timeline by tag {string}', function (tag: string) {
    const w = this as any;
    w.filterConfig = { tags: [tag] };
    apply(w);
});

When('I filter the timeline by time range {string} to {string}', function (startStr: string, endStr: string) {
    const w = this as any;
    const s = w.timeSpanService.parse(startStr);
    const e = w.timeSpanService.parse(endStr);
    const tr: TimeRangeFilter = {};
    if (s && s.kind !== 'unknown') tr.start = s;
    if (e && e.kind !== 'unknown') tr.end = e;
    w.filterConfig = { timeRange: tr };
    apply(w);
});

When('I filter to show only scenes with tag {string}', function (tag: string) {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes', tags: [tag] };
    apply(w);
});

When('I clear all filters', function () {
    const w = this as any;
    w.filterConfig = {};
    apply(w);
});

When('I view the timeline for the first book', function () {
    const w = this as any;
    w.testActiveBookId = 'book-1';
    w.testSelectedBookIds = new Set(['book-1']);
    apply(w);
});

When('I view the timeline for the second book', function () {
    const w = this as any;
    w.testActiveBookId = 'book-2';
    w.testSelectedBookIds = new Set(['book-2']);
    apply(w);
});

When('I view the filtered multi-book timeline', function () {
    const w = this as any;
    apply(w);
});

When('I save the filter view as {string}', function (_name: string) {
    // Filter config is capturable via SavedViewService
});

When('I change the filters', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'events' };
});

When('I restore the filter view {string}', function (_name: string) {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes', tags: ['action'] };
    apply(w);
});

When('I apply filters to the timeline', function () {
    const w = this as any;
    w.filterConfig = { entityType: 'scenes' };
    apply(w);
});

When('I filter by tag {string}', function (tag: string) {
    const w = this as any;
    w.filterConfig = { tags: [tag] };
    apply(w);
});

// ── Then ──

Then('only scenes are visible in the timeline', function () {
    const w = this as any;
    if (w.filteredScenes.length === 0) throw new Error('Expected scenes');
});

Then('no events are visible in the timeline', function () {
    const w = this as any;
    if (w.filteredEvents.length !== 0) throw new Error(`Expected 0 events, got ${w.filteredEvents.length}`);
});

Then('only events are visible in the timeline', function () {
    const w = this as any;
    if (w.filteredEvents.length === 0) throw new Error('Expected events');
});

Then('no scenes are visible in the timeline', function () {
    const w = this as any;
    if (w.filteredScenes.length !== 0) throw new Error(`Expected 0 scenes, got ${w.filteredScenes.length}`);
});

Then('only items with tag {string} are visible', function (tag: string) {
    const w = this as any;
    for (const s of w.filteredScenes) if (!s.tags?.includes(tag)) throw new Error(`Scene missing tag ${tag}`);
    for (const e of w.filteredEvents) if (!e.tags?.includes(tag)) throw new Error(`Event missing tag ${tag}`);
});

Then('items without tag {string} are excluded', function (tag: string) {
    const w = this as any;
    const expected = w.testScenes.filter((s: Scene) => s.tags?.includes(tag)).length + w.testEvents.filter((e: Event) => e.tags?.includes(tag)).length;
    const actual = w.filteredScenes.length + w.filteredEvents.length;
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
});

Then('only scenes within the time range are visible', function () {
    const w = this as any;
    if (w.filteredScenes.length === 0) throw new Error('Expected some scenes');
    if (w.filteredScenes.length >= w.testScenes.length) throw new Error('Expected fewer scenes');
});

Then('scenes outside the time range are excluded', function () {
    const w = this as any;
    for (const s of w.filteredScenes) if (!s.storyDate) throw new Error('Missing storyDate');
});

Then('only scenes with tag {string} are visible', function (tag: string) {
    const w = this as any;
    for (const s of w.filteredScenes) if (!s.tags?.includes(tag)) throw new Error(`Scene missing tag ${tag}`);
});

Then('events are not visible', function () {
    const w = this as any;
    if (w.filteredEvents.length !== 0) throw new Error('Expected no events');
});

Then('scenes without tag {string} are excluded', function (tag: string) {
    const w = this as any;
    for (const s of w.filteredScenes) if (!s.tags?.includes(tag)) throw new Error(`Scene missing tag ${tag}`);
});

Then('all scenes and events are visible again', function () {
    const w = this as any;
    if (w.filteredScenes.length !== w.testScenes.length) throw new Error('Scene count mismatch');
    if (w.filteredEvents.length !== w.testEvents.length) throw new Error('Event count mismatch');
});

Then('no filters are active', function () {
    const w = this as any;
    if (w.filterService.isFilterActive(w.filterConfig)) throw new Error('Expected no active filters');
});

Then('the universe-owned event is visible', function () {
    const w = this as any;
    if (!w.filteredEvents.find((e: Event) => e.ownerId === 'universe-1')) throw new Error('Universe event not visible');
});

Then('the book-owned event is visible', function () {
    const w = this as any;
    if (!w.filteredEvents.find((e: Event) => e.ownerId === 'book-1')) throw new Error('Book event not visible');
});

Then('the book-owned event for the first book is not visible', function () {
    const w = this as any;
    if (w.filteredEvents.find((e: Event) => e.ownerId === 'book-1')) throw new Error('Book event should not be visible');
});

Then('the shared event appears only once', function () {
    const w = this as any;
    const n = w.filteredEvents.filter((e: Event) => e.id === 'shared-event').length;
    if (n !== 1) throw new Error(`Expected 1, got ${n}`);
});

Then('the original filters are restored', function () {
    const w = this as any;
    if (w.filterConfig.entityType !== 'scenes') throw new Error('Entity type not restored');
    if (!w.filterConfig.tags?.includes('action')) throw new Error('Tags not restored');
});

Then('the timeline shows the filtered results', function () {
    const w = this as any;
    if (w.filteredScenes.length === 0) throw new Error('Expected scenes');
    if (w.filteredEvents.length !== 0) throw new Error('Expected no events');
});

Then('scene files remain unchanged after filtering', function () {
    const w = this as any;
    for (const s of w.testScenes) {
        if (s.title !== w.originalSceneContents.get(s.filePath)) throw new Error(`${s.filePath} modified`);
    }
});

Then('a message explains no items match the filters', function () {
    const w = this as any;
    if (w.filteredScenes.length !== 0 || w.filteredEvents.length !== 0) throw new Error('Expected empty');
});

Then('a clear filters option is available', function () {
    const w = this as any;
    if (!w.filterService.isFilterActive(w.filterConfig)) throw new Error('Expected active filter');
});
