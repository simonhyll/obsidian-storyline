/**
 * Step definitions for series-in-universe hierarchy scenarios.
 *
 * Exercises real UniverseManager, SeriesManager, and SceneManager to verify
 * Series ↔ Universe membership and Book → Series → Universe chains.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import type { TestWorld } from '../support/world';
import { setupHierarchyTest } from '../support/hierarchy-test-helpers';

// ── Scenario: Book belongs to a series in a universe ──

Given('I create a series {string} in universe {string}', async function (
  this: TestWorld,
  seriesName: string,
  universeName: string,
) {
  const { vault, sceneManager, universeManager, seriesManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.hierarchySceneManager = sceneManager;
  this.universeManager = universeManager;
  this.seriesManager = seriesManager;
  this.hierarchyPlugin = plugin;

  const universe = await universeManager.createUniverse(universeName);
  this.universeMetadata = universe;
  this.universeId = universe.id;
  this.universeFolder = `StoryLine/${universeName.replace(/[\\/:*?"<>|]/g, '-')}`;
  if (universeName === 'Alpha') this.universeAlphaId = universe.id;

  const series = await seriesManager.createSeries(seriesName);
  this.seriesMetadata = series;
  this.seriesFolder = `StoryLine/${seriesName.replace(/[\\/:*?"<>|]/g, '-')}`;

  await universeManager.addSeriesToUniverse(universe.id, this.seriesFolder);
  await verifySeriesInUniverse(this, universe.id);
});

async function verifySeriesInUniverse(world: TestWorld, universeId: string) {
  const series = world.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  const universeFolder = world.universeFolder;
  if (!universeFolder) throw new Error('No universe folder');
  const seriesFolder = world.seriesFolder;
  if (!seriesFolder) throw new Error('No series folder');

  const updatedUniverse = await world.universeManager!.loadUniverseMetadata(universeFolder);
  if (!updatedUniverse) throw new Error('Universe metadata not found after adding series');
  if (!updatedUniverse.seriesIds?.includes(series.seriesUuid!)) {
    throw new Error(`Universe seriesIds does not include series ${series.seriesUuid}`);
  }
  world.universeMetadata = updatedUniverse;

  const updatedSeries = await world.seriesManager!.loadSeriesMetadata(seriesFolder);
  if (!updatedSeries) throw new Error('Series metadata not found');
  if (updatedSeries.universeId !== universeId) {
    throw new Error(`Series universeId mismatch: ${updatedSeries.universeId} !== ${universeId}`);
  }
  world.seriesMetadata = updatedSeries;
}

Given('I create a book {string} in series {string}', async function (
  this: TestWorld,
  bookTitle: string,
  seriesName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  const sceneManager = this.hierarchySceneManager;
  if (!sceneManager) throw new Error('SceneManager not initialized');

  // Create book via production SceneManager
  const book = await sceneManager.createProject(bookTitle);
  this.bookInSeries = book;
  this.activeBook = book;

  // Add book to series via production SeriesManager
  await this.seriesManager!.addBookToSeries(series.seriesUuid!, book);

  // Verify the book now has seriesUuid and universeId
  if (!book.seriesUuid) throw new Error('Book has no seriesUuid after addBookToSeries');
  if (book.seriesUuid !== series.seriesUuid) {
    throw new Error(`Book seriesUuid mismatch: ${book.seriesUuid} !== ${series.seriesUuid}`);
  }
});

Then('the book belongs to series {string}', function (
  this: TestWorld,
  seriesName: string,
) {
  const book = this.bookInSeries || this.activeBook;
  if (!book) throw new Error('No book found');
  const series = this.seriesMetadata;
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  if (!book.seriesUuid) throw new Error('Book has no seriesUuid');
  if (book.seriesUuid !== series.seriesUuid) {
    throw new Error(
      `Book seriesUuid ${book.seriesUuid} does not match series ${series.seriesUuid} (${series.name})`,
    );
  }
});

// ── Scenario: Series belongs to a universe ──

Then('the series universe ID matches {string}', function (
  this: TestWorld,
  universeName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  if (!series.universeId) throw new Error('Series has no universeId');
  const universe = this.universeMetadata;
  if (!universe) throw new Error('No universe metadata');
  if (series.universeId !== universe.id) {
    throw new Error(
      `Series universeId ${series.universeId} does not match universe ${universe.id}`,
    );
  }
  if (!universe.seriesIds?.includes(series.seriesUuid!)) {
    throw new Error(`Universe seriesIds does not include series ${series.seriesUuid}`);
  }
  const expectedName = universeName.replace(/[\\/:*?"<>|]/g, '-');
  if (universe.name !== expectedName) {
    throw new Error(`Universe name mismatch: expected ${expectedName}, got ${universe.name}`);
  }
});

// ── Scenario: Series membership is exclusive across universes ──

Given('I create a second universe {string}', async function (
  this: TestWorld,
  universeName: string,
) {
  const universe = await this.universeManager!.createUniverse(universeName);
  this.universeBetaId = universe.id;
  this.universeBetaFolder = `StoryLine/${universeName.replace(/[\\/:*?"<>|]/g, '-')}`;
});

When('I move the series to universe {string}', async function (
  this: TestWorld,
  universeName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  const universeId = this.universeBetaId;
  if (!universeId) throw new Error('Beta universe ID not found');
  const seriesFolder = this.seriesFolder;
  if (!seriesFolder) throw new Error('Series folder not found');

  // Use production addSeriesToUniverse to move the series
  await this.universeManager!.addSeriesToUniverse(universeId, seriesFolder);
});

Then('the series belongs to universe {string}', async function (
  this: TestWorld,
  universeName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  const universeId = this.universeBetaId;
  if (!universeId) throw new Error('Beta universe ID not found');

  // Reload series from persisted metadata
  const seriesFolder = this.seriesFolder;
  if (!seriesFolder) throw new Error('Series folder not found');
  const reloadedSeries = await this.seriesManager!.loadSeriesMetadata(seriesFolder);
  if (!reloadedSeries) throw new Error('Series metadata not found after move');
  if (reloadedSeries.universeId !== universeId) {
    throw new Error(
      `Series universeId ${reloadedSeries.universeId} does not match ${universeName} (${universeId})`,
    );
  }

  // Verify universe seriesIds includes the series
  const seriesIds = await this.universeManager!.getSeriesForUniverse(universeId);
  if (!seriesIds.includes(series.seriesUuid!)) {
    throw new Error(`Universe ${universeName} seriesIds does not include series ${series.seriesUuid}`);
  }
});

Then('the series no longer belongs to universe {string}', async function (
  this: TestWorld,
  universeName: string,
) {
  const series = this.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  const universeId = this.universeAlphaId || this.universeId;
  if (!universeId) throw new Error(`${universeName} universe ID not found`);

  // Verify old universe seriesIds does NOT include the series
  const seriesIds = await this.universeManager!.getSeriesForUniverse(universeId);
  if (seriesIds.includes(series.seriesUuid!)) {
    throw new Error(
      `Universe ${universeName} still contains series ${series.seriesUuid} after move`,
    );
  }

  // Reload series and verify universeId is not the old universe
  const seriesFolder = this.seriesFolder;
  if (!seriesFolder) throw new Error('Series folder not found');
  const reloadedSeries = await this.seriesManager!.loadSeriesMetadata(seriesFolder);
  if (!reloadedSeries) throw new Error('Series metadata not found');
  if (reloadedSeries.universeId === universeId) {
    throw new Error(
      `Series still references old universe ${universeName} (${universeId})`,
    );
  }
});
