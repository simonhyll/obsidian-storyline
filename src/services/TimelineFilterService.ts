/* eslint-disable max-lines -- filtering service needs many methods for each filter dimension */
/**
 * TimelineFilterService — unified filtering for Timeline scenes and events.
 */

import type { Scene } from '../models/Scene';
import type { Event } from '../models/Event';
import type { TimeSpan, Timestamp } from '../models/TimeSpan';
import type { TimeSpanService } from './TimeSpanService';
import type { StoryLineProject } from '../models/StoryLineProject';

export type EntityTypeFilter = 'scenes' | 'events' | 'both';

export interface TimeRangeFilter {
    start?: TimeSpan;
    end?: TimeSpan;
}

export interface TimelineFilterConfig {
    entityType?: EntityTypeFilter;
    tags?: string[];
    timeRange?: TimeRangeFilter;
}

export interface TimelineFilterResult {
    scenes: Scene[];
    events: Event[];
}

export interface TimelineContext {
    activeBookId: string;
    selectedBookIds: Set<string>;
    universeId?: string | null;
    seriesId?: string | null;
    projects: StoryLineProject[];
}

export class TimelineFilterService {

    constructor(private timeSpanService: TimeSpanService) {}

    applyFilters(
        scenes: Scene[],
        events: Event[],
        config: TimelineFilterConfig,
        context: TimelineContext
    ): TimelineFilterResult {
        let filteredScenes = scenes;
        let filteredEvents = events;

        // Entity type filter
        const entityType = config.entityType ?? 'both';
        if (entityType === 'scenes') {
            filteredEvents = [];
        } else if (entityType === 'events') {
            filteredScenes = [];
        }

        // Tag filtering
        if (config.tags && config.tags.length > 0) {
            filteredScenes = this.filterScenesByTags(filteredScenes, config.tags);
            filteredEvents = this.filterEventsByTags(filteredEvents, config.tags);
        }

        // Time range filtering
        if (config.timeRange && (config.timeRange.start || config.timeRange.end)) {
            filteredScenes = this.filterScenesByTimeRange(filteredScenes, config.timeRange);
            filteredEvents = this.filterEventsByTimeRange(filteredEvents, config.timeRange);
        }

        // Event ownership visibility
        filteredEvents = this.filterEventsByOwnership(filteredEvents, context);

        // Deduplicate events by canonical ID
        filteredEvents = this.deduplicateEvents(filteredEvents);

        return {
            scenes: filteredScenes,
            events: filteredEvents,
        };
    }

    private filterScenesByTags(scenes: Scene[], tags: string[]): Scene[] {
        if (tags.length === 0) return scenes;
        return scenes.filter(scene => {
            const sceneTags = scene.tags ?? [];
            return tags.every(tag => sceneTags.includes(tag));
        });
    }

    private filterEventsByTags(events: Event[], tags: string[]): Event[] {
        if (tags.length === 0) return events;
        return events.filter(event => {
            const eventTags = event.tags ?? [];
            return tags.every(tag => eventTags.includes(tag));
        });
    }

    private filterScenesByTimeRange(scenes: Scene[], range: TimeRangeFilter): Scene[] {
        const { start, end } = range;
        if (!start && !end) return scenes;

        return scenes.filter(scene => {
            const sceneTime = this.extractSceneTimeSpan(scene);
            if (!sceneTime) return false;

            // Check against start boundary
            if (start) {
                const scenePoint = this.timeSpanService.getEarliestPoint(sceneTime);
                const startPoint = this.timeSpanService.getEarliestPoint(start);
                if (scenePoint && startPoint) {
                    const cmp = this.timeSpanService.compareTimestamps(scenePoint, startPoint);
                    if (cmp < 0) return false;
                }
            }

            // Check against end boundary
            if (end) {
                const scenePoint = this.timeSpanService.getEarliestPoint(sceneTime);
                const endPoint = this.timeSpanService.getEarliestPoint(end);
                if (scenePoint && endPoint) {
                    const cmp = this.timeSpanService.compareTimestamps(scenePoint, endPoint);
                    if (cmp > 0) return false;
                }
            }

            return true;
        });
    }

    private filterEventsByTimeRange(events: Event[], range: TimeRangeFilter): Event[] {
        const { start, end } = range;
        if (!start && !end) return events;
        return events.filter(e => this.eventInTimeRange(e, start, end));
    }

    private eventInTimeRange(event: Event, start?: TimeSpan, end?: TimeSpan): boolean {
        const ts = event.timeSpan;
        if (!ts || ts.kind === 'unknown') return false;
        const point = this.timeSpanService.getEarliestPoint(ts);
        if (!point) return false;
        if (start && !this.timestampInRange(point, start, end)) return false;
        return true;
    }

    private timestampInRange(point: import('../models/TimeSpan').Timestamp, start: TimeSpan, end?: TimeSpan): boolean {
        const sp = this.timeSpanService.getEarliestPoint(start);
        if (!sp) return true;
        if (this.timeSpanService.compareTimestamps(point, sp) < 0) return false;
        if (end) {
            const ep = this.timeSpanService.getEarliestPoint(end);
            if (ep && this.timeSpanService.compareTimestamps(point, ep) > 0) return false;
        }
        return true;
    }

    private extractSceneTimeSpan(scene: Scene): TimeSpan | null {
        // Try storyDate first
        if (scene.storyDate) {
            const parsed = this.timeSpanService.parse(scene.storyDate);
            if (parsed && parsed.kind !== 'unknown') return parsed;
        }
        // Try timeSpan (structured temporal data)
        if (scene.timeSpan && scene.timeSpan.kind !== 'unknown') {
            return scene.timeSpan;
        }
        // Try chronological_order as fallback
        if (scene.chronologicalOrder) {
            const parsed = this.timeSpanService.parse(String(scene.chronologicalOrder));
            if (parsed && parsed.kind !== 'unknown') return parsed;
        }
        return null;
    }

    private filterEventsByOwnership(events: Event[], context: TimelineContext): Event[] {
        const { selectedBookIds, universeId, seriesId, projects, activeBookId } = context;

        // If no books selected, only show events for active book
        if (selectedBookIds.size === 0) {
            return events.filter(event => this.isEventVisibleToBook(event, activeBookId, context));
        }

        // Multi-book mode: show events visible to any selected book
        return events.filter(event => {
            for (const bookId of selectedBookIds) {
                if (this.isEventVisibleToBook(event, bookId, context)) {
                    return true;
                }
            }
            return false;
        });
    }

    // eslint-disable-next-line complexity -- ownership visibility requires checking multiple hierarchy levels
    private isEventVisibleToBook(event: Event, bookId: string, context: TimelineContext): boolean {
        // Events explicitly referenced by this book
        if (event.booksById?.includes(bookId)) {
            return true;
        }

        // Book-owned events
        if (event.ownerId === bookId) {
            return true;
        }

        // Find the project for this book
        const project = context.projects.find(p => p.bookId === bookId);
        if (!project) return false;

        // Series-owned events visible to books in that series
        if (event.ownerId === project.seriesUuid) {
            return true;
        }

        // Universe-owned events visible to books in that universe
        if (event.ownerId === project.universeId) {
            return true;
        }

        // If event has no owner, check if it's in the same universe context
        if (!event.ownerId && context.universeId) {
            // Check if the event file is in a folder belonging to this universe
            const eventProject = context.projects.find(p => {
                // Events are stored in Events/ subfolder of the book
                const baseFolder = p.filePath.replace(/\.md$/i, '');
                const eventFolder = `${baseFolder}/Events`;
                return event.filePath.startsWith(eventFolder);
            });
            if (eventProject && eventProject.universeId === context.universeId) {
                return true;
            }
        }

        return false;
    }

    private deduplicateEvents(events: Event[]): Event[] {
        const seen = new Set<string>();
        const result: Event[] = [];
        for (const event of events) {
            if (!seen.has(event.id)) {
                seen.add(event.id);
                result.push(event);
            }
        }
        return result;
    }

    collectAvailableTags(scenes: Scene[], events: Event[]): string[] {
        const tagSet = new Set<string>();
        for (const scene of scenes) {
            for (const tag of scene.tags ?? []) {
                tagSet.add(tag);
            }
        }
        for (const event of events) {
            for (const tag of event.tags ?? []) {
                tagSet.add(tag);
            }
        }
        return Array.from(tagSet).sort();
    }

    isFilterActive(config: TimelineFilterConfig): boolean {
        if (config.entityType && config.entityType !== 'both') return true;
        if (config.tags && config.tags.length > 0) return true;
        if (config.timeRange && (config.timeRange.start || config.timeRange.end)) return true;
        return false;
    }
}
/* eslint-enable max-lines -- end of filtering service */
