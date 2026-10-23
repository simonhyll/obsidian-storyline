/* eslint-disable @typescript-eslint/no-floating-promises -- Vault event handlers fire-and-forget; Obsidian handles errors */
/**
 * Registers vault and workspace event listeners for StoryLine.
 *
 * Covers file create/modify/delete/rename, context menu items,
 * undo/redo keyboard shortcuts, and entity detail commands.
 */

import { ItemView, TFile } from 'obsidian';
import {
    BOARD_VIEW_TYPE, PLOTGRID_VIEW_TYPE, TIMELINE_VIEW_TYPE,
    STORYLINE_VIEW_TYPE, CHARACTER_VIEW_TYPE, STATS_VIEW_TYPE,
    LOCATION_VIEW_TYPE, CODEX_VIEW_TYPE, SCENE_INSPECTOR_VIEW_TYPE,
    NOTES_VIEW_TYPE, SYNOPSIS_VIEW_TYPE, DETAILS_VIEW_TYPE,
    MANUSCRIPT_VIEW_TYPE, RESEARCH_VIEW_TYPE, HELP_VIEW_TYPE,
    NAVIGATOR_VIEW_TYPE,
} from '../constants';
import type { PluginTarget } from './plugin-target';

/**
 * Registers all vault and workspace event listeners on the plugin instance.
 * Must be called once during {@link SceneCardsPlugin.onload}.
 */
export function registerEvents(p: PluginTarget): void {
    registerVaultEvents(p);
    registerUndoRedoKeys(p);
    registerFileMenuCommands(p);
    registerEntityDetailsCommand(p);
}

/** Vault create/modify/delete/rename listeners. */
function registerVaultEvents(p: PluginTarget): void {
    const debouncedRefresh = p.debounce(() => p.refreshOpenViews(true), 500);
    const modifiedPaths = new Set<string>();
    const debouncedIncremental = p.debounce(() => {
        const paths = Array.from(modifiedPaths);
        modifiedPaths.clear();
        void p.refreshOpenViews(false, paths);
    }, 500);

    p.registerEvent(p.app.vault.on('create', (file) => {
        if (file instanceof TFile && p.isRelevantStoryLineFile(file.path)) debouncedRefresh();
    }));

    p.registerEvent(p.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || !p.isRelevantStoryLineFile(file.path)) return;
        p.sceneManager.handleFileChange(file).then(() => {
            modifiedPaths.add(file.path);
            debouncedIncremental();
        });
        const sysFolder = p.getProjectSystemFolder();
        const isSystem = file.path === sysFolder || file.path.startsWith(sysFolder + '/');
        if (!isSystem) p.scheduleWritingStatsSave();
    }));

    p.registerEvent(p.app.vault.on('delete', (file) => {
        if (!(file instanceof TFile) || !p.isRelevantStoryLineFile(file.path)) return;
        p.sceneManager.handleFileDelete(file.path);
        debouncedRefresh();
    }));

    p.registerEvent(p.app.vault.on('rename', (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        if (!p.isRelevantStoryLineFile(file.path) && !p.isRelevantStoryLineFile(oldPath)) return;
        p.sceneManager.handleFileRename(file, oldPath).then(async () => {
            await p.updatePlotGridLinkedSceneIds(oldPath, file.path);
            debouncedRefresh();
        });
    }));
}

/**
 * Global keydown handler routing Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y to
 * StoryLine's undo/redo when a StoryLine view is active.
 */
function registerUndoRedoKeys(p: PluginTarget): void {
    const slViewTypes = new Set([
        BOARD_VIEW_TYPE, PLOTGRID_VIEW_TYPE, TIMELINE_VIEW_TYPE,
        STORYLINE_VIEW_TYPE, CHARACTER_VIEW_TYPE, STATS_VIEW_TYPE,
        LOCATION_VIEW_TYPE, CODEX_VIEW_TYPE, SCENE_INSPECTOR_VIEW_TYPE,
        NOTES_VIEW_TYPE, SYNOPSIS_VIEW_TYPE, DETAILS_VIEW_TYPE,
        MANUSCRIPT_VIEW_TYPE, RESEARCH_VIEW_TYPE, HELP_VIEW_TYPE,
        NAVIGATOR_VIEW_TYPE,
    ]);

    p.registerDomEvent(activeDocument, 'keydown', (evt: KeyboardEvent) => {
        const action = parseUndoRedoKey(evt);
        if (action === 'none') return;
        if (isInInputField(activeDocument)) return;
        if (!isStoryLineViewActive(p, slViewTypes)) return;
        evt.preventDefault();
        evt.stopPropagation();
        if (action === 'undo') void p.sceneManager.undoManager.undo();
        else void p.sceneManager.undoManager.redo();
    });
}

/** Parse keyboard shortcut and return 'undo', 'redo', or 'none'. */
function parseUndoRedoKey(evt: KeyboardEvent): string {
    const mod = evt.ctrlKey || evt.metaKey;
    if (!mod) return 'none';
    if (!evt.shiftKey && evt.key === 'z') return 'undo';
    if (evt.shiftKey && evt.key === 'Z') return 'redo';
    if (evt.key === 'y') return 'redo';
    return 'none';
}

/** Returns true if focus is inside a text input element. */
function isInInputField(doc: Document): boolean {
    const active = doc.activeElement;
    if (!active) return false;
    // Compare tag names instead of instanceof: pop-out windows have different DOM realms.
    if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;
    return (active as HTMLElement).isContentEditable === true;
}

/** Returns true if a StoryLine view is currently active. */
function isStoryLineViewActive(p: PluginTarget, viewTypes: Set<string>): boolean {
    const view = p.app.workspace.getActiveViewOfType(ItemView);
    if (!view) return false;
    const vt: string = view.getViewType();
    return typeof vt === 'string' && viewTypes.has(vt);
}

/** File and editor context menu items. */
function registerFileMenuCommands(p: PluginTarget): void {
    // "Convert to scene" in file context menu
    p.registerEvent(p.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        if (!p.sceneManager.activeProject) return;
        const existing = p.sceneManager.getScene(file.path);
        if (existing && (existing as { type?: string }).type === 'scene'
            && !(existing as { corkboardNote?: boolean }).corkboardNote) return;
        menu.addItem(item => {
            item.setTitle('Convert to scene').setIcon('clapperboard')
                .onClick(async () => {
                    const newPath = await p.sceneManager.convertFileToScene(file.path);
                    if (newPath) p.refreshOpenViews();
                });
        });
    }));

    // "Show in StoryLine" in file context menu
    p.registerEvent(p.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile)) return;
        if (!p.resolveEntityType(file.path)) return;
        menu.addItem(item => {
            item.setTitle('Show in StoryLine').setIcon('book-open')
                .onClick(() => p.showEntityDetails(file.path));
        });
    }));

    // "Show in StoryLine" in editor context menu
    p.registerEvent(p.app.workspace.on('editor-menu', (menu, _editor, info) => {
        const file = info.file;
        if (!file || !p.resolveEntityType(file.path)) return;
        menu.addItem(item => {
            item.setTitle('Show in StoryLine').setIcon('book-open')
                .onClick(() => p.showEntityDetails(file.path));
        });
    }));

    // "Find & replace in manuscript" in editor menu
    p.registerEvent(p.app.workspace.on('editor-menu', (menu) => {
        const view = p.app.workspace.getActiveViewOfType(ItemView);
        const vt = (view as unknown as { getViewType?: () => string })?.getViewType?.();
        if (vt !== MANUSCRIPT_VIEW_TYPE) return;
        menu.addItem(item => {
            item.setTitle('Find & replace in manuscript').setIcon('search')
                .onClick(() => {
                    const leaves = p.app.workspace.getLeavesOfType(MANUSCRIPT_VIEW_TYPE);
                    const mv = leaves[0]?.view as unknown as { toggleSearch?: () => void };
                    mv?.toggleSearch?.();
                });
        });
    }));
}

/** "Show in details view" command palette entry. */
function registerEntityDetailsCommand(p: PluginTarget): void {
    p.addCommand({
        id: 'show-entity-details',
        name: 'Show in details view',
        checkCallback: (checking) => {
            const file = p.app.workspace.getActiveFile();
            if (!file || !p.resolveEntityType(file.path)) return false;
            if (!checking) p.showEntityDetails(file.path);
            return true;
        },
    });
}

/* eslint-enable @typescript-eslint/no-floating-promises -- Vault event handlers fire-and-forget */
