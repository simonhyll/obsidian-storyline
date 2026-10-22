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
    }

    // ── Hierarchy tree ──
    const treeEl = wrapper.createDiv({ cls: 'universe-selector-tree' });

    // Build the tree from discovered hierarchy + standalone items
    buildTree(treeEl, plugin, active, onSwitch);

    // ── New project button ──
    const newBtn = wrapper.createEl('button', {
        cls: 'clickable-icon universe-selector-new',
        attr: { 'aria-label': 'New StoryLine project', title: 'New project' },
    });
    obsidian.setIcon(newBtn, 'plus');

    newBtn.addEventListener('click', () => {
        (plugin.app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById('storyline:create-new-project');
    });

    return wrapper;
}

/**
 * Build the hierarchy tree DOM.
 */
function buildTree(
    treeEl: HTMLElement,
    plugin: SceneCardsPlugin,
    activeProject: StoryLineProject | null,
    onSwitch: () => void
): void {
    const projects = plugin.sceneManager.getProjects();

    // Group all projects — the synchronous build is simple;
    // the async refreshUniverseSelector populates the full tree.
    for (const project of projects) {
        // All projects end up in the series grouping below
    }

    // If only one project, show a simple label
    if (projects.length <= 1 && activeProject) {
        treeEl.createSpan({
            cls: 'universe-selector-label',
            text: activeProject.title,
        });
        return;
    }

    // ── Render Universes ──
    // We render a simplified view: group by series, then by standalone
    const seriesGroups = new Map<string, StoryLineProject[]>();
    for (const project of projects) {
        const seriesKey = project.seriesUuid || project.seriesId || '__standalone__';
        if (!seriesGroups.has(seriesKey)) {
            seriesGroups.set(seriesKey, []);
        }
        seriesGroups.get(seriesKey)!.push(project);
    }

    // Separate universe-backed series from standalone
    const universeSeriesKeys: string[] = [];
    const standaloneSeriesKeys: string[] = [];

    for (const [key] of seriesGroups) {
        if (key === '__standalone__') {
            standaloneSeriesKeys.push(key);
        } else {
            // Check if any project in this group has a universeId
            const hasUniverse = seriesGroups.get(key)!.some(p => !!p.universeId);
            if (hasUniverse) {
                universeSeriesKeys.push(key);
            } else {
                standaloneSeriesKeys.push(key);
            }
        }
    }

    // Render universe-backed series
    for (const seriesKey of universeSeriesKeys) {
        const books = seriesGroups.get(seriesKey)!;
        const universeId = books.find(p => p.universeId)?.universeId;
        const universeName = universeId ? `Universe: ${universeId.substring(0, 8)}...` : '';

        const universeNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-universe' });
        renderExpandableNode(universeNode, universeName || 'Universe', 'globe', books, activeProject, onSwitch);
    }

    // Render standalone series
    for (const seriesKey of standaloneSeriesKeys) {
        if (seriesKey === '__standalone__') {
            // Render standalone books directly
            const books = seriesGroups.get(seriesKey)!;
            for (const book of books) {
                renderBookNode(treeEl, book, activeProject, onSwitch);
            }
        } else {
            // Render as a series group
            const books = seriesGroups.get(seriesKey)!;
            const seriesName = books[0]?.seriesId || seriesKey.substring(0, 20);
            const seriesNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-series' });
            renderExpandableNode(seriesNode, seriesName, 'library', books, activeProject, onSwitch);
        }
    }
}

/**
 * Render an expandable node (Universe or Series) with child books.
 */
function renderExpandableNode(
    nodeEl: HTMLElement,
    label: string,
    icon: string,
    books: StoryLineProject[],
    activeProject: StoryLineProject | null,
    onSwitch: () => void
): void {
    const header = nodeEl.createDiv({ cls: 'universe-selector-header' });

    const toggle = header.createSpan({ cls: 'universe-selector-toggle' });
    obsidian.setIcon(toggle, 'chevron-right');

    const iconEl = header.createSpan({ cls: 'universe-selector-icon' });
    obsidian.setIcon(iconEl, icon);

    header.createSpan({
        cls: 'universe-selector-label',
        text: label,
    });

    const childCount = header.createSpan({
        cls: 'universe-selector-count',
        text: `(${books.length})`,
    });

    const childrenEl = nodeEl.createDiv({ cls: 'universe-selector-children' });
    let expanded = false;

    // Render child books
    for (const book of books) {
        const bookEl = childrenEl.createDiv({ cls: 'universe-selector-child' });
        renderBookItem(bookEl, book, activeProject, onSwitch);
    }

    // Toggle expand/collapse
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

    // Start collapsed
    childrenEl.addClass('universe-selector-children-collapsed');
}

/**
 * Render a single book node (standalone).
 */
function renderBookNode(
    parent: HTMLElement,
    book: StoryLineProject,
    activeProject: StoryLineProject | null,
    onSwitch: () => void
): void {
    const bookEl = parent.createDiv({ cls: 'universe-selector-node universe-selector-book' });
    renderBookItem(bookEl, book, activeProject, onSwitch);
}

/**
 * Render a book item (clickable to switch).
 */
function renderBookItem(
    bookEl: HTMLElement,
    book: StoryLineProject,
    activeProject: StoryLineProject | null,
    onSwitch: () => void
): void {
    const isActive = activeProject && book.filePath === activeProject.filePath;

    bookEl.addClass('universe-selector-book-item');
    if (isActive) {
        bookEl.addClass('universe-selector-book-active');
    }

    const iconEl = bookEl.createSpan({ cls: 'universe-selector-book-icon' });
    obsidian.setIcon(iconEl, 'book');

    const label = bookEl.createSpan({
        cls: 'universe-selector-book-label',
        text: book.title,
    });

    // Series badge
    if (book.seriesId) {
        const badge = bookEl.createSpan({
            cls: 'universe-selector-series-badge',
            text: book.seriesId,
        });
        badge.setCssStyles({ fontSize: '0.75em', opacity: '0.6' });
    }

    attachTooltip(bookEl, isActive ? 'Active project' : `Switch to ${book.title}`);

    bookEl.addEventListener('click', async () => {
        await pluginFromElement(bookEl).sceneManager.setActiveProject(book);
        onSwitch();
    });
}

/**
 * Get the plugin instance from a DOM element (walks up to find the wrapper).
 */
function pluginFromElement(el: HTMLElement): SceneCardsPlugin {
    // This is a workaround — in practice, the plugin should be passed down.
    // For now, we use a global reference.
    // TODO: Pass plugin through closure instead.
    throw new Error('Plugin reference not available. Use renderUniverseSelector with closure.');
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

    // Discover hierarchy
    const hierarchy = await plugin.universeManager.discoverHierarchy();

    // Track which projects are in the hierarchy
    const hierarchyProjectPaths = new Set<string>();

    // Render universes
    for (const { universe, series } of hierarchy) {
        const universeNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-universe' });

        const header = universeNode.createDiv({ cls: 'universe-selector-header' });
        const toggle = header.createSpan({ cls: 'universe-selector-toggle' });
        obsidian.setIcon(toggle, 'chevron-right');

        const iconEl = header.createSpan({ cls: 'universe-selector-icon' });
        obsidian.setIcon(iconEl, 'globe');

        header.createSpan({
            cls: 'universe-selector-label',
            text: universe.name,
        });

        const childrenEl = universeNode.createDiv({ cls: 'universe-selector-children' });
        childrenEl.addClass('universe-selector-children-collapsed');
        let expanded = false;

        // Render series
        for (const { meta, books } of series) {
            const seriesNode = childrenEl.createDiv({ cls: 'universe-selector-node universe-selector-series' });

            const seriesHeader = seriesNode.createDiv({ cls: 'universe-selector-header' });
            const seriesToggle = seriesHeader.createSpan({ cls: 'universe-selector-toggle' });
            obsidian.setIcon(seriesToggle, 'chevron-right');

            const seriesIcon = seriesHeader.createSpan({ cls: 'universe-selector-icon' });
            obsidian.setIcon(seriesIcon, 'library');

            seriesHeader.createSpan({
                cls: 'universe-selector-label',
                text: meta.name,
            });

            const seriesChildren = seriesNode.createDiv({ cls: 'universe-selector-children' });
            seriesChildren.addClass('universe-selector-children-collapsed');
            let seriesExpanded = false;

            // Render books
            for (const book of books) {
                hierarchyProjectPaths.add(book.filePath);
                renderBookItemInContainer(seriesChildren, book, active, plugin, onSwitch);
            }

            // Series toggle
            seriesHeader.addEventListener('click', () => {
                seriesExpanded = !seriesExpanded;
                if (seriesExpanded) {
                    seriesChildren.removeClass('universe-selector-children-collapsed');
                    obsidian.setIcon(seriesToggle, 'chevron-down');
                } else {
                    seriesChildren.addClass('universe-selector-children-collapsed');
                    obsidian.setIcon(seriesToggle, 'chevron-right');
                }
            });
        }

        // Universe toggle
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

    for (const { meta, folder } of allSeries) {
        if (universeSeriesUuids.has(meta.seriesUuid || '')) continue;

        const seriesNode = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-series' });

        const seriesHeader = seriesNode.createDiv({ cls: 'universe-selector-header' });
        const seriesToggle = seriesHeader.createSpan({ cls: 'universe-selector-toggle' });
        obsidian.setIcon(seriesToggle, 'chevron-right');

        const seriesIcon = seriesHeader.createSpan({ cls: 'universe-selector-icon' });
        obsidian.setIcon(seriesIcon, 'library');

        seriesHeader.createSpan({
            cls: 'universe-selector-label',
            text: meta.name,
        });

        const seriesChildren = seriesNode.createDiv({ cls: 'universe-selector-children' });
        seriesChildren.addClass('universe-selector-children-collapsed');
        let seriesExpanded = false;

        // Find books in this series
        const books = projects.filter(p =>
            p.seriesUuid === meta.seriesUuid || p.seriesId === meta.name
        );
        for (const book of books) {
            hierarchyProjectPaths.add(book.filePath);
            renderBookItemInContainer(seriesChildren, book, active, plugin, onSwitch);
        }

        seriesHeader.addEventListener('click', () => {
            seriesExpanded = !seriesExpanded;
            if (seriesExpanded) {
                seriesChildren.removeClass('universe-selector-children-collapsed');
                obsidian.setIcon(seriesToggle, 'chevron-down');
            } else {
                seriesChildren.addClass('universe-selector-children-collapsed');
                obsidian.setIcon(seriesToggle, 'chevron-right');
            }
        });
    }

    // Render standalone books
    for (const project of projects) {
        if (hierarchyProjectPaths.has(project.filePath)) continue;

        const bookEl = treeEl.createDiv({ cls: 'universe-selector-node universe-selector-book' });
        renderBookItemInContainer(bookEl, project, active, plugin, onSwitch);
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
