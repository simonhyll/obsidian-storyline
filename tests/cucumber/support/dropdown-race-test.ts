/**
 * Helper for testing the production dropdown race protection.
 *
 * Exercises updateSeriesDropdownInPlace() from CreateProjectDropdowns.ts
 * using jsdom to simulate the browser environment.
 */

import { JSDOM } from 'jsdom';

/**
 * Run the dropdown race test and return the resulting options.
 */
export async function runDropdownRaceTest(): Promise<Array<{ name: string; seriesUuid: string }>> {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	const doc = dom.window.document;
	const win = dom.window;

	// Set up globals for jsdom — needed because the production code uses document.createElement
	(globalThis as any).document = doc;
	(globalThis as any).window = win;

	try {
		return await runRace(doc);
	} finally {
		delete (globalThis as any).document;
		delete (globalThis as any).window;
	}
}

/**
 * Build mock dropdown deps that wait on a controllable promise.
 */
function buildDeps(
	wait: Promise<void>,
	universeId: string,
	seriesUuid: string,
	seriesName: string,
) {
	return {
		discoverSeries: async () => {
			await wait;
			return [{ folder: 'StoryLine/Series', meta: { seriesUuid, name: seriesName, bookOrder: [], created: '' } }];
		},
		discoverHierarchy: async () => {
			await wait;
			return [{
				universe: { id: universeId, name: `Universe ${universeId.slice(-1)}`, seriesIds: [seriesUuid], created: '' },
				series: [{ folder: 'StoryLine/Series', meta: { seriesUuid, name: seriesName, bookOrder: [], created: '' } }],
			}];
		},
		getAllUniverses: async () => [],
	};
}

/**
 * Run the actual race test against production updateSeriesDropdownInPlace.
 */
async function runRace(
	doc: Document,
): Promise<Array<{ name: string; seriesUuid: string }>> {
	const { updateSeriesDropdownInPlace } = await import('../../../src/components/CreateProjectDropdowns');

	const dropdownEl = doc.createElement('select');
	const optNone = doc.createElement('option');
	optNone.value = '';
	optNone.text = '— None —';
	dropdownEl.add(optNone);

	let currentRequestId = 0;

	let resolveA: (() => void) | undefined;
	let resolveB: (() => void) | undefined;
	const waitA = new Promise<void>(r => { resolveA = r; });
	const waitB = new Promise<void>(r => { resolveB = r; });

	const depsA = buildDeps(waitA, 'universe-1', 'series-a', 'Series A');
	const depsB = buildDeps(waitB, 'universe-2', 'series-b', 'Series B');

	const modalChecker = { isClosed: false };

	// Request A (id=1) starts first
	currentRequestId = 1;
	const promiseA = updateSeriesDropdownInPlace({
		deps: depsA,
		dropdownEl,
		selectedUniverseId: 'universe-1',
		requestId: 1,
		getCurrentRequestId: () => currentRequestId,
		modalChecker,
	});

	// Request B (id=2) starts later
	currentRequestId = 2;
	const promiseB = updateSeriesDropdownInPlace({
		deps: depsB,
		dropdownEl,
		selectedUniverseId: 'universe-2',
		requestId: 2,
		getCurrentRequestId: () => currentRequestId,
		modalChecker,
	});

	// B resolves first (faster), A resolves last (stale)
	resolveB!();
	await Promise.resolve();
	resolveA!();
	await Promise.all([promiseA, promiseB]);

	// Collect series options (exclude sentinel options)
	return Array.from(dropdownEl.options)
		.map(o => ({ value: o.value, text: o.text }))
		.filter(o => o.value !== '' && o.value !== '__new__')
		.map(o => ({ name: o.text, seriesUuid: o.value }));
}
