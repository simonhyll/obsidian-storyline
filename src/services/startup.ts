/**
 * Orchestrates the StoryLine startup sequence after the workspace layout is ready.
 *
 * Extracted from {@link SceneCardsPlugin.onLayoutReady} to keep the plugin
 * composition root small. This module coordinates the 16-step bootstrap:
 *
 * 1. UI visibility updates (frontmatter, toolbar)
 * 2. Project discovery and active book selection
 * 3. Scene index initialization
 * 4. Legacy data migration
 * 5. Per-project System/ data loading
 * 6. Universal field templates
 * 7. Corkboard layout positions
 * 8. Active view snapshot restoration
 * 9. Characters and locations
 * 10. Extra source folder scanning
 * 11. Codex categories and inherited resources
 * 12. Canonical events
 * 13. LinkScanner indexing
 * 14. Writing tracker initialization
 * 15. Writing stats autosave scheduling
 * 16. Open view refresh
 *
 * Dependencies are strictly sequential — settings must load before services,
 * project discovery before resources, codex before link scanning, etc.
 */

import type { SceneManager } from './SceneManager';
import type { LocationManager } from './LocationManager';
import type { CharacterManager } from './CharacterManager';
import type { CodexManager } from './CodexManager';
import type { ViewSnapshotService } from './ViewSnapshotService';
import type { LinkScanner } from './LinkScanner';
import type { FieldTemplateService } from './FieldTemplateService';
import type { UniverseManager } from './UniverseManager';
import type { EventManager } from './EventManager';
import type { WritingTracker } from './WritingTracker';
import { makeCustomCodexCategory } from '../models/Codex';

/**
 * Narrow interface for the plugin instance required during startup.
 *
 * Avoids importing the full {@link SceneCardsPlugin} class, preventing
 * circular dependencies with service modules.
 */
export interface StartupTarget {
    /** Apply frontmatter visibility settings to open leaves. */
    updateFrontmatterVisibility(): void;
    /** Apply toolbar visibility settings. */
    updateToolbarVisibility(): void;

    /** Core scene manager. */
    sceneManager: SceneManager;
    /** Character manager. */
    characterManager: CharacterManager;
    /** Location manager. */
    locationManager: LocationManager;
    /** Codex manager. */
    codexManager: CodexManager;
    /** View snapshot service. */
    viewSnapshotService: ViewSnapshotService;
    /** Link scanner for wikilink discovery. */
    linkScanner: LinkScanner;
    /** Field template service. */
    fieldTemplates: FieldTemplateService;
    /** Universe hierarchy manager. */
    universeManager: UniverseManager;
    /** Event manager. */
    eventManager: EventManager;
    /** Writing session tracker. */
    writingTracker: WritingTracker;

    /** Current plugin settings. */
    settings: StartupSettings;

    /** Refresh all open StoryLine views. */
    refreshOpenViews(): void;
    /** Schedule periodic writing stats autosave. */
    scheduleWritingStatsSave(immediate?: boolean): void;

    /** Bootstrap project discovery and selection. */
    bootstrapProjects(): Promise<void>;
    /** Migrate legacy data from data.json to project frontmatter. */
    migrateProjectDataFromSettings(): Promise<void>;
    /** Load per-project System/ data into settings. */
    loadProjectSystemData(): Promise<void>;
    /** Load characters and locations for the active project. */
    loadActiveProjectEntities(): Promise<void>;
    /** Scan extra source folders configured by the user. */
    scanExtraFolders(): Promise<void>;
    /** Load events for the active project. */
    loadActiveProjectEvents(): Promise<void>;
}

/**
 * Subset of settings required during startup.
 */
interface StartupSettings {
    codexEnabledCategories?: string[];
    codexCustomCategories?: Array<{ id: string; label: string; icon: string }>;
    characterAliases?: Record<string, string>;
}

/**
 * Execute the full startup sequence after the workspace layout is ready.
 *
 * Must be called once during {@link SceneCardsPlugin.onLayoutReady} after
 * all services are initialized and registered.
 *
 * @param target - Narrow plugin interface providing services and settings.
 * @returns Whether the full sequence finished; a failed startup must not schedule autosave.
 */
export async function runStartupSequence(target: StartupTarget): Promise<boolean> {
    try {
        // Phase 1: UI visibility
        applyUiVisibility(target);

        // Phase 2: Project bootstrap
        await bootstrapProjectPhase(target);

        // Phase 3: Resource loading
        await loadResourcesPhase(target);

        // Phase 4: Writing session
        initializeWritingSession(target);

        // Phase 5: Final refresh
        target.refreshOpenViews();
        return true;
    } catch (startupErr) {
        console.error('[StoryLine] Startup sequence failed:', startupErr);
        return false;
    }
}

/**
 * Apply frontmatter and toolbar visibility settings.
 */
function applyUiVisibility(target: StartupTarget): void {
    target.updateFrontmatterVisibility();
    target.updateToolbarVisibility();
}

/**
 * Discover projects, initialize scenes, and migrate legacy data.
 *
 * Order: bootstrap → scene init → migration → system data → field templates
 * → corkboard → view snapshot.
 */
async function bootstrapProjectPhase(target: StartupTarget): Promise<void> {
    await target.bootstrapProjects();

    // Re-initialize scene index now that the active project is set.
    // Views that opened before bootstrapProjects may have scanned a
    // fallback folder and found no scenes.
    await target.sceneManager.initialize(true);

    // Migrate legacy data from data.json into project frontmatter
    await target.migrateProjectDataFromSettings();

    // Load per-project data from System/ files (tagColors, aliases, etc.)
    await target.loadProjectSystemData();

    // Load universal field templates from System/field-templates.json
    await target.fieldTemplates.load();

    // Load corkboard layout from System/board.json
    await target.sceneManager.loadCorkboardPositions();

    // Load active view snapshot state
    await target.viewSnapshotService.loadActiveState();
}

/**
 * Load all project-scoped resources: entities, codex, events, and links.
 *
 * Order: entities → extra folders → codex → events → link scan.
 * Codex must load before LinkScanner so entity links are resolved.
 */
async function loadResourcesPhase(target: StartupTarget): Promise<void> {
    // Load locations and characters for the active project
    await loadEntitiesSafe(target);

    // Scan extra source folders and route by frontmatter type
    await scanExtraFoldersSafe(target);

    // Load and initialize codex (must be before LinkScanner.scanAll)
    await loadCodexSafe(target);

    // Load Events for the active project
    await loadEventsSafe(target);

    // Scan scene bodies for wikilinks after entities are fully loaded
    // Issue #271 fix: explicitly re-scan to ensure link discovery works on reload
    await rescanLinks(target);
}

/**
 * Initialize the writing tracker and schedule periodic autosave.
 */
function initializeWritingSession(target: StartupTarget): void {
    const stats = target.sceneManager.queryService.getStatistics();
    target.writingTracker.startSession(stats.totalWords);

    // Issue #238 — periodic autosave of writing stats so a crash or
    // force-quit no longer loses the whole session. A debounced save
    // runs 60s after the last scene change, and a safety-net interval
    // flushes+persists every 5 minutes regardless of activity.
    target.scheduleWritingStatsSave();
}

/**
 * Load characters and locations, catching and logging errors.
 */
async function loadEntitiesSafe(target: StartupTarget): Promise<void> {
    try {
        await target.loadActiveProjectEntities();
    } catch (e) {
        console.error('[StoryLine] Failed to load active project entities:', e);
    }
}

/**
 * Scan extra source folders, catching and logging errors.
 */
async function scanExtraFoldersSafe(target: StartupTarget): Promise<void> {
    try {
        await target.scanExtraFolders();
    } catch (e) {
        console.error('[StoryLine] Failed to scan extra folders:', e);
    }
}

/**
 * Load codex categories and inherited resources, catching and logging errors.
 */
async function loadCodexSafe(target: StartupTarget): Promise<void> {
    try {
        const codexFolder = target.sceneManager.getCodexFolder();
        if (!codexFolder) return;

        const customDefs = (target.settings.codexCustomCategories || []).map(
            (cc) => makeCustomCodexCategory(cc.id, cc.label, cc.icon)
        );
        target.codexManager.initCategories(
            target.settings.codexEnabledCategories || [],
            customDefs
        );
        await target.codexManager.loadAll(codexFolder);

        // Failure to load optional inherited resources must not suppress
        // local Codex data or prevent subsequent Event and link loading.
        await loadInheritedCodexSafe(target);
    } catch (e) {
        console.error('[StoryLine] Failed to load codex:', e);
    }
}

/**
 * Load optional Universe/Series Codex inheritance without failing startup.
 * Local Codex data remains usable when inheritance is unavailable.
 */
async function loadInheritedCodexSafe(target: StartupTarget): Promise<void> {
    const project = target.sceneManager.activeProject;
    if (!project) return;
    try {
        const folders = await target.universeManager.getInheritedCodexFolders(project);
        if (folders.length > 0) await target.codexManager.loadInheritedFolders(folders);
    } catch (e) {
        console.warn('[StoryLine] Could not load inherited Codex resources:', e);
    }
}

/**
 * Load events for the active project, catching and logging errors.
 */
async function loadEventsSafe(target: StartupTarget): Promise<void> {
    try {
        await target.loadActiveProjectEvents();
    } catch (e) {
        console.error('[StoryLine] Failed to load events:', e);
    }
}

/**
 * Re-scan all scenes for wikilinks after entities are loaded.
 */
async function rescanLinks(target: StartupTarget): Promise<void> {
    target.linkScanner.invalidateAll();
    target.linkScanner.rebuildLookups(target.settings.characterAliases);
    await target.linkScanner.scanAllAsync(target.sceneManager.getAllScenes());
}
