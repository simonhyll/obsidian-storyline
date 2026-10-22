/**
 * Shared Service Interfaces
 *
 * Interface definitions for services that will be implemented in later phases.
 * Phase 0 defines the contracts; Phase 1+ implements them.
 */
import type { TimeSpan, Timestamp, CalendarAdapter } from '../models/TimeSpan';
import type { EntityNode, EntityEdge, EntityGraphIndex, GraphQueryFilter, GraphQueryResult } from '../models/EntityGraph';
import type { TemporalFact, TemporalFactIndex } from '../models/TemporalFact';

// ============================================================================
// TimeSpanService Interface (implemented in Phase 2)
// ============================================================================

/**
 * Service for parsing, comparing, and formatting TimeSpan values.
 */
export interface TimeSpanService {
    /** Parse a string into a TimeSpan */
    parse(input: string): TimeSpan | null;
    /** Format a TimeSpan to a display string */
    format(timeSpan: TimeSpan): string;
    /** Compare two TimeSpans; returns negative/zero/positive */
    compare(a: TimeSpan, b: TimeSpan): number;
    /** Check if two TimeSpans overlap */
    overlaps(a: TimeSpan, b: TimeSpan): boolean;
    /** Check if a TimeSpan contains another */
    contains(container: TimeSpan, contained: TimeSpan): boolean;
    /** Resolve a relative TimeSpan to an absolute one */
    resolveRelative(timeSpan: TimeSpan, referenceResolver: (id: string) => TimeSpan | null): TimeSpan;
    /** Register a calendar adapter */
    registerCalendar(adapter: CalendarAdapter): void;
    /** Get a calendar adapter by ID */
    getCalendar(id: string): CalendarAdapter | null;
}

// ============================================================================
// EntityGraphService Interface (implemented in Phase 4)
// ============================================================================

/**
 * Service for graph storage, derivation, queries, and temporal filtering.
 */
export interface EntityGraphService {
    /** Rebuild the graph index from frontmatter */
    rebuildIndex(): Promise<void>;
    /** Get all nodes */
    getNodes(): EntityNode[];
    /** Get a node by ID */
    getNode(id: string): EntityNode | undefined;
    /** Get all edges */
    getEdges(): EntityEdge[];
    /** Get edges connected to a node */
    getEdgesForNode(nodeId: string): EntityEdge[];
    /** Query the graph with filters */
    query(filter: GraphQueryFilter): GraphQueryResult;
    /** Get nodes valid at a specific time */
    getNodesValidAt(timeSpan: TimeSpan): EntityNode[];
    /** Get edges valid at a specific time */
    getEdgesValidAt(timeSpan: TimeSpan): EntityEdge[];
    /** Get the graph index */
    getIndex(): EntityGraphIndex | null;
    /** Get temporal facts for an entity */
    getTemporalFacts(entityId: string): TemporalFact[];
    /** Add a temporal fact */
    addTemporalFact(fact: TemporalFact): void;
    /** Save the temporal facts index */
    saveTemporalFactIndex(): Promise<void>;
}

// ============================================================================
// UniverseManager Interface (implemented in Phase 1)
// ============================================================================

/**
 * Universe metadata.
 */
export interface UniverseMetadata {
    /** UUID of the universe */
    id: string;
    /** Display name */
    name: string;
    /** Series IDs contained in this universe */
    seriesIds?: string[];
    /** Created timestamp */
    created: string;
    /** Last modified timestamp */
    modified?: string;
}

/**
 * Container entity abstraction shared by Universe and Series.
 */
export interface ContainerEntity {
    /** UUID */
    id: string;
    /** Container type */
    type: 'universe' | 'series';
    /** Display name */
    name: string;
    /** Parent container ID (Universe ID for Series) */
    parentId?: string;
    /** Child container IDs (Series IDs for Universe, Book IDs for Series) */
    childIds?: string[];
    /** Created timestamp */
    created: string;
}

/**
 * Service for Universe/Series/Book hierarchy management.
 */
export interface UniverseManager {
    /** Create a new universe */
    createUniverse(name: string): Promise<UniverseMetadata>;
    /** Get a universe by ID */
    getUniverse(id: string): UniverseMetadata | null;
    /** Get all universes */
    getAllUniverses(): UniverseMetadata[];
    /** Delete a universe */
    deleteUniverse(id: string): Promise<void>;
    /** Add a series to a universe */
    addSeriesToUniverse(universeId: string, seriesId: string): Promise<void>;
    /** Remove a series from a universe */
    removeSeriesFromUniverse(universeId: string, seriesId: string): Promise<void>;
    /** Get series IDs for a universe */
    getSeriesForUniverse(universeId: string): string[];
    /** Get the universe ID for a series */
    getUniverseForSeries(seriesId: string): string | null;
    /** Resolve inherited collections (Characters, Locations, Codex, Events) for a book */
    resolveInheritedCollections(bookId: string, collectionType: string): string[];
    /** Get the owner ID for an entity */
    getOwnerId(entityId: string): string | null;
}