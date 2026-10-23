/**
 * Universe, Series, and Book Hierarchy Model
 *
 * Defines the data structures for the Universe → Series → Book hierarchy.
 * Universe and Series share a common ContainerEntity abstraction with
 * inherited Codex and Event collections.
 *
 * Key concepts:
 * - Universe: top-level container, can contain multiple Series
 * - Series: contained in a Universe (or standalone), can contain multiple Books
 * - Book: a StoryLine project, contained in a Series (or standalone)
 * - Collections cascade down: Book effective Codex = Universe ∪ Series ∪ Book
 * - All new fields are optional for backward compatibility
 */

import type { SeriesMetadata, StoryLineProject } from './StoryLineProject';

/**
 * Universe metadata, persisted as universe.json in the Universe folder.
 */
export interface UniverseMetadata {
    /** UUID of the universe */
    id: string;
    /** Display name */
    name: string;
    /** Description / notes */
    description?: string;
    /** Series IDs contained in this universe */
    seriesIds: string[];
    /** Created timestamp (ISO date) */
    created: string;
    /** Last modified timestamp (ISO date) */
    modified?: string;
    /** Vault-relative path to a cover image */
    coverImage?: string;
}

/**
 * Container entity abstraction shared by Universe and Series.
 * Used for hierarchy navigation and inherited collection resolution.
 */
export interface ContainerEntity {
    /** UUID */
    id: string;
    /** Container type discriminator */
    type: 'universe' | 'series';
    /** Display name */
    name: string;
    /** Parent container ID (Universe ID for Series) */
    parentId?: string;
    /** Child container IDs (Series IDs for Universe, Book IDs for Series) */
    childIds?: string[];
    /** Vault-relative folder path */
    folderPath: string;
    /** Created timestamp (ISO date) */
    created: string;
}

/**
 * Hierarchy path from a root Universe down to a specific Book.
 * Used for scope resolution and inherited collection lookup.
 */
export interface HierarchyPath {
    /** The Universe, if any */
    universe?: UniverseMetadata;
    /** The Series, if any */
    series?: SeriesMetadata;
    /** The Book (project) */
    book: StoryLineProject;
}

/**
 * Result of resolving inherited collections for a book.
 * Contains the merged list of entity file paths from all applicable scopes.
 */
export interface InheritedCollectionResult {
    /** Collection type (e.g., 'Characters', 'Locations', 'Events') */
    collectionType: string;
    /** Book ID this result is for */
    bookId: string;
    /** Entity file paths owned by the Universe scope */
    universeEntities: string[];
    /** Entity file paths owned by the Series scope */
    seriesEntities: string[];
    /** Entity file paths owned by the Book scope */
    bookEntities: string[];
    /** Merged entity file paths (Universe ∪ Series ∪ Book, deduplicated) */
    allEntities: string[];
}

/**
 * Default folder name for universe.json
 */
export const UNIVERSE_JSON = 'universe.json';

/**
 * Default folder names for shared collections at Universe/Series level
 */
export const UNIVERSE_CODEX_FOLDER = 'Codex';
export const UNIVERSE_EVENTS_FOLDER = 'Events';

/**
 * Check if a StoryLineProject belongs to a Universe.
 */
export function isProjectInUniverse(project: StoryLineProject): boolean {
    return !!project.universeId;
}

/**
 * Check if a SeriesMetadata belongs to a Universe.
 */
export function isSeriesInUniverse(series: SeriesMetadata): boolean {
    return !!series.universeId;
}

/**
 * Build a HierarchyPath from a project, optionally with series and universe metadata.
 */
export function buildHierarchyPath(
    book: StoryLineProject,
    series?: SeriesMetadata | null,
    universe?: UniverseMetadata | null
): HierarchyPath {
    return {
        universe: universe || undefined,
        series: series || undefined,
        book,
    };
}

/**
 * Get the effective owner ID for a project within the hierarchy.
 * Returns the Universe ID if present, otherwise the Series UUID, otherwise the Book ID.
 */
export function getEffectiveOwnerId(project: StoryLineProject): string | undefined {
    return project.universeId || project.seriesUuid || project.bookId;
}

/**
 * Derive the Universe folder path from a Series folder path.
 * The Universe folder is the parent of the Series folder.
 */
export function deriveUniverseFolderFromSeries(seriesFolder: string): string | null {
    const lastSlash = seriesFolder.lastIndexOf('/');
    if (lastSlash < 0) return null;
    return seriesFolder.substring(0, lastSlash);
}

/**
 * Derive the Series folder path from a Book project file path.
 * The Series folder is the parent of the Book's base folder.
 */
export function deriveSeriesFolderFromBook(bookFilePath: string): string | null {
    const lastSlash = bookFilePath.lastIndexOf('/');
    if (lastSlash < 0) return null;
    const parentDir = bookFilePath.substring(0, lastSlash);
    // The book file is inside a book folder; the series is the parent of that
    const bookFolderSlash = parentDir.lastIndexOf('/');
    if (bookFolderSlash < 0) return null;
    return parentDir.substring(0, bookFolderSlash);
}
