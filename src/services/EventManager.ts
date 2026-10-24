/**
 * EventManager — CRUD and hierarchy-aware queries for Events.
 *
 * Events are stored as Markdown files with YAML frontmatter in Events/ folders.
 * Each Book, Series, and Universe can have its own Events/ folder.
 * Events are inherited through the Universe → Series → Book hierarchy.
 */

import type { App, Vault } from 'obsidian';
import { TFile } from 'obsidian';
import { parseYaml, stringifyYaml } from 'obsidian';
import type { Event } from '../models/Event';
import { createEvent, hasTemporalInfo } from '../models/Event';
import type { TimeSpan, IntervalTimeSpan } from '../models/TimeSpan';
import type { TimeSpanService } from './TimeSpanService';
import type { StoryLineProject } from '../models/StoryLineProject';

/**
 * Manager for Event entities.
 */
export class EventManager {
    private app: App;
    private timeSpanService: TimeSpanService | null = null;
    private events = new Map<string, Event>();

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Set the TimeSpanService for serialization/deserialization.
     */
    setTimeSpanService(service: TimeSpanService): void {
        this.timeSpanService = service;
    }

    // ── CRUD ──

    /**
     * Get all events.
     */
    getAllEvents(): Event[] {
        return Array.from(this.events.values());
    }

    /**
     * Get an event by ID.
     */
    getEvent(id: string): Event | undefined {
        return this.events.get(id);
    }

    /**
     * Get events by name (fuzzy match).
     */
    getEventsByName(name: string): Event[] {
        const lower = name.toLowerCase();
        return this.getAllEvents().filter(e => e.name.toLowerCase().includes(lower));
    }

    /**
     * Get events with temporal information.
     */
    getEventsWithTime(): Event[] {
        return this.getAllEvents().filter(hasTemporalInfo);
    }

    /**
     * Get events by participant (Character ID).
     */
    getEventsByParticipant(characterId: string): Event[] {
        return this.getAllEvents().filter(e => e.participants?.includes(characterId));
    }

    /**
     * Get events by tag.
     */
    getEventsByTag(tag: string): Event[] {
        return this.getAllEvents().filter(e => e.tags?.includes(tag));
    }

    /**
     * Get events that overlap with the given time range.
     * An event overlaps if any part of its time span falls within the range.
     * Uses TimeSpanService for safe temporal comparison.
     */
    getEventsInRange(rangeStart: TimeSpan, rangeEnd: TimeSpan): Event[] {
        if (!this.timeSpanService) return [];
        // Build a proper interval TimeSpan from the range endpoints
        const startTs = this.timeSpanService.getEarliestPoint(rangeStart);
        const endTs = this.timeSpanService.getEarliestPoint(rangeEnd);
        if (!startTs || !endTs) return [];
        const rangeInterval: IntervalTimeSpan = {
            kind: 'interval',
            start: startTs,
            end: endTs,
        };
        return this.getAllEvents().filter(e => {
            if (!e.timeSpan) return false;
            return this.timeSpanService!.overlaps(e.timeSpan, rangeInterval);
        });
    }

    /**
     * Add or update an event.
     */
    addEvent(event: Event): void {
        this.events.set(event.id, event);
    }

    /**
     * Remove an event by ID.
     */
    removeEvent(id: string): void {
        this.events.delete(id);
    }

    /**
     * Clear all events.
     */
    clear(): void {
        this.events.clear();
    }

    // ── Loading ──

    /**
     * Load all events from an Events/ folder.
     */
    async loadAll(eventsFolder: string): Promise<void> {
        this.clear();
        const vault = this.app.vault;

        // Check if the folder exists
        if (!(await vault.adapter.exists(eventsFolder))) {
            return;
        }

        // Find all markdown files in the Events folder
        const files = vault.getMarkdownFiles().filter(f => f.path.startsWith(eventsFolder + '/'));

        for (const file of files) {
            try {
                const content = await vault.read(file);
                const event = this.parseEvent(content, file.path);
                if (event) {
                    this.addEvent(event);
                }
            } catch (e) {
                console.warn(`EventManager: Failed to parse event ${file.path}`, e);
            }
        }
    }

    /**
     * Load events from multiple folders into a standalone map without mutating
     * the working collection. Used by TimelineView for universe-wide Event queries
     * that must not affect the active book's Event state.
     *
     * @param folderPaths - Array of Events/ folder paths to scan
     * @returns Array of events found, deduplicated by UUID
     */
    async loadEventsFromFolders(folderPaths: string[]): Promise<Event[]> {
        const vault = this.app.vault;
        const tempEvents = new Map<string, Event>();

        for (const folder of folderPaths) {
            if (!(await vault.adapter.exists(folder))) {
                continue;
            }
            const files = vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + '/'));
            for (const file of files) {
                try {
                    const content = await vault.read(file);
                    const event = this.parseEvent(content, file.path);
                    if (event && !tempEvents.has(event.id)) {
                        tempEvents.set(event.id, event);
                    } else if (event && tempEvents.has(event.id)) {
                        console.warn(
                            `EventManager: Duplicate UUID conflict for event "${event.name}" ` +
                            `(ID: ${event.id}) in ${file.path}`
                        );
                    }
                } catch (e) {
                    console.warn(`EventManager: Failed to parse event from folder ${folder}/${file.path}`, e);
                }
            }
        }

        return Array.from(tempEvents.values());
    }

    /**
     * Load events from multiple folders (for inherited collections).
     * Book-level events take precedence; duplicate UUIDs are reported as conflicts.
     */
    async loadInheritedFolders(folderPaths: string[]): Promise<void> {
        const vault = this.app.vault;

        for (const folder of folderPaths) {
            if (!(await vault.adapter.exists(folder))) {
                continue;
            }

            const files = vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + '/'));

            for (const file of files) {
                try {
                    const content = await vault.read(file);
                    const event = this.parseEvent(content, file.path);
                    if (event && !this.events.has(event.id)) {
                        // Only add if not already present (book-level takes precedence)
                        this.addEvent(event);
                    } else if (event && this.events.has(event.id)) {
                        console.warn(
                            `EventManager: Duplicate UUID conflict for event "${event.name}" ` +
                            `(ID: ${event.id}) in ${file.path}`
                        );
                    }
                } catch (e) {
                    console.warn(`EventManager: Failed to parse inherited event ${file.path}`, e);
                }
            }
        }
    }

    // ── Parsing ──

    /**
     * Parse an Event from Markdown content with YAML frontmatter.
     * Uses Obsidian's parseYaml for proper nested object handling.
     */
    parseEvent(content: string, filePath: string): Event | null {
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontmatterMatch) return null;

        const frontmatterText = frontmatterMatch[1];
        let frontmatter: Record<string, unknown>;
        try {
            frontmatter = parseYaml(frontmatterText);
            if (!frontmatter || typeof frontmatter !== 'object') return null;
        } catch {
            return null;
        }

        // Body is everything after frontmatter
        const body = content.slice(frontmatterMatch[0].length).trim();

        const safeFm = frontmatter;

        // Parse TimeSpan from YAML
        let timeSpan: TimeSpan | undefined;
        if (safeFm.timeSpan && this.timeSpanService) {
            const parsed = this.timeSpanService.deserializeFromYaml(safeFm.timeSpan);
            if (parsed) timeSpan = parsed;
        }

        const event: Event = {
            filePath,
            type: 'event',
            id: safeFm.id ? String(safeFm.id) : '',
            name: String(safeFm.name || ''),
            ownerId: safeFm.ownerId ? String(safeFm.ownerId) : undefined,
            introducedIn: safeFm.introducedIn ? String(safeFm.introducedIn) : undefined,
            timeSpan,
            location: safeFm.location ? String(safeFm.location) : undefined,
            participants: this.parseStringArray(safeFm.participants),
            description: safeFm.description ? String(safeFm.description) : undefined,
            tags: this.parseStringArray(safeFm.tags),
            booksById: this.parseStringArray(safeFm.booksById),
            created: safeFm.created ? String(safeFm.created) : undefined,
            modified: safeFm.modified ? String(safeFm.modified) : undefined,
            body,
            universalFields: safeFm.universalFields && typeof safeFm.universalFields === 'object'
                ? safeFm.universalFields as Record<string, string | string[] | boolean | number>
                : undefined,
        };

        return event;
    }

    /**
     * Create a new event file.
     */
    async createEventFile(
        eventsFolder: string,
        name: string,
        options?: {
            id?: string;
            ownerId?: string;
            timeSpan?: TimeSpan;
            location?: string;
            participants?: string[];
            description?: string;
            tags?: string[];
        }
    ): Promise<Event> {
        const vault = this.app.vault;

        // Ensure the folder exists
        if (!(await vault.adapter.exists(eventsFolder))) {
            await vault.adapter.mkdir(eventsFolder);
        }

        // Generate file name from event name
        const fileName = this.slugify(name) + '.md';
        const filePath = eventsFolder + '/' + fileName;

        // Create the event
        const event = createEvent(name, filePath, options);

        // Write the file
        const content = this.buildEventContent(event);
        await vault.create(filePath, content);
        this.addEvent(event);

        return event;
    }

    /**
     * Save an event back to its file.
     * Preserves unknown frontmatter fields and the Markdown body.
     */
    async saveEvent(event: Event): Promise<void> {
        const vault = this.app.vault;

        // Read existing content to preserve body and unknown frontmatter fields
        let body = event.body || '';
        let unknownFields: Record<string, unknown> = {};
        if (await vault.adapter.exists(event.filePath)) {
            const file = vault.getAbstractFileByPath(event.filePath);
            if (file instanceof TFile) {
                const existing = await vault.read(file);
                // Extract body
                const bodyMatch = existing.match(/---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/);
                if (bodyMatch) {
                    body = bodyMatch[1];
                }
                // Extract unknown frontmatter fields
                const fmMatch = existing.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (fmMatch) {
                    try {
                        const existingFm = parseYaml(fmMatch[1]) as Record<string, unknown>;
                        // Known fields that EventManager manages
                        const knownFields = new Set([
                            'type', 'id', 'name', 'ownerId', 'introducedIn',
                            'timeSpan', 'location', 'participants', 'description',
                            'tags', 'booksById', 'created', 'modified',
                            'universalFields',
                        ]);
                        for (const [key, value] of Object.entries(existingFm)) {
                            if (!knownFields.has(key)) {
                                unknownFields[key] = value;
                            }
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        }

        event.body = body;
        event.modified = new Date().toISOString();

        const content = this.buildEventContent(event, body, unknownFields);
        const file = vault.getAbstractFileByPath(event.filePath);
        if (file instanceof TFile) {
            await vault.modify(file, content);
        }
        this.addEvent(event);
    }

    /**
     * Delete an event file.
     */
    async deleteEvent(event: Event): Promise<void> {
        const vault = this.app.vault;
        if (await vault.adapter.exists(event.filePath)) {
            await vault.adapter.remove(event.filePath);
        }
        this.removeEvent(event.id);
    }

    // ── Content Building ──

    /**
     * Build complete file content for an Event.
     * Uses Obsidian's stringifyYaml for proper nested object handling.
     * Preserves unknown frontmatter fields passed in `extraFields`.
     */
    buildEventContent(event: Event, body?: string, extraFields?: Record<string, unknown>): string {
        const fm: Record<string, unknown> = {
            type: 'event',
            id: event.id,
            name: event.name,
        };

        if (event.ownerId) fm.ownerId = event.ownerId;
        if (event.introducedIn) fm.introducedIn = event.introducedIn;
        if (event.location) fm.location = event.location;
        if (event.participants && event.participants.length > 0) fm.participants = event.participants;
        if (event.description) fm.description = event.description;
        if (event.tags && event.tags.length > 0) fm.tags = event.tags;
        if (event.booksById && event.booksById.length > 0) fm.booksById = event.booksById;
        if (event.universalFields && Object.keys(event.universalFields).length > 0) {
            fm.universalFields = event.universalFields;
        }
        if (event.created) fm.created = event.created;
        if (event.modified) fm.modified = event.modified;

        // Serialize TimeSpan using TimeSpanService
        if (event.timeSpan && this.timeSpanService) {
            fm.timeSpan = this.timeSpanService.serializeToYaml(event.timeSpan);
        }

        // Preserve unknown frontmatter fields
        if (extraFields) {
            for (const [key, value] of Object.entries(extraFields)) {
                if (!(key in fm)) {
                    fm[key] = value;
                }
            }
        }

        const finalBody = body ?? event.body ?? '';
        // Ensure frontmatter YAML ends with a newline before closing ---
        const yaml = stringifyYaml(fm).replace(/\n+$/, '');
        return `---\n${yaml}\n---\n${finalBody}`;
    }

    // ── Helpers ──

    /**
     * Parse a string array from frontmatter.
     */
    parseStringArray(value: unknown): string[] | undefined {
        if (Array.isArray(value)) return value.map(String);
        if (typeof value === 'string' && value.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(value.replace(/'/g, '"'));
                if (Array.isArray(parsed)) return parsed.map(String);
            } catch { /* ignore */ }
        }
        return undefined;
    }

    /**
     * Convert a string to a URL-safe slug.
     */
    slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
}
