/* eslint-disable @typescript-eslint/no-misused-promises -- Obsidian's API surface and several untyped third-party libraries force dynamic dispatch; floating promises are intentional in DOM/event handlers; matching enable at end of file */
import * as obsidian from 'obsidian';
import type SceneCardsPlugin from '../main';
import type { StoryLineProject } from '../models/StoryLineProject';
import { attachTooltip } from './Tooltip';

/**
 * UniverseSelector — a hierarchy-aware project selector that replaces
 * the flat ProjectSelector dropdown.
 *
 * Shows a tree view:
 * - Universe (expandable)
 *   - Series (expandable)
 *     - Book (clickable to switch)
 * - Standalone Series (expandable)
 *   - Book (clickable to switch)
 * - Standalone Books (clickable to switch)
 *
 * Supports cover thumbnails, series badges, and quick project creation.
 */
export function renderUniverseSelector(
    container: HTMLElement,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): HTMLElement {
    const wrapper = container.createDiv('story-line-universe-selector');

    const active = plugin.sceneManager.activeProject;

    // ── Cover image thumbnail (if active project) ──
    if (active) {
        const coverEl = wrapper.createDiv({ cls: 'universe-selector-cover' });
        attachTooltip(coverEl, 'Click to set cover image');
        coverEl.setCssStyles({ cursor: 'pointer' });

        if (active.coverImage) {
            const resourcePath = plugin.app.vault.adapter.getResourcePath(active.coverImage);
            if (resourcePath) {
                coverEl.createEl('img', {
                    cls: 'universe-selector-cover-img',
                    attr: { src: resourcePath, alt: active.title },
                });
            }
        } else {
            const placeholder = coverEl.createSpan({ cls: 'universe-selector-cover-placeholder' });
            obsidian.setIcon(placeholder, 'image');
        }

        coverEl.addEventListener('click', async () => {
            const sceneFolder = plugin.sceneManager.getSceneFolder();
            const { pickImage } = await import('./ImagePicker');
            const result = await pickImage(plugin.app, sceneFolder, active.coverImage);
            if (result === undefined) return; // cancelled
            active.coverImage = result || undefined;
            await plugin.sceneManager.saveProjectFrontmatter(active);
            onSwitch();
        });
    }

    // ── Hierarchy tree (async, always) ──
    const treeEl = wrapper.createDiv({ cls: 'universe-selector-tree' });
    treeEl.createSpan({ cls: 'universe-selector-loading', text: 'Loading...' });

    // ── New project button ──
    const newBtn = wrapper.createEl('button', {
        cls: 'clickable-icon universe-selector-new',
        attr: { 'aria-label': 'New StoryLine project', title: 'New project' },
    });
    obsidian.setIcon(newBtn, 'plus');

    newBtn.addEventListener('click', () => {
        (plugin.app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById('storyline:create-new-project');
    });

    // Build the async tree immediately
    refreshUniverseSelector(wrapper, plugin, onSwitch).catch(() => {
        // If refresh fails, treeEl already has "Loading..." text
    });

    return wrapper;
}

/**
 * Create an expandable header with toggle functionality.
 * The header is inserted BEFORE the childrenEl in the DOM.
 */
function createExpandableHeader(
    parent: HTMLElement,
    label: string,
    icon: string,
    childrenEl: HTMLElement
): HTMLElement {
    // Insert the header BEFORE the children element in the DOM
    const header = parent.createDiv({ cls: 'universe-selector-header' });
    header.insertAdjacentElement('afterend', childrenEl);
    const toggle = header.createSpan({ cls: 'universe-selector-toggle' });
    obsidian.setIcon(toggle, 'chevron-right');

    const iconEl = header.createSpan({ cls: 'universe-selector-icon' });
    obsidian.setIcon(iconEl, icon);

    header.createSpan({
        cls: 'universe-selector-label',
        text: label,
    });

    let expanded = false;
    childrenEl.addClass('universe-selector-children-collapsed');

    header.addEventListener('click', () => {
        expanded = !expanded;
        if (expanded) {
            childrenEl.removeClass('universe-selector-children-collapsed');
            obsidian.setIcon(toggle, 'chevron-down');
        } else {
            childrenEl.addClass('universe-selector-children-collapsed');
            obsidian.setIcon(toggle, 'chevron-right');
        }
    });

    return header;
}

/**
 * Async version that builds the full tree with discovered hierarchy.
 * Call this after initial render to populate with universe/series data.
 */
export async function refreshUniverseSelector(
    wrapper: HTMLElement,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): Promise<void> {
    const treeEl = wrapper.querySelector<HTMLElement>('.universe-selector-tree');
    if (!treeEl) return;

    treeEl.empty();

    const active = plugin.sceneManager.activeProject;
    const projects = plugin.sceneManager.getProjects();

    // Always show the full hierarchy, even with a single project.

    // Discover hierarchy
    const hierarchy = await plugin.universeManager.discoverHierarchy();

    // Track which projects are in the hierarchy
    const hierarchyProjectPaths = new Set<string>();

    // Render universes
    for (const { universe, series } of hierarchy) {
        const universeNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-universe' });
        const childrenEl = universeNode.createDiv({ cls: 'universe-selector-children' });
        createExpandableHeader(universeNode, universe.name, 'globe', childrenEl);

        // Render series
        for (const { meta, books } of series) {
            const seriesNode = childrenEl.createDiv({ cls: 'universe-selector-node universe-selector-series' });
            const seriesChildren = seriesNode.createDiv({ cls: 'universe-selector-children' });
            createExpandableHeader(seriesNode, meta.name, 'library', seriesChildren);

            for (const book of books) {
                hierarchyProjectPaths.add(book.filePath);
                renderBookItemInContainer(seriesChildren, book, active, plugin, onSwitch);
            }
        }
    }

    // Render standalone series (not in any universe)
    const allSeries = await plugin.seriesManager.discoverSeries();
    const universeSeriesUuids = new Set<string>();
    for (const { series: seriesList } of hierarchy) {
        for (const { meta } of seriesList) {
            if (meta.seriesUuid) {
                universeSeriesUuids.add(meta.seriesUuid);
            }
        }
    }

    for (const { meta } of allSeries) {
        if (universeSeriesUuids.has(meta.seriesUuid || '')) continue;

        const seriesNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-series' });
        const seriesChildren = seriesNode.createDiv({ cls: 'universe-selector-children' });
        createExpandableHeader(seriesNode, meta.name, 'library', seriesChildren);

        const books = projects.filter(p =>
            p.seriesUuid === meta.seriesUuid || p.seriesId === meta.name
        );
        for (const book of books) {
            hierarchyProjectPaths.add(book.filePath);
            renderBookItemInContainer(seriesChildren, book, active, plugin, onSwitch);
        }
    }

    // Render standalone books
    for (const project of projects) {
        if (hierarchyProjectPaths.has(project.filePath)) continue;
        renderBookItemInContainer(treeEl, project, active, plugin, onSwitch);
    }
}

/**
 * Render a book item with proper plugin closure.
 */
function renderBookItemInContainer(
    parent: HTMLElement,
    book: StoryLineProject,
    activeProject: StoryLineProject | null,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): void {
    const isActive = activeProject && book.filePath === activeProject.filePath;

    const bookEl = parent.createDiv({ cls: 'universe-selector-book-item' });
    if (isActive) {
        bookEl.addClass('universe-selector-book-active');
    }

    const iconEl = bookEl.createSpan({ cls: 'universe-selector-book-icon' });
    obsidian.setIcon(iconEl, 'book');

    bookEl.createSpan({
        cls: 'universe-selector-book-label',
        text: book.title,
    });

    if (book.seriesId) {
        const badge = bookEl.createSpan({
            cls: 'universe-selector-series-badge',
            text: book.seriesId,
        });
        badge.setCssStyles({ fontSize: '0.75em', opacity: '0.6' });
    }

    attachTooltip(bookEl, isActive ? 'Active project' : `Switch to ${book.title}`);

    bookEl.addEventListener('click', async () => {
        await plugin.sceneManager.setActiveProject(book);
        onSwitch();
    });
}
