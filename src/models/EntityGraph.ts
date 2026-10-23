/**
 * Entity Graph Model
 *
 * Graph-oriented entity and relationship layer with temporal validity.
 * This module defines the types only; graph indexing and queries are
 * implemented in Phase 4.
 *
 * Key concepts:
 * - Typed nodes and relationships
 * - Directed and symmetric relations
 * - Inverse relationship definitions
 * - Temporal validity on edges
 * - Graph is derived from frontmatter, never the canonical source of truth
 * - The derived graph index is ALWAYS reconstructible from source files
 * - If the index is deleted or corrupted, it can be rebuilt from frontmatter
 * - The index is stored in .storyline/ (gitignoreable) to avoid Git churn
 */
import type { TimeSpan } from './TimeSpan';

/**
 * Entity node in the graph.
 * Represents any entity type: character, location, event, codex, scene, or custom.
 */
export interface EntityNode {
    /** UUID of the entity */
    id: string;
    /** Entity type discriminator */
    type: string;
    /** Display name */
    name: string;
    /** UUID of the owning Universe, Series, or Book */
    ownerId?: string;
    /** Temporal validity - when this entity exists in the story timeline */
    validFrom?: TimeSpan;
    /** Temporal validity end */
    validTo?: TimeSpan;
    /** Additional properties derived from frontmatter */
    properties: Record<string, unknown>;
}

/**
 * Entity edge in the graph.
 * Represents a relationship between two entities.
 */
export interface EntityEdge {
    /** UUID of the edge */
    id: string;
    /** UUID of the source entity */
    from: string;
    /** UUID of the target entity */
    to: string;
    /** Relationship type, e.g. 'ally', 'enemy', 'presentAt', 'references', 'parentOf' */
    relationType: string;
    /** Inverse relationship type, e.g. 'childOf' for 'parentOf' */
    inverseType?: string;
    /** If true, the relation is bidirectional */
    symmetric?: boolean;
    /** Temporal validity start */
    validFrom?: TimeSpan;
    /** Temporal validity end */
    validTo?: TimeSpan;
    /** Additional properties */
    properties?: Record<string, unknown>;
}

/**
 * Graph index stored as JSON in .storyline/system/entity-graph.json.
 * Derived from frontmatter on save, reconstructible from source files.
 */
export interface EntityGraphIndex {
    /** Version of the graph index format */
    version: number;
    /** Timestamp of last rebuild */
    lastRebuild: string;
    /** All nodes in the graph */
    nodes: EntityNode[];
    /** All edges in the graph */
    edges: EntityEdge[];
}

/**
 * Query filter for graph traversal.
 */
export interface GraphQueryFilter {
    /** Filter by node type */
    nodeType?: string;
    /** Filter by relation type */
    relationType?: string;
    /** Filter by temporal validity */
    validAt?: TimeSpan;
    /** Filter by owner scope */
    ownerId?: string;
}

/**
 * Result of a graph query.
 */
export interface GraphQueryResult {
    /** Matching nodes */
    nodes: EntityNode[];
    /** Matching edges */
    edges: EntityEdge[];
}

/**
 * Current graph index format version.
 */
export const GRAPH_INDEX_VERSION = 1;

/**
 * Default path for the derived graph index.
 * Stored in .storyline/ to avoid Git changes in author repositories.
 */
export const GRAPH_INDEX_PATH = '.storyline/system/entity-graph.json';