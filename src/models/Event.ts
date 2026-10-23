/**
 * Event Model
 *
 * Events represent objective canonical occurrences within the fictional universe.
 * Unlike Scenes, Events are not literary interpretations — they are the factual
 * record of what happened in the universe, independent of any narrative perspective.
 *
 * Key properties:
 * - Events have a TimeSpan for canonical timing
 * - Events can be shared across books via Universe/Series inheritance
 * - Scenes reference Events via eventRefs without being constrained to depict them accurately
 * - Events support participants (Character IDs), locations, and typed relationships
 */

import type { TimeSpan } from './TimeSpan';

/**
 * Event data model — represents an objective canonical occurrence.
 */
export interface Event {
    /** File path relative to vault root */
    filePath: string;
    /** Type discriminator */
    type: 'event';
    /** Stable UUID — globally unique within the vault */
    id: string;
    /** Owner ID — which Universe, Series, or Book owns this event */
    ownerId?: string;
    /** Which Book first introduces this event (author organization) */
    introducedIn?: string;
    /** Event name/title */
    name: string;
    /** Canonical timing */
    timeSpan?: TimeSpan;
    /** Location (wikilink to Location) */
    location?: string;
    /** Character IDs involved in this event */
    participants?: string[];
    /** Canonical description of what happened */
    description?: string;
    /** Tags for categorization */
    tags?: string[];
    /** Which Books reference this event */
    booksById?: string[];
    /** Created date */
    created?: string;
    /** Modified date */
    modified?: string;
    /** Body content (without frontmatter) */
    body?: string;
    /** Optional custom universal field values */
    universalFields?: Record<string, string | string[] | boolean | number>;
}

/**
 * Create a new Event with a generated UUID.
 */
export function createEvent(
    name: string,
    filePath: string,
    options?: {
        id?: string;
        ownerId?: string;
        introducedIn?: string;
        timeSpan?: TimeSpan;
        location?: string;
        participants?: string[];
        description?: string;
        tags?: string[];
    }
): Event {
    const now = new Date().toISOString();
    return {
        filePath,
        type: 'event',
        id: options?.id || generateEventId(),
        ownerId: options?.ownerId,
        introducedIn: options?.introducedIn,
        name,
        timeSpan: options?.timeSpan,
        location: options?.location,
        participants: options?.participants,
        description: options?.description,
        tags: options?.tags,
        created: now,
        modified: now,
    };
}

/**
 * Generate a simple UUID v4 for events.
 */
function generateEventId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Check if an event has temporal information.
 */
export function hasTemporalInfo(event: Event): boolean {
    return event.timeSpan !== undefined && event.timeSpan.kind !== 'unknown';
}

/**
 * Check if an event is referenced by a specific book.
 */
export function isReferencedByBook(event: Event, bookId: string): boolean {
    return event.booksById?.includes(bookId) ?? false;
}
