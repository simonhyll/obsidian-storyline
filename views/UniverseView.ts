/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises -- Obsidian's API surface and several untyped third-party libraries force dynamic dispatch; floating promises are intentional in DOM/event handlers; matching enable at end of file */
import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type SceneCardsPlugin from '../main';
import { renderUniverseSelector, refreshUniverseSelector } from '../components/UniverseSelector';
import { UNIVERSE_VIEW_TYPE } from '../constants';

/**
 * UniverseView — a dedicated Project Library view for navigating
 * the Universe → Series → Book hierarchy.
 *
 * Provides:
 * - Hierarchy tree with expandable universes, series, and books
 * - Cover thumbnails
 * - Quick project switching
 * - Buttons for universe management operations
 */
export class UniverseView extends ItemView {
    private plugin: SceneCardsPlugin;
    private selectorEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: SceneCardsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return UNIVERSE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'StoryLine library';
    }

    getIcon(): string {
        return 'library';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('sl-universe-view');

        // ── Header ──
        const header = container.createDiv('sl-universe-header');
        header.createSpan({
            cls: 'sl-universe-title',
            text: 'Project Library',
        });

        // ── Action buttons ──
        const actions = header.createDiv('sl-universe-actions');

        const createUniverseBtn = actions.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Create universe', title: 'Create universe' },
        });
        setIcon(createUniverseBtn, 'globe');
        createUniverseBtn.addEventListener('click', () => {
            this.plugin.openCreateUniverseModal();
        });

        const addSeriesBtn = actions.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Add series to universe', title: 'Add series to universe' },
        });
        setIcon(addSeriesBtn, 'library');
        addSeriesBtn.addEventListener('click', () => {
            this.plugin.openAddSeriesToUniverseModal();
        });

        // ── Hierarchy tree ──
        const treeContainer = container.createDiv('sl-universe-tree-container');
        this.selectorEl = renderUniverseSelector(
            treeContainer,
            this.plugin,
            () => this.refresh()
        );
    }

    async onClose(): Promise<void> {
        // Nothing to clean up
    }

    /** Refresh the selector tree */
    async refresh(): Promise<void> {
        if (this.selectorEl) {
            await refreshUniverseSelector(
                this.selectorEl,
                this.plugin,
                () => this.refresh()
            );
        }
    }
}
