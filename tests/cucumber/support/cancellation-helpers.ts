/**
 * Cancellation test helpers — reusable functions for testing real
 * production modal cancellation in Gherkin steps.
 *
 * Each function sets up jsdom, instantiates the real production modal,
 * clicks the Cancel button, and verifies the expected behavior.
 */

import { JSDOM } from 'jsdom';

/** Set up jsdom and restore after the callback completes. */
async function withJSDOM<T>(fn: () => Promise<T>): Promise<T> {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	const g = globalThis as typeof globalThis & Record<string, unknown>;
	const savedDocument = g.document;
	const savedWindow = g.window;
	const savedHTMLElement = g.HTMLElement;
	const savedEvent = g.Event;
	g.document = dom.window.document;
	g.window = dom.window as unknown as typeof globalThis['window'];
	g.HTMLElement = dom.window.HTMLElement;
	g.Event = dom.window.Event;
	try {
		return await fn();
	} finally {
		g.document = savedDocument;
		g.window = savedWindow;
		g.HTMLElement = savedHTMLElement;
		g.Event = savedEvent;
	}
}

/**
 * Test CreateProjectModal cancellation by clicking the real Cancel button.
 */
export async function testCreateProjectCancel(): Promise<void> {
	await withJSDOM(async () => {
		const { CreateProjectModal } = await import('../../../src/components/CreateProjectModal');
		const app = {
			vault: { adapter: { read: async () => '{}', list: async () => ({ files: [], folders: [] }) } },
		};
		let createCalled = false;
		const deps = {
			app, storyLineRoot: 'StoryLine',
			getAllUniverses: async () => [], getAllSeries: async () => [],
			createUniverse: async () => { createCalled = true; throw new Error('no'); },
			createSeries: async () => { createCalled = true; throw new Error('no'); },
			createProject: async () => { createCalled = true; throw new Error('no'); },
			saveProjectFrontmatter: async () => { createCalled = true; throw new Error('no'); },
			getSeriesForUniverse: async () => [], getUniverseForSeries: async () => null,
		};
		const modal = new CreateProjectModal(app as any, deps as any);
		const promise = modal.openAndWait();
		const cancelBtn = findCancelButton(modal.contentEl);
		if (!cancelBtn) throw new Error('Cancel button not found in CreateProjectModal');
		cancelBtn.click();
		const result = await promise;
		if (result !== null) throw new Error('CreateProjectModal cancel did not resolve to null');
		if (createCalled) throw new Error('Cancellation triggered creation operations');
	});
}

/**
 * Test EventModal cancellation by clicking the real Cancel button.
 */
export async function testEventCancel(): Promise<void> {
	await withJSDOM(async () => {
		const { EventModal } = await import('../../../src/components/EventModal');
		const vault = {
			files: new Map(),
			create: async () => { throw new Error('no'); },
			read: async () => '', modify: async () => { throw new Error('no'); },
			getAbstractFileByPath: () => null, getMarkdownFiles: () => [],
			adapter: { exists: async () => false, mkdir: async () => {}, remove: async () => { throw new Error('no'); } },
		};
		let eventOpCalled = false;
		const eventManager = {
			createEventFile: async () => { eventOpCalled = true; throw new Error('no'); },
			saveEvent: async () => { eventOpCalled = true; throw new Error('no'); },
			deleteEvent: async () => { eventOpCalled = true; throw new Error('no'); },
		};
		const timeSpanService = { parse: () => null, serializeToYaml: () => ({}), format: () => '', compareTimestamps: () => 0 };
		const modal = new EventModal({ vault } as any, {} as any, eventManager as any, timeSpanService as any, 'StoryLine/Events');
		const promise = modal.openAsync();
		const cancelBtn = findCancelButton(modal.contentEl);
		if (!cancelBtn) throw new Error('Cancel button not found in EventModal');
		cancelBtn.click();
		const result = await promise;
		if (result !== null) throw new Error('EventModal cancel did not resolve to null');
		if (eventOpCalled) throw new Error('Cancellation triggered EventManager operations');
	});
}

/** Find a Cancel button by text content. */
function findCancelButton(el: HTMLElement): HTMLButtonElement | null {
	const buttons = el.querySelectorAll('button');
	const found = Array.from(buttons).find((b) => b.textContent === 'Cancel');
	return found as HTMLButtonElement | null;
}
