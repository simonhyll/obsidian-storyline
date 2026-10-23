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
 * State required for dropdown operations.
 */
export interface DropdownState {
    /** Currently selected universe ID. */
    selectedUniverseId: string;
    /** Monotonically increasing request ID for stale-response protection. */
    seriesDropdownRequestId: number;
}

/**
 * A minimal interface for checking whether the modal is still open.
 */
export interface ModalClosedChecker {
    /** True if the modal has been closed. */
    isClosed: boolean;
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
 * @param state - Current dropdown state.
 * @param defaultSeriesUuid - Optional pre-selected series.
 * @returns The populated dropdown element.
 */
export async function populateSeriesDropdown(
    deps: DropdownDeps,
    state: DropdownState,
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
        const seriesList = await fetchSeriesForUniverse(deps, state.selectedUniverseId);
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
 * @param deps - Dropdown dependencies.
 * @param dropdownEl - The select element to update.
 * @param state - Current dropdown state (snapshot at call time).
 * @param requestId - The request ID this call was made with.
 * @param modalChecker - Interface to check if the modal is closed.
 */
export async function updateSeriesDropdownInPlace(
    deps: DropdownDeps,
    dropdownEl: HTMLSelectElement,
    state: DropdownState,
    requestId: number,
    modalChecker: ModalClosedChecker,
): Promise<void> {
    const currentVal = dropdownEl.value;
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
        const seriesList = await fetchSeriesForUniverse(deps, state.selectedUniverseId);
        // Skip if modal closed or a newer request superseded this one
        if (modalChecker.isClosed) return;
        if (state.seriesDropdownRequestId !== requestId) return;
        for (const s of seriesList) {
            const opt = document.createElement('option');
            opt.value = s.uuid;
            opt.text = s.name;
            dropdownEl.add(opt);
        }
        // If the previously selected series is still valid, restore it;
        // otherwise reset to none so an incompatible selection isn't kept.
        if (currentVal && Array.from(dropdownEl.options).some(o => o.value === currentVal)) {
            dropdownEl.value = currentVal;
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
