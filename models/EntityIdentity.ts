/**
 * Entity Identity and Ownership Model
 *
 * Every entity (Character, Location, CodexEntry, Event, Scene) has a stable
 * identity within the vault. This module defines the shared identity contract
 * and ownership types used across all entity models.
 *
 * Core principles:
 * - Single canonical entity per UUID — duplicate persisted UUIDs are identity conflicts
 * - Ownership determines where an entity "lives" in the hierarchy
 * - References track which books use an entity
 * - Introduction tracks which book first introduces an entity
 * - Visibility is view-level filter state, not entity metadata
 * - Scope precedence does NOT silently resolve identity collisions
 * - Legacy entities without UUIDs use deterministic file-path-based temporary identities
 */

/**
 * Entity type discriminator.
 * Extended as new entity types are added (e.g., Event in Phase 2).
 */
export type EntityType = 'character' | 'location' | 'codex' | 'scene' | 'event' | (string & {});

/**
 * Shared identity fields for all entities.
 * Mixed into entity interfaces via intersection types.
 */
export interface EntityIdentity {
    /** Stable UUID (v4), globally unique within the vault. Generated on first scan, persisted on explicit save. */
    id?: string;
    /** Entity type discriminator */
    type: EntityType;
    /** Vault-relative file path. The file is the canonical source of truth. */
    filePath: string;
    /** UUID of the Universe, Series, or Book that owns this entity. Determines hierarchy scope. */
    ownerId?: string;
    /** UUID of the Book that first introduces this entity. For author organization, not reader-facing spoiler filtering. */
    introducedIn?: string;
}

/**
 * Supplementary metadata for an inherited entity within a specific scope.
 * Stored in a separate JSON sidecar file, never modifies the entity's frontmatter.
 */
export interface EntitySupplement {
    /** UUID of the canonical entity this supplements */
    entityId: string;
    /** UUID of the scope (Book or Series) where this supplement applies */
    scopeId: string;
    /** Scope-specific display name override */
    displayName?: string;
    /** Scope-specific notes */
    notes?: string;
    /** Scope-specific property overrides */
    propertyOverrides?: Record<string, unknown>;
}

/**
 * Scope resolution order for entity lookup.
 * Higher scopes take precedence for canonical identity.
 *
 * IMPORTANT: Scope precedence is used for resolving inherited access, NOT for
 * silently resolving duplicate UUID conflicts. If two entities have the same
 * persisted UUID, that is an identity conflict that must be reported to the user.
 */
export const SCOPE_PRECEDENCE: Record<string, number> = {
    'universe': 3,
    'series': 2,
    'book': 1,
};

/**
 * A detected duplicate UUID conflict.
 */
export interface DuplicateIdConflict {
    /** The conflicting UUID */
    id: string;
    /** File path of the entity in the higher scope (canonical) */
    canonicalPath: string;
    /** File path of the entity in the lower scope (conflict) */
    conflictingPath: string;
}

/**
 * Generate a UUID v4 for entity identity.
 * Uses crypto.randomUUID if available, falls back to simple random UUID.
 */
export function generateEntityId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Check if an ID is a valid UUID v4 format.
 */
export function isValidEntityId(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * Generate a deterministic temporary identity for a legacy entity that lacks a UUID.
 *
 * This function produces a stable, reproducible identifier from the file path.
 * The result is NOT a UUID — it is a hash-based string that remains constant
 * across plugin reloads as long as the file path does not change.
 *
 * This is a temporary identity surrogate. Once the author explicitly saves the
 * entity through StoryLine, a proper UUID is generated and persisted.
 *
 * @param filePath - Vault-relative file path of the entity
 * @returns A deterministic identity string derived from the file path
 */
export function generateLegacyIdentity(filePath: string): string {
    // Simple deterministic hash of the file path
    // Using a basic hash that's stable across reloads
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
        const char = filePath.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Format as a UUID-like string for consistency, but NOT a valid UUID v4
    // Prefix "legacy-" makes it clearly distinguishable from real UUIDs
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `legacy-${hex}`;
}

/**
 * Check if an identity is a temporary legacy identity (not a real UUID).
 */
export function isLegacyIdentity(id: string): boolean {
    return id.startsWith('legacy-');
}

/**
 * Detect duplicate UUID conflicts among a list of entities.
 * Returns an array of conflicts; empty array means no conflicts.
 *
 * Duplicate persisted UUIDs are identity conflicts — scope precedence does NOT
 * silently resolve them. The caller must report the conflict to the user.
 */
export function detectDuplicateIdConflicts(entities: EntityIdentity[]): DuplicateIdConflict[] {
    const idMap = new Map<string, EntityIdentity[]>();

    for (const entity of entities) {
        // Only check persisted UUIDs, not legacy temporary identities
        if (entity.id && !isLegacyIdentity(entity.id)) {
            const existing = idMap.get(entity.id) || [];
            existing.push(entity);
            idMap.set(entity.id, existing);
        }
    }

    const conflicts: DuplicateIdConflict[] = [];
    for (const [id, duplicates] of idMap) {
        if (duplicates.length > 1) {
            // Report each pair as a conflict
            for (let i = 1; i < duplicates.length; i++) {
                conflicts.push({
                    id,
                    canonicalPath: duplicates[0].filePath,
                    conflictingPath: duplicates[i].filePath,
                });
            }
        }
    }

    return conflicts;
}
