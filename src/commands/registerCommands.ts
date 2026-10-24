/* eslint-disable @typescript-eslint/no-floating-promises -- Command callbacks fire-and-forget; Obsidian handles errors */
/* eslint-disable @typescript-eslint/no-misused-promises -- Obsidian checkCallback may be async */
/**
 * Registers all Obsidian command-palette commands for StoryLine.
 *
 * Centralizes command definitions so that {@link SceneCardsPlugin} remains
 * a small composition root. Preserves existing command IDs and behavior.
 */

import { App, FuzzySuggestModal, Notice } from 'obsidian';
import {
    BOARD_VIEW_TYPE, TIMELINE_VIEW_TYPE, PLOTGRID_VIEW_TYPE,
    STORYLINE_VIEW_TYPE, CHARACTER_VIEW_TYPE, STATS_VIEW_TYPE,
    LOCATION_VIEW_TYPE, CODEX_VIEW_TYPE, UNIVERSE_VIEW_TYPE,
} from '../constants';
import { SceneFilenameSyncModal } from '../components/SceneFilenameSyncModal';
import { ExportModal } from '../components/ExportModal';
import { openManageSnapshotsModal } from '../components/ViewSnapshotModal';
import type { StoryLineProject } from '../models/StoryLineProject';
import type { PluginTarget } from './plugin-target';

/**
 * Entry point: registers every command-palette entry on the plugin instance.
 * Must be called once during {@link SceneCardsPlugin.onload}.
 */
export function registerCommands(p: PluginTarget): void {
    registerViewCommands(p);
    registerSceneCommands(p);
    registerProjectCommands(p);
    registerUndoRedoCommands(p);
    registerExportCommands(p);
    registerSidebarCommands(p);
    registerSeriesCommands(p);
    registerUniverseCommands(p);
    registerEventCommands(p);
    registerMiscCommands(p);
}

/** Commands that open a specific StoryLine view. */
function registerViewCommands(p: PluginTarget): void {
    p.addCommand({ id: 'open-board-view', name: 'Open board view', callback: () => p.activateView(BOARD_VIEW_TYPE) });
    p.addCommand({ id: 'open-timeline-view', name: 'Open timeline view', callback: () => p.activateView(TIMELINE_VIEW_TYPE) });
    p.addCommand({ id: 'open-plotgrid-view', name: 'Open plotgrid view', callback: () => p.activateView(PLOTGRID_VIEW_TYPE) });
    p.addCommand({ id: 'open-plotlines-view', name: 'Open plotlines view', callback: () => p.activateView(STORYLINE_VIEW_TYPE) });
    p.addCommand({ id: 'open-character-view', name: 'Open character view', callback: () => p.activateView(CHARACTER_VIEW_TYPE) });
    p.addCommand({ id: 'open-stats-view', name: 'Open statistics dashboard', callback: () => p.activateView(STATS_VIEW_TYPE) });
    p.addCommand({ id: 'open-location-view', name: 'Open location view', callback: () => p.activateView(LOCATION_VIEW_TYPE) });
    p.addCommand({ id: 'open-codex-view', name: 'Open codex', callback: () => p.activateView(CODEX_VIEW_TYPE) });
    p.addCommand({ id: 'open-universe-view', name: 'Open project library', callback: () => p.activateView(UNIVERSE_VIEW_TYPE) });
}

/** Commands related to scene creation and manipulation. */
function registerSceneCommands(p: PluginTarget): void {
    p.addCommand({ id: 'create-new-scene', name: 'Create new scene', callback: () => p.openQuickAdd() });
    p.addCommand({
        id: 'synchronize-scene-filenames',
        name: 'Synchronize scene filenames from metadata',
        checkCallback: (checking: boolean) => {
            if (!p.sceneManager.activeProject) return false;
            if (!checking) {
                const changes = p.sceneManager.getSceneFilenameSyncPreview();
                if (changes.length === 0) {
                    new Notice('Scene filenames are already synchronized.');
                    return true;
                }
                new SceneFilenameSyncModal(p.app, changes, async () => {
                    const count = await p.sceneManager.synchronizeSceneFileNames();
                    p.refreshOpenViews();
                    new Notice(`Synchronized ${count} scene filename${count === 1 ? '' : 's'}.`);
                }).open();
            }
            return true;
        },
    });
}

/** Project lifecycle commands: create, switch, fork, delete, rename. */
function registerProjectCommands(p: PluginTarget): void {
    p.addCommand({ id: 'create-new-project', name: 'Create new project', callback: async () => { await p.openNewProjectModal(); } });
    p.addCommand({ id: 'fork-project', name: 'Fork current project', callback: () => p.openForkProjectModal() });
    p.addCommand({ id: 'delete-project', name: 'Delete current project', callback: () => p.openDeleteProjectModal() });
    p.addCommand({ id: 'rename-project', name: 'Rename current project', callback: () => p.openRenameProjectModal() });
    p.addCommand({
        id: 'switch-project',
        name: 'Open or switch project',
        callback: () => {
            const projects = p.sceneManager.getProjects();
            if (projects.length <= 1) {
                new Notice(projects.length === 0 ? 'No projects found.' : 'Only one project exists.');
                return;
            }
            new ProjectSwitcherModal(p.app, projects, async (project) => {
                await p.sceneManager.setActiveProject(project);
                p.refreshOpenViews();
                new Notice(`Switched to "${project.title}"`);
            }).open();
        },
    });
}

/** Undo and redo commands for scene changes. */
function registerUndoRedoCommands(p: PluginTarget): void {
    p.addCommand({ id: 'undo', name: 'Undo last scene change', callback: async () => { await p.sceneManager.undoManager.undo(); } });
    p.addCommand({ id: 'redo', name: 'Redo last scene change', callback: async () => { await p.sceneManager.undoManager.redo(); } });
}

/** Export-related commands. */
function registerExportCommands(p: PluginTarget): void {
    p.addCommand({ id: 'export-project', name: 'Export project', callback: () => {
        // ExportModal requires SceneCardsPlugin; PluginTarget is a verified subset
        new ExportModal(p as unknown as import('../main').default).open();
    }});
}

/** Commands that open sidebar panels. */
function registerSidebarCommands(p: PluginTarget): void {
    p.addCommand({ id: 'open-help', name: 'Open help', callback: () => p.openHelp() });
    p.addCommand({ id: 'open-navigator', name: 'Open navigator', callback: () => p.openNavigator() });
    p.addCommand({ id: 'open-scene-inspector', name: 'Open scene details sidebar', callback: () => p.openSceneInspector() });
    p.addCommand({ id: 'open-scene-notes', name: 'Open scene notes sidebar', callback: () => p.openNotesView() });
    p.addCommand({ id: 'open-scene-synopsis', name: 'Open scene synopsis sidebar', callback: () => p.openSynopsisView() });
    p.addCommand({ id: 'open-scene-details-view', name: 'Open scene details in own pane', callback: () => p.openSceneDetailsLeaf() });
    p.addCommand({ id: 'open-research', name: 'Open research sidebar', callback: () => p.openResearch() });
    p.addCommand({
        id: 'open-scene-notes-file',
        name: 'Open scene notes as file',
        checkCallback: (checking: boolean) => {
            const scene = p.sceneManager.getScene(p.app.workspace.getActiveFile()?.path ?? '');
            if (!scene) return false;
            if (!checking) p.sceneManager.openSceneNotes(scene);
            return true;
        },
    });
}

/** Series management commands. */
function registerSeriesCommands(p: PluginTarget): void {
    p.addCommand({ id: 'create-series', name: 'Create new series from current project', callback: () => p.openCreateSeriesModal() });
    p.addCommand({ id: 'add-to-series', name: 'Add current project to existing series', callback: () => p.openAddToSeriesModal() });
    p.addCommand({
        id: 'remove-from-series',
        name: 'Remove current project from series',
        callback: async () => {
            const project = p.sceneManager.activeProject;
            if (!project?.seriesId && !project?.seriesUuid) {
                new Notice('This project is not part of a series.');
                return;
            }
            try {
                await p.seriesManager.removeProjectFromSeries();
                p.refreshOpenViews();
            } catch (e: unknown) {
                new Notice((e instanceof Error ? e.message : String(e)), 10000);
            }
        },
    });
}

/** Universe management commands. */
function registerUniverseCommands(p: PluginTarget): void {
    p.addCommand({ id: 'create-universe', name: 'Create new universe', callback: () => p.openCreateUniverseModal() });
    p.addCommand({ id: 'add-series-to-universe', name: 'Add series to universe', callback: () => p.openAddSeriesToUniverseModal() });
    p.addCommand({ id: 'remove-series-from-universe', name: 'Remove series from universe', callback: () => p.openRemoveSeriesFromUniverseModal() });
    p.addCommand({ id: 'delete-universe', name: 'Delete universe', callback: () => p.openDeleteUniverseModal() });
}

/** Event management commands. */
function registerEventCommands(p: PluginTarget): void {
    p.addCommand({
        id: 'create-event', name: 'Create new event',
        checkCallback: (checking: boolean) => {
            if (!p.sceneManager.activeProject) return false;
            if (checking) return true;
            p.openCreateEventModal();
            return true;
        },
    });
    p.addCommand({
        id: 'browse-events', name: 'Browse events',
        checkCallback: (checking: boolean) => {
            if (!p.sceneManager.activeProject) return false;
            if (checking) return true;
            p.openEventBrowser();
            return true;
        },
    });
}

import { canImportScrivener } from './scrivener-availability';

/** Miscellaneous commands: snapshots, Scrivener import, convert note. */
function registerMiscCommands(p: PluginTarget): void {
    p.addCommand({
        id: 'manage-view-snapshots', name: 'Manage view snapshots',
        callback: () => {
            if (!p.sceneManager.activeProject) { new Notice('No active project.'); return; }
            openManageSnapshotsModal(p.app, p.viewSnapshotService as import('../services/ViewSnapshotService').ViewSnapshotService);
        },
    });
    p.addCommand({
        id: 'import-scrivener', name: 'Import Scrivener project',
        checkCallback: (checking: boolean) => canImportScrivener(p, checking),
    });
    p.addCommand({
        id: 'convert-note-to-scene', name: 'Convert note to scene',
        checkCallback: (checking: boolean) => {
            const file = p.app.workspace.getActiveFile();
            if (!file || file.extension !== 'md') return false;
            if (!p.sceneManager.activeProject) return false;
            if (checking) return true;
            p.sceneManager.convertFileToScene(file.path).then(newPath => { if (newPath) p.refreshOpenViews(); });
            return true;
        },
    });
}

/**
 * Fuzzy-search modal for quick project switching from the command palette.
 */
class ProjectSwitcherModal extends FuzzySuggestModal<StoryLineProject> {
    private projects: StoryLineProject[];
    private onChoose: (project: StoryLineProject) => void;

    constructor(app: App, projects: StoryLineProject[], onChoose: (project: StoryLineProject) => void) {
        super(app);
        this.projects = projects;
        this.onChoose = onChoose;
        this.setPlaceholder('Switch to project…');
    }
    getItems(): StoryLineProject[] { return this.projects; }
    getItemText(project: StoryLineProject): string {
        return project.title + (project.seriesId || project.seriesUuid ? ` [${project.seriesId ?? project.seriesUuid}]` : '');
    }
    onChooseItem(project: StoryLineProject): void { this.onChoose(project); }
}

/* eslint-enable @typescript-eslint/no-floating-promises -- Obsidian command callbacks fire-and-forget */
/* eslint-enable @typescript-eslint/no-misused-promises -- Obsidian checkCallback may be async */
