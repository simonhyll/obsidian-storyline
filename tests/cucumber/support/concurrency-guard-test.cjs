/**
 * Helper for testing the production concurrency guard pattern.
 *
 * Exercises the isCreating flag pattern from CreateProjectModal.handleCreate():
 *   if (this.isCreating) return;
 *   this.isCreating = true;
 *   try { await executeCreation(...) } finally { this.isCreating = false; }
 */

"use strict";

const { executeCreation } = require("../../../src/services/projectCreation");

/**
 * Run the double-click concurrency guard test.
 * @param {import('../support/world').TestWorld} world
 * @param {object} formState
 * @param {function} makeDeps
 * @returns {Promise<{createCount: number}>}
 */
async function runConcurrencyGuardTest(world, formState, makeDeps) {
	let isCreating = false;
	let createCallCount = 0;
	let secondCallBlocked = false;
	const deps = makeDeps(world);

	const originalCreateProject = deps.createProject;
	let resolveSlowCreate;
	const slowPromise = new Promise(resolve => { resolveSlowCreate = resolve; });
	deps.createProject = async (...args) => {
		createCallCount++;
		await slowPromise;
		return originalCreateProject(...args);
	};

	const firstPromise = (async () => {
		if (isCreating) return;
		isCreating = true;
		try {
			const project = await executeCreation(formState, deps);
			world.createdProject = project ?? undefined;
			if (project) {
				world.activeBook = project;
				world.books.push(project);
			}
		} finally {
			isCreating = false;
		}
	})();

	const secondPromise = (async () => {
		if (isCreating) {
			secondCallBlocked = true;
			return;
		}
		isCreating = true;
		try {
			await executeCreation(formState, deps);
		} finally {
			isCreating = false;
		}
	})();

	resolveSlowCreate();
	await Promise.all([firstPromise, secondPromise]);

	if (!secondCallBlocked) {
		throw new Error("Second create call was NOT blocked by isCreating guard");
	}
	return { createCallCount };
}

module.exports = { runConcurrencyGuardTest };
