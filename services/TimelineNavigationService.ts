/**
 * TimelineNavigationService — Time navigation and temporal axis generation.
 *
 * Provides:
 * - Jump to date/year navigation
 * - Previous/next chronological item navigation
 * - Adaptive time marker generation (year/month/day based on scale)
 * - Visible time window tracking
 * - Integration with TimeSpanService for calendar-aware operations
 */

import type { TimeSpan, Timestamp } from '../models/TimeSpan';
import type { Scene } from '../models/Scene';
import type { Event } from '../models/Event';
import type { TimeSpanService } from './TimeSpanService';

/**
 * Navigation state for the timeline view.
 */
export interface TimelineNavigationState {
    /** The currently selected/focused date (null = no selection) */
    selectedDate: Timestamp | null;
    /** The visible time range (start, end) */
    visibleRange: { start: Timestamp; end: Timestamp } | null;
    /** Temporal zoom level: 'year' | 'month' | 'day' | 'hour' */
    zoomLevel: 'year' | 'month' | 'day' | 'hour';
}

/**
 * A time marker for the temporal axis/ruler.
 */
export interface TimeMarker {
    /** The timestamp this marker represents */
    timestamp: Timestamp;
    /** Display label (e.g., "2000", "January", "15") */
    label: string;
    /** Granularity of this marker */
    granularity: 'year' | 'month' | 'day' | 'hour';
    /** Whether this is a major marker (always shown) or minor (shown at higher zoom) */
    isMajor: boolean;
}

/**
 * A chronological timeline item for navigation.
 */
export interface TimelineNavItem {
    /** The scene (if this is a scene) */
    scene?: Scene;
    /** The event (if this is an event) */
    event?: Event;
    /** The earliest timestamp for sorting/navigation */
    timestamp: Timestamp | null;
    /** Calendar system */
    calendar: string | undefined;
}

/**
 * TimelineNavigationService handles time navigation and temporal axis generation.
 */
export class TimelineNavigationService {
    private timeSpanService: TimeSpanService;
    private state: TimelineNavigationState;
    private items: TimelineNavItem[] = [];
    /** Stable identity so next/previous visits every item sharing a timestamp. */
    private focusedItemKey: string | null = null;

    constructor(timeSpanService: TimeSpanService) {
        this.timeSpanService = timeSpanService;
        this.state = {
            selectedDate: null,
            visibleRange: null,
            zoomLevel: 'year',
        };
    }

    // ── State Management ──

    /** Get the current navigation state. */
    getState(): TimelineNavigationState {
        return { ...this.state };
    }

    /** Set the selected date. */
    setSelectedDate(date: Timestamp | null) {
        this.state.selectedDate = date;
        this.focusedItemKey = null;
    }

    /** Get the selected date. */
    getSelectedDate(): Timestamp | null {
        return this.state.selectedDate;
    }

    /** Get the current zoom level. */
    getZoomLevel(): 'year' | 'month' | 'day' | 'hour' {
        return this.state.zoomLevel;
    }

    /** Set the zoom level. */
    setZoomLevel(level: 'year' | 'month' | 'day' | 'hour') {
        this.state.zoomLevel = level;
    }

    // ── Item Management ──

    /**
     * Update the list of chronological items for navigation.
     * This should be called whenever the timeline projection changes.
     */
    updateItems(scenes: Scene[], events: Event[]) {
        this.items = [];

        // Add scenes
        for (const scene of scenes) {
            const ts = this.getSceneTimestamp(scene);
            this.items.push({
                scene,
                timestamp: ts,
                calendar: ts?.calendar,
            });
        }

        // Add events
        for (const event of events) {
            const ts = event.timeSpan
                ? this.timeSpanService.getEarliestPoint(event.timeSpan)
                : null;
            this.items.push({
                event,
                timestamp: ts,
                calendar: ts?.calendar,
            });
        }

        // Sort items by timestamp
        this.items.sort((a, b) => this.compareItems(a, b));
        if (this.focusedItemKey &&
            !this.items.some(item => this.getItemKey(item) === this.focusedItemKey)) {
            this.focusedItemKey = null;
        }

        // Calculate visible range
        this.calculateVisibleRange();
    }

    /** Get the sorted list of navigation items. */
    getItems(): TimelineNavItem[] {
        return this.items;
    }

    /** Get the number of items. */
    getItemCount(): number {
        return this.items.length;
    }

    // ── Navigation ──

    /**
     * Jump to a specific date.
     * @param year The year to jump to.
     * @param month Optional month (1-12).
     * @param day Optional day (1-31).
     */
    jumpToDate(year: number, month?: number, day?: number) {
        const timestamp: Timestamp = {
            calendar: 'gregorian',
            year,
            precision: day ? 'day' : month ? 'month' : 'year',
        };
        if (month) timestamp.month = month;
        if (day) timestamp.day = day;

        this.state.selectedDate = timestamp;
        this.focusedItemKey = null;
        this.centerVisibleRangeOn(timestamp);
    }

    /**
     * Navigate to the previous chronological item.
     * @returns The previous item, or null if already at the beginning.
     */
    navigatePrevious(): TimelineNavItem | null {
        if (this.items.length === 0) return null;

        // Find current position
        let currentIndex = this.getFocusedIndex();

        if (currentIndex > 0) {
            currentIndex--;
            const item = this.items[currentIndex];
            this.focusedItemKey = this.getItemKey(item);
            if (item.timestamp) {
                this.state.selectedDate = item.timestamp;
            }
            return item;
        }

        return null;
    }

    /**
     * Navigate to the next chronological item.
     * @returns The next item, or null if already at the end.
     */
    navigateNext(): TimelineNavItem | null {
        if (this.items.length === 0) return null;

        // Find current position
        let currentIndex = this.getFocusedIndex();

        if (currentIndex < this.items.length - 1) {
            currentIndex++;
            const item = this.items[currentIndex];
            this.focusedItemKey = this.getItemKey(item);
            if (item.timestamp) {
                this.state.selectedDate = item.timestamp;
            }
            return item;
        }

        return null;
    }

    /**
     * Find the index of the item closest to the selected date.
     */
    findCurrentIndex(): number {
        if (!this.state.selectedDate || this.items.length === 0) {
            return 0;
        }

        // Binary search for the closest item
        let low = 0;
        let high = this.items.length - 1;

        while (low <= high) {
            const mid = (low + high) >> 1;
            const item = this.items[mid];
            if (!item.timestamp) {
                low = mid + 1;
                continue;
            }

            const cmp = this.timeSpanService.compareTimestamps(
                item.timestamp,
                this.state.selectedDate
            );

            if (cmp < 0) {
                low = mid + 1;
            } else if (cmp > 0) {
                high = mid - 1;
            } else {
                return mid; // Exact match
            }
        }

        // Return the closest index
        return Math.max(0, high);
    }

    /** Resolve an item by stable source identity rather than its timestamp. */
    private getItemKey(item: TimelineNavItem): string | null {
        if (item.scene) return `scene:${item.scene.filePath}`;
        if (item.event) return `event:${item.event.id}`;
        return null;
    }

    private getFocusedIndex(): number {
        if (this.focusedItemKey) {
            const index = this.items.findIndex(item => this.getItemKey(item) === this.focusedItemKey);
            if (index !== -1) return index;
        }
        return this.findCurrentIndex();
    }

    // ── Time Markers ──

    /**
     * Generate adaptive time markers for the temporal axis.
     * The granularity is determined by the time range and zoom level.
     */
    getTimeMarkers(): TimeMarker[] {
        if (!this.state.visibleRange) return [];

        const { start, end } = this.state.visibleRange;
        const markers: TimeMarker[] = [];

        // Calculate the time span in years
        const yearSpan = end.year - start.year;

        // Determine granularity based on zoom level and time span
        let granularity: 'year' | 'month' | 'day' = this.state.zoomLevel as 'year' | 'month' | 'day';

        // Auto-adjust granularity if the time span is too large/small for the current zoom
        if (granularity === 'year' && yearSpan > 100) {
            // Show decade markers
            const decadeStart = Math.floor(start.year / 10) * 10;
            for (let year = decadeStart; year <= end.year; year += 10) {
                markers.push({
                    timestamp: { calendar: 'gregorian', year, precision: 'year' },
                    label: String(year),
                    granularity: 'year',
                    isMajor: true,
                });
            }
        } else if (granularity === 'year' && yearSpan > 20) {
            // Show 5-year markers
            const fiveYearStart = Math.floor(start.year / 5) * 5;
            for (let year = fiveYearStart; year <= end.year; year += 5) {
                markers.push({
                    timestamp: { calendar: 'gregorian', year, precision: 'year' },
                    label: String(year),
                    granularity: 'year',
                    isMajor: true,
                });
            }
        } else if (granularity === 'year') {
            // Show yearly markers
            for (let year = start.year; year <= end.year; year++) {
                markers.push({
                    timestamp: { calendar: 'gregorian', year, precision: 'year' },
                    label: String(year),
                    granularity: 'year',
                    isMajor: true,
                });
            }
        } else if (granularity === 'month' && yearSpan <= 2) {
            // Show monthly markers
            let year = start.year;
            let month = start.month ?? 1;
            const endYear = end.year;
            const endMonth = end.month ?? 12;

            while (year < endYear || (year === endYear && month <= endMonth)) {
                const label = this.formatMonth(year, month);
                markers.push({
                    timestamp: {
                        calendar: 'gregorian',
                        year,
                        month,
                        precision: 'month',
                    },
                    label,
                    granularity: 'month',
                    isMajor: month === 1, // January is major
                });

                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }
            }
        } else if (granularity === 'day' && yearSpan <= 1) {
            // Show daily markers (only for short ranges)
            const startDate = new Date(start.year, (start.month ?? 1) - 1, start.day ?? 1);
            const endDate = new Date(end.year, (end.month ?? 1) - 1, end.day ?? 1);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const year = d.getFullYear();
                const month = d.getMonth() + 1;
                const day = d.getDate();

                markers.push({
                    timestamp: {
                        calendar: 'gregorian',
                        year,
                        month,
                        day,
                        precision: 'day',
                    },
                    label: String(day),
                    granularity: 'day',
                    isMajor: day === 1, // First of month is major
                });
            }
        }

        return markers;
    }

    /**
     * Get a time marker at a specific position (for click handling).
     * @param fraction The fraction along the timeline (0.0 = start, 1.0 = end).
     * @returns The timestamp at that position, or null if out of range.
     */
    getTimestampAtPosition(fraction: number): Timestamp | null {
        if (!this.state.visibleRange) return null;

        const { start, end } = this.state.visibleRange;

        // Calculate the year at this position
        const yearSpan = end.year - start.year;
        const year = Math.round(start.year + fraction * yearSpan);

        // Calculate the month at this position (if we have month precision)
        let month: number | undefined;
        if (start.month && end.month && yearSpan < 2) {
            const monthSpan = (end.year - start.year) * 12 + (end.month - start.month);
            const monthAtPos = start.month + Math.round(fraction * monthSpan);
            month = Math.max(1, Math.min(12, monthAtPos));
        }

        // Calculate the day at this position (if we have day precision)
        let day: number | undefined;
        if (start.day && end.day && yearSpan < 1) {
            const daysInYear = 365;
            const dayOfYearStart = this.getDayOfYear(start.year, start.month, start.day);
            const dayOfYearEnd = this.getDayOfYear(end.year, end.month, end.day);
            const daySpan = dayOfYearEnd - dayOfYearStart;
            const dayAtPos = dayOfYearStart + Math.round(fraction * daySpan);
            const { month: m, day: d } = this.getDateFromDayOfYear(year, dayAtPos);
            month = m;
            day = d;
        }

        return {
            calendar: 'gregorian',
            year,
            month,
            day,
            precision: day ? 'day' : month ? 'month' : 'year',
        };
    }

    // ── Visible Range ──

    /**
     * Calculate the visible time range based on items.
     */
    private calculateVisibleRange() {
        const datedItems = this.items.filter(item => item.timestamp !== null);

        if (datedItems.length === 0) {
            this.state.visibleRange = null;
            return;
        }

        // Find the earliest and latest timestamps
        let earliest = datedItems[0].timestamp!;
        let latest = datedItems[0].timestamp!;

        for (const item of datedItems) {
            if (!item.timestamp) continue;
            if (this.timeSpanService.compareTimestamps(item.timestamp, earliest) < 0) {
                earliest = item.timestamp;
            }
            if (this.timeSpanService.compareTimestamps(item.timestamp, latest) > 0) {
                latest = item.timestamp;
            }
        }

        // Add padding (10% on each side)
        const padding = Math.max(1, Math.round((latest.year - earliest.year) * 0.1));
        this.state.visibleRange = {
            start: { ...earliest, year: earliest.year - padding },
            end: { ...latest, year: latest.year + padding },
        };
    }

    /**
     * Center the visible range on a specific timestamp.
     */
    private centerVisibleRangeOn(timestamp: Timestamp) {
        if (!this.state.visibleRange) {
            this.state.visibleRange = {
                start: { ...timestamp, year: timestamp.year - 5 },
                end: { ...timestamp, year: timestamp.year + 5 },
            };
            return;
        }

        const rangeSpan = this.state.visibleRange.end.year - this.state.visibleRange.start.year;
        this.state.visibleRange = {
            start: { ...timestamp, year: timestamp.year - Math.floor(rangeSpan / 2) },
            end: { ...timestamp, year: timestamp.year + Math.floor(rangeSpan / 2) },
        };
    }

    // ── Helpers ──

    /**
     * Get the timestamp for a scene (from TimeSpan or legacy storyDate).
     */
    private getSceneTimestamp(scene: Scene): Timestamp | null {
        // Try TimeSpan first
        if (scene.timeSpan) {
            return this.timeSpanService.getEarliestPoint(scene.timeSpan);
        }

        // Fall back to legacy storyDate
        if (scene.storyDate) {
            const ts = this.timeSpanService.convertLegacyToTimeSpan(scene.storyDate, scene.storyTime || '');
            return ts ? this.timeSpanService.getEarliestPoint(ts) : null;
        }

        return null;
    }

    /**
     * Compare two timeline items for sorting.
     */
    private compareItems(a: TimelineNavItem, b: TimelineNavItem): number {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;

        return this.timeSpanService.compareTimestamps(a.timestamp, b.timestamp);
    }

    /**
     * Format a month for display.
     */
    private formatMonth(year: number, month: number): string {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[month - 1] || '';
    }

    /**
     * Get the day of year for a date.
     */
    private getDayOfYear(year: number, month: number | undefined, day: number | undefined): number {
        if (!month || !day) return 1;
        const date = new Date(year, month - 1, day);
        const startOfYear = new Date(year, 0, 1);
        const diff = date.getTime() - startOfYear.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    /**
     * Get month and day from day of year.
     */
    private getDateFromDayOfYear(year: number, dayOfYear: number): { month: number; day: number } {
        const date = new Date(year, 0, dayOfYear);
        return {
            month: date.getMonth() + 1,
            day: date.getDate(),
        };
    }
}
