/**
 * Step definitions for project restoration after restart.
 *
 * Uses a real plugin data store so settings are persisted and reloaded,
 * not shared in-memory. Verifies that activeProjectFile is correctly
 * restored after a simulated plugin restart.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import type { TestWorld } from '../support/world';
import { setupHierarchyTest, createReloadedSceneManager } from '../support/hierarchy-test-helpers';
import { createPluginDataStore } from '../support/plugin-data-store';
import { parseFrontmatter } from '../support/in-memory-vault';

Given('an existing active book {string}', async function (this: TestWorld, title: string) {
  const { vault, sceneManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.hierarchySceneManager = sceneManager;
  this.hierarchyPlugin = plugin;

  // Create a plugin data store to simulate data.json persistence
  const dataStore = createPluginDataStore();
  this.pluginDataStore = dataStore;

  // Wire plugin.saveSettings() to the data store so that production
  // setActiveProject() persists through the real saveSettings callback.
  plugin.saveSettings = async () => {
    await dataStore.saveData(plugin.settings as unknown as Record<string, unknown>);
  };

  // Create two books; Book A first, Book B second.
  // Book B will be set as active, so it is NOT the first discovered.
  const bookA = await sceneManager.createProject('Book Alpha');
  const bookB = await sceneManager.createProject(title);

  // Set Book B as active — production setActiveProject() calls
  // plugin.saveSettings(), which persists to the data store.
  await sceneManager.setActiveProject(bookB);

  // Verify that saveSettings was actually called and persisted
  const persisted = await dataStore.loadData();
  if (!persisted || !persisted.activeProjectFile) {
    throw new Error('setActiveProject did not persist activeProjectFile via saveSettings');
  }

  // Create scenes in each book (names match their owners)
  await sceneManager.setActiveProject(bookA);
  const sceneA = await sceneManager.createScene({ title: 'Scene in Alpha' });
  await sceneManager.setActiveProject(bookB);
  const sceneB = await sceneManager.createScene({ title: 'Scene in Beta' });

  // Store references for assertions
  this.bookA = bookA;
  this.bookB = bookB;
  // createScene returns TFile, store the path for later verification
  this.sceneA = sceneA as any;
  this.sceneB = sceneB as any;
  this.books = [bookA, bookB];
});

When('I restart the plugin', async function (this: TestWorld) {
  const vault = this.testVault;
  const dataStore = this.pluginDataStore;
  if (!vault || !dataStore) {
    throw new Error('Restart test not set up');
  }

  // Load settings from persisted data (simulates plugin.loadData())
  const persisted = await dataStore.loadData();
  if (!persisted) {
    throw new Error('No persisted settings found');
  }

  // Create a new plugin mock with settings loaded from persistence
  const newPlugin = {
    settings: {
      storyLineRoot: 'StoryLine',
      activeProjectFile: (persisted.activeProjectFile as string) || '',
    },
    sceneManager: null as any,
    seriesManager: null as any,
    flushCorkboardPositions: async () => {},
    invalidateCorkboardCache: () => {},
    saveSettings: async () => {},
    flushPendingWritingChanges: () => {},
    saveProjectSystemData: async () => {},
    loadProjectSystemData: async () => {},
    fieldTemplates: { load: async () => {}, getAll: () => [] },
  };

  // Create a fresh SceneManager against the same vault
  const newSceneManager = createReloadedSceneManager(vault, newPlugin as any);

  // Run production project discovery — scanProjects reads activeProjectFile
  // from the new plugin's settings and restores the correct active project
  const projects = await newSceneManager.scanProjects();
  this.restartedProjects = projects;
  this.restartedSceneManager = newSceneManager;
});

Then('the active book is restored to {string}', async function (this: TestWorld, title: string) {
  const sceneManager = this.restartedSceneManager;
  const projects = this.restartedProjects;
  const vault = this.testVault;
  if (!sceneManager || !projects || !vault) {
    throw new Error('Restart not completed');
  }

  // Verify the correct book is active
  const active = sceneManager.activeProject;
  if (!active) {
    throw new Error('No active project after restart');
  }
  if (active.title !== title) {
    throw new Error(
      `Active project not restored: expected "${title}", got "${active.title}"`,
    );
  }

  // Verify both books are discovered
  if (projects.length < 2) {
    throw new Error(
      `Expected at least 2 projects after restart, got ${projects.length}`,
    );
  }

  // Verify the restored book has the same UUID as the original
  const originalBook = this.bookB;
  if (!originalBook) {
    throw new Error('Original book not found');
  }
  if (active.bookId !== originalBook.bookId) {
    throw new Error(
      `Book UUID changed after restart: expected ${originalBook.bookId}, got ${active.bookId}`,
    );
  }

  // Verify the other book is available but not active
  const otherBook = projects.find(p => p.title !== title);
  if (!otherBook) {
    throw new Error('Other book not discovered after restart');
  }
  if (otherBook.bookId === active.bookId) {
    throw new Error('Both projects have the same UUID after restart');
  }

  // Verify scenes still exist in the vault after restart
  const sceneB = this.sceneB;
  const sceneA = this.sceneA;
  if (!sceneB || !sceneA) {
    throw new Error('Original scenes not found');
  }

  // createScene returns TFile, so use .path
  const sceneBPath = (sceneB as any).path;
  const sceneAPath = (sceneA as any).path;
  if (!sceneBPath || !sceneAPath) {
    throw new Error('Scene file paths not available');
  }

  // Verify Book B's scene file still exists
  const sceneBFile = vault.getAbstractFileByPath(sceneBPath);
  if (!sceneBFile) {
    throw new Error(`Scene in restored book file missing: ${sceneBPath}`);
  }

  // Verify Book A's scene file still exists
  const sceneAFile = vault.getAbstractFileByPath(sceneAPath);
  if (!sceneAFile) {
    throw new Error(`Scene in other book file missing: ${sceneAPath}`);
  }

  // Verify Book B's scene is loadable through production SceneManager
  const scenesMap = await sceneManager.loadScenesForBooks([active.bookId!]);
  const bookBScenes = scenesMap.get(active.bookId!) ?? [];
  // Reload the scene to get its UUID from persisted frontmatter
  const sceneBContent = await vault.read(sceneBFile);
  const { frontmatter } = parseFrontmatter(sceneBContent);
  const sceneBId = frontmatter.id as string | undefined;
  if (!sceneBId) {
    throw new Error('Scene B UUID not found in persisted frontmatter');
  }
  const hasSceneB = bookBScenes.some(
    (s: import('../../../src/models/Scene').Scene) => s.id === sceneBId,
  );
  if (!hasSceneB) {
    throw new Error('Scene in restored book not found after restart');
  }
});
