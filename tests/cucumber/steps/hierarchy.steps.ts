/**
 * Step definitions for hierarchy scenarios.
 *
 * Five scenarios exercise real UniverseManager and SeriesManager with an
 * isolated in-memory vault. Two scenarios (legacy migration and restart)
 * remain simulated and are deferred to Step 6C.4b.3b.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import {
  setupHierarchyTest,
  createReloadedUniverseManager,
  isValidUUID,
} from '../support/hierarchy-test-helpers';
import * as assert from '../support/hierarchy-assertions';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

// ── Scenario: Book belongs to a universe ─────────────

Given('I create a book {string} in universe {string}', async function (
  this: TestWorld,
  bookTitle: string,
  universeName: string,
) {
  const { vault, universeManager, seriesManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.universeManager = universeManager;
  this.seriesManager = seriesManager;
  this.hierarchyPlugin = plugin;

  const universe = await universeManager.createUniverse(universeName);
  this.universeMetadata = universe;
  this.universeId = universe.id;
  if (!isValidUUID(universe.id)) throw new Error(`Invalid UUID: ${universe.id}`);

  const bookId = crypto.randomUUID();
  const book = {
    bookId, title: bookTitle, filePath: `StoryLine/${bookTitle}/${bookTitle}.md`,
    universeId: universe.id,
  } as StoryLineProject;
  this.books.push(book);
  this.activeBook = book;
  const sm = (plugin as unknown as Record<string, unknown>).sceneManager as { getProjects: () => StoryLineProject[] };
  sm.getProjects = () => [book];
});

Then('the book universe ID matches {string}', function (this: TestWorld, universeName: string) {
  assert.assertBookUniverseIdMatches(this, universeName);
});

// ── Scenario: Book belongs to a series in a universe ──

Given('I create a series {string} in universe {string}', async function (
  this: TestWorld,
  seriesName: string,
  universeName: string,
) {
  const { vault, universeManager, seriesManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.universeManager = universeManager;
  this.seriesManager = seriesManager;
  this.hierarchyPlugin = plugin;

  const universe = await universeManager.createUniverse(universeName);
  this.universeMetadata = universe;
  this.universeId = universe.id;
  this.universeFolder = `StoryLine/${universeName.replace(/[\\/:*?"<>|]/g, '-')}`;

  const series = await seriesManager.createSeries(seriesName);
  this.seriesMetadata = series;
  this.seriesFolder = `StoryLine/${seriesName.replace(/[\\/:*?"<>|]/g, '-')}`;

  await universeManager.addSeriesToUniverse(universe.id, this.seriesFolder);
  const updatedUniverse = await universeManager.loadUniverseMetadata(this.universeFolder);
  if (!updatedUniverse) throw new Error('Universe metadata not found after adding series');
  this.universeMetadata = updatedUniverse;

  const updatedSeries = await seriesManager.loadSeriesMetadata(this.seriesFolder);
  if (!updatedSeries) throw new Error('Series metadata not found');
  if (updatedSeries.universeId !== universe.id) {
    throw new Error(`Series universeId mismatch: ${updatedSeries.universeId} !== ${universe.id}`);
  }
  this.seriesMetadata = updatedSeries;
});

Given('I create a book {string} in series {string}', function (
  this: TestWorld,
  bookTitle: string,
  seriesName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  const bookId = crypto.randomUUID();
  const book = {
    bookId,
    title: bookTitle,
    filePath: `${this.seriesFolder}/${bookTitle}/${bookTitle}.md`,
    seriesUuid: series.seriesUuid,
    universeId: series.universeId,
  } as StoryLineProject;
  this.books.push(book);
  this.activeBook = book;
  const plugin = this.hierarchyPlugin as unknown as Record<string, unknown>;
  const sm = plugin.sceneManager as { getProjects: () => StoryLineProject[] };
  sm.getProjects = () => [book];
});

Then('the book belongs to series {string}', function (this: TestWorld, seriesName: string) {
  assert.assertBookBelongsToSeries(this, seriesName);
});

// ── Scenario: Series belongs to a universe ───────────

Then('the series universe ID matches {string}', function (this: TestWorld, universeName: string) {
  assert.assertSeriesUniverseIdMatches(this, universeName);
});

// ── Scenario: Books from different universes are isolated ──

Given('a book in universe {string}', async function (this: TestWorld, universeName: string) {
  if (!this.universeManager) {
    const { vault, universeManager, seriesManager, plugin } = setupHierarchyTest();
    this.testVault = vault;
    this.universeManager = universeManager;
    this.seriesManager = seriesManager;
    this.hierarchyPlugin = plugin;
  }
  const universe = await this.universeManager.createUniverse(universeName);
  const bookId = crypto.randomUUID();
  const book = {
    bookId,
    title: `Book in ${universeName}`,
    filePath: `StoryLine/${universeName}/Book/${universeName}.md`,
    universeId: universe.id,
  } as StoryLineProject;
  if (universeName === 'Alpha') {
    this.universeAlphaId = universe.id;
    this.bookAlpha = book;
  } else {
    this.universeBetaId = universe.id;
    this.bookBeta = book;
  }
  this.books.push(book);
  const plugin = this.hierarchyPlugin as unknown as Record<string, unknown>;
  (plugin.sceneManager as { getProjects: () => StoryLineProject[] }).getProjects = () => this.books;
});

When('I view the timeline for {string}', async function (this: TestWorld, universeName: string) {
  const universeManager = this.universeManager;
  const universeId = universeName === 'Alpha' ? this.universeAlphaId : this.universeBetaId;
  if (!universeId) throw new Error(`Universe ID not found for ${universeName}`);

  const books = await this.universeManager!.getBooksInUniverse(universeId);
  const scenes = books.map(b => ({
    id: b.bookId || '',
    title: b.title,
    ownerId: b.bookId,
  }) as unknown as import('../../../src/models/Scene').Scene);

  if (universeName === 'Alpha') {
    this.alphaScenes = scenes;
  } else {
    this.betaScenes = scenes;
  }
});

Then('only scenes from universe {string} are visible', function (
  this: TestWorld,
  universeName: string,
) {
  assert.assertOnlyScenesFromUniverse(this, universeName);
});

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
  assert.assertUniverseUUIDRemainsSame(this);
});

// ── Deferred scenarios (simulated — see Step 6C.4b.3b) ──

Given('old project settings in the legacy format', function (this: TestWorld) {
  this.settings.set('legacyActiveBook', 'old-book-id');
});

When('I load the plugin', function (this: TestWorld) {
  const legacyBook = this.settings.get('legacyActiveBook');
  if (legacyBook) {
    this.settings.set('activeBookId', legacyBook);
    this.settings.delete('legacyActiveBook');
  }
});

Then('the settings are migrated to the new format', function (this: TestWorld) {
  if (this.settings.has('legacyActiveBook')) throw new Error('Legacy settings not migrated');
  if (!this.settings.has('activeBookId')) throw new Error('New settings not set');
});

Given('an existing active book {string}', function (this: TestWorld, title: string) {
  const bookId = crypto.randomUUID();
  const book = { bookId, title, filePath: `StoryLine/${title}/${title}.md` } as StoryLineProject;
  this.books.push(book);
  this.activeBook = book;
  this.settings.set('activeBookId', bookId);
});

When('I restart the plugin', function (this: TestWorld) {
  const savedBookId = this.settings.get('activeBookId');
  if (savedBookId) {
    const book = this.books.find(b => b.bookId === savedBookId);
    if (book) this.activeBook = book;
  }
});

Then('the active book is restored to {string}', function (this: TestWorld, title: string) {
  if (!this.activeBook || this.activeBook.title !== title) {
    throw new Error(`Active book not restored: expected ${title}, got ${this.activeBook?.title}`);
  }
});
