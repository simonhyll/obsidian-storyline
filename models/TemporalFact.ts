/**
 * Temporal Fact Model
 *
 * Property-level temporal assertions for individual facts and property values.
 * For example, a character's title, employer, location, or political affiliation
 * may change over time. This model supports tracking those changes.
 *
 * Full implementation is deferred to Phase 4+, but the model is defined in Phase 0.
 *
 * Storage and Reconstructibility:
 * - Primary storage: YAML lists in frontmatter (e.g., titleHistory) for portability
 * - Derived index: JSON in System/temporal-facts.json for fast queries
 * - The derived index is ALWAYS reconstructible from frontmatter YAML lists
 * - The derived index is NEVER the exclusive source of truth
 * - If the derived index is deleted or corrupted, it can be rebuilt from source files
 */
import type { TimeSpan } from './TimeSpan';

/**
 * A single temporal fact about an entity.
 * Represents a property value during a specific time period.
 */
export interface TemporalFact {
    /** UUID of the entity this fact belongs to */
    entityId: string;
    /** Property name, e.g. "title", "employer", "location", "politicalAffiliation" */
    property: string;
    /** The property value during this period */
    value: unknown;
    /** When this fact becomes valid */
    validFrom?: TimeSpan;
    /** When this fact ceases to be valid */
    validTo?: TimeSpan;
}

/**
 * Collection of temporal facts for an entity.
 * Stored as YAML lists in frontmatter or in a JSON index.
 */
export interface TemporalFactCollection {
    /** UUID of the entity */
    entityId: string;
    /** List of temporal facts */
    facts: TemporalFact[];
}

/**
 * Index of all temporal facts across entities.
 * Stored in System/temporal-facts.json (derived index).
 */
export interface TemporalFactIndex {
    /** Version of the index format */
    version: number;
    /** Timestamp of last rebuild */
    lastRebuild: string;
    /** All temporal facts */
    facts: TemporalFact[];
}

/**
 * Default path for the derived temporal facts index.
 */
export const TEMPORAL_FACTS_PATH = 'System/temporal-facts.json';

/**
 * Current temporal fact index format version.
 */
export const TEMPORAL_FACT_INDEX_VERSION = 1;