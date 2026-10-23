/**
 * Step definitions for universe isolation hierarchy scenario.
 *
 * Exercises real UniverseManager, SeriesManager, and SceneManager to verify
 * that Books and Scenes from different universes are correctly isolated.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { setupHierarchyTest } from '../support/hierarchy-test-helpers';
import { parseFrontmatter } from '../support/in-memory-vault';
import type { Scene } from '../../../src/models/Scene';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

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
  const sceneManager = this.hierarchySceneManager;
  if (!sceneManager) throw new Error('SceneManager not initialized');

  const universe = await this.universeManager.createUniverse(universeName);
  const book = await sceneManager.createProject(`Book in ${universeName}`);
  book.universeId = universe.id;
  await sceneManager.saveProjectFrontmatter(book);
  await sceneManager.setActiveProject(book);

  const sceneUuids = await createScenes(this, sceneManager, universeName);

  if (universeName === 'Alpha') {
    this.universeAlphaId = universe.id;
    this.bookAlpha = book;
    this.alphaSceneUuids = sceneUuids;
  } else {
    this.universeBetaId = universe.id;
    this.bookBeta = book;
    this.betaSceneUuids = sceneUuids;
  }
  this.books.push(book);
});

async function createScenes(
  world: TestWorld,
  sceneManager: import('../../../src/services/SceneManager').SceneManager,
  universeName: string,
): Promise<string[]> {
  const sceneCount = universeName === 'Alpha' ? 2 : 1;
  const sceneUuids: string[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const file = await sceneManager.createScene({
      title: `Scene ${i + 1} in ${universeName}`,
    });
    const content = await world.testVault!.read(
      file as unknown as import('../support/in-memory-vault').InMemoryFile,
    );
    const { frontmatter } = parseFrontmatter(content);
    const sceneId = frontmatter.id as string | undefined;
    if (sceneId) sceneUuids.push(sceneId);
  }
  return sceneUuids;
}

When('I view the timeline for {string}', async function (this: TestWorld, universeName: string) {
  const universeId = universeName === 'Alpha' ? this.universeAlphaId : this.universeBetaId;
  if (!universeId) throw new Error(`Universe ID not found for ${universeName}`);
  const sceneManager = this.hierarchySceneManager;
  if (!sceneManager) throw new Error('SceneManager not initialized');

  const books = await this.universeManager!.getBooksInUniverse(universeId);
  if (books.length === 0) throw new Error(`No books found in universe ${universeName}`);

  const bookIds = books.map(b => b.bookId!).filter(Boolean);
  const scenesMap = await sceneManager.loadScenesForBooks(bookIds);
  const allScenes: Scene[] = [];
  for (const scenes of scenesMap.values()) {
    allScenes.push(...scenes);
  }

  if (universeName === 'Alpha') {
    this.alphaScenes = allScenes;
  } else {
    this.betaScenes = allScenes;
  }
});

function assertSceneUuidsMatch(actualUuids: string[], expectedUuids: string[], name: string) {
  for (const expectedUuid of expectedUuids) {
    if (!actualUuids.includes(expectedUuid)) {
      throw new Error(`Expected scene UUID ${expectedUuid} not found in ${name} scenes`);
    }
  }
  const unexpected = actualUuids.filter(u => !expectedUuids.includes(u));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected scene UUIDs in ${name}: ${unexpected.join(', ')}`);
  }
}

function assertSceneOwnership(
  scenes: Scene[],
  books: StoryLineProject[],
  expectedId: string,
  otherId: string | undefined,
) {
  for (const scene of scenes) {
    const book = books.find(b => b.bookId === scene.ownerId);
    if (!book) throw new Error(`Scene owner book not found: ${scene.ownerId}`);
    if (book.universeId !== expectedId) {
      throw new Error(
        `Scene from wrong universe: ${book.title} belongs to ${book.universeId}, expected ${expectedId}`,
      );
    }
    if (otherId && book.universeId === otherId) {
      throw new Error(`Scene from wrong universe: ${scene.title} belongs to ${otherId}`);
    }
  }
}

Then('only scenes from universe {string} are visible', function (
  this: TestWorld,
  universeName: string,
) {
  const expectedId = universeName === 'Alpha' ? this.universeAlphaId : this.universeBetaId;
  const scenes = universeName === 'Alpha' ? this.alphaScenes : this.betaScenes;
  const expectedUuids = universeName === 'Alpha' ? this.alphaSceneUuids : this.betaSceneUuids;

  if (!scenes || scenes.length === 0) {
    throw new Error(`No scenes found for universe ${universeName}`);
  }

  if (expectedUuids && scenes.length !== expectedUuids.length) {
    throw new Error(
      `Scene count mismatch for ${universeName}: expected ${expectedUuids.length}, got ${scenes.length}`,
    );
  }

  const actualUuids = scenes.map(s => s.id!);
  if (expectedUuids) {
    assertSceneUuidsMatch(actualUuids, expectedUuids, universeName);
  }

  const otherId = universeName === 'Alpha' ? this.universeBetaId : this.universeAlphaId;
  assertSceneOwnership(scenes, this.books, expectedId!, otherId);
});
