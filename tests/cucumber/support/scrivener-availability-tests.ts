/**
 * Scrivener command availability integration test.
 *
 * Exercises the real production `canImportScrivener` function from
 * `registerCommands.ts` directly with the controllable Platform mock.
 *
 * This file runs at test bootstrap via BeforeAll hook and does not
 * contribute to Cucumber scenario counts.
 */

import { Platform } from './obsidian-mock';
import { canImportScrivener } from '../../../src/commands/scrivener-availability';

function assert(condition: boolean, msg: string) {
	if (!condition) {
		throw new Error(`Scrivener availability test failed: ${msg}`);
	}
}

/** Minimal mock plugin target for canImportScrivener. */
const mockPlugin: any = {
	app: { vault: {} },
	sceneManager: { activeProject: null },
};

/**
 * Test that the production canImportScrivener predicate correctly
 * gates the command based on Platform.isMobile.
 */
function testScrivenerCommandAvailability() {
	// Reset Platform state
	Platform.isMobile = false;

	// Test desktop: should return true
	const desktopResult = canImportScrivener(mockPlugin, true);
	assert(desktopResult === true, 'Scrivener available on desktop');

	// Test mobile: should return false
	Platform.isMobile = true;
	const mobileResult = canImportScrivener(mockPlugin, true);
	assert(mobileResult === false, 'Scrivener hidden on mobile');

	// Reset Platform state
	Platform.isMobile = false;
}

/**
 * Test that canImportScrivener(false) on desktop returns true
 * (and attempts to dynamically import the scrivener module).
 */
function testScrivenerDesktopExecution() {
	Platform.isMobile = false;
	const result = canImportScrivener(mockPlugin, false);
	assert(result === true, 'canImportScrivener(false) returns true on desktop');
	Platform.isMobile = false;
}

/** Run all Scrivener availability tests. */
export function runScrivenerAvailabilityTests() {
	testScrivenerCommandAvailability();
	testScrivenerDesktopExecution();
}
