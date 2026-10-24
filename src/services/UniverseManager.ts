/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- Obsidian's API surface and several untyped third-party libraries force dynamic dispatch; floating promises are intentional in DOM/event handlers; matching enable at end of file */
import { App, Notice, normalizePath } from 'obsidian';
;
;
;
;
import type SceneCardsPlugin from '../main';
import type { SeriesMetadata, StoryLineProject } from '../models/StoryLineProject';
import type { HierarchyPath } from '../models/Universe';
import type { ContainerEntity } from '../models/Universe';
import type { UniverseMetadata } from '../models/Universe';
import type { InheritedCollectionResult } from '../models/Universe';
import { UNIVERSE_JSON, UNIVERSE_CODEX_FOLDER, buildHierarchyPath,  } from '../models/Universe';
;
;
;
;

/**
 * Manages the Universe → Series → Book hierarchy.
 *
 * Responsibilities:
 * - Create, load, save, and delete Universes (universe.json)
 * - Add/remove Series from Universes
 * - Resolve inherited collections (Characters, Locations, Codex, Events)
 * - Navigate the hierarchy (parent/child lookups)
 * - Discover existing universes in the vault
 *
 * Backward compatibility:
 * - All new fields are optional
 * - Existing series continue to work without a Universe
 * - Standalone books (no series, no universe) remain fully supported
 * - Creating a Universe does NOT automatically reorganize or move existing directories
 */
export class UniverseManager {
    private app: App;
    private plugin: SceneCardsPlugin;

    // Cache: folder path → UniverseMetadata
    private universeCache = new Map<string, UniverseMetadata>();

    constructor(app: App, plugin: SceneCardsPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    // ── Universe CRUD ──────────────────────────────────

    /**
     * Create a new Universe. This creates the folder structure and universe.json.
     * Does NOT move existing series or books — the hierarchy is a logical overlay.
     */
    async createUniverse(name: string): Promise<UniverseMetadata> {
        const root = this.plugin.settings.storyLineRoot;
        const safeName = name.replace(/[\\/:*?"<>|]/g, '-');
        const universeFolder = normalizePath(`${root}/${safeName}`);
        const adapter = this.app.vault.adapter;

        // Check for name collision
        if (await adapter.exists(universeFolder)) {
            throw new Error(`A folder named "${safeName}" already exists.`);
        }

        // Create the Universe folder
        await this.ensureFolder(universeFolder);

        // Create shared Codex folder structure
        const codexFolder = normalizePath(`${universeFolder}/${UNIVERSE_CODEX_FOLDER}`);
        await this.ensureFolder(codexFolder);
        await this.ensureFolder(normalizePath(`${codexFolder}/Characters`));
        await this.ensureFolder(normalizePath(`${codexFolder}/Locations`));

        // Create and save universe.json
        const now = new Date().toISOString().split('T')[0];
        const universe: UniverseMetadata = {
            id: crypto.randomUUID(),
            name: safeName,
            seriesIds: [],
            created: now,
            modified: now,
        };
        await this.saveUniverseMetadata(universeFolder, universe);

        // Cache it
        this.universeCache.set(universeFolder, universe);

        new Notice(`Universe "${safeName}" created`);
        return universe;
    }

    /**
     * Load universe.json from a universe folder.
     * Returns null if the file doesn't exist or is invalid.
     */
    async loadUniverseMetadata(universeFolder: string): Promise<UniverseMetadata | null> {
        // Check cache first
        const cached = this.universeCache.get(universeFolder);
        if (cached) return cached;

        const adapter = this.app.vault.adapter;
        const metaPath = normalizePath(`${universeFolder}/${UNIVERSE_JSON}`);
        if (!await adapter.exists(metaPath)) return null;

        try {
            const raw = await adapter.read(metaPath);
            const data = JSON.parse(raw);
            if (!data.id || !data.name) return null;
            const universe: UniverseMetadata = {
                id: data.id,
                name: data.name,
                description: data.description || undefined,
                seriesIds: Array.isArray(data.seriesIds) ? data.seriesIds : [],
                created: data.created || '',
                modified: data.modified || undefined,
                coverImage: data.coverImage || undefined,
            };
            this.universeCache.set(universeFolder, universe);
            return universe;
        } catch {
            return null;
        }
    }

    /**
     * Save universe.json to the universe folder.
     */
    async saveUniverseMetadata(universeFolder: string, meta: UniverseMetadata): Promise<void> {
        const adapter = this.app.vault.adapter;
        const metaPath = normalizePath(`${universeFolder}/${UNIVERSE_JSON}`);
        meta.modified = new Date().toISOString().split('T')[0];
        await adapter.write(metaPath, JSON.stringify(meta, null, 2));
        this.universeCache.set(universeFolder, meta);
    }

    /**
     * Get a universe by ID. Searches all known universes.
     */
    async getUniverse(id: string): Promise<UniverseMetadata | null> {
        const universes = await this.getAllUniverses();
        return universes.find(u => u.id === id) || null;
    }

    /**
     * Get all universes by scanning the StoryLine root.
     */
    async getAllUniverses(): Promise<UniverseMetadata[]> {
        const root = this.plugin.settings.storyLineRoot;
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(root)) return [];

        // Clear stale cache entries
        this.universeCache.clear();

        const listing = await adapter.list(root);
        const results: UniverseMetadata[] = [];

        for (const folder of listing.folders) {
            const meta = await this.loadUniverseMetadata(folder);
            if (meta) {
                results.push(meta);
            }
        }

        return results;
    }

    /**
     * Delete a universe. Removes universe.json and shared Codex folder.
     * Does NOT delete series or books — they become standalone.
     */
    async deleteUniverse(id: string): Promise<void> {
        const universe = await this.getUniverse(id);
        if (!universe) throw new Error('Universe not found');

        // Find the universe folder
        const root = this.plugin.settings.storyLineRoot;
        const adapter = this.app.vault.adapter;
        const listing = await adapter.list(root);
        let universeFolder: string | null = null;

        for (const folder of listing.folders) {
            const meta = await this.loadUniverseMetadata(folder);
            if (meta && meta.id === id) {
                universeFolder = folder;
                break;
            }
        }

        if (!universeFolder) throw new Error('Universe folder not found');

        // Remove universe.json
        const metaPath = normalizePath(`${universeFolder}/${UNIVERSE_JSON}`);
        if (await adapter.exists(metaPath)) {
            await adapter.remove(metaPath);
        }

        // Remove shared Codex folder if empty
        const codexFolder = normalizePath(`${universeFolder}/${UNIVERSE_CODEX_FOLDER}`);
        await this.removeFolderIfEmpty(codexFolder);

        // Clear series universeId references
        for (const seriesId of universe.seriesIds || []) {
            await this.removeSeriesFromUniverseInternal(universe.id, seriesId);
        }

        // Clear cache
        this.universeCache.delete(universeFolder);

        new Notice(`Universe "${universe.name}" deleted`);
    }

    // ── Series ↔ Universe membership ──────────────────

    /**
     * Add an existing series to a universe.
     * If the series already belongs to another universe, it is removed from that universe first.
     * A series can belong to at most one universe (exclusive membership).
     */
    async addSeriesToUniverse(universeId: string, seriesFolder: string): Promise<void> {
        const universe = await this.getUniverse(universeId);
        if (!universe) throw new Error('Universe not found');

        const seriesMeta = await this.plugin.seriesManager.loadSeriesMetadata(seriesFolder);
        if (!seriesMeta) throw new Error('Invalid series folder — no series.json found');

        const seriesUuid = seriesMeta.seriesUuid;
        if (!seriesUuid) {
            throw new Error('Series must have a UUID. Ensure the series was created via StoryLine.');
        }

        // If the series already belongs to this universe, nothing to do
        if (seriesMeta.universeId === universeId) return;

        // Remove from old universe if it belongs to one
        if (seriesMeta.universeId && seriesMeta.universeId !== universeId) {
            const oldUniverseId = seriesMeta.universeId;
            await this.removeSeriesFromUniverseInternal(oldUniverseId, seriesUuid);
        }

        // Add series to new universe
        if (!universe.seriesIds) universe.seriesIds = [];
        if (!universe.seriesIds.includes(seriesUuid)) {
            universe.seriesIds.push(seriesUuid);
        }
        await this.saveUniverseMetadata(
            this.findUniverseFolder(universeId)!,
            universe
        );

        // Update series metadata with universe reference
        seriesMeta.universeId = universeId;
        seriesMeta.ownerId = universeId;
        await this.plugin.seriesManager.saveSeriesMetadata(seriesFolder, seriesMeta);

        new Notice(`Series "${seriesMeta.name}" added to universe "${universe.name}"`);
    }

    /**
     * Remove a series from its universe.
     * The series becomes standalone but retains its data.
     * Rejects if the series does not belong to the specified universe.
     */
    async removeSeriesFromUniverse(universeId: string, seriesUuid: string): Promise<void> {
        const universe = await this.getUniverse(universeId);
        if (!universe) throw new Error('Universe not found');

        // Validate that the series actually belongs to this universe
        if (!(universe.seriesIds || []).includes(seriesUuid)) {
            throw new Error(`Series "${seriesUuid}" does not belong to universe "${universe.name}"`);
        }

        const universeFolder = this.findUniverseFolder(universeId)!;

        // Remove series from universe
        universe.seriesIds = (universe.seriesIds || []).filter(id => id !== seriesUuid);
        await this.saveUniverseMetadata(universeFolder, universe);

        // Clear series universe reference
        await this.removeSeriesFromUniverseInternal(universeId, seriesUuid);

        new Notice(`Series removed from universe "${universe.name}"`);
    }

    /**
     * Internal: remove a series from a specific universe and clear its metadata.
     * @param universeId The universe to remove from (must match the series' current universeId).
     * @param seriesUuid The series UUID to remove.
     */
    private async removeSeriesFromUniverseInternal(universeId: string, seriesUuid: string): Promise<void> {
        // Remove the series UUID from the universe's seriesIds
        const oldUniverse = await this.getUniverse(universeId);
        if (oldUniverse) {
            oldUniverse.seriesIds = (oldUniverse.seriesIds || []).filter(id => id !== seriesUuid);
            const oldUniverseFolder = this.findUniverseFolder(universeId);
            if (oldUniverseFolder) {
                await this.saveUniverseMetadata(oldUniverseFolder, oldUniverse);
            }
        }

        // Find the series folder by UUID and clear its universe reference
        const seriesList = await this.plugin.seriesManager.discoverSeries();
        for (const { folder, meta } of seriesList) {
            if (meta.seriesUuid === seriesUuid) {
                meta.universeId = undefined;
                meta.ownerId = undefined;
                await this.plugin.seriesManager.saveSeriesMetadata(folder, meta);
                break;
            }
        }
    }

    /**
     * Get series IDs for a universe.
     */
    async getSeriesForUniverse(universeId: string): Promise<string[]> {
        const universe = await this.getUniverse(universeId);
        return universe?.seriesIds || [];
    }

    /**
     * Get the universe ID for a series.
     */
    async getUniverseForSeries(seriesId: string): Promise<string | null> {
        const seriesList = await this.plugin.seriesManager.discoverSeries();
        for (const { meta } of seriesList) {
            if (meta.seriesUuid === seriesId || meta.name === seriesId) {
                return meta.universeId || null;
            }
        }
        return null;
    }

    // ── Hierarchy navigation ───────────────────────────

    /**
     * Build a ContainerEntity from a Universe.
     */
    universeToContainer(universe: UniverseMetadata, folderPath: string): ContainerEntity {
        return {
            id: universe.id,
            type: 'universe' as const,
            name: universe.name,
            childIds: universe.seriesIds,
            folderPath,
            created: universe.created,
        };
    }

    /**
     * Build a ContainerEntity from a Series.
     */
    seriesToContainer(series: SeriesMetadata, folderPath: string): ContainerEntity {
        return {
            id: series.seriesUuid || series.name,
            type: 'series' as const,
            name: series.name,
            parentId: series.universeId,
            childIds: series.bookIds,
            folderPath,
            created: series.created,
        };
    }

    /**
     * Resolve the full hierarchy path for a book.
     * Returns Universe → Series → Book chain, with missing parts as undefined.
     * Uses the supplied project, not the active project.
     */
    async resolveHierarchyPath(project: StoryLineProject): Promise<HierarchyPath> {
        let series: SeriesMetadata | null = null;
        let universe: UniverseMetadata | null = null;

        // Resolve Series — find the series that contains this specific project
        if (project.seriesUuid || project.seriesId) {
            const allSeries = await this.plugin.seriesManager.discoverSeries();
            for (const { folder, meta } of allSeries) {
                if (meta.seriesUuid === project.seriesUuid || meta.name === project.seriesId) {
                    series = meta;
                    break;
                }
            }
        }

        // Resolve Universe
        if (project.universeId) {
            universe = await this.getUniverse(project.universeId);
        } else if (series?.universeId) {
            universe = await this.getUniverse(series.universeId);
        }

        return buildHierarchyPath(project, series, universe);
    }

    /**
     * Get all books (projects) belonging to a universe, directly or via series.
     */
    async getBooksInUniverse(universeId: string): Promise<StoryLineProject[]> {
        const universe = await this.getUniverse(universeId);
        if (!universe) return [];

        const projects = this.plugin.sceneManager.getProjects();
        const result: StoryLineProject[] = [];

        for (const project of projects) {
            // Direct universe membership
            if (project.universeId === universeId) {
                result.push(project);
                continue;
            }

            // Via series
            if (project.seriesUuid && universe.seriesIds?.includes(project.seriesUuid)) {
                result.push(project);
                continue;
            }

            // Via series universeId
            if (project.seriesUuid) {
                const seriesUniverse = await this.getUniverseForSeries(project.seriesUuid);
                if (seriesUniverse === universeId) {
                    result.push(project);
                }
            }
        }

        return result;
    }

    // ── Inherited collection resolution ────────────────

    /**
     * Resolve inherited collections for a book.
     * Returns merged entity file paths from Universe ∪ Series ∪ Book scopes.
     * Uses the supplied project's series, not the active project.
     * @param collectionType A specific category subfolder (e.g., 'Characters', 'Locations').
     *   Do NOT pass 'all' — use getInheritedCodexFolders() instead.
     */
    async resolveInheritedCollections(
        project: StoryLineProject,
        collectionType: string
    ): Promise<InheritedCollectionResult> {
        const hierarchy = await this.resolveHierarchyPath(project);
        const bookId = project.bookId || project.filePath;

        const universeEntities: string[] = [];
        const seriesEntities: string[] = [];
        const bookEntities: string[] = [];

        // Universe-level entities
        if (hierarchy.universe) {
            const universeFolder = this.findUniverseFolder(hierarchy.universe.id);
            if (universeFolder) {
                const collectionFolder = normalizePath(`${universeFolder}/${UNIVERSE_CODEX_FOLDER}/${collectionType}`);
                universeEntities.push(...await this.listMarkdownFiles(collectionFolder));
            }
        }

        // Series-level entities — find the series folder for this specific project
        if (hierarchy.series && (hierarchy.series.seriesUuid || hierarchy.series.name)) {
            let seriesFolder: string | null = null;
            const allSeries = await this.plugin.seriesManager.discoverSeries();
            for (const { folder, meta } of allSeries) {
                if (meta.seriesUuid === hierarchy.series.seriesUuid || meta.name === hierarchy.series.name) {
                    seriesFolder = folder;
                    break;
                }
            }
            if (seriesFolder) {
                const collectionFolder = normalizePath(`${seriesFolder}/${UNIVERSE_CODEX_FOLDER}/${collectionType}`);
                seriesEntities.push(...await this.listMarkdownFiles(collectionFolder));
            }
        }

        // Book-level entities
        const bookFolders = this.deriveProjectFolders(project.filePath);
        const bookCollectionFolder = this.getCollectionFolder(bookFolders, collectionType);
        bookEntities.push(...await this.listMarkdownFiles(bookCollectionFolder));

        // Merge and deduplicate by file path
        const allEntities = Array.from(new Set([...universeEntities, ...seriesEntities, ...bookEntities]));

        return {
            collectionType,
            bookId,
            universeEntities,
            seriesEntities,
            bookEntities,
            allEntities,
        };
    }

    /**
     * Get the parent Codex folder paths from Universe and Series scopes.
     * Returns an ordered array: [universeCodexFolder?, seriesCodexFolder?].
     * These are the root Codex folders (e.g., "StoryLine/My Universe/Codex"),
     * NOT category-specific subfolders. The caller (CodexManager) is responsible
     * for scanning the category subfolders within each parent.
     */
    async getInheritedCodexFolders(project: StoryLineProject): Promise<string[]> {
        const hierarchy = await this.resolveHierarchyPath(project);
        const folders: string[] = [];

        // Universe-level Codex folder
        if (hierarchy.universe) {
            const universeFolder = this.findUniverseFolder(hierarchy.universe.id);
            if (universeFolder) {
                const universeCodex = normalizePath(`${universeFolder}/${UNIVERSE_CODEX_FOLDER}`);
                folders.push(universeCodex);
            }
        }

        // Series-level Codex folder
        if (hierarchy.series && (hierarchy.series.seriesUuid || hierarchy.series.name)) {
            let seriesFolder: string | null = null;
            const allSeries = await this.plugin.seriesManager.discoverSeries();
            for (const { folder, meta } of allSeries) {
                if (meta.seriesUuid === hierarchy.series.seriesUuid || meta.name === hierarchy.series.name) {
                    seriesFolder = folder;
                    break;
                }
            }
            if (seriesFolder) {
                const seriesCodex = normalizePath(`${seriesFolder}/${UNIVERSE_CODEX_FOLDER}`);
                folders.push(seriesCodex);
            }
        }

        return folders;
    }

    /**
     * Get the parent Events folder paths from Universe and Series scopes.
     * Returns an ordered array: [universeEventsFolder?, seriesEventsFolder?].
     */
    async getInheritedEventFolders(project: StoryLineProject): Promise<string[]> {
        const hierarchy = await this.resolveHierarchyPath(project);
        const folders: string[] = [];

        // Universe-level Events folder
        if (hierarchy.universe) {
            const universeFolder = this.findUniverseFolder(hierarchy.universe.id);
            if (universeFolder) {
                const universeEvents = normalizePath(`${universeFolder}/Events`);
                folders.push(universeEvents);
            }
        }

        // Series-level Events folder
        if (hierarchy.series && (hierarchy.series.seriesUuid || hierarchy.series.name)) {
            let seriesFolder: string | null = null;
            const allSeries = await this.plugin.seriesManager.discoverSeries();
            for (const { folder, meta } of allSeries) {
                if (meta.seriesUuid === hierarchy.series.seriesUuid || meta.name === hierarchy.series.name) {
                    seriesFolder = folder;
                    break;
                }
            }
            if (seriesFolder) {
                const seriesEvents = normalizePath(`${seriesFolder}/Events`);
                folders.push(seriesEvents);
            }
        }

        return folders;
    }

    /**
     * Get ALL Events folder paths belonging to a universe.
     * This includes:
     * - Universe-level Events folder
     * - All Series-level Events folders within the universe
     * - All Book-level Events folders for books in the universe
     *
     * Used by TimelineView to display universe-wide canonical Events
     * regardless of which book is currently active.
     */
    async getAllUniverseEventFolders(universeId: string): Promise<string[]> {
        const folders: string[] = [];
        const universe = await this.getUniverse(universeId);
        if (!universe) return folders;

        // Universe-level Events folder
        const universeFolder = this.findUniverseFolder(universeId);
        if (universeFolder) {
            folders.push(normalizePath(`${universeFolder}/Events`));
        }

        // All series-level Events folders
        const allSeries = await this.plugin.seriesManager.discoverSeries();
        for (const { folder, meta } of allSeries) {
            if (meta.universeId === universeId || universe.seriesIds?.includes(meta.seriesUuid || '')) {
                folders.push(normalizePath(`${folder}/Events`));
            }
        }

        // All book-level Events folders
        const books = await this.getBooksInUniverse(universeId);
        for (const book of books) {
            const bookFolders = this.deriveProjectFolders(book.filePath);
            const bookEvents = normalizePath(`${bookFolders.baseFolder}/Events`);
            folders.push(bookEvents);
        }

        return folders;
    }

    /**
     * Get the owner ID for an entity based on its file path.
     * Determines which Universe, Series, or Book owns the entity.
     */
    async getOwnerId(entityFilePath: string): Promise<string | null> {
        const projects = this.plugin.sceneManager.getProjects();

        // Check if it's in a book's codex
        for (const project of projects) {
            const bookFolders = this.deriveProjectFolders(project.filePath);
            const bookCodex = bookFolders.codexFolder;
            if (entityFilePath.startsWith(bookCodex)) {
                return project.bookId || project.filePath;
            }
        }

        // Check if it's in a series' codex
        const seriesList = await this.plugin.seriesManager.discoverSeries();
        for (const { folder, meta } of seriesList) {
            const seriesCodex = normalizePath(`${folder}/${UNIVERSE_CODEX_FOLDER}`);
            if (entityFilePath.startsWith(seriesCodex)) {
                return meta.seriesUuid || meta.name;
            }
        }

        // Check if it's in a universe's codex
        const universes = await this.getAllUniverses();
        for (const universe of universes) {
            const universeFolder = this.findUniverseFolder(universe.id);
            if (universeFolder) {
                const universeCodex = normalizePath(`${universeFolder}/${UNIVERSE_CODEX_FOLDER}`);
                if (entityFilePath.startsWith(universeCodex)) {
                    return universe.id;
                }
            }
        }

        return null;
    }

    // ── Discovery ──────────────────────────────────────

    /**
     * Discover all universes and their series/books in the vault.
     * Returns a tree structure for navigation.
     * Includes books that belong directly to a Universe (without a Series).
     */
    async discoverHierarchy(): Promise<Array<{
        universe: UniverseMetadata;
        folder: string;
        series: Array<{
            meta: SeriesMetadata;
            folder: string;
            books: StoryLineProject[];
        }>;
        directBooks: StoryLineProject[];
    }>> {
        const universes = await this.getAllUniverses();
        const result: Array<{
            universe: UniverseMetadata;
            folder: string;
            series: Array<{
                meta: SeriesMetadata;
                folder: string;
                books: StoryLineProject[];
            }>;
            directBooks: StoryLineProject[];
        }> = [];

        for (const universe of universes) {
            const universeFolder = this.findUniverseFolder(universe.id);
            if (!universeFolder) continue;

            const seriesList: Array<{
                meta: SeriesMetadata;
                folder: string;
                books: StoryLineProject[];
            }> = [];

            // Find series in this universe
            const allSeries = await this.plugin.seriesManager.discoverSeries();
            for (const { folder, meta } of allSeries) {
                if (meta.universeId === universe.id || universe.seriesIds?.includes(meta.seriesUuid || '')) {
                    const projects = this.plugin.sceneManager.getProjects();
                    const books = projects.filter(p =>
                        p.seriesUuid === meta.seriesUuid || p.seriesId === meta.name
                    );
                    seriesList.push({ meta, folder, books });
                }
            }

            // Find books that belong directly to this universe (no series)
            const projects = this.plugin.sceneManager.getProjects();
            const directBooks = projects.filter(p =>
                p.universeId === universe.id && !p.seriesUuid
            );

            result.push({ universe, folder: universeFolder, series: seriesList, directBooks });
        }

        return result;
    }

    // ── Helpers ────────────────────────────────────────

    /** Find the folder path for a universe by ID. */
    private findUniverseFolder(universeId: string): string | null {
        for (const [folder, meta] of this.universeCache) {
            if (meta.id === universeId) return folder;
        }
        return null;
    }

    /** Derive project folder paths from a file path (mirrors StoryLineProject.ts). */
    private deriveProjectFolders(
        filePath: string
    ): { baseFolder: string; codexFolder: string } {
        const lastSlash = filePath.lastIndexOf('/');
        const parentDir = lastSlash >= 0 ? filePath.substring(0, lastSlash) : '';
        const basename = (filePath.split('/').pop() ?? '').replace(/\.md$/i, '');
        const parentName = parentDir.split('/').pop() ?? '';
        const baseFolder = (parentName === basename) ? parentDir : `${parentDir}/${basename}`;
        return {
            baseFolder,
            codexFolder: `${baseFolder}/Codex`,
        };
    }

    /** Get the collection folder path for a given type. */
    private getCollectionFolder(
        folders: { baseFolder: string; codexFolder: string },
        collectionType: string
    ): string {
        // Map collection types to folder paths
        if (collectionType === 'Characters') {
            return `${folders.codexFolder}/Characters`;
        }
        if (collectionType === 'Locations') {
            return `${folders.codexFolder}/Locations`;
        }
        // Generic codex category
        return `${folders.codexFolder}/${collectionType}`;
    }

    /** List all .md files in a folder recursively. */
    private async listMarkdownFiles(folder: string): Promise<string[]> {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(folder)) return [];

        const results: string[] = [];
        await this.listMarkdownFilesRecursive(folder, results);
        return results;
    }

    private async listMarkdownFilesRecursive(folder: string, results: string[]): Promise<void> {
        const adapter = this.app.vault.adapter;
        const listing = await adapter.list(folder);

        for (const file of listing.files) {
            if (file.toLowerCase().endsWith('.md')) {
                results.push(file);
            }
        }

        for (const subfolder of listing.folders) {
            await this.listMarkdownFilesRecursive(subfolder, results);
        }
    }

    /** Ensure a folder exists, creating it if necessary. */
    private async ensureFolder(folder: string): Promise<void> {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(folder)) {
            await adapter.mkdir(folder);
        }
    }

    /** Remove a folder only if it's empty. */
    private async removeFolderIfEmpty(folder: string): Promise<void> {
        const adapter = this.app.vault.adapter;
        if (!await adapter.exists(folder)) return;

        const listing = await adapter.list(folder);
        if (listing.files.length === 0 && listing.folders.length === 0) {
            await adapter.rmdir(folder, false);
        }
    }
}
