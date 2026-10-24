/**
 * Headless modal cancellation tests.
 *
 * These tests instantiate the actual production modal classes
 * using jsdom and trigger their real cancellation handlers via close().
 *
 * This file runs at test bootstrap via BeforeAll hook and does not
 * contribute to Cucumber scenario counts.
 *
 * IMPORTANT: This file uses require() to load modal classes AFTER
 * the Module._resolveFilename patch is in place (set up by hooks.ts).
 */

'use strict';

const { JSDOM } = require('jsdom');

// Set up jsdom before importing modal classes
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;

// Import production modal classes (obsidian module is patched by hooks.ts)
const { CreateProjectModal } = require('../../../src/components/CreateProjectModal');
const { EventModal } = require('../../../src/components/EventModal');
const { QuickAddModal } = require('../../../src/components/QuickAddModal');

function assert(condition, msg) {
  if (!condition) {
    throw new Error(`Headless modal test failed: ${msg}`);
  }
}

function assertNull(value, msg) {
  assert(value === null, msg);
}

// ─── A. CreateProjectModal ──────────────────────────────────────────────

async function testCreateProjectModalCancel() {
  const app = {
    vault: {
      adapter: {
        read: async () => '{}',
        list: async () => ({ files: [], folders: [] }),
      },
    },
  };

  let createCalled = false;
  const deps = {
    app,
    storyLineRoot: 'StoryLine',
    getAllUniverses: async () => [],
    getAllSeries: async () => [],
    createUniverse: async () => { createCalled = true; throw new Error('should not be called'); },
    createSeries: async () => { createCalled = true; throw new Error('should not be called'); },
    createProject: async () => { createCalled = true; throw new Error('should not be called'); },
    saveProjectFrontmatter: async () => { createCalled = true; throw new Error('should not be called'); },
    getSeriesForUniverse: async () => [],
    getUniverseForSeries: async () => null,
  };

  const modal = new CreateProjectModal(app, deps);
  const promise = modal.openAndWait();

  // Trigger the real cancellation: close() calls onClose(), which calls settle(null)
  modal.close();

  const result = await promise;
  assertNull(result, 'CreateProjectModal cancel resolves to null');
  assert(!createCalled, 'No creation operation should be called on cancel');
}

async function testCreateProjectModalProgrammaticClose() {
  const app = {
    vault: {
      adapter: {
        read: async () => '{}',
        list: async () => ({ files: [], folders: [] }),
      },
    },
  };

  let createCalled = false;
  const deps = {
    app,
    storyLineRoot: 'StoryLine',
    getAllUniverses: async () => [],
    getAllSeries: async () => [],
    createUniverse: async () => { createCalled = true; throw new Error('should not be called'); },
    createSeries: async () => { createCalled = true; throw new Error('should not be called'); },
    createProject: async () => { createCalled = true; throw new Error('should not be called'); },
    saveProjectFrontmatter: async () => { createCalled = true; throw new Error('should not be called'); },
    getSeriesForUniverse: async () => [],
    getUniverseForSeries: async () => null,
  };

  const modal = new CreateProjectModal(app, deps);
  const promise = modal.openAndWait();

  // Simulate Escape key: just call close()
  modal.close();

  const result = await promise;
  assertNull(result, 'CreateProjectModal programmatic close resolves to null');
  assert(!createCalled, 'No creation operation should be called on programmatic close');
}

async function testCreateProjectModalSettleIdempotence() {
  const app = {
    vault: {
      adapter: {
        read: async () => '{}',
        list: async () => ({ files: [], folders: [] }),
      },
    },
  };

  const deps = {
    app,
    storyLineRoot: 'StoryLine',
    getAllUniverses: async () => [],
    getAllSeries: async () => [],
    createUniverse: async () => null,
    createSeries: async () => null,
    createProject: async () => null,
    saveProjectFrontmatter: async () => {},
    getSeriesForUniverse: async () => [],
    getUniverseForSeries: async () => null,
  };

  const modal = new CreateProjectModal(app, deps);
  modal.openAndWait();

  // Call close() multiple times
  modal.close();
  modal.close();

  // The modal should only resolve once (settled flag)
  assert(modal.settled, 'Modal is settled after multiple close calls');
}

// ─── B. EventModal ──────────────────────────────────────────────────────

async function testEventModalCancel() {
  const vault = {
    files: new Map(),
    create: async () => { throw new Error('create should not be called on cancel'); },
    read: async () => '',
    modify: async () => { throw new Error('modify should not be called on cancel'); },
    getAbstractFileByPath: () => null,
    getMarkdownFiles: () => [],
    adapter: {
      exists: async () => false,
      mkdir: async () => {},
      remove: async () => { throw new Error('remove should not be called on cancel'); },
    },
  };

  const app = { vault };

  const eventManager = {
    createEventFile: async () => { throw new Error('createEventFile should not be called on cancel'); },
    saveEvent: async () => { throw new Error('saveEvent should not be called on cancel'); },
    deleteEvent: async () => { throw new Error('deleteEvent should not be called on cancel'); },
  };

  const timeSpanService = {
    parse: () => null,
    serializeToYaml: () => ({}),
    format: () => '',
    compareTimestamps: () => 0,
  };

  const plugin = {};
  const eventsFolder = 'StoryLine/Events';

  const modal = new EventModal(
    app,
    plugin,
    eventManager,
    timeSpanService,
    eventsFolder,
  );

  const promise = modal.openAsync();

  // Trigger the real cancel: close() calls onClose(), which resolves with null
  modal.close();

  const result = await promise;
  assertNull(result, 'EventModal cancel resolves to null');
}

async function testEventModalProgrammaticClose() {
  const vault = {
    files: new Map(),
    create: async () => { throw new Error('create should not be called'); },
    read: async () => '',
    modify: async () => { throw new Error('modify should not be called'); },
    getAbstractFileByPath: () => null,
    getMarkdownFiles: () => [],
    adapter: {
      exists: async () => false,
      mkdir: async () => {},
      remove: async () => { throw new Error('remove should not be called'); },
    },
  };

  const app = { vault };
  const eventManager = {
    createEventFile: async () => { throw new Error('createEventFile should not be called'); },
    saveEvent: async () => { throw new Error('saveEvent should not be called'); },
    deleteEvent: async () => { throw new Error('deleteEvent should not be called'); },
  };
  const timeSpanService = {
    parse: () => null,
    serializeToYaml: () => ({}),
    format: () => '',
    compareTimestamps: () => 0,
  };
  const plugin = {};
  const eventsFolder = 'StoryLine/Events';

  const modal = new EventModal(app, plugin, eventManager, timeSpanService, eventsFolder);
  const promise = modal.openAsync();

  // Simulate Escape key: close() triggers onClose()
  modal.close();

  const result = await promise;
  assertNull(result, 'EventModal programmatic close resolves to null');
}

// ─── C. QuickAddModal ───────────────────────────────────────────────────

function testQuickAddModalCancel() {
  const vault = {
    files: new Map(),
    create: async () => { throw new Error('create should not be called on cancel'); },
    read: async () => '',
    modify: async () => { throw new Error('modify should not be called on cancel'); },
    getAbstractFileByPath: () => null,
    getMarkdownFiles: () => [],
    adapter: {
      exists: async () => false,
      mkdir: async () => {},
      remove: async () => { throw new Error('remove should not be called on cancel'); },
    },
  };

  const app = { vault };

  let onSubmitCalled = false;
  const onSubmit = () => { onSubmitCalled = true; };

  const sceneManager = {
    createScene: async () => { throw new Error('createScene should not be called on cancel'); },
    getAllScenes: () => [],
    queryService: {
      getAllCharacters: () => [],
      getAllTags: () => [],
      getUniqueValues: () => [],
    },
    getChapterLabel: () => '',
  };

  const plugin = {
    settings: { defaultStatus: 'idea', sceneTemplates: [] },
    characterManager: null,
    locationManager: null,
  };

  const modal = new QuickAddModal(app, plugin, sceneManager, onSubmit);

  // Trigger the real cancel: close() calls onClose(), which just empties contentEl
  // No onSubmit callback should fire
  modal.close();

  assert(!onSubmitCalled, 'QuickAddModal cancel does not call onSubmit');
}

function testQuickAddModalProgrammaticClose() {
  const vault = {
    files: new Map(),
    create: async () => { throw new Error('create should not be called'); },
    read: async () => '',
    modify: async () => { throw new Error('modify should not be called'); },
    getAbstractFileByPath: () => null,
    getMarkdownFiles: () => [],
    adapter: {
      exists: async () => false,
      mkdir: async () => {},
      remove: async () => { throw new Error('remove should not be called'); },
    },
  };

  const app = { vault };

  let onSubmitCalled = false;
  const onSubmit = () => { onSubmitCalled = true; };

  const sceneManager = {
    createScene: async () => { throw new Error('createScene should not be called'); },
    getAllScenes: () => [],
    queryService: {
      getAllCharacters: () => [],
      getAllTags: () => [],
      getUniqueValues: () => [],
    },
    getChapterLabel: () => '',
  };

  const plugin = {
    settings: { defaultStatus: 'idea', sceneTemplates: [] },
    characterManager: null,
    locationManager: null,
  };

  const modal = new QuickAddModal(app, plugin, sceneManager, onSubmit);

  // Simulate Escape key: close() triggers onClose()
  modal.close();

  assert(!onSubmitCalled, 'QuickAddModal programmatic close does not call onSubmit');
}

/**
 * Run all headless modal cancellation tests.
 */
async function runHeadlessModalTests() {
  // CreateProjectModal tests
  await testCreateProjectModalCancel();
  await testCreateProjectModalProgrammaticClose();
  await testCreateProjectModalSettleIdempotence();

  // EventModal tests
  await testEventModalCancel();
  await testEventModalProgrammaticClose();

  // QuickAddModal tests
  testQuickAddModalCancel();
  testQuickAddModalProgrammaticClose();
}

module.exports = { runHeadlessModalTests };
