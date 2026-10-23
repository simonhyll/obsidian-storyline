/**
 * Shared typed fixtures for project creation tests.
 *
 * Provides factory functions and mock builders that satisfy
 * production interfaces without using `any`.
 */

import { vi } from 'vitest';
import type { ProjectCreationDeps, CreationFormState } from '../../src/services/projectCreation';
import type { StoryLineProject, SeriesMetadata } from '../../src/models/StoryLineProject';
import type { DropdownDeps, ModalClosedChecker } from '../../src/components/CreateProjectDropdowns';

/** Create a minimal StoryLineProject for tests. */
export function makeProject(
    overrides: Partial<StoryLineProject> = {},
): StoryLineProject {
    return {
        filePath: 'StoryLine/Test.md',
        title: 'Test Book',
        created: '2024-01-01',
        description: '',
        sceneFolder: 'StoryLine/Test/Scenes',
        characterFolder: 'StoryLine/Test/Codex/Characters',
        locationFolder: 'StoryLine/Test/Codex/Locations',
        codexFolder: 'StoryLine/Test/Codex',
        notesFolder: 'StoryLine/Test/Notes',
        sceneNotesFolder: 'StoryLine/Test/SceneNotes',
        archiveFolder: 'StoryLine/Test/Archive',
        researchFolder: 'StoryLine/Test/Research',
        definedActs: [],
        definedChapters: [],
        actLabels: {},
        chapterLabels: {},
        actDescriptions: {},
        chapterDescriptions: {},
        filterPresets: [],
        corkboardPositions: {},
        ...overrides,
    };
}

/** Create a minimal SeriesMetadata for tests. */
export function makeSeries(
    overrides: Partial<SeriesMetadata> = {},
): SeriesMetadata {
    return {
        name: 'Test Series',
        seriesUuid: 'su-1',
        bookOrder: [],
        created: '2024-01-01',
        ...overrides,
    };
}

/** Create a default CreationFormState for tests. */
export function makeForm(
    overrides: Partial<CreationFormState> = {},
): CreationFormState {
    return {
        projectType: 'book',
        title: 'Test Book',
        customFolder: undefined,
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
        ...overrides,
    };
}

/**
 * Build a typed ProjectCreationDeps mock.
 * All references point to the same mock functions.
 */
export function makeCreationDeps(): {
    deps: ProjectCreationDeps;
    createUniverse: ReturnType<typeof vi.fn>;
    createSeries: ReturnType<typeof vi.fn>;
    addSeriesToUniverse: ReturnType<typeof vi.fn>;
    getSeriesByUuid: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>;
    addBookToSeries: ReturnType<typeof vi.fn>;
    saveProjectFrontmatter: ReturnType<typeof vi.fn>;
    setActiveProject: ReturnType<typeof vi.fn>;
    refreshOpenViews: ReturnType<typeof vi.fn>;
    openNavigator: ReturnType<typeof vi.fn>;
    activateView: ReturnType<typeof vi.fn>;
} {
    const m = {
        createUniverse: vi.fn(),
        createSeries: vi.fn(),
        addSeriesToUniverse: vi.fn(),
        getSeriesByUuid: vi.fn(),
        createProject: vi.fn(),
        addBookToSeries: vi.fn(),
        saveProjectFrontmatter: vi.fn(),
        setActiveProject: vi.fn(),
        refreshOpenViews: vi.fn(),
        openNavigator: vi.fn(),
        activateView: vi.fn(),
    };
    return {
        deps: { ...m, autoOpenNavigator: false },
        ...m,
    };
}

/**
 * Build a typed DropdownDeps mock.
 * All references point to the same mock functions.
 */
export function makeDropdownDeps(): {
    deps: DropdownDeps;
    discoverSeries: ReturnType<typeof vi.fn>;
    discoverHierarchy: ReturnType<typeof vi.fn>;
    getAllUniverses: ReturnType<typeof vi.fn>;
} {
    const discoverSeries = vi.fn();
    const discoverHierarchy = vi.fn();
    const getAllUniverses = vi.fn();

    return {
        deps: {
            discoverSeries,
            discoverHierarchy,
            getAllUniverses,
        },
        discoverSeries,
        discoverHierarchy,
        getAllUniverses,
    };
}

/**
 * Create a mutable modal closed checker for tests.
 */
export function makeClosedChecker(
    initialClosed = false,
): ModalClosedChecker & { setClosed: (v: boolean) => void } {
    let closed = initialClosed;
    return {
        get isClosed() { return closed; },
        setClosed(v: boolean) { closed = v; },
    };
}

/**
 * Create a request ID counter for tests.
 */
export function makeRequestIdCounter(): {
    current: number;
    next: () => number;
    getCurrent: () => number;
} {
    let current = 0;
    return {
        get current() { return current; },
        next() { return ++current; },
        getCurrent() { return current; },
    };
}
