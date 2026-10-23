/**
 * @vitest-environment jsdom
 */

/**
 * Dropdown basic behavior tests.
 */

import { describe, it, expect } from 'vitest';
import {
    updateSeriesDropdownInPlace,
} from '../src/components/CreateProjectDropdowns';
import {
    makeSeries,
    makeDropdownDeps,
    makeClosedChecker,
    makeRequestIdCounter,
} from './fixtures/project-creation-fixtures';

function makeSelect(): HTMLSelectElement {
    const el = document.createElement('select');
    el.innerHTML = '<option value="">— None —</option>';
    return el;
}

describe('dropdown basic behavior', () => {
    it('applies results when request ID matches', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const checker = makeClosedChecker(false);
        const counter = makeRequestIdCounter();
        counter.next();
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: counter.getCurrent,
            modalChecker: checker,
        });
        expect(select.options.length).toBeGreaterThan(1);
    });

    it('skips results when a newer request has arrived', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const checker = makeClosedChecker(false);
        const counter = makeRequestIdCounter();
        counter.next();
        counter.next();
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: counter.getCurrent,
            modalChecker: checker,
        });
        expect(
            Array.from(select.options).some(o => o.value === 's1'),
        ).toBe(false);
    });

    it('skips results when modal is closed', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const checker = makeClosedChecker(true);
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: () => 1,
            modalChecker: checker,
        });
        expect(
            Array.from(select.options).some(o => o.value === 's1'),
        ).toBe(false);
    });

    it('preserves valid selection after update', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const opt = document.createElement('option');
        opt.value = 's1';
        select.add(opt);
        select.value = 's1';
        const checker = makeClosedChecker(false);
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: () => 1,
            modalChecker: checker,
        });
        expect(select.value).toBe('s1');
    });

    it('resets selection when previous value is invalid', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });
        discoverSeries.mockResolvedValue([{ folder: 's1', meta: seriesMeta }]);
        const select = makeSelect();
        const opt = document.createElement('option');
        opt.value = 'old_series';
        select.add(opt);
        select.value = 'old_series';
        const checker = makeClosedChecker(false);
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: () => 1,
            modalChecker: checker,
        });
        expect(select.value).not.toBe('old_series');
    });

    it('filters series by selected universe', async () => {
        const { deps, discoverSeries, discoverHierarchy } = makeDropdownDeps();
        const s1 = makeSeries({ seriesUuid: 's1' });
        const s2 = makeSeries({ seriesUuid: 's2' });
        discoverSeries.mockResolvedValue([
            { folder: 's1', meta: s1 },
            { folder: 's2', meta: s2 },
        ]);
        discoverHierarchy.mockResolvedValue([
            {
                universe: { id: 'u1', name: 'U1' },
                series: [{ folder: 's1', meta: s1 }],
            },
        ]);
        const select = makeSelect();
        const checker = makeClosedChecker(false);
        await updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: 'u1',
            requestId: 1,
            getCurrentRequestId: () => 1,
            modalChecker: checker,
        });
        const values = Array.from(select.options).map(o => o.value);
        expect(values).toContain('s1');
        expect(values).not.toContain('s2');
    });
});
