/**
 * Step definitions for hierarchy scenarios.
 *
 * Five scenarios exercise real UniverseManager, SeriesManager, and SceneManager
 * with an isolated in-memory vault. Two scenarios (legacy migration and restart)
 * remain simulated and are deferred to Step 6C.4b.3b.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import {
  setupHierarchyTest,
  createReloadedUniverseManager,
  isValidUUID,
} from '../support/hierarchy-test-helpers';
import { parseFrontmatter } from '../support/in-memory-vault';

// ── Scenario: Book belongs to a universe ─────────────

Given('I create a book {string} in universe {string}', async function (
  this: TestWorld,
  bookTitle: string,
  universeName: string,
) {
  const { vault, sceneManager, universeManager, seriesManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.hierarchySceneManager = sceneManager;
  this.universeManager = universeManager;
  this.seriesManager = seriesManager;
  this.hierarchyPlugin = plugin;

  // Create universe via production code
  const universe = await universeManager.createUniverse(universeName);
  this.universeMetadata = universe;
  this.universeId = universe.id;
  if (!isValidUUID(universe.id)) throw new Error(`Invalid UUID: ${universe.id}`);

  // Create book via production SceneManager
  const book = await sceneManager.createProject(bookTitle);
  this.bookInUniverse = book;
  this.activeBook = book;

  // Set universe membership and persist via production saveProjectFrontmatter
  book.universeId = universe.id;
  await sceneManager.saveProjectFrontmatter(book);

  // Verify persisted frontmatter contains universeId
  const file = vault.getAbstractFileByPath(book.filePath);
  if (!file) throw new Error(`Book file not created: ${book.filePath}`);
  const content = await vault.read(file);
  const { frontmatter } = parseFrontmatter(content);
  const persistedUniverseId = frontmatter.universeId as string | undefined;
  if (persistedUniverseId !== universe.id) {
    throw new Error(`Persisted universeId mismatch: ${String(frontmatter.universeId)} !== ${universe.id}`);
  }
});

Then('the book universe ID matches {string}', function (
  this: TestWorld,
  universeName: string,
) {
  const book = this.bookInUniverse || this.activeBook;
  if (!book) throw new Error('No book found');
  if (!book.universeId) throw new Error('Book has no universeId');
  if (!isValidUUID(book.universeId)) {
    throw new Error(`Book universeId is not a valid UUID: ${book.universeId}`);
  }
  const universe = this.universeMetadata;
  if (!universe) throw new Error('No universe metadata');
  if (book.universeId !== universe.id) {
    throw new Error(
      `Book universeId ${book.universeId} does not match universe ${universe.id} (${universe.name})`,
    );
  }
  const expectedName = universeName.replace(/[\\/:*?"<>|]/g, '-');
  if (universe.name !== expectedName) {
    throw new Error(`Universe name mismatch: expected ${expectedName}, got ${universe.name}`);
  }
});

// Series scenarios are in hierarchy-series.steps.ts

// ── Scenario: Universe UUID is stable ────────────────

Given('I create a universe {string}', async function (this: TestWorld, universeName: string) {
  const { vault, universeManager, seriesManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.universeManager = universeManager;
  this.seriesManager = seriesManager;
  this.hierarchyPlugin = plugin;

  const universe = await universeManager.createUniverse(universeName);
  this.universeMetadata = universe;
  this.universeId = universe.id;

  if (!isValidUUID(universe.id)) {
    throw new Error(`Universe ID is not a valid UUID: ${universe.id}`);
  }
});

When('I reload the universe', async function (this: TestWorld) {
  const reloadedManager = createReloadedUniverseManager(this.testVault!, this.hierarchyPlugin!);
  const universes = await reloadedManager.getAllUniverses();
  if (universes.length === 0) throw new Error('No universes found after reload');
  const reloaded = universes.find(u => u.id === this.universeId);
  if (!reloaded) throw new Error(`Universe ${this.universeId} not found after reload`);
  this.universeMetadata = reloaded;
});

Then('the universe UUID remains the same', function (this: TestWorld) {
  const originalId = this.universeId;
  const reloaded = this.universeMetadata;
  if (!originalId) throw new Error('No original universe ID');
  if (!reloaded) throw new Error('No reloaded universe');
  if (reloaded.id !== originalId) {
    throw new Error(`Universe UUID changed: expected ${originalId}, got ${reloaded.id}`);
  }
  if (!reloaded.name) throw new Error('Reloaded universe has no name');
});

// Deferred scenarios (legacy migration, project restart) are in hierarchy-deferred.steps.ts
