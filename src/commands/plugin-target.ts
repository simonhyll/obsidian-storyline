/**
 * Minimal interface describing the plugin methods required by command
 * and event registration modules.
 *
 * This avoids circular imports while keeping registration functions
 * loosely coupled to the concrete {@link SceneCardsPlugin} class.
 */

import { App, TFile, WorkspaceLeaf } from 'obsidian';
import type { StoryLineProject } from '../models/StoryLineProject';

/** Subset of SceneCardsPlugin required by command and event registration. */
export interface PluginTarget {
    app: App;
    addCommand(options: { id: string; name: string; callback?: () => void | Promise<void>; checkCallback?: (checking: boolean) => boolean }): void;
    registerDomEvent(el: HTMLElement | Document | Window, event: string, callback: (...args: unknown[]) => void): void;
    registerEvent(disposer: unknown): void;
    activateView(viewType: string): Promise<void>;
    openQuickAdd(): void;
    openHelp(): Promise<void>;
    openNavigator(): Promise<void>;
    openSceneInspector(): Promise<void>;
    openNotesView(): Promise<void>;
    openSynopsisView(): Promise<void>;
    openSceneDetailsLeaf(): Promise<void>;
    openResearch(): Promise<void>;
    openCreateEventModal(eventsFolder?: string, prefillTimestamp?: unknown): Promise<void>;
    openEventBrowser(): Promise<void>;
    openNewProjectModal(): Promise<StoryLineProject | null>;
    openForkProjectModal(): void;
    openDeleteProjectModal(): void;
    openCreateSeriesModal(): void;
    openAddToSeriesModal(): Promise<void>;
    openRenameProjectModal(): void;
    openCreateUniverseModal(): Promise<void>;
    openAddSeriesToUniverseModal(): Promise<void>;
    openRemoveSeriesFromUniverseModal(): Promise<void>;
    openDeleteUniverseModal(): Promise<void>;
    refreshOpenViews(reloadScenes?: boolean, changedPaths?: string[]): Promise<void>;
    showEntityDetails(filePath: string): Promise<void>;
    resolveEntityType(filePath: string): 'character' | 'location' | 'codex' | null;
    updatePlotGridLinkedSceneIds(oldPath: string, newPath: string): Promise<void>;
    sceneManager: PluginTargetSceneManager;
    getProjectSystemFolder(): string;
    scheduleWritingStatsSave(): void;
    isRelevantStoryLineFile(filePath: string): boolean;
    debounce<T extends (...args: unknown[]) => unknown>(fn: T, time: number): T;
    settings: {
        showFormattingToolbar: boolean;
        autoOpenNavigator?: boolean;
        storyLineRoot: string;
    };
    injectFormattingToolbar(leaf: WorkspaceLeaf | null): void;
    updateFrontmatterVisibility(): void;
}

/** Subset of SceneManager required by registration modules. */
export interface PluginTargetSceneManager {
    activeProject: StoryLineProject | null | undefined;
    getSceneFilenameSyncPreview(): Array<{ currentPath: string; newPath: string }>;
    synchronizeSceneFileNames(): Promise<number>;
    getProjects(): StoryLineProject[];
    setActiveProject(project: StoryLineProject): Promise<void>;
    getScene(path: string): unknown;
    openSceneNotes(scene: unknown): void;
    convertFileToScene(path: string): Promise<string | null>;
    undoManager: { undo(): Promise<boolean>; redo(): Promise<boolean> };
    handleFileChange(file: TFile): Promise<void>;
    handleFileDelete(path: string): void;
    handleFileRename(file: TFile, oldPath: string): Promise<void>;
    scanProjects(): Promise<StoryLineProject[]>;
}
