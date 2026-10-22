/**
 * EventManager — CRUD and hierarchy-aware queries for Events.
 *
 * Events are stored as Markdown files with YAML frontmatter in Events/ folders.
 * Each Book, Series, and Universe can have its own Events/ folder.
 * Events are inherited through the Universe → Series → Book hierarchy.
 */

import type { App, Vault } from 'obsidian';
import type { Event } from '../models/Event';
import { createEvent, hasTemporalInfo } from '../models/Event';
import type { TimeSpan } from '../models/TimeSpan';
import type { StoryLineProject } from '../models/StoryLineProject';

/**
 * Manager for Event entities.
 */
export class EventManager {
    private app: App;
    private events = new Map<string, Event>();

    constructor(app: App) {
        this.app = app;
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
     * Get events within a TimeSpan range.
     */
    getEventsInRange(rangeStart: TimeSpan, rangeEnd: TimeSpan, timeSpanService: any): Event[] {
        return this.getAllEvents().filter(e => {
            if (!e.timeSpan) return false;
            // Simple check: event's earliest point falls within the range
            const cmpStart = timeSpanService.compare(e.timeSpan, rangeStart);
            const cmpEnd = timeSpanService.compare(e.timeSpan, rangeEnd);
            return cmpStart >= 0 && cmpEnd <= 0;
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
        const adapter = vault.adapter;

        // Check if the folder exists
        if (!(await adapter.exists(eventsFolder))) {
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
     * Load events from multiple folders (for inherited collections).
     */
    async loadInheritedFolders(folderPaths: string[]): Promise<void> {
        const vault = this.app.vault;
        const adapter = vault.adapter;

        for (const folder of folderPaths) {
            if (!(await adapter.exists(folder))) {
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
     */
    parseEvent(content: string, filePath: string): Event | null {
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return null;

        const frontmatterText = frontmatterMatch[1];
        const frontmatter = this.parseYaml(frontmatterText);

        // Body is everything after frontmatter
        const body = content.slice(frontmatterMatch[0].length).trim();

        const safeFm = frontmatter as Record<string, unknown>;

        const event: Event = {
            filePath,
            type: 'event',
            id: safeFm.id ? String(safeFm.id) : '',
            name: String(safeFm.name || ''),
            ownerId: safeFm.ownerId ? String(safeFm.ownerId) : undefined,
            introducedIn: safeFm.introducedIn ? String(safeFm.introducedIn) : undefined,
            location: safeFm.location ? String(safeFm.location) : undefined,
            participants: this.parseStringArray(safeFm.participants),
            description: safeFm.description ? String(safeFm.description) : undefined,
            tags: this.parseStringArray(safeFm.tags),
            booksById: this.parseStringArray(safeFm.booksById),
            created: safeFm.created ? String(safeFm.created) : undefined,
            modified: safeFm.modified ? String(safeFm.modified) : undefined,
            body,
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
        const adapter = vault.adapter;

        // Ensure the folder exists
        if (!(await adapter.exists(eventsFolder))) {
            await adapter.mkdir(eventsFolder);
        }

        // Generate file name from event name
        const fileName = this.slugify(name) + '.md';
        const filePath = eventsFolder + '/' + fileName;

        // Create the event
        const event = createEvent(name, filePath, options);

        // Write the file
        const frontmatter = this.buildFrontmatter(event);
        const content = `---\n${frontmatter}---\n`;

        await vault.create(filePath, content);
        this.addEvent(event);

        return event;
    }

    /**
     * Save an event back to its file.
     */
    async saveEvent(event: Event): Promise<void> {
        const vault = this.app.vault;

        // Read existing content to preserve body
        let body = event.body || '';
        if (await vault.adapter.exists(event.filePath)) {
            const existing = await vault.read(vault.getAbstractFileByPath(event.filePath) as any);
            const bodyMatch = existing.match(/---\n[\s\S]*?\n---\n([\s\S]*)/);
            if (bodyMatch) {
                body = bodyMatch[1];
            }
        }

        event.body = body;
        event.modified = new Date().toISOString();

        const frontmatter = this.buildFrontmatter(event);
        const content = `---\n${frontmatter}---\n${body}`;

        await vault.modify(vault.getAbstractFileByPath(event.filePath) as any, content);
        this.addEvent(event);
    }

    // ── Helpers ──

    /**
     * Build YAML frontmatter string from an Event.
     */
    buildFrontmatter(event: Event): string {
        const lines: string[] = [];
        lines.push(`type: event`);
        if (event.id) lines.push(`id: ${event.id}`);
        lines.push(`name: ${this.escapeYaml(event.name)}`);
        if (event.ownerId) lines.push(`ownerId: ${event.ownerId}`);
        if (event.introducedIn) lines.push(`introducedIn: ${event.introducedIn}`);
        if (event.location) lines.push(`location: ${event.location}`);
        if (event.participants && event.participants.length > 0) {
            lines.push(`participants: [${event.participants.join(', ')}]`);
        }
        if (event.description) lines.push(`description: ${this.escapeYaml(event.description)}`);
        if (event.tags && event.tags.length > 0) {
            lines.push(`tags: [${event.tags.join(', ')}]`);
        }
        if (event.booksById && event.booksById.length > 0) {
            lines.push(`booksById: [${event.booksById.join(', ')}]`);
        }
        if (event.created) lines.push(`created: ${event.created}`);
        if (event.modified) lines.push(`modified: ${event.modified}`);
        return lines.join('\n');
    }

    /**
     * Escape a string for YAML.
     */
    escapeYaml(value: string): string {
        // Simple escaping: quote if contains special chars
        if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }

    /**
     * Parse a YAML string into a Record.
     */
    parseYaml(text: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const line of text.split('\n')) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                const cleaned = value.trim();

                // Handle arrays: [item1, item2]
                if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
                    const inner = cleaned.slice(1, -1);
                    result[key] = inner
                        .split(',')
                        .map(s => s.trim().replace(/^["']|["']$/g, ''))
                        .filter(Boolean);
                }
                // Handle booleans
                else if (cleaned === 'true') result[key] = true;
                else if (cleaned === 'false') result[key] = false;
                // Handle numbers
                else if (!isNaN(Number(cleaned))) result[key] = Number(cleaned);
                // Handle strings
                else result[key] = cleaned.replace(/^["']|["']$/g, '');
            }
        }
        return result;
    }

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
