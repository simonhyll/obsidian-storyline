/**
 * Step definitions for series-in-universe hierarchy scenarios.
 *
 * Exercises real UniverseManager, SeriesManager, and SceneManager to verify
 * Series ↔ Universe membership and Book → Series → Universe chains.
 */
import { Given, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
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

  const series = await seriesManager.createSeries(seriesName);
  this.seriesMetadata = series;
  this.seriesFolder = `StoryLine/${seriesName.replace(/[\\/:*?"<>|]/g, '-')}`;

  await universeManager.addSeriesToUniverse(universe.id, this.seriesFolder);

  // Verify persisted universe contains series
  const updatedUniverse = await universeManager.loadUniverseMetadata(this.universeFolder);
  if (!updatedUniverse) throw new Error('Universe metadata not found after adding series');
  if (!updatedUniverse.seriesIds?.includes(series.seriesUuid!)) {
    throw new Error(`Universe seriesIds does not include series ${series.seriesUuid}`);
  }
  this.universeMetadata = updatedUniverse;

  // Verify persisted series contains universeId
  const updatedSeries = await seriesManager.loadSeriesMetadata(this.seriesFolder);
  if (!updatedSeries) throw new Error('Series metadata not found');
  if (updatedSeries.universeId !== universe.id) {
    throw new Error(`Series universeId mismatch: ${updatedSeries.universeId} !== ${universe.id}`);
  }
  this.seriesMetadata = updatedSeries;
});

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
