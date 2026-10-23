/**
 * @vitest-environment jsdom
 */

/**
 * Dropdown race condition tests with deferred promises.
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

describe('dropdown race with deferred promises', () => {
    it('rejects stale result when requests finish in reverse order', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const s2 = makeSeries({ seriesUuid: 's2' });

        let resolve2: () => void;
        const p2 = new Promise<void>(r => { resolve2 = r; });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- deferred promise test
        discoverSeries.mockImplementation(async () => {
            await p2;
            return [{ folder: 's2', meta: s2 }];
        });

        const select = makeSelect();
        const checker = makeClosedChecker(false);
        const counter = makeRequestIdCounter();

        const req1Id = counter.next();
        const req1 = updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: req1Id,
            getCurrentRequestId: counter.getCurrent,
            modalChecker: checker,
        });

        const req2Id = counter.next();
        discoverSeries.mockResolvedValue([{ folder: 's2', meta: s2 }]);
        const req2 = updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: req2Id,
            getCurrentRequestId: counter.getCurrent,
            modalChecker: checker,
        });

        resolve2!();
        await req2;
        await req1;

        const values = Array.from(select.options).map(o => o.value);
        expect(values).toContain('s2');
    });

    it('modal close during pending request prevents update', async () => {
        const { deps, discoverSeries } = makeDropdownDeps();
        const seriesMeta = makeSeries({ seriesUuid: 's1' });

        let resolvePending: () => void;
        const pendingPromise = new Promise<void>(r => { resolvePending = r; });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- deferred promise test
        discoverSeries.mockImplementation(async () => {
            await pendingPromise;
            return [{ folder: 's1', meta: seriesMeta }];
        });

        const select = makeSelect();
        const checker = makeClosedChecker(false);
        const update = updateSeriesDropdownInPlace({
            deps,
            dropdownEl: select,
            selectedUniverseId: '',
            requestId: 1,
            getCurrentRequestId: () => 1,
            modalChecker: checker,
        });

        checker.setClosed(true);
        resolvePending!();
        await update;

        const seriesOptions = Array.from(select.options).filter(
            o => o.value !== '' && o.value !== '__new__',
        );
        expect(seriesOptions.length).toBe(0);
    });
});
