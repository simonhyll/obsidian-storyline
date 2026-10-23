/**
 * Registers the active-leaf-change handler and frontmatter visibility
 * listeners for StoryLine.
 *
 * When a markdown leaf becomes active and the file is a StoryLine scene,
 * this module injects the formatting toolbar (if enabled) and updates
 * the frontmatter visibility. On layout and file-open events it re-applies
 * the frontmatter hiding to all open leaves.
 */

import { TFile } from 'obsidian';
import type { PluginTarget } from './plugin-target';

/**
 * Registers leaf-change and frontmatter visibility listeners.
 * Must be called once during {@link SceneCardsPlugin.onload}.
 */
export function registerLeafChange(p: PluginTarget): void {
    p.registerEvent(p.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf && !isStoryLineScene(leaf, p)) {
            if (!p.settings.showFormattingToolbar) {
                activeDocument.querySelectorAll<HTMLElement>('.sl-injected-fmt-toolbar')
                    .forEach((el: HTMLElement) => el.remove());
            }
            return;
        }
        p.injectFormattingToolbar(leaf);
        p.updateFrontmatterVisibility();
    }));

    p.registerEvent(p.app.workspace.on('layout-change', () => {
        p.updateFrontmatterVisibility();
    }));
    p.registerEvent(p.app.workspace.on('file-open', () => {
        p.updateFrontmatterVisibility();
    }));
}

/** Returns true if the active leaf is editing a StoryLine scene file. */
function isStoryLineScene(leaf: import('obsidian').WorkspaceLeaf, p: PluginTarget): boolean {
    const view = leaf.view as { getViewType?: () => string; file?: TFile | null };
    const isMarkdown = view?.getViewType?.() === 'markdown';
    const file = view?.file ?? null;
    const sf = p.sceneManager.activeProject?.sceneFolder;
    const projectRoot = sf ? sf.replace(/\/Scenes$/, '') : undefined;
    return isMarkdown && !!file && !!projectRoot && file.path.startsWith(projectRoot);
}
