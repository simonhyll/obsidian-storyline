/**
 * SavedViewService — persists and retrieves named Timeline view presets.
 *
 * Saved Views are configuration presets only. They do not modify Scene
 * frontmatter, reorder stored sequences, or change Event ownership.
 *
 * Storage: System/SavedViews/{uuid}.json per preset.
 */

import { normalizePath } from 'obsidian';
import type SceneCardsPlugin from '../main';

/**
 * Versioned schema for saved view presets.
 * Increment `version` when the schema changes.
 */
export interface SavedViewConfig {
    /** Schema version for future migrations */
    version: number;
    /** Stable UUID for this preset */
    id: string;
    /** User-visible name */
    name: string;
    /** Optional description */
    description?: string;
    /** Created timestamp (ISO 8601) */
    created: string;
    /** Last modified timestamp (ISO 8601) */
    modified?: string;

    // ── Timeline configuration ──

    /** Scene ordering: reading (by sequence) or chronological */
    timelineOrder?: 'reading' | 'chronological';
    /** Enable swimlane (multi-lane) view */
    swimlaneMode?: boolean;
    /** Swimlane grouping dimension */
    swimlaneGroupBy?: 'pov' | 'character' | 'location' | 'plotline' | 'tag';
    /** Book IDs for multi-book timeline (empty = active book only) */
    selectedBookIds?: string[];
    /** Zoom level (0.5–3.0) */
    zoomLevel?: number;
}

/** Metadata returned by listSavedViews() */
export interface SavedViewMeta {
    id: string;
    name: string;
    description?: string;
    created: string;
    modified?: string;
}

export class SavedViewService {
    constructor(private plugin: SceneCardsPlugin) {}

    // ── Path helpers ──

    private getSavedViewsFolder(): string {
        return normalizePath(`${this.plugin.getProjectSystemFolder()}/SavedViews`);
    }

    private viewPath(id: string): string {
        return normalizePath(`${this.getSavedViewsFolder()}/${id}.json`);
    }

    private async ensureFolder(): Promise<void> {
        const folder = this.getSavedViewsFolder();
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(folder))) {
            await this.plugin.app.vault.createFolder(folder);
        }
    }

    // ── CRUD ──

    /**
     * List all saved views, newest first.
     */
    async listSavedViews(): Promise<SavedViewMeta[]> {
        const folder = this.getSavedViewsFolder();
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(folder))) return [];

        const listing = await adapter.list(folder);
        const metas: SavedViewMeta[] = [];

        for (const filePath of listing.files) {
            if (!filePath.endsWith('.json')) continue;
            try {
                const txt = await adapter.read(filePath);
                const data = JSON.parse(txt) as SavedViewConfig;
                metas.push({
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    created: data.created,
                    modified: data.modified,
                });
            } catch {
                // Skip malformed files
            }
        }

        metas.sort((a, b) => {
            const ta = a.modified ?? a.created;
            const tb = b.modified ?? b.created;
            return tb.localeCompare(ta);
        });
        return metas;
    }

    /**
     * Create a new saved view preset.
     */
    async createSavedView(
        name: string,
        config: Omit<SavedViewConfig, 'version' | 'id' | 'created' | 'name'>,
    ): Promise<SavedViewConfig> {
        await this.ensureFolder();

        const id = this.generateId();
        const now = new Date().toISOString();

        const viewConfig: SavedViewConfig = {
            version: 1,
            id,
            name,
            created: now,
            modified: now,
            ...config,
        };

        const adapter = this.plugin.app.vault.adapter;
        await adapter.write(this.viewPath(id), JSON.stringify(viewConfig, null, 2));

        return viewConfig;
    }

    /**
     * Load a saved view by ID.
     */
    async loadSavedView(id: string): Promise<SavedViewConfig | null> {
        const adapter = this.plugin.app.vault.adapter;
        const path = this.viewPath(id);
        if (!(await adapter.exists(path))) return null;

        try {
            const txt = await adapter.read(path);
            return JSON.parse(txt) as SavedViewConfig;
        } catch {
            return null;
        }
    }

    /**
     * Update a saved view's metadata or configuration.
     */
    async updateSavedView(
        id: string,
        updates: Partial<SavedViewConfig>,
    ): Promise<SavedViewConfig | null> {
        const existing = await this.loadSavedView(id);
        if (!existing) return null;

        // Never allow changing id or version via update
        const { id: _id, version: _v, ...rest } = updates;
        const updated: SavedViewConfig = {
            ...existing,
            ...rest,
            modified: new Date().toISOString(),
        };

        const adapter = this.plugin.app.vault.adapter;
        await adapter.write(this.viewPath(id), JSON.stringify(updated, null, 2));

        return updated;
    }

    /**
     * Rename a saved view.
     */
    async renameSavedView(id: string, newName: string): Promise<SavedViewConfig | null> {
        return this.updateSavedView(id, { name: newName });
    }

    /**
     * Delete a saved view.
     */
    async deleteSavedView(id: string): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        const path = this.viewPath(id);
        if (await adapter.exists(path)) {
            await adapter.remove(path);
        }
    }

    // ── Utilities ──

    /**
     * Generate a short UUID for the preset ID.
     */
    private generateId(): string {
        // Use Obsidian's uuid if available, otherwise fallback
        try {
            const { uuid } = require('obsidian');
            return uuid();
        } catch {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }
    }
}
