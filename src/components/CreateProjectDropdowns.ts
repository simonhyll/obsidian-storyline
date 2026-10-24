/**
 * Populates the Universe and Series dropdowns in the CreateProjectModal.
 *
 * Separated from the modal to keep it under the 200-line architectural limit.
 * Handles async population with stale-response protection to prevent race
 * conditions when the user changes selections quickly.
 */

import type { SeriesMetadata } from '../models/StoryLineProject';
import type { UniverseMetadata } from '../models/Universe';

/**
 * Dependencies for dropdown population.
 */
export interface DropdownDeps {
    /** Discover all Series in the vault. */
    discoverSeries: () => Promise<Array<{ folder: string; meta: SeriesMetadata }>>;
    /** Discover the Universe → Series hierarchy. */
    discoverHierarchy: () => Promise<Array<{
        universe: UniverseMetadata;
        series: Array<{ folder: string; meta: SeriesMetadata }>;
    }>>;
    /** Get all Universes. */
    getAllUniverses: () => Promise<UniverseMetadata[]>;
}

/**
 * A minimal interface for checking whether the modal is still open.
 */
export interface ModalClosedChecker {
    /** True if the modal has been closed. */
    isClosed: boolean;
}

/**
 * Options for updating a series dropdown in-place.
 *
 * Uses a live request-id getter function so the freshness check compares
 * against the current modal counter, not a stale snapshot taken before
 * the async await.
 */
export interface UpdateSeriesDropdownOptions {
    /** Dropdown dependencies. */
    deps: DropdownDeps;
    /** The select element to update. */
    dropdownEl: HTMLSelectElement;
    /** Currently selected universe ID. */
    selectedUniverseId: string;
    /** The request ID this call was made with. */
    requestId: number;
    /** Get the current live request ID from the modal. */
    getCurrentRequestId: () => number;
    /** Check if the modal has been closed. */
    modalChecker: ModalClosedChecker;
}

/**
 * Populate the universe dropdown with all available universes.
 *
 * @param deps - Dropdown dependencies.
 * @param defaultUniverseId - Optional pre-selected universe.
 * @returns The populated dropdown element.
 */
export async function populateUniverseDropdown(
    deps: DropdownDeps,
    defaultUniverseId?: string,
): Promise<HTMLSelectElement> {
    const dropdownEl = document.createElement('select');
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.text = '— None —';
    dropdownEl.add(optNone);

    try {
        const universes = await deps.getAllUniverses();
        for (const u of universes) {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.text = u.name;
            dropdownEl.add(opt);
        }
        if (defaultUniverseId) dropdownEl.value = defaultUniverseId;
    } catch { /* no universes yet */ }

    return dropdownEl;
}

/**
 * Populate the series dropdown with series filtered by the selected universe.
 *
 * @param deps - Dropdown dependencies.
 * @param selectedUniverseId - Currently selected universe ID.
 * @param defaultSeriesUuid - Optional pre-selected series.
 * @returns The populated dropdown element.
 */
export async function populateSeriesDropdown(
    deps: DropdownDeps,
    selectedUniverseId: string,
    defaultSeriesUuid?: string,
): Promise<HTMLSelectElement> {
    const dropdownEl = document.createElement('select');
    dropdownEl.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.text = '— None —';
    dropdownEl.add(optNone);
    const optNew = document.createElement('option');
    optNew.value = '__new__';
    optNew.text = '+ Create new series…';
    dropdownEl.add(optNew);

    try {
        const seriesList = await fetchSeriesForUniverse(deps, selectedUniverseId);
        for (const s of seriesList) {
            const opt = document.createElement('option');
            opt.value = s.uuid;
            opt.text = s.name;
            dropdownEl.add(opt);
        }
        if (defaultSeriesUuid) dropdownEl.value = defaultSeriesUuid;
    } catch { /* no series yet */ }

    return dropdownEl;
}

/**
 * Update an existing series dropdown in-place, preserving the current selection.
 * Skips the update if the modal has been closed or if a newer request has arrived.
 *
 * The freshness check uses a live request-id getter so it compares against
 * the current modal counter after the async await, not a stale snapshot.
 *
 * @param opts - Options object containing all parameters.
 */
export async function updateSeriesDropdownInPlace(
    opts: UpdateSeriesDropdownOptions,
): Promise<void> {
    const currentVal = opts.dropdownEl.value;
    opts.dropdownEl.innerHTML = '';
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.text = '— None —';
    opts.dropdownEl.add(optNone);
    const optNew = document.createElement('option');
    optNew.value = '__new__';
    optNew.text = '+ Create new series…';
    opts.dropdownEl.add(optNew);

    try {
        const seriesList = await fetchSeriesForUniverse(
            opts.deps,
            opts.selectedUniverseId,
        );
        // Skip if modal closed
        if (opts.modalChecker.isClosed) return;
        // Check freshness against the LIVE modal counter, not a snapshot
        if (opts.getCurrentRequestId() !== opts.requestId) return;
        for (const s of seriesList) {
            const opt = document.createElement('option');
            opt.value = s.uuid;
            opt.text = s.name;
            opts.dropdownEl.add(opt);
        }
        // If the previously selected series is still valid, restore it;
        // otherwise reset to none so an incompatible selection isn't kept.
        if (currentVal && Array.from(opts.dropdownEl.options).some(o => o.value === currentVal)) {
            opts.dropdownEl.value = currentVal;
        }
    } catch { /* no series yet */ }
}

/**
 * Fetch series filtered by the selected universe.
 *
 * @param deps - Dropdown dependencies.
 * @param selectedUniverseId - The currently selected universe ID.
 * @returns Array of series with UUID and name.
 */
export async function fetchSeriesForUniverse(
    deps: DropdownDeps,
    selectedUniverseId: string,
): Promise<Array<{ uuid: string; name: string }>> {
    const universeSeriesUuids = await getUniverseSeriesUuids(deps, selectedUniverseId);
    const allSeries = await deps.discoverSeries();
    const result: Array<{ uuid: string; name: string }> = [];
    for (const { meta } of allSeries) {
        if (!meta.seriesUuid) continue;
        if (selectedUniverseId && !universeSeriesUuids.has(meta.seriesUuid)) {
            continue;
        }
        result.push({ uuid: meta.seriesUuid, name: meta.name });
    }
    return result;
}

/**
 * Get the set of series UUIDs belonging to the specified universe.
 *
 * @param deps - Dropdown dependencies.
 * @param universeId - The universe ID to look up.
 * @returns Set of series UUIDs.
 */
async function getUniverseSeriesUuids(
    deps: DropdownDeps,
    universeId: string,
): Promise<Set<string>> {
    const uuids = new Set<string>();
    if (!universeId) return uuids;
    const hierarchy = await deps.discoverHierarchy();
    for (const entry of hierarchy) {
        if (entry.universe.id !== universeId) continue;
        for (const { meta } of entry.series) {
            if (meta.seriesUuid) uuids.add(meta.seriesUuid);
        }
    }
    return uuids;
}
