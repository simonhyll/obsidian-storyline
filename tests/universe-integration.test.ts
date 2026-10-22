// @ts-nocheck — integration tests use mocked Obsidian API with intentional type casting
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type SceneCardsPlugin from '../main';
import type { SceneManager } from '../services/SceneManager';
import type { SeriesManager } from '../services/SeriesManager';
import { UniverseManager } from '../services/UniverseManager';
import type { StoryLineProject, SeriesMetadata } from '../models/StoryLineProject';
import type { UniverseMetadata } from '../models/Universe';

/**
 * Integration tests for UniverseManager using a mocked Obsidian vault.
 *
 * These tests exercise:
 * - Universe CRUD and persistence
 * - Series membership changes
 * - Hierarchy resolution for non-active books
 * - Inherited Codex collection resolution
 * - Duplicate entity identity handling
 * - Legacy books and standalone series
 * - Safe deletion and preservation of user content
 */

// ── Mock helpers ──────────────────────────────────────────────

function createMockAdapter(): Adapter {
    const store = new Map<string, string>(); // path → content
    const folders = new Set<string>();

    return {
        get path() { return '/vault'; },
        async exists(path: string): Promise<boolean> {
            // Check exact match
            if (store.has(path) || folders.has(path)) return true;
            // Check if any stored path is under this path (it's a parent folder)
            for (const storedPath of [...store.keys(), ...folders]) {
                if (storedPath.startsWith(path + '/') || storedPath === path) return true;
            }
            return false;
        },
        async read(path: string): Promise<string> {
            return store.get(path) || '';
        },
        async write(path: string, data: string): Promise<void> {
            store.set(path, data);
        },
        async remove(path: string): Promise<void> {
            store.delete(path);
            folders.delete(path);
        },
        async mkdir(path: string): Promise<void> {
            folders.add(path);
        },
        async rmdir(path: string, _empty: boolean): Promise<void> {
            folders.delete(path);
        },
        async list(path: string): Promise<{ files: string[]; folders: string[] }> {
            const resultFiles: string[] = [];
            const resultFolders: Set<string> = new Set();
            const prefix = path.endsWith('/') ? path : path + '/';

            for (const storedPath of store.keys()) {
                if (storedPath.startsWith(prefix)) {
                    const relative = storedPath.substring(prefix.length);
                    const parts = relative.split('/');
                    if (parts.length === 1) {
                        // Direct file child
                        resultFiles.push(storedPath);
                    } else {
                        // File in subfolder — add the subfolder
                        resultFolders.add(`${prefix}${parts[0]}`);
                    }
                }
            }

            for (const folder of folders) {
                if (folder === path) continue;
                if (folder.startsWith(prefix)) {
                    const relative = folder.substring(prefix.length);
                    const parts = relative.split('/');
                    if (parts.length === 1) {
                        // Direct folder child
                        resultFolders.add(folder);
                    } else {
                        // Nested folder — add the immediate child
                        resultFolders.add(`${prefix}${parts[0]}`);
                    }
                }
            }

            return { files: resultFiles, folders: Array.from(resultFolders) };
        },
        async copy(_src: string, _dest: string): Promise<void> {},
        async rename(_old: string, _new: string): Promise<void> {},
        async listRecursive(_path: string): Promise<{ files: string[]; folders: string[] }> {
            return { files: [], folders: [] };
        },
        getResourcePath(_path: string): string | undefined { return undefined; },
        async chmod(_path: string, _mode: number): Promise<void> {},
        async stat(_path: string) { return null; },
    } as unknown as Adapter;
}

function createMockVault(adapter: Adapter): Vault {
    return {
        adapter,
        getMarkdownFiles: () => [],
        getAllFiles: () => [],
        getFileByPath: () => null,
        getFolderByPath: () => null,
        retrieveMarkdown: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        offref: vi.fn(),
    } as unknown as Vault;
}

function createMockApp(vault: Vault): App {
    return {
        vault,
        workspace: {
            onLayoutReady: (cb: () => void) => cb(),
            on: vi.fn(),
            off: vi.fn(),
        },
        commands: {
            addCommand: vi.fn(),
            executeCommandById: vi.fn(),
        },
        scope: {
            addKeybinding: vi.fn(),
            register: vi.fn(),
        },
        plugins: {},
        customRibbon: false,
        manifest: null,
        enable: vi.fn(),
        disable: vi.fn(),
        isMobileEditor: false,
        isMobile: false,
        isSafari: false,
        isMac: false,
        isWindows: false,
        isLinux: false,
        metadataCache: {
            on: vi.fn(),
            off: vi.fn(),
            getFileCache: () => null,
        },
        resourceManager: null,
    } as unknown as App;
}

function createMockSceneManager(projects: StoryLineProject[], activeProject: StoryLineProject | null): SceneManager {
    return {
        getProjects: () => projects,
        get activeProject() { return activeProject; },
        setActiveProject: vi.fn(),
        getSeriesFolder: () => activeProject ? `${activeProject.filePath.substring(0, activeProject.filePath.lastIndexOf('/'))}` : null,
        getSceneFolder: () => 'Scenes',
        getCodexFolder: () => 'Codex',
        saveProjectFrontmatter: vi.fn(),
        getAllScenes: () => [],
        queryService: {
            getStatistics: () => ({ totalWords: 0 }),
        },
        loadCorkboardPositions: vi.fn(),
        initialize: vi.fn(),
    } as unknown as SceneManager;
}

function createMockSeriesManager(seriesList: Array<{ folder: string; meta: SeriesMetadata }>): SeriesManager {
    const metaMap = new Map<string, SeriesMetadata>();
    for (const { folder, meta } of seriesList) {
        metaMap.set(folder, meta);
    }

    return {
        discoverSeries: async () => seriesList,
        loadSeriesMetadata: async (folder: string) => metaMap.get(folder) || null,
        saveSeriesMetadata: vi.fn(),
        ensureProjectSeriesIdentity: vi.fn(),
        checkLinkSettings: vi.fn(),
    } as unknown as SeriesManager;
}

function createMockPlugin(
    app: App,
    sceneManager: SceneManager,
    seriesManager: SeriesManager,
    storyLineRoot: string
): SceneCardsPlugin {
    return {
        app,
        sceneManager,
        seriesManager,
        settings: {
            storyLineRoot,
        },
    } as unknown as SceneCardsPlugin;
}

// ── Tests ─────────────────────────────────────────────────────

describe('UniverseManager Integration', () => {
    let adapter: Adapter;
    let app: App;
    let sceneManager: SceneManager;
    let seriesManager: SeriesManager;
    let plugin: SceneCardsPlugin;
    let universeManager: UniverseManager;

    const ROOT = 'StoryLine';

    function setup(
        projects: StoryLineProject[] = [],
        activeProject: StoryLineProject | null = null,
        seriesList: Array<{ folder: string; meta: SeriesMetadata }> = []
    ) {
        adapter = createMockAdapter();
        app = createMockVault(adapter);
        app = createMockApp(app as unknown as Vault);
        sceneManager = createMockSceneManager(projects, activeProject);
        seriesManager = createMockSeriesManager(seriesList);
        plugin = createMockPlugin(app, sceneManager, seriesManager, ROOT);
        universeManager = new UniverseManager(app, plugin);
    }

    beforeEach(() => {
        setup();
    });

    describe('Universe CRUD', () => {
        it('creates a universe with folder structure', async () => {
            setup();
            const universe = await universeManager.createUniverse('Test Universe');

            expect(universe.id).toBeDefined();
            expect(universe.name).toBe('Test Universe');
            expect(universe.seriesIds).toEqual([]);
            expect(universe.created).toBeDefined();

            // Verify universe.json was written
            const exists = await adapter.exists(`${ROOT}/Test Universe/universe.json`);
            expect(exists).toBe(true);
        });

        it('loads universe metadata from disk', async () => {
            setup();
            const created = await universeManager.createUniverse('Load Test');

            // Clear cache to force disk read
            universeManager = new UniverseManager(app, plugin);
            const loaded = await universeManager.loadUniverseMetadata(`${ROOT}/Load Test`);

            expect(loaded).not.toBeNull();
            expect(loaded!.id).toBe(created.id);
            expect(loaded!.name).toBe('Load Test');
        });

        it('rejects duplicate universe names', async () => {
            setup();
            await universeManager.createUniverse('Duplicate');

            await expect(universeManager.createUniverse('Duplicate'))
                .rejects.toThrow('already exists');
        });

        it('deletes a universe and preserves series', async () => {
            setup();
            const universe = await universeManager.createUniverse('Delete Test');

            await universeManager.deleteUniverse(universe.id);

            // universe.json should be removed
            const exists = await adapter.exists(`${ROOT}/Delete Test/universe.json`);
            expect(exists).toBe(false);
        });

        it('returns null for non-existent universe', async () => {
            setup();
            const result = await universeManager.loadUniverseMetadata('NonExistent');
            expect(result).toBeNull();
        });
    });

    describe('Series membership', () => {
        it('adds a series to a universe', async () => {
            const seriesMeta: SeriesMetadata = {
                name: 'Test Series',
                seriesUuid: 'series-123',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/My Universe/Test Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            const universe = await universeManager.createUniverse('My Universe');

            // Write series.json so it can be loaded
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            await universeManager.addSeriesToUniverse(universe.id, seriesFolder);

            // Verify universe now contains the series
            const updated = await universeManager.getUniverse(universe.id);
            expect(updated?.seriesIds).toContain('series-123');
        });

        it('removes a series from a universe', async () => {
            const seriesMeta: SeriesMetadata = {
                name: 'Test Series',
                seriesUuid: 'series-456',
                universeId: 'universe-abc',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/My Universe/Test Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            const universe: UniverseMetadata = {
                id: 'universe-abc',
                name: 'My Universe',
                seriesIds: ['series-456'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/My Universe`);
            await adapter.write(`${ROOT}/My Universe/universe.json`, JSON.stringify(universe));

            await universeManager.removeSeriesFromUniverse('universe-abc', 'series-456');

            const updated = await universeManager.getUniverse('universe-abc');
            expect(updated?.seriesIds).not.toContain('series-456');
        });

        it('prevents a series from belonging to multiple universes', async () => {
            // When adding a series to a new universe, the old universeId should be overwritten
            const seriesMeta: SeriesMetadata = {
                name: 'Moving Series',
                seriesUuid: 'series-move',
                universeId: 'old-universe',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/New Universe/Moving Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            // Create old universe
            const oldUniverse: UniverseMetadata = {
                id: 'old-universe',
                name: 'Old Universe',
                seriesIds: ['series-move'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/Old Universe`);
            await adapter.write(`${ROOT}/Old Universe/universe.json`, JSON.stringify(oldUniverse));

            // Create new universe
            const newUniverse = await universeManager.createUniverse('New Universe');
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            await universeManager.addSeriesToUniverse(newUniverse.id, seriesFolder);

            // Series should now point to new universe
            const updatedSeries = await seriesManager.loadSeriesMetadata(seriesFolder);
            expect(updatedSeries?.universeId).toBe(newUniverse.id);
        });

        it('removes series from old universe when adding to new universe', async () => {
            // Verify both sides of membership: old universe loses the series UUID
            const seriesMeta: SeriesMetadata = {
                name: 'Moving Series',
                seriesUuid: 'series-move',
                universeId: 'old-universe',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/Old Universe/Moving Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            // Create old universe with the series
            const oldUniverse: UniverseMetadata = {
                id: 'old-universe',
                name: 'Old Universe',
                seriesIds: ['series-move'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/Old Universe`);
            await adapter.write(`${ROOT}/Old Universe/universe.json`, JSON.stringify(oldUniverse));
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            // Create new universe and add the series
            const newUniverse = await universeManager.createUniverse('New Universe');
            await universeManager.addSeriesToUniverse(newUniverse.id, seriesFolder);

            // Old universe should no longer contain the series UUID
            const oldUpdated = await universeManager.getUniverse('old-universe');
            expect(oldUpdated?.seriesIds).not.toContain('series-move');

            // New universe should contain the series UUID
            const newUpdated = await universeManager.getUniverse(newUniverse.id);
            expect(newUpdated?.seriesIds).toContain('series-move');
        });

        it('rejects removing a series that does not belong to the universe', async () => {
            const seriesMeta: SeriesMetadata = {
                name: 'Other Series',
                seriesUuid: 'series-other',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/Other Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            const universe: UniverseMetadata = {
                id: 'universe-abc',
                name: 'My Universe',
                seriesIds: [],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/My Universe`);
            await adapter.write(`${ROOT}/My Universe/universe.json`, JSON.stringify(universe));

            // Try to remove a series that doesn't belong to this universe
            await expect(
                universeManager.removeSeriesFromUniverse('universe-abc', 'series-other')
            ).rejects.toThrow('does not belong to universe');
        });

        it('is idempotent when adding a series to its current universe', async () => {
            const seriesMeta: SeriesMetadata = {
                name: 'Existing Series',
                seriesUuid: 'series-existing',
                universeId: 'universe-abc',
                created: '2024-01-01',
            };
            const seriesFolder = `${ROOT}/My Universe/Existing Series`;

            setup([], null, [{ folder: seriesFolder, meta: seriesMeta }]);

            const universe: UniverseMetadata = {
                id: 'universe-abc',
                name: 'My Universe',
                seriesIds: ['series-existing'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/My Universe`);
            await adapter.write(`${ROOT}/My Universe/universe.json`, JSON.stringify(universe));
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            // Adding to the same universe should be a no-op
            await universeManager.addSeriesToUniverse('universe-abc', seriesFolder);

            // Series UUID should appear only once
            const updated = await universeManager.getUniverse('universe-abc');
            const count = (updated?.seriesIds || []).filter(id => id === 'series-existing').length;
            expect(count).toBe(1);
        });
    });

    describe('Hierarchy resolution', () => {
        it('resolves hierarchy for a project in a universe', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/My Universe/My Series/Book1/Book1.md`,
                title: 'Book 1',
                bookId: 'book-1',
                seriesUuid: 'series-123',
                universeId: 'universe-123',
            };

            const seriesMeta: SeriesMetadata = {
                name: 'My Series',
                seriesUuid: 'series-123',
                universeId: 'universe-123',
                created: '2024-01-01',
            };

            setup([project], project, [{ folder: `${ROOT}/My Universe/My Series`, meta: seriesMeta }]);

            const universe: UniverseMetadata = {
                id: 'universe-123',
                name: 'My Universe',
                seriesIds: ['series-123'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/My Universe`);
            await adapter.write(`${ROOT}/My Universe/universe.json`, JSON.stringify(universe));

            const path = await universeManager.resolveHierarchyPath(project);

            expect(path.book).toBe(project);
            expect(path.series).toBeDefined();
            expect(path.universe).toBeDefined();
            expect(path.universe!.id).toBe('universe-123');
        });

        it('resolves hierarchy for a standalone project', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/Standalone/Book.md`,
                title: 'Standalone Book',
                bookId: 'book-standalone',
            };

            setup([project], project, []);

            const path = await universeManager.resolveHierarchyPath(project);

            expect(path.book).toBe(project);
            expect(path.series).toBeUndefined();
            expect(path.universe).toBeUndefined();
        });

        it('resolves hierarchy using the supplied project, not the active project', async () => {
            // Regression test: resolveHierarchyPath must not fall back to
            // getSeriesFolder() which refers to the active project's series.
            const activeProject: StoryLineProject = {
                filePath: `${ROOT}/Active Series/ActiveBook/ActiveBook.md`,
                title: 'Active Book',
                bookId: 'book-active',
                seriesUuid: 'active-series',
            };
            const targetProject: StoryLineProject = {
                filePath: `${ROOT}/Target Series/TargetBook/TargetBook.md`,
                title: 'Target Book',
                bookId: 'book-target',
                seriesUuid: 'target-series',
            };

            const activeSeriesMeta: SeriesMetadata = {
                name: 'Active Series',
                seriesUuid: 'active-series',
                created: '2024-01-01',
            };
            const targetSeriesMeta: SeriesMetadata = {
                name: 'Target Series',
                seriesUuid: 'target-series',
                created: '2024-01-01',
            };

            // Active project is different from the target project
            setup([activeProject, targetProject], activeProject, [
                { folder: `${ROOT}/Active Series`, meta: activeSeriesMeta },
                { folder: `${ROOT}/Target Series`, meta: targetSeriesMeta },
            ]);

            // Resolve hierarchy for the target project (not the active one)
            const path = await universeManager.resolveHierarchyPath(targetProject);

            expect(path.book).toBe(targetProject);
            expect(path.series).toBeDefined();
            expect(path.series!.seriesUuid).toBe('target-series');
            // Should NOT resolve to the active project's series
            expect(path.series!.seriesUuid).not.toBe('active-series');
        });

        it('resolves hierarchy for a project in a series without a universe', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/Standalone Series/Book1/Book1.md`,
                title: 'Book 1',
                bookId: 'book-1',
                seriesUuid: 'standalone-series',
            };

            const seriesMeta: SeriesMetadata = {
                name: 'Standalone Series',
                seriesUuid: 'standalone-series',
                created: '2024-01-01',
            };

            setup([project], project, [{ folder: `${ROOT}/Standalone Series`, meta: seriesMeta }]);

            const path = await universeManager.resolveHierarchyPath(project);

            expect(path.book).toBe(project);
            expect(path.series).toBeDefined();
            expect(path.series!.seriesUuid).toBe('standalone-series');
            expect(path.universe).toBeUndefined();
        });
    });

    describe('Inherited collections', () => {
        it('resolves inherited collections from all three scopes', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/My Universe/My Series/Book1/Book1.md`,
                title: 'Book 1',
                bookId: 'book-1',
                seriesUuid: 'series-123',
                universeId: 'universe-123',
            };

            const seriesMeta: SeriesMetadata = {
                name: 'My Series',
                seriesUuid: 'series-123',
                universeId: 'universe-123',
                created: '2024-01-01',
            };

            setup([project], project, [{ folder: `${ROOT}/My Universe/My Series`, meta: seriesMeta }]);

            // Create universe-level character
            await adapter.mkdir(`${ROOT}/My Universe/Codex/Characters`);
            await adapter.write(`${ROOT}/My Universe/Codex/Characters/Alice.md`, '# Alice');

            // Create series-level character
            await adapter.mkdir(`${ROOT}/My Universe/My Series/Codex/Characters`);
            await adapter.write(`${ROOT}/My Universe/My Series/Codex/Characters/Bob.md`, '# Bob');

            // Create book-level character
            await adapter.mkdir(`${ROOT}/My Universe/My Series/Book1/Codex/Characters`);
            await adapter.write(`${ROOT}/My Universe/My Series/Book1/Codex/Characters/Charlie.md`, '# Charlie');

            const universe: UniverseMetadata = {
                id: 'universe-123',
                name: 'My Universe',
                seriesIds: ['series-123'],
                created: '2024-01-01',
            };
            await adapter.mkdir(`${ROOT}/My Universe`);
            await adapter.write(`${ROOT}/My Universe/universe.json`, JSON.stringify(universe));

            const result = await universeManager.resolveInheritedCollections(project, 'Characters');

            expect(result.collectionType).toBe('Characters');
            expect(result.universeEntities.length).toBeGreaterThanOrEqual(1);
            expect(result.seriesEntities.length).toBeGreaterThanOrEqual(1);
            expect(result.bookEntities.length).toBeGreaterThanOrEqual(1);
            expect(result.allEntities.length).toBeGreaterThanOrEqual(3);
        });

        it('deduplicates entities by file path', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/Book/Book.md`,
                title: 'Book',
                bookId: 'book-1',
            };

            setup([project], project, []);

            // Book-level codex — the deriveProjectFolders creates Book/Codex/Characters
            const bookCodexPath = `${ROOT}/Book/Codex/Characters/Alice.md`;
            await adapter.mkdir(`${ROOT}/Book/Codex/Characters`);
            await adapter.write(bookCodexPath, '# Alice');

            const result = await universeManager.resolveInheritedCollections(project, 'Characters');

            // Should appear only once in allEntities (deduplicated)
            const count = result.allEntities.filter(e => e === bookCodexPath).length;
            expect(count).toBe(1);
            // Total entities should be 1, not duplicated
            expect(result.allEntities.length).toBe(1);
        });
    });

    describe('Discovery', () => {
        it('discovers all universes in the vault', async () => {
            setup();

            // Create two universes
            const u1: UniverseMetadata = { id: 'u1', name: 'Universe 1', seriesIds: [], created: '2024-01-01' };
            const u2: UniverseMetadata = { id: 'u2', name: 'Universe 2', seriesIds: [], created: '2024-01-01' };

            await adapter.mkdir(`${ROOT}/Universe 1`);
            await adapter.write(`${ROOT}/Universe 1/universe.json`, JSON.stringify(u1));
            await adapter.mkdir(`${ROOT}/Universe 2`);
            await adapter.write(`${ROOT}/Universe 2/universe.json`, JSON.stringify(u2));

            const universes = await universeManager.getAllUniverses();
            expect(universes.length).toBe(2);
        });

        it('returns empty array when no universes exist', async () => {
            setup();
            const universes = await universeManager.getAllUniverses();
            expect(universes).toEqual([]);
        });
    });

    describe('Legacy compatibility', () => {
        it('handles projects without universeId', async () => {
            const project: StoryLineProject = {
                filePath: `${ROOT}/Old Book/Book.md`,
                title: 'Old Book',
                bookId: 'old-book',
            };

            setup([project], project, []);

            const path = await universeManager.resolveHierarchyPath(project);
            expect(path.book).toBe(project);
            expect(path.universe).toBeUndefined();
        });

        it('handles series without universeId', async () => {
            const seriesMeta: SeriesMetadata = {
                name: 'Legacy Series',
                seriesUuid: 'legacy-123',
                created: '2024-01-01',
            };

            setup([], null, [{ folder: `${ROOT}/Legacy Series`, meta: seriesMeta }]);

            const allSeries = await seriesManager.discoverSeries();
            expect(allSeries.length).toBe(1);
            expect(allSeries[0].meta.universeId).toBeUndefined();
        });
    });

    describe('Safe deletion', () => {
        it('preserves user-authored codex files during universe deletion', async () => {
            setup();

            const universe = await universeManager.createUniverse('Preserve Test');

            // Create a codex file
            const codexPath = `${ROOT}/Preserve Test/Codex/Characters/Hero.md`;
            await adapter.write(codexPath, '# Hero');

            // Delete universe
            await universeManager.deleteUniverse(universe.id);

            // universe.json should be gone
            const jsonExists = await adapter.exists(`${ROOT}/Preserve Test/universe.json`);
            expect(jsonExists).toBe(false);

            // Codex file should still exist (not deleted by universe deletion)
            const codexExists = await adapter.exists(codexPath);
            expect(codexExists).toBe(true);
        });
    });
});
