/**
 * @vitest-environment jsdom
 */

/**
 * Project creation flow and error handling tests.
 */

import { describe, it, expect } from 'vitest';
import {
    executeCreation,
} from '../src/services/projectCreation';
import {
    makeProject,
    makeSeries,
    makeForm,
    makeCreationDeps,
} from './fixtures/project-creation-fixtures';

describe('project creation flows', () => {
    it('creates a book and sets it active', async () => {
        const { deps, createProject, setActiveProject, refreshOpenViews } =
            makeCreationDeps();
        const project = makeProject();
        createProject.mockResolvedValue(project);
        const form = makeForm();
        const result = await executeCreation(form, deps);
        expect(result).toBe(project);
        expect(setActiveProject).toHaveBeenCalledWith(project);
        expect(refreshOpenViews).toHaveBeenCalled();
    });

    it('creates a book with a new series', async () => {
        const { deps, createProject, createSeries, addBookToSeries } =
            makeCreationDeps();
        const project = makeProject();
        createProject.mockResolvedValue(project);
        const seriesMeta = makeSeries({ name: 'New S', seriesUuid: 'nsu' });
        createSeries.mockResolvedValue(seriesMeta);
        const form = makeForm({
            selectedSeriesUuid: '__new__',
            newSeriesName: 'New S',
        });
        const result = await executeCreation(form, deps);
        expect(result).toBe(project);
        expect(createSeries).toHaveBeenCalledWith('New S', undefined);
        expect(addBookToSeries).toHaveBeenCalledWith('nsu', project);
    });

    it('creates a book inside an existing series', async () => {
        const { deps, createProject, getSeriesByUuid, addBookToSeries } =
            makeCreationDeps();
        const project = makeProject();
        createProject.mockResolvedValue(project);
        getSeriesByUuid.mockResolvedValue({
            folder: 's',
            meta: makeSeries({ seriesUuid: 'su1' }),
        });
        const form = makeForm({ selectedSeriesUuid: 'su1' });
        await executeCreation(form, deps);
        expect(addBookToSeries).toHaveBeenCalledWith('su1', project);
    });

    it('creates a book directly inside a universe', async () => {
        const { deps, createProject, saveProjectFrontmatter } =
            makeCreationDeps();
        const project = makeProject({ universeId: undefined });
        createProject.mockResolvedValue(project);
        const form = makeForm({ selectedUniverseId: 'u1' });
        await executeCreation(form, deps);
        expect(project.universeId).toBe('u1');
        expect(saveProjectFrontmatter).toHaveBeenCalledWith(project);
    });

    it('creates a universe', async () => {
        const { deps, createUniverse } = makeCreationDeps();
        createUniverse.mockResolvedValue({ id: 'u1', name: 'U' });
        const form = makeForm({ projectType: 'universe', title: 'U' });
        const result = await executeCreation(form, deps);
        expect(result).toBeNull();
        expect(createUniverse).toHaveBeenCalledWith('U');
    });

    it('creates a series inside a universe', async () => {
        const { deps, createSeries, getSeriesByUuid, addSeriesToUniverse } =
            makeCreationDeps();
        const seriesMeta = makeSeries();
        createSeries.mockResolvedValue(seriesMeta);
        getSeriesByUuid.mockResolvedValue({ folder: 's', meta: seriesMeta });
        const form = makeForm({
            projectType: 'series',
            title: 'S',
            selectedUniverseId: 'u1',
        });
        await executeCreation(form, deps);
        expect(addSeriesToUniverse).toHaveBeenCalledWith('u1', 's');
    });
});

describe('project creation error handling', () => {
    it('propagates errors from createProject', async () => {
        const { deps, createProject } = makeCreationDeps();
        createProject.mockRejectedValue(new Error('Disk full'));
        const form = makeForm();
        await expect(executeCreation(form, deps)).rejects.toThrow('Disk full');
    });

    it('does not activate project on failure', async () => {
        const { deps, createProject, setActiveProject } = makeCreationDeps();
        createProject.mockRejectedValue(new Error('Fail'));
        const form = makeForm();
        await expect(executeCreation(form, deps)).rejects.toThrow();
        expect(setActiveProject).not.toHaveBeenCalled();
    });

    it('validation runs before any persistence', async () => {
        const { deps, createProject, createSeries, createUniverse } =
            makeCreationDeps();
        const form = makeForm({ title: '  ' });
        try {
            await executeCreation(form, deps);
        } catch { /* expected */ }
        expect(createProject).not.toHaveBeenCalled();
        expect(createSeries).not.toHaveBeenCalled();
        expect(createUniverse).not.toHaveBeenCalled();
    });

    it('allows book with existing series', async () => {
        const { deps, createProject, getSeriesByUuid } = makeCreationDeps();
        const project = makeProject();
        getSeriesByUuid.mockResolvedValue({
            folder: 's',
            meta: makeSeries(),
        });
        createProject.mockResolvedValue(project);
        const form = makeForm({ selectedSeriesUuid: 'su-1' });
        const result = await executeCreation(form, deps);
        expect(result).toBeDefined();
        expect(createProject).toHaveBeenCalled();
    });
});
