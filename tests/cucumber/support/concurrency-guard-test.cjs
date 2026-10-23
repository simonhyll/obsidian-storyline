/**
 * Helper for testing the production concurrency guard from CreateProjectModal.
 *
 * Exercises the actual CreationConcurrencyGuard class extracted from
 * CreateProjectModal.ts. The modal delegates to this coordinator, so
 * testing it directly verifies the production concurrency behavior.
 *
 * The test verifies:
 * - First click starts creation
 * - Second click is blocked while first is pending
 * - Exactly one persistence operation executes
 * - Guard is released after completion
 * - Guard is released after failure
 * - Subsequent attempt after failure can succeed
 */

"use strict";

const { executeCreation } = require("../../../src/services/projectCreation");
const { CreationConcurrencyGuard } = require("../../../src/services/creationGuard");

/**
 * Run the production concurrency guard test.
 * @param {import('../support/world').TestWorld} world
 * @param {object} formState
 * @param {function} makeDepsFactory
 * @returns {Promise<{createCallCount: number, secondCallBlocked: boolean}>}
 */
async function runConcurrencyGuardTest(world, formState, makeDepsFactory) {
	// Use the production CreationConcurrencyGuard from CreateProjectModal
	const guard = new CreationConcurrencyGuard();

	// Build deps with a slow createProject to keep the first operation pending
	const deps = makeDepsFactory(world);
	let createCallCount = 0;
	let resolveSlowCreate;
	const slowPromise = new Promise(resolve => { resolveSlowCreate = resolve; });

	const originalCreateProject = deps.createProject;
	deps.createProject = async (...args) => {
		createCallCount++;
		await slowPromise;
		return originalCreateProject(...args);
	};

	// Simulate the production handleCreate() flow using the real guard.
	// The guard must be acquired synchronously before any await, exactly
	// as CreateProjectModal.handleCreate() does: it calls tryStart() and
	// returns immediately if null, before awaiting executeCreation.
	let release1 = null;
	let release2 = null;

	// Acquire the guard synchronously for both calls, mimicking two rapid
	// clicks that happen before either operation reaches its first await.
	release1 = guard.tryStart();
	release2 = guard.tryStart(); // Should return null (blocked)

	if (release2 !== null) {
		throw new Error("Second call was NOT blocked by production guard.tryStart()");
	}

	// Only the first call proceeds to executeCreation
	const firstCall = (async () => {
		if (!release1) return;
		try {
			const project = await executeCreation(formState, deps);
			world.createdProject = project ?? undefined;
			if (project) {
				world.activeBook = project;
				world.books.push(project);
			}
		} finally {
			release1();
		}
	})();

	// Second call returns immediately (blocked)
	const secondCall = Promise.resolve();

	// Resolve the slow promise to complete the first creation
	resolveSlowCreate();
	await Promise.all([firstCall, secondCall]);

	// Verify exactly one createProject call was made
	if (createCallCount !== 1) {
		throw new Error(`Expected exactly 1 createProject call, got ${createCallCount}`);
	}

	// Verify guard is released — a third call should work
	const release3 = guard.tryStart();
	if (!release3) {
		throw new Error("Guard not released after first operation completed");
	}
	try {
		const project = await executeCreation(formState, deps);
		// Don't store this one, just verify the guard released
	} finally {
		release3();
	}

	if (createCallCount !== 2) {
		throw new Error(`Expected 2 createProject calls after guard release, got ${createCallCount}`);
	}

	// Test that failed operations release the guard
	let failCount = 0;
	deps.createProject = async () => {
		failCount++;
		throw new Error("Simulated failure");
	};

	// First failing call
	const releaseFail1 = guard.tryStart();
	if (!releaseFail1) throw new Error("Guard should allow new call after release");
	try {
		await executeCreation(formState, deps);
	} catch (e) {
		// Expected failure
	} finally {
		releaseFail1();
	}

	// Second failing call — guard should be released
	const releaseFail2 = guard.tryStart();
	if (!releaseFail2) {
		throw new Error("Guard not released after failure");
	}
	try {
		await executeCreation(formState, deps);
	} catch (e) {
		// Expected failure
	} finally {
		releaseFail2();
	}

	// Both calls should have attempted createProject
	if (failCount < 2) {
		throw new Error(`Guard not released after failure: only ${failCount} attempts`);
	}

	// Verify the guard's pending property works correctly
	if (guard.pending) {
		throw new Error("Guard should not be pending after all operations complete");
	}

	return { createCallCount: 2, secondCallBlocked: true };
}

module.exports = { runConcurrencyGuardTest };
