/**
 * Helper for testing the production dropdown race protection.
 *
 * Exercises updateSeriesDropdownInPlace() from CreateProjectDropdowns.ts
 * using jsdom to simulate the browser environment.
 *
 * This is a CommonJS module because it needs require() for jsdom and
 * the production TypeScript module, and uses globalThis for jsdom setup.
 */

"use strict";

const { JSDOM } = require("jsdom");

/**
 * Run the dropdown race test and return the resulting options.
 * @returns {Array<{name: string, seriesUuid: string}>}
 */
async function runDropdownRaceTest() {
	const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
	const doc = dom.window.document;
	const win = dom.window;

	// Set up globals for jsdom — needed because the production code uses document.createElement
	global.document = doc;
	global.window = win;

	try {
		return await runRace(doc);
	} finally {
		delete global.document;
		delete global.window;
	}
}

/**
 * Build mock dropdown deps that wait on a controllable promise.
 */
function buildDeps(wait, universeId, seriesUuid, seriesName) {
	return {
		discoverSeries: async () => {
			await wait;
			return [{ folder: "StoryLine/Series", meta: { seriesUuid, name: seriesName, bookOrder: [], created: "" } }];
		},
		discoverHierarchy: async () => {
			await wait;
			return [{
				universe: { id: universeId, name: `Universe ${universeId.slice(-1)}`, seriesIds: [seriesUuid], created: "" },
				series: [{ folder: "StoryLine/Series", meta: { seriesUuid, name: seriesName, bookOrder: [], created: "" } }],
			}];
		},
		getAllUniverses: async () => [],
	};
}

/**
 * Run the actual race test against production updateSeriesDropdownInPlace.
 */
async function runRace(doc) {
	const { updateSeriesDropdownInPlace } = require("../../../src/components/CreateProjectDropdowns");

	const dropdownEl = doc.createElement("select");
	const optNone = doc.createElement("option");
	optNone.value = "";
	optNone.text = "— None —";
	dropdownEl.add(optNone);

	let currentRequestId = 0;

	let resolveA;
	let resolveB;
	const waitA = new Promise(r => { resolveA = r; });
	const waitB = new Promise(r => { resolveB = r; });

	const depsA = buildDeps(waitA, "universe-1", "series-a", "Series A");
	const depsB = buildDeps(waitB, "universe-2", "series-b", "Series B");

	const modalChecker = { isClosed: false };

	// Request A (id=1) starts first
	currentRequestId = 1;
	const promiseA = updateSeriesDropdownInPlace({
		deps: depsA,
		dropdownEl,
		selectedUniverseId: "universe-1",
		requestId: 1,
		getCurrentRequestId: () => currentRequestId,
		modalChecker,
	});

	// Request B (id=2) starts later
	currentRequestId = 2;
	const promiseB = updateSeriesDropdownInPlace({
		deps: depsB,
		dropdownEl,
		selectedUniverseId: "universe-2",
		requestId: 2,
		getCurrentRequestId: () => currentRequestId,
		modalChecker,
	});

	// B resolves first (faster), A resolves last (stale)
	resolveB();
	await Promise.resolve();
	resolveA();
	await Promise.all([promiseA, promiseB]);

	// Collect series options (exclude sentinel options)
	return Array.from(dropdownEl.options)
		.map(o => ({ value: o.value, text: o.text }))
		.filter(o => o.value !== "" && o.value !== "__new__")
		.map(o => ({ name: o.text, seriesUuid: o.value }));
}

module.exports = { runDropdownRaceTest };
