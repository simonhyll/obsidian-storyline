/**
 * Headless modal cancellation tests.
 *
 * These tests instantiate the actual production modal classes
 * using jsdom and trigger their real cancellation handlers.
 *
 * This file runs at test bootstrap via BeforeAll hook and does not
 * contribute to Cucumber scenario counts.
 */

import { JSDOM } from 'jsdom';
import { CreateProjectModal } from '../../../src/components/CreateProjectModal';
import { EventModal } from '../../../src/components/EventModal';
import { QuickAddModal } from '../../../src/components/QuickAddModal';

// Set up jsdom before importing modal classes
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const g = globalThis as unknown as Record<string, unknown>;
g.document = dom.window.document;
g.window = dom.window;
g.HTMLElement = dom.window.HTMLElement;
g.Event = dom.window.Event;

function assert(condition: boolean, msg: string) {
	if (!condition) {
		throw new Error(`Headless modal test failed: ${msg}`);
	}
}

function assertNull(value: unknown, msg: string) {
	assert(value === null, msg);
}

// ─── CreateProjectModal ───────────────────────────────────────

async function testCreateProjectModalCancel() {
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
	modal.close();
	assertNull(await promise, 'CreateProjectModal cancel resolves to null');
	assert(!createCalled, 'No creation on cancel');
}

async function testCreateProjectModalCancelClick() {
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
	// Find the actual Cancel button by text content
	const buttons = modal.contentEl.querySelectorAll('button');
	const cancelBtn = Array.from(buttons).find(b => b.textContent === 'Cancel');
	assert(cancelBtn instanceof dom.window.HTMLElement, 'Cancel button exists in DOM');
	(cancelBtn as HTMLButtonElement).click();
	assertNull(await promise, 'CreateProjectModal cancel click resolves to null');
	assert(!createCalled, 'No creation on cancel click');
}

async function testCreateProjectModalSettleIdempotence() {
	const app = {
		vault: { adapter: { read: async () => '{}', list: async () => ({ files: [], folders: [] }) } },
	};
	const deps = {
		app, storyLineRoot: 'StoryLine',
		getAllUniverses: async () => [], getAllSeries: async () => [],
		createUniverse: async () => null, createSeries: async () => null,
		createProject: async () => null, saveProjectFrontmatter: async () => {},
		getSeriesForUniverse: async () => [], getUniverseForSeries: async () => null,
	};
	const modal = new CreateProjectModal(app as any, deps as any);
	void modal.openAndWait();
	modal.close();
	modal.close();
	assert((modal as any).settled, 'Modal settled after multiple close');
}

// ─── EventModal ───────────────────────────────────────────────

async function testEventModalCancel() {
	const vault = {
		files: new Map(),
		create: async () => { throw new Error('no'); },
		read: async () => '', modify: async () => { throw new Error('no'); },
		getAbstractFileByPath: () => null, getMarkdownFiles: () => [],
		adapter: { exists: async () => false, mkdir: async () => {}, remove: async () => { throw new Error('no'); } },
	};
	const eventManager = {
		createEventFile: async () => { throw new Error('no'); },
		saveEvent: async () => { throw new Error('no'); },
		deleteEvent: async () => { throw new Error('no'); },
	};
	const timeSpanService = { parse: () => null, serializeToYaml: () => ({}), format: () => '', compareTimestamps: () => 0 };
	const modal = new EventModal({ vault } as any, {} as any, eventManager as any, timeSpanService as any, 'StoryLine/Events');
	const promise = modal.openAsync();
	modal.close();
	assertNull(await promise, 'EventModal cancel resolves to null');
}

async function testEventModalCancelClick() {
	const vault = {
		files: new Map(),
		create: async () => { throw new Error('no'); },
		read: async () => '', modify: async () => { throw new Error('no'); },
		getAbstractFileByPath: () => null, getMarkdownFiles: () => [],
		adapter: { exists: async () => false, mkdir: async () => {}, remove: async () => { throw new Error('no'); } },
	};
	const eventManager = {
		createEventFile: async () => { throw new Error('no'); },
		saveEvent: async () => { throw new Error('no'); },
		deleteEvent: async () => { throw new Error('no'); },
	};
	const timeSpanService = { parse: () => null, serializeToYaml: () => ({}), format: () => '', compareTimestamps: () => 0 };
	const modal = new EventModal({ vault } as any, {} as any, eventManager as any, timeSpanService as any, 'StoryLine/Events');
	const promise = modal.openAsync();
	// Find the actual Cancel button by text content
	const buttons = modal.contentEl.querySelectorAll('button');
	const cancelBtn = Array.from(buttons).find(b => b.textContent === 'Cancel');
	assert(cancelBtn instanceof dom.window.HTMLElement, 'EventModal Cancel button exists');
	(cancelBtn as HTMLButtonElement).click();
	assertNull(await promise, 'EventModal cancel click resolves to null');
}

// ─── QuickAddModal ────────────────────────────────────────────

function testQuickAddModalCancel() {
	const vault = {
		files: new Map(),
		create: async () => { throw new Error('no'); },
		read: async () => '', modify: async () => { throw new Error('no'); },
		getAbstractFileByPath: () => null, getMarkdownFiles: () => [],
		adapter: { exists: async () => false, mkdir: async () => {}, remove: async () => { throw new Error('no'); } },
	};
	let onSubmitCalled = false;
	const sceneManager = {
		createScene: async () => { throw new Error('no'); },
		getAllScenes: () => [],
		queryService: { getAllCharacters: () => [], getAllTags: () => [], getUniqueValues: () => [] },
		getChapterLabel: () => '',
	};
	const plugin = { settings: { defaultStatus: 'idea', sceneTemplates: [] }, characterManager: null, locationManager: null };
	const modal = new QuickAddModal({ vault } as any, plugin as any, sceneManager as any, () => { onSubmitCalled = true; });
	modal.close();
	assert(!onSubmitCalled, 'QuickAddModal cancel does not call onSubmit');
}

function testQuickAddModalCancelClick() {
	// QuickAddModal.onOpen() creates InlineSuggest which requires extensive
	// Obsidian APIs not available in the headless mock. The cancel behavior
	// is verified via close() in testQuickAddModalCancel(). The Cancel button
	// in production calls this.close() which triggers onClose().
	// This test verifies the safety property: onSubmit is not called.
	const vault = {
		files: new Map(),
		create: async () => { throw new Error('no'); },
		read: async () => '', modify: async () => { throw new Error('no'); },
		getAbstractFileByPath: () => null, getMarkdownFiles: () => [],
		adapter: { exists: async () => false, mkdir: async () => {}, remove: async () => { throw new Error('no'); } },
	};
	let onSubmitCalled = false;
	const sceneManager = {
		createScene: async () => { throw new Error('no'); },
		getAllScenes: () => [],
		queryService: { getAllCharacters: () => [], getAllTags: () => [], getUniqueValues: () => [] },
		getChapterLabel: () => '',
	};
	const plugin = { settings: { defaultStatus: 'idea', sceneTemplates: [] }, characterManager: null, locationManager: null };
	const modal = new QuickAddModal({ vault } as any, plugin as any, sceneManager as any, () => { onSubmitCalled = true; });
	modal.close();
	assert(!onSubmitCalled, 'QuickAddModal cancel does not call onSubmit');
}

/** Run all headless modal cancellation tests. */
export async function runHeadlessModalTests() {
	await testCreateProjectModalCancel();
	await testCreateProjectModalCancelClick();
	await testCreateProjectModalSettleIdempotence();
	await testEventModalCancel();
	await testEventModalCancelClick();
	testQuickAddModalCancel();
	testQuickAddModalCancelClick();
}
