/**
 * Initializes all StoryLine services and wires their dependencies.
 *
 * Extracted from {@link SceneCardsPlugin.onload} to keep the composition
 * root small. Services are constructed in dependency order:
 *
 * 1. Core managers (Scene, Character, Location, Codex)
 * 2. Cross-cutting services (LinkScanner, CascadeRename, FieldTemplates)
 * 3. Hierarchy managers (Series, Universe)
 * 4. Timeline services (TimeSpan, Event, Navigation)
 * 5. Auxiliary services (Research, Snapshot, ViewSnapshot)
 *
 * Callers must assign the returned services to the plugin instance properties
 * before invoking any service methods.
 */

import { App } from 'obsidian';
import { SceneManager } from './SceneManager';
import { LocationManager } from './LocationManager';
import { CharacterManager } from './CharacterManager';
import { CodexManager } from './CodexManager';
import { SnapshotManager } from './SnapshotManager';
import { ViewSnapshotService } from './ViewSnapshotService';
import { LinkScanner } from './LinkScanner';
import { CascadeRenameService } from './CascadeRenameService';
import { FieldTemplateService } from './FieldTemplateService';
import { setActiveTemplatesProvider, setTopLevelMirrorEnabled, type FieldTemplateChange } from './FieldTemplateService';
import { SeriesManager } from './SeriesManager';
import { UniverseManager } from './UniverseManager';
import { TimeSpanService } from './TimeSpanService';
import { EventManager } from './EventManager';
import { TimelineNavigationService } from './TimelineNavigationService';
import { ResearchManager } from './ResearchManager';

/**
 * Narrow interface for the plugin instance required during service
 * initialization. Avoids importing the full {@link SceneCardsPlugin}
 * class, preventing circular dependencies.
 */
interface ServiceInitPlugin {
    app: App;
    settings: {
        defaultProjectLanguage?: string;
        universalFieldsMirrorTopLevel?: boolean;
    };
    /** Called after undo/redo to re-index and refresh views. */
    refreshOpenViews: () => void;
    /** Returns the System/ folder path for the active project. */
    getProjectSystemFolder: () => string;
    /** Migrates universal field mirror when templates change. */
    migrateUniversalFieldMirror: (change: FieldTemplateChange) => Promise<void>;
}

/**
 * All services required by StoryLine, constructed in dependency order.
 */
export interface ServiceBag {
    sceneManager: SceneManager;
    locationManager: LocationManager;
    characterManager: CharacterManager;
    codexManager: CodexManager;
    snapshotManager: SnapshotManager;
    viewSnapshotService: ViewSnapshotService;
    linkScanner: LinkScanner;
    cascadeRename: CascadeRenameService;
    fieldTemplates: FieldTemplateService;
    seriesManager: SeriesManager;
    universeManager: UniverseManager;
    timeSpanService: TimeSpanService;
    eventManager: EventManager;
    timelineNavigationService: TimelineNavigationService;
    researchManager: ResearchManager;
}

/**
 * Creates all StoryLine services and wires their cross-dependencies.
 *
 * The caller (typically {@link SceneCardsPlugin.onload}) must assign
 * each service to the corresponding plugin property after this call.
 *
 * @param plugin - Narrow plugin interface providing app, settings, and callbacks.
 * @returns A bag of fully constructed and wired services.
 */
export function createServices(plugin: ServiceInitPlugin): ServiceBag {
    const { app } = plugin;

    // 1. Core managers
    const sceneManager = new SceneManager(app, plugin as unknown as import('../main').default);
    const locationManager = new LocationManager(app);
    const characterManager = new CharacterManager(app);
    const codexManager = new CodexManager(app);

    // 2. Snapshot services
    const snapshotManager = new SnapshotManager(
        app,
        () => sceneManager?.getEffectiveLocale()
            ?? plugin.settings.defaultProjectLanguage
            ?? 'en',
    );
    const viewSnapshotService = new ViewSnapshotService(plugin as unknown as import('../main').default);

    // 3. Cross-cutting services
    const linkScanner = new LinkScanner(characterManager, locationManager);
    linkScanner.setCodexManager(codexManager);
    linkScanner.setSceneProvider(() => sceneManager.getAllScenes());

    const cascadeRename = new CascadeRenameService(app, sceneManager, characterManager, locationManager);

    // 4. Field templates (Issue #71 — top-level YAML mirroring)
    const fieldTemplates = new FieldTemplateService(app, () => plugin.getProjectSystemFolder());
    setActiveTemplatesProvider(() => fieldTemplates.getAll());
    setTopLevelMirrorEnabled(plugin.settings.universalFieldsMirrorTopLevel !== false);
    fieldTemplates.setOnChange(async (change) => {
        await plugin.migrateUniversalFieldMirror(change);
    });

    // 5. Hierarchy managers
    const seriesManager = new SeriesManager(app, plugin as unknown as import('../main').default);
    const universeManager = new UniverseManager(app, plugin as unknown as import('../main').default);

    // 6. Timeline services
    const timeSpanService = new TimeSpanService();
    const eventManager = new EventManager(app);
    eventManager.setTimeSpanService(timeSpanService);
    const timelineNavigationService = new TimelineNavigationService(timeSpanService);

    // 7. Auxiliary services
    const researchManager = new ResearchManager(app, plugin as unknown as import('../main').default);

    return {
        sceneManager,
        locationManager,
        characterManager,
        codexManager,
        snapshotManager,
        viewSnapshotService,
        linkScanner,
        cascadeRename,
        fieldTemplates,
        seriesManager,
        universeManager,
        timeSpanService,
        eventManager,
        timelineNavigationService,
        researchManager,
    };
}

/**
 * Wires post-construction callbacks that depend on service relationships.
 *
 * Must be called after services are assigned to the plugin instance.
 *
 * @param sceneManager - The initialized scene manager.
 * @param refreshOpenViews - Callback to refresh all open views after undo/redo.
 */
/* eslint-disable @typescript-eslint/no-misused-promises -- undoManager callback is invoked asynchronously by the undo manager */
export function wireServiceCallbacks(
    sceneManager: SceneManager,
    refreshOpenViews: () => void,
): void {
    // Wire undo/redo to refresh views and re-index
    sceneManager.undoManager.onAfterUndoRedo = async () => {
        await sceneManager.initialize();
        refreshOpenViews();
    };
}
/* eslint-enable @typescript-eslint/no-misused-promises -- undoManager callback is invoked asynchronously by the undo manager */
