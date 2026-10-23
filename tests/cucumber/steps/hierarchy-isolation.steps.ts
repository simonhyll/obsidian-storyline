/**
 * Step definitions for universe isolation hierarchy scenario.
 *
 * Exercises real UniverseManager, SeriesManager, and SceneManager to verify
 * that Books and Scenes from different universes are correctly isolated.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { setupHierarchyTest } from '../support/hierarchy-test-helpers';

// ── Scenario: Books from different universes are isolated ──

Given('a book in universe {string}', async function (this: TestWorld, universeName: string) {
  if (!this.universeManager) {
    const { vault, sceneManager, universeManager, seriesManager, plugin } = setupHierarchyTest();
    this.testVault = vault;
    this.hierarchySceneManager = sceneManager;
    this.universeManager = universeManager;
    this.seriesManager = seriesManager;
    this.hierarchyPlugin = plugin;
  }
  const universeManager = this.universeManager;
  const sceneManager = this.hierarchySceneManager;
  if (!universeManager || !sceneManager) throw new Error('Managers not initialized');

  const universe = await universeManager.createUniverse(universeName);
  const book = await sceneManager.createProject(`Book in ${universeName}`);
  book.universeId = universe.id;
  await sceneManager.saveProjectFrontmatter(book);

  // Set as active project so scenes can be created
  await sceneManager.setActiveProject(book);

  // Create real scenes in this book via production SceneManager
  const sceneCount = universeName === 'Alpha' ? 2 : 1;
  for (let i = 0; i < sceneCount; i++) {
    await sceneManager.createScene({
      title: `Scene ${i + 1} in ${universeName}`,
    });
  }

  if (universeName === 'Alpha') {
    this.universeAlphaId = universe.id;
    this.bookAlpha = book;
  } else {
    this.universeBetaId = universe.id;
    this.bookBeta = book;
  }
  this.books.push(book);
});

When('I view the timeline for {string}', async function (this: TestWorld, universeName: string) {
  const universeId = universeName === 'Alpha' ? this.universeAlphaId : this.universeBetaId;
  if (!universeId) throw new Error(`Universe ID not found for ${universeName}`);
  const sceneManager = this.hierarchySceneManager;
  if (!sceneManager) throw new Error('SceneManager not initialized');

  // Use production UniverseManager to get books in universe
  const books = await this.universeManager!.getBooksInUniverse(universeId);
  if (books.length === 0) throw new Error(`No books found in universe ${universeName}`);

  // Use production SceneManager to load scenes for those books
  const bookIds = books.map(b => b.bookId!).filter(Boolean);
  const scenesMap = await sceneManager.loadScenesForBooks(bookIds);
  const allScenes: import('../../../src/models/Scene').Scene[] = [];
  for (const scenes of scenesMap.values()) {
    allScenes.push(...scenes);
  }

  if (universeName === 'Alpha') {
    this.alphaScenes = allScenes;
  } else {
    this.betaScenes = allScenes;
  }
});

Then('only scenes from universe {string} are visible', function (
  this: TestWorld,
  universeName: string,
) {
  const expectedId = universeName === 'Alpha' ? this.universeAlphaId : this.universeBetaId;
  const scenes = universeName === 'Alpha' ? this.alphaScenes : this.betaScenes;

  if (!scenes || scenes.length === 0) {
    throw new Error(`No scenes found for universe ${universeName}`);
  }

  for (const scene of scenes) {
    const book = this.books.find(b => b.bookId === scene.ownerId);
    if (!book) {
      throw new Error(`Scene owner book not found: ${scene.ownerId}`);
    }
    if (book.universeId !== expectedId) {
      throw new Error(
        `Scene from wrong universe: book ${book.title} belongs to ${book.universeId}, expected ${expectedId}`,
      );
    }
  }
});
