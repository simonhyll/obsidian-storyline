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
 * If seriesUuid is provided, the header becomes draggable for hierarchy management.
 */
function createExpandableHeader(
    parent: HTMLElement,
    label: string,
    icon: string,
    childrenEl: HTMLElement,
    seriesUuid?: string
): HTMLElement {
    const header = parent.createDiv({ cls: 'universe-selector-header' });
    header.insertAdjacentElement('afterend', childrenEl);
    const toggle = header.createSpan({ cls: 'universe-selector-toggle' });
    obsidian.setIcon(toggle, 'chevron-right');
    const iconEl = header.createSpan({ cls: 'universe-selector-icon' });
    obsidian.setIcon(iconEl, icon);
    header.createSpan({ cls: 'universe-selector-label', text: label });

    if (seriesUuid) {
        const dragHandle = header.createEl('button', {
            cls: 'universe-selector-drag-handle',
            attr: { 'aria-label': `Drag to move "${label}"` },
        });
        obsidian.setIcon(dragHandle, 'grip-vertical');
        header.setAttribute('draggable', 'true');
        let isDragging = false;
        dragHandle.addEventListener('mousedown', (e) => { e.stopPropagation(); isDragging = true; });
        header.addEventListener('dragstart', (e: DragEvent) => {
            if (!e.dataTransfer) return;
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'series', seriesUuid }));
            header.addClass('dragging');
        });
        header.addEventListener('dragend', () => { header.removeClass('dragging'); });
        header.addEventListener('click', (e) => {
            if (isDragging) { isDragging = false; return; }
            toggleExpand();
        });
    }

    let expanded = false;
    childrenEl.addClass('universe-selector-children-collapsed');
    const toggleExpand = () => {
        expanded = !expanded;
        if (expanded) {
            childrenEl.removeClass('universe-selector-children-collapsed');
            obsidian.setIcon(toggle, 'chevron-down');
        } else {
            childrenEl.addClass('universe-selector-children-collapsed');
            obsidian.setIcon(toggle, 'chevron-right');
        }
    };
    if (!seriesUuid) {
        header.addEventListener('click', toggleExpand);
    }
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
    for (const { universe, series: seriesList, directBooks } of hierarchy) {
        const universeSection = groupsContainer.createDiv({ cls: 'universe-selector-section' });
        universeSection.dataset.universeId = universe.id;

        const childrenEl = universeSection.createDiv({ cls: 'universe-selector-children' });
        const header = createExpandableHeader(universeSection, universe.name, 'globe', childrenEl);

        // Universe header is a drop target for Series and Books
        setupDropTarget(header, 'universe', universe.id, plugin, onSwitch);

        let universeBooks = 0;

        // Render direct books (books that belong to universe without a series)
        if (directBooks.length > 0) {
            const directGrid = childrenEl.createDiv({ cls: 'universe-selector-cards' });
            for (const book of directBooks) {
                hierarchyProjectPaths.add(book.filePath);
                universeBooks++;
                totalBooks++;
                renderBookCard(directGrid, book, active, plugin, onSwitch);
            }
        }

        // Render series
        for (const { meta, books } of seriesList) {
            const seriesSection = childrenEl.createDiv({ cls: 'universe-selector-section' });
            seriesSection.dataset.seriesUuid = meta.seriesUuid || '';
            const seriesChildren = seriesSection.createDiv({ cls: 'universe-selector-children' });
            const seriesHeader = createExpandableHeader(seriesSection, meta.name, 'library', seriesChildren, meta.seriesUuid || undefined);

            // Series header is a drop target for Books
            setupDropTarget(seriesHeader, 'series', meta.seriesUuid || '', plugin, onSwitch);

            // Book cards grid
            const cardsGrid = seriesChildren.createDiv({ cls: 'universe-selector-cards' });
            for (const book of books) {
                hierarchyProjectPaths.add(book.filePath);
                universeBooks++;
                totalBooks++;
                renderBookCard(cardsGrid, book, active, plugin, onSwitch);
            }
        }

        // If universe has no series, show empty state with drop target
        if (seriesList.length === 0) {
            const emptyEl = childrenEl.createDiv({ cls: 'universe-selector-empty' });
            emptyEl.createSpan({
                text: 'No series in this universe yet.',
            });
            setupDropTarget(emptyEl, 'universe', universe.id, plugin, onSwitch);
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
        seriesSection.dataset.seriesUuid = meta.seriesUuid || '';
        const seriesChildren = seriesSection.createDiv({ cls: 'universe-selector-children' });
        const seriesHeader = createExpandableHeader(seriesSection, meta.name, 'library', seriesChildren, meta.seriesUuid || undefined);

        // Standalone series can receive books via drag
        setupDropTarget(seriesHeader, 'series', meta.seriesUuid || '', plugin, onSwitch);

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

    // Render standalone books section with drop target for detaching
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

    // Standalone drop zone — for detaching books/series
    const standaloneZone = groupsContainer.createDiv({ cls: 'universe-selector-standalone-zone' });
    standaloneZone.createSpan({ text: 'Drag here to detach from Universe/Series' });
    setupDropTarget(standaloneZone, 'standalone', '', plugin, onSwitch);

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
 * Set up a drop target element for drag-and-drop hierarchy management.
 * Supports dropping books onto universes, series, or standalone zones.
 */
function setupDropTarget(
    element: HTMLElement,
    targetType: 'universe' | 'series' | 'standalone',
    targetId: string,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): void {
    element.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        element.addClass('drag-over');
    });

    element.addEventListener('dragleave', () => {
        element.removeClass('drag-over');
    });

    element.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        element.removeClass('drag-over');
        try {
            const data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}');
            if (data.type === 'book') {
                await handleDropBook(plugin, data.filePath, targetType, targetId, onSwitch);
            } else if (data.type === 'series') {
                await handleDropSeries(plugin, data.seriesUuid, targetType, targetId, onSwitch);
            }
        } catch (err) {
            new obsidian.Notice((err instanceof Error ? err.message : String(err)), 10000);
        }
    });
}

/**
 * Handle dropping a book onto a universe, series, or standalone zone.
 */
async function handleDropBook(
    plugin: SceneCardsPlugin,
    bookPath: string,
    targetType: 'universe' | 'series' | 'standalone',
    targetId: string,
    onSwitch: () => void
): Promise<void> {
    const book = plugin.sceneManager.getProjects().find(p => p.filePath === bookPath);
    if (!book) return;

    if (targetType === 'standalone') {
        if (book.seriesUuid) {
            await plugin.seriesManager.removeBookFromSeries(book.seriesUuid, book);
        }
        book.seriesUuid = undefined;
        book.seriesId = undefined;
        book.universeId = undefined;
        await plugin.sceneManager.saveProjectFrontmatter(book);
        onSwitch();
    } else if (targetType === 'series' && targetId) {
        if (book.seriesUuid && book.seriesUuid !== targetId) {
            await plugin.seriesManager.removeBookFromSeries(book.seriesUuid, book);
        }
        await plugin.seriesManager.addBookToSeries(targetId, book);
        onSwitch();
    } else if (targetType === 'universe' && targetId) {
        if (book.seriesUuid) {
            await plugin.seriesManager.removeBookFromSeries(book.seriesUuid, book);
        }
        book.universeId = targetId;
        book.seriesUuid = undefined;
        book.seriesId = undefined;
        await plugin.sceneManager.saveProjectFrontmatter(book);
        onSwitch();
    }
}

async function handleDropSeries(
    plugin: SceneCardsPlugin,
    seriesUuid: string,
    targetType: 'universe' | 'series' | 'standalone',
    targetId: string,
    onSwitch: () => void
): Promise<void> {
    if (targetType === 'universe' && targetId) {
        const found = await plugin.seriesManager.getSeriesByUuid(seriesUuid);
        if (!found) throw new Error('Series not found');
        await plugin.universeManager.addSeriesToUniverse(targetId, found.folder);
        onSwitch();
    } else if (targetType === 'standalone') {
        const found = await plugin.seriesManager.getSeriesByUuid(seriesUuid);
        if (!found) throw new Error('Series not found');
        const meta = found.meta;
        if (meta.universeId) {
            await plugin.universeManager.removeSeriesFromUniverse(meta.universeId, seriesUuid);
            onSwitch();
        }
    }
}

/**
 * Render a book card with portrait-oriented cover and title.
 * Supports drag-and-drop for hierarchy management.
 */
function renderBookCard(
    parent: HTMLElement,
    book: StoryLineProject,
    activeProject: StoryLineProject | null,
    plugin: SceneCardsPlugin,
    onSwitch: () => void
): HTMLElement {
    const isActive = activeProject && book.filePath === activeProject.filePath;

    const card = parent.createDiv({ cls: 'universe-selector-card' });
    if (isActive) {
        card.addClass('universe-selector-card-active');
    }
    card.dataset.bookId = book.bookId || '';
    card.dataset.bookPath = book.filePath;

    // Drag handle
    const dragHandle = card.createEl('button', {
        cls: 'universe-selector-drag-handle',
        attr: { 'aria-label': `Drag to move "${book.title}"` },
    });
    obsidian.setIcon(dragHandle, 'grip-vertical');

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

    // ── Drag and Drop ──
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'book',
            bookId: book.bookId,
            filePath: book.filePath,
        }));
        card.addClass('dragging');
    });

    card.addEventListener('dragend', () => {
        card.removeClass('dragging');
    });

    card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer?.dropEffect === 'move' && card.addClass('drag-over');
    });

    card.addEventListener('dragleave', () => {
        card.removeClass('drag-over');
    });

    card.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        card.removeClass('drag-over');
        try {
            const data = JSON.parse(e.dataTransfer?.getData('text/plain') || '{}');
            if (data.type === 'book' && data.filePath !== book.filePath) {
                // Drop book on book — reorder within same series
                await handleBookReorder(plugin, data.filePath, book.filePath, onSwitch);
            }
        } catch {
            // Ignore invalid drag data
        }
    });

    // Click to open book — but not when dragging
    let isDragging = false;
    dragHandle.addEventListener('mousedown', () => { isDragging = true; });
    card.addEventListener('click', async (e) => {
        if (isDragging) {
            isDragging = false;
            return;
        }
        await plugin.navigateToBook(book);
    });

    return card;
}

/**
 * Handle reordering a book when dropped on another book in the same series.
 */
async function handleBookReorder(
    plugin: SceneCardsPlugin,
    sourcePath: string,
    targetPath: string,
    onSwitch: () => void
): Promise<void> {
    const source = plugin.sceneManager.getProjects().find(p => p.filePath === sourcePath);
    const target = plugin.sceneManager.getProjects().find(p => p.filePath === targetPath);
    if (!source || !target || source.seriesUuid !== target.seriesUuid || !source.seriesUuid) {
        return;
    }
    const found = await plugin.seriesManager.getSeriesByUuid(source.seriesUuid);
    if (!found || !found.meta.bookIds) return;
    const meta = found.meta;
    const bookIds = meta.bookIds!;
    const sourceIdx = bookIds.indexOf(source.bookId || '');
    const targetIdx = bookIds.indexOf(target.bookId || '');
    if (sourceIdx === -1 || targetIdx === -1) return;
    bookIds.splice(sourceIdx, 1);
    bookIds.splice(targetIdx, 0, source.bookId || '');
    await plugin.seriesManager.saveSeriesMetadata(found.folder, meta);
    onSwitch();
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
