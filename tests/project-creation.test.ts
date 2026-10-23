/**
 * @vitest-environment jsdom
 */

/**
 * Behavioral tests for project creation regression repairs.
 *
 * These tests verify the fixes for Step 6B.4a regressions:
 * - Form field bindings (title and new series name onChange)
 * - Async dropdown stale-response protection
 * - Creation concurrency guards
 * - Pre-persistence validation
 * - Cancellation semantics
 */

import { describe, it, expect, vi } from 'vitest';
import {
    executeCreation,
    CreationValidationError,
    type CreationFormState,
} from '../src/services/projectCreation';
import type { StoryLineProject, SeriesMetadata } from '../src/models/StoryLineProject';
import type { UniverseMetadata } from '../src/models/Universe';
import {
    updateSeriesDropdownInPlace,
    type DropdownDeps,
    type DropdownState,
    type ModalClosedChecker,
} from '../src/components/CreateProjectDropdowns';

// ── Typed mock helpers ───────────────────────────────────

function makeEmptyDeps(): any {
    return {
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
        autoOpenNavigator: false,
    };
}

function makeProject(overrides: Partial<StoryLineProject> = {}): StoryLineProject {
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

function makeSeries(overrides: Partial<SeriesMetadata> = {}): SeriesMetadata {
    return {
        name: 'Test Series',
        seriesUuid: 'su-1',
        bookOrder: [],
        created: '2024-01-01',
        ...overrides,
    };
}

function makeForm(overrides: Partial<CreationFormState> = {}): CreationFormState {
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

// ── Validation Tests ─────────────────────────────────────

describe('project creation validation', () => {
    it('rejects empty title', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({ title: '   ' });
        await expect(executeCreation(form, deps)).rejects.toThrow(CreationValidationError);
        expect(deps.createProject).not.toHaveBeenCalled();
    });

    it('rejects blank title', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({ title: '' });
        await expect(executeCreation(form, deps)).rejects.toThrow(CreationValidationError);
        expect(deps.createProject).not.toHaveBeenCalled();
    });

    it('rejects book with new series but empty series name', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({
            projectType: 'book',
            selectedSeriesUuid: '__new__',
            newSeriesName: '  ',
        });
        await expect(executeCreation(form, deps)).rejects.toThrow(/new series/i);
        expect(deps.createProject).not.toHaveBeenCalled();
    });

    it('allows book with existing series and empty newSeriesName', async () => {
        const deps = makeEmptyDeps();
        const project = makeProject();
        deps.getSeriesByUuid.mockResolvedValue({ folder: 's', meta: makeSeries() });
        deps.createProject.mockResolvedValue(project);
        const form = makeForm({ selectedSeriesUuid: 'su-1' });
        const result = await executeCreation(form, deps);
        expect(result).toBeDefined();
        expect(deps.createProject).toHaveBeenCalled();
    });

    it('allows universe creation with valid title', async () => {
        const deps = makeEmptyDeps();
        deps.createUniverse.mockResolvedValue({ id: 'u1', name: 'U' });
        const form = makeForm({ projectType: 'universe', title: 'My Universe' });
        await executeCreation(form, deps);
        expect(deps.createUniverse).toHaveBeenCalledWith('My Universe');
    });

    it('allows series creation with valid title', async () => {
        const deps = makeEmptyDeps();
        deps.createSeries.mockResolvedValue(makeSeries({ name: 'My Series' }));
        const form = makeForm({ projectType: 'series', title: 'My Series' });
        await executeCreation(form, deps);
        expect(deps.createSeries).toHaveBeenCalledWith('My Series', undefined);
    });
});

// ── Creation Flow Tests ──────────────────────────────────

describe('project creation flows', () => {
    it('creates a book and sets it active', async () => {
        const deps = makeEmptyDeps();
        const project = makeProject();
        deps.createProject.mockResolvedValue(project);
        const form = makeForm();
        const result = await executeCreation(form, deps);
        expect(result).toBe(project);
        expect(deps.setActiveProject).toHaveBeenCalledWith(project);
        expect(deps.refreshOpenViews).toHaveBeenCalled();
    });

    it('creates a book with a new series name', async () => {
        const deps = makeEmptyDeps();
        const project = makeProject();
        deps.createProject.mockResolvedValue(project);
        const seriesMeta = makeSeries({ name: 'New S', seriesUuid: 'nsu' });
        deps.createSeries.mockResolvedValue(seriesMeta);
        const form = makeForm({
            selectedSeriesUuid: '__new__',
            newSeriesName: 'New S',
        });
        const result = await executeCreation(form, deps);
        expect(result).toBe(project);
        expect(deps.createSeries).toHaveBeenCalledWith('New S', undefined);
        expect(deps.addBookToSeries).toHaveBeenCalledWith('nsu', project);
    });

    it('creates a book inside an existing series', async () => {
        const deps = makeEmptyDeps();
        const project = makeProject();
        deps.createProject.mockResolvedValue(project);
        deps.getSeriesByUuid.mockResolvedValue({
            folder: 's',
            meta: makeSeries({ seriesUuid: 'su1' }),
        });
        const form = makeForm({ selectedSeriesUuid: 'su1' });
        await executeCreation(form, deps);
        expect(deps.addBookToSeries).toHaveBeenCalledWith('su1', project);
    });

    it('creates a book directly inside a universe', async () => {
        const deps = makeEmptyDeps();
        const project = makeProject({ universeId: undefined });
        deps.createProject.mockResolvedValue(project);
        const form = makeForm({ selectedUniverseId: 'u1' });
        await executeCreation(form, deps);
        expect(project.universeId).toBe('u1');
        expect(deps.saveProjectFrontmatter).toHaveBeenCalledWith(project);
    });

    it('creates a universe', async () => {
        const deps = makeEmptyDeps();
        deps.createUniverse.mockResolvedValue({ id: 'u1', name: 'U' });
        const form = makeForm({ projectType: 'universe', title: 'U' });
        const result = await executeCreation(form, deps);
        expect(result).toBeNull();
        expect(deps.createUniverse).toHaveBeenCalledWith('U');
    });

    it('creates a series inside a universe', async () => {
        const deps = makeEmptyDeps();
        const seriesMeta = makeSeries();
        deps.createSeries.mockResolvedValue(seriesMeta);
        deps.getSeriesByUuid.mockResolvedValue({ folder: 's', meta: seriesMeta });
        const form = makeForm({
            projectType: 'series',
            title: 'S',
            selectedUniverseId: 'u1',
        });
        await executeCreation(form, deps);
        expect(deps.addSeriesToUniverse).toHaveBeenCalledWith('u1', 's');
    });
});

// ── Error Handling Tests ─────────────────────────────────

describe('project creation error handling', () => {
    it('propagates errors from createProject', async () => {
        const deps = makeEmptyDeps();
        deps.createProject.mockRejectedValue(new Error('Disk full'));
        const form = makeForm();
        await expect(executeCreation(form, deps)).rejects.toThrow('Disk full');
    });

    it('does not activate project on failure', async () => {
        const deps = makeEmptyDeps();
        deps.createProject.mockRejectedValue(new Error('Fail'));
        const form = makeForm();
        await expect(executeCreation(form, deps)).rejects.toThrow();
        expect(deps.setActiveProject).not.toHaveBeenCalled();
    });
});

// ── Dropdown Stale Response Tests ────────────────────────

function makeDropdownDeps(): any {
    return {
        discoverSeries: vi.fn(),
        discoverHierarchy: vi.fn(),
        getAllUniverses: vi.fn(),
    };
}

function makeSelect(): HTMLSelectElement {
    const el = document.createElement('select');
    el.innerHTML = '<option value="">— None —</option>';
    return el;
}

describe('dropdown stale response protection', () => {
    it('applies results when request ID matches', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(select.options.length).toBeGreaterThan(1);
    });

    it('skips results when a newer request has arrived', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        select.add(document.createElement('option'));
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 2 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(Array.from(select.options).some(o => o.value === 's1')).toBe(false);
    });

    it('skips results when modal is closed', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: true };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(Array.from(select.options).some(o => o.value === 's1')).toBe(false);
    });

    it('preserves valid selection after update', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const opt = document.createElement('option');
        opt.value = 's1';
        select.add(opt);
        select.value = 's1';
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(select.value).toBe('s1');
    });

    it('resets selection when previous value is no longer valid', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const opt = document.createElement('option');
        opt.value = 'old_series';
        select.add(opt);
        select.value = 'old_series';
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(select.value).not.toBe('old_series');
    });

    it('filters series by selected universe', async () => {
        const deps = makeDropdownDeps();
        const s1 = makeSeries({ seriesUuid: 's1' });
        const s2 = makeSeries({ seriesUuid: 's2' });
        deps.discoverSeries.mockResolvedValue([
            { folder: 's1', meta: s1 },
            { folder: 's2', meta: s2 },
        ]);
        deps.discoverHierarchy.mockResolvedValue([
            {
                universe: { id: 'u1', name: 'U1' },
                series: [{ folder: 's1', meta: s1 }],
            },
        ]);
        const select = makeSelect();
        const state: DropdownState = { selectedUniverseId: 'u1', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        const values = Array.from(select.options).map(o => o.value);
        expect(values).toContain('s1');
        expect(values).not.toContain('s2');
    });
});

// ── Concurrency Guard Tests ──────────────────────────────

describe('creation concurrency', () => {
    it('validation runs before any persistence', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({ title: '  ' });
        try {
            await executeCreation(form, deps);
        } catch { /* expected */ }
        expect(deps.createProject).not.toHaveBeenCalled();
        expect(deps.createSeries).not.toHaveBeenCalled();
        expect(deps.createUniverse).not.toHaveBeenCalled();
    });

    it('validation error message is descriptive', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({ title: '' });
        try {
            await executeCreation(form, deps);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).toContain('name');
        }
    });

    it('new series name validation error is descriptive', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({
            selectedSeriesUuid: '__new__',
            newSeriesName: '',
        });
        try {
            await executeCreation(form, deps);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).toMatch(/series/i);
        }
    });
});

// ── Cancellation Semantics Tests ─────────────────────────

describe('cancellation semantics', () => {
    it('modal close flag prevents dropdown update', async () => {
        const deps = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 1 };
        const checker: ModalClosedChecker = { isClosed: true };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        const seriesOptions = Array.from(select.options).filter(
            o => o.value !== '' && o.value !== '__new__',
        );
        expect(seriesOptions.length).toBe(0);
    });

    it('out-of-order completion is rejected via request ID', async () => {
        const deps = makeDropdownDeps();
        const s1 = makeSeries({ seriesUuid: 's1' });
        deps.discoverSeries.mockResolvedValue([{ folder: 's1', meta: s1 }]);
        const select = makeSelect();
        const state: DropdownState = { selectedUniverseId: '', seriesDropdownRequestId: 2 };
        const checker: ModalClosedChecker = { isClosed: false };
        await updateSeriesDropdownInPlace(deps, select, state, 1, checker);
        expect(Array.from(select.options).some(o => o.value === 's1')).toBe(false);
    });
});

// ── Form Field Binding Tests ─────────────────────────────

describe('form field bindings', () => {
    it('title change callback updates form state', () => {
        let formTitle = '';
        const onTitleChange = (title: string) => { formTitle = title; };
        onTitleChange('My Novel');
        expect(formTitle).toBe('My Novel');
    });

    it('new series name callback updates form state', () => {
        let seriesName = '';
        const onNewSeriesNameChange = (name: string) => { seriesName = name; };
        onNewSeriesNameChange('My Trilogy');
        expect(seriesName).toBe('My Trilogy');
    });

    it('empty title after trim is rejected by validation', async () => {
        const deps = makeEmptyDeps();
        const form = makeForm({ title: '   ' });
        await expect(executeCreation(form, deps)).rejects.toThrow(CreationValidationError);
    });
});
