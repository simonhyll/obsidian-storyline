/* eslint-disable @typescript-eslint/no-misused-promises -- Obsidian's API surface and several untyped third-party libraries force dynamic dispatch; floating promises are intentional in DOM/event handlers; matching enable at end of file */
import * as obsidian from 'obsidian';
import type SceneCardsPlugin from '../main';
import type { StoryLineProject } from '../models/StoryLineProject';
import { attachTooltip } from './Tooltip';

/**
 * UniverseSelector — a hierarchy-aware project library that displays
 * Universe → Series → Book as polished book cards.
 *
 * Features:
 * - Portrait-oriented book cards (2:3 aspect ratio) with fallback covers
 * - Expandable Universe and Series groupings
 * - Active project highlighting
 * - Sensible empty states
 * - Responsive layout for dark/light themes
 */
export function renderUniverseSelector(
    container: HTMLElement,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): HTMLElement {
    const wrapper = container.createDiv('story-line-universe-selector');

    // ── Loading state ──
    const loadingEl = wrapper.createDiv({ cls: 'universe-selector-loading' });
    loadingEl.createSpan({ text: 'Loading library...' });

    // ── New project button ──
    const newBtn = wrapper.createEl('button', {
        cls: 'universe-selector-new-btn',
        text: '+ New Project',
    });
    newBtn.addEventListener('click', () => {
        (plugin.app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById('storyline:create-new-project');
    });

    // Build the async tree immediately
    refreshUniverseSelector(wrapper, plugin, onSwitch).catch(() => {
        // If refresh fails, loadingEl is still visible
    });

    return wrapper;
}

/**
 * Create an expandable section header with toggle functionality.
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
 * Generate a deterministic fallback cover color from a title string.
 */
function getFallbackCoverColor(title: string): string {
    // Simple hash to pick from a palette of pleasant colors
    const colors = [
        '#4A90D9', '#50B0A0', '#D97A4A', '#9B59B6',
        '#E74C3C', '#2ECC71', '#F39C12', '#1ABC9C',
        '#8E44AD', '#3498DB', '#E67E22', '#16A085',
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = ((hash << 5) - hash) + title.charCodeAt(i);
        hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate the first letter or two for the fallback cover.
 */
function getFallbackInitials(title: string): string {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
}

/**
 * Async version that builds the full library with discovered hierarchy.
 * Call this after initial render to populate with universe/series data.
 */
export async function refreshUniverseSelector(
    wrapper: HTMLElement,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): Promise<void> {
    // Remove loading state
    const loadingEl = wrapper.querySelector<HTMLElement>('.universe-selector-loading');
    if (loadingEl) loadingEl.remove();

    // Clear previous content except the new project button
    const newBtn = wrapper.querySelector<HTMLElement>('.universe-selector-new-btn');
    wrapper.empty();
    if (newBtn) wrapper.appendChild(newBtn);

    const active = plugin.sceneManager.activeProject;
    const projects = plugin.sceneManager.getProjects();

    // Container for all groups
    const groupsContainer = wrapper.createDiv({ cls: 'universe-selector-groups' });

    // Discover hierarchy
    const hierarchy = await plugin.universeManager.discoverHierarchy();

    // Track which projects are in the hierarchy
    const hierarchyProjectPaths = new Set<string>();
    let totalBooks = 0;

    // Render universes
    for (const { universe, series: seriesList } of hierarchy) {
        const universeSection = groupsContainer.createDiv({ cls: 'universe-selector-section' });

        const childrenEl = universeSection.createDiv({ cls: 'universe-selector-children' });
        createExpandableHeader(universeSection, universe.name, 'globe', childrenEl);

        let universeBooks = 0;
        // Render series
        for (const { meta, books } of seriesList) {
            const seriesSection = childrenEl.createDiv({ cls: 'universe-selector-section' });
            const seriesChildren = seriesSection.createDiv({ cls: 'universe-selector-children' });
            createExpandableHeader(seriesSection, meta.name, 'library', seriesChildren);

            // Book cards grid
            const cardsGrid = seriesChildren.createDiv({ cls: 'universe-selector-cards' });
            for (const book of books) {
                hierarchyProjectPaths.add(book.filePath);
                universeBooks++;
                totalBooks++;
                renderBookCard(cardsGrid, book, active, plugin, onSwitch);
            }
        }

        // If universe has no series, show empty state
        if (seriesList.length === 0) {
            childrenEl.createDiv({ cls: 'universe-selector-empty' }).createSpan({
                text: 'No series in this universe yet.',
            });
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

        const seriesSection = groupsContainer.createDiv({ cls: 'universe-selector-section' });
        const seriesChildren = seriesSection.createDiv({ cls: 'universe-selector-children' });
        createExpandableHeader(seriesSection, meta.name, 'library', seriesChildren);

        const books = projects.filter(p =>
            p.seriesUuid === meta.seriesUuid || p.seriesId === meta.name
        );

        const cardsGrid = seriesChildren.createDiv({ cls: 'universe-selector-cards' });
        for (const book of books) {
            hierarchyProjectPaths.add(book.filePath);
            totalBooks++;
            renderBookCard(cardsGrid, book, active, plugin, onSwitch);
        }
    }

    // Render standalone books
    const standaloneBooks = projects.filter(p => !hierarchyProjectPaths.has(p.filePath));
    if (standaloneBooks.length > 0) {
        const standaloneSection = groupsContainer.createDiv({ cls: 'universe-selector-section' });
        const standaloneChildren = standaloneSection.createDiv({ cls: 'universe-selector-children' });
        createExpandableHeader(standaloneSection, 'Standalone Books', 'book', standaloneChildren);

        const cardsGrid = standaloneChildren.createDiv({ cls: 'universe-selector-cards' });
        for (const book of standaloneBooks) {
            totalBooks++;
            renderBookCard(cardsGrid, book, active, plugin, onSwitch);
        }
    }

    // Empty state — no projects at all
    if (totalBooks === 0) {
        const emptyState = wrapper.createDiv({ cls: 'universe-selector-empty-state' });
        emptyState.createEl('h3', { text: 'Your library is empty' });
        emptyState.createEl('p', {
            text: 'Create your first StoryLine project to get started.',
        });
    }
}

/**
 * Render a book card with portrait-oriented cover and title.
 */
function renderBookCard(
    parent: HTMLElement,
    book: StoryLineProject,
    activeProject: StoryLineProject | null,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): void {
    const isActive = activeProject && book.filePath === activeProject.filePath;

    const card = parent.createDiv({ cls: 'universe-selector-card' });
    if (isActive) {
        card.addClass('universe-selector-card-active');
    }

    // Cover area (portrait 2:3 aspect ratio)
    const cover = card.createDiv({ cls: 'universe-selector-cover' });

    if (book.coverImage) {
        const resourcePath = plugin.app.vault.adapter.getResourcePath(book.coverImage);
        if (resourcePath) {
            cover.createEl('img', {
                cls: 'universe-selector-cover-img',
                attr: { src: resourcePath, alt: book.title },
            });
        } else {
            renderFallbackCover(cover, book.title);
        }
    } else {
        renderFallbackCover(cover, book.title);
    }

    // Cover edit button (small pencil icon, top-right corner)
    const coverEditBtn = cover.createEl('button', {
        cls: 'universe-selector-cover-edit',
    });
    obsidian.setIcon(coverEditBtn, 'pencil');
    coverEditBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Don't trigger card click (open book)
        const { pickImage } = await import('./ImagePicker');
        const sceneFolder = plugin.sceneManager.getSceneFolder() || '';
        const result = await pickImage(plugin.app, sceneFolder, book.coverImage);
        if (result === undefined) return; // cancelled
        // Update the project's coverImage and persist
        book.coverImage = result || undefined;
        await plugin.sceneManager.saveProjectFrontmatter(book);
        // Refresh the library to show the new cover
        onSwitch();
    });

    // Title and series info
    const info = card.createDiv({ cls: 'universe-selector-card-info' });
    info.createEl('div', {
        cls: 'universe-selector-card-title',
        text: book.title,
    });

    if (book.seriesId) {
        info.createEl('div', {
            cls: 'universe-selector-card-series',
            text: book.seriesId,
        });
    }

    attachTooltip(card, isActive ? 'Active project' : `Switch to ${book.title}`);

    card.addEventListener('click', async () => {
        await plugin.sceneManager.setActiveProject(book);
        // Refresh scenes and inherited entities for the selected project
        await plugin.refreshOpenViews(true);
        // Open StoryLine Board view, reusing existing leaf if available
        try {
            const { BOARD_VIEW_TYPE } = await import('../constants');
            await plugin.activateView(BOARD_VIEW_TYPE);
        } catch {
            // Fallback: just refresh the library
            onSwitch();
        }
    });
}

/**
 * Render a fallback cover with deterministic color and initials.
 */
function renderFallbackCover(coverEl: HTMLElement, title: string): void {
    const color = getFallbackCoverColor(title);
    const initials = getFallbackInitials(title);

    const fallbackEl = coverEl.createDiv({
        cls: 'universe-selector-cover-fallback',
        text: initials,
    });
    fallbackEl.style.backgroundColor = color;
}
