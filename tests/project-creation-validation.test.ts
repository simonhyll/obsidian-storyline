/**
 * @vitest-environment jsdom
 */

/**
 * Project creation validation tests.
 */

import { describe, it, expect } from 'vitest';
import {
    executeCreation,
    CreationValidationError,
} from '../src/services/projectCreation';
import {
    makeForm,
    makeCreationDeps,
} from './fixtures/project-creation-fixtures';

describe('project creation validation', () => {
    it('rejects empty title', async () => {
        const { deps } = makeCreationDeps();
        const form = makeForm({ title: '   ' });
        await expect(executeCreation(form, deps)).rejects.toThrow(
            CreationValidationError,
        );
        expect(deps.createProject).not.toHaveBeenCalled();
    });

    it('rejects blank title', async () => {
        const { deps } = makeCreationDeps();
        const form = makeForm({ title: '' });
        await expect(executeCreation(form, deps)).rejects.toThrow(
            CreationValidationError,
        );
    });

    it('rejects book with new series but empty series name', async () => {
        const { deps } = makeCreationDeps();
        const form = makeForm({
            projectType: 'book',
            selectedSeriesUuid: '__new__',
            newSeriesName: '  ',
        });
        await expect(executeCreation(form, deps)).rejects.toThrow(
            /new series/i,
        );
    });

    it('allows universe creation with valid title', async () => {
        const { deps, createUniverse } = makeCreationDeps();
        createUniverse.mockResolvedValue({ id: 'u1', name: 'U' });
        const form = makeForm({ projectType: 'universe', title: 'My Universe' });
        await executeCreation(form, deps);
        expect(createUniverse).toHaveBeenCalledWith('My Universe');
    });

    it('allows series creation with valid title', async () => {
        const { deps, createSeries } = makeCreationDeps();
        const series = { name: 'My Series', seriesUuid: 'su', bookOrder: [], created: '2024-01-01' };
        createSeries.mockResolvedValue(series);
        const form = makeForm({ projectType: 'series', title: 'My Series' });
        await executeCreation(form, deps);
        expect(createSeries).toHaveBeenCalledWith('My Series', undefined);
    });

    it('validation error message is descriptive', async () => {
        const { deps } = makeCreationDeps();
        const form = makeForm({ title: '' });
        try {
            await executeCreation(form, deps);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).toContain('name');
        }
    });

    it('new series name error is descriptive', async () => {
        const { deps } = makeCreationDeps();
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
