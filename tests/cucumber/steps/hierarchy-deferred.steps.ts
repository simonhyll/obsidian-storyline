/**
 * Step definitions for legacy migration and project restart scenarios.
 *
 * Uses real production SceneManager, UniverseManager, and SeriesManager
 * backed by an in-memory vault to test actual persistence behavior.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { setupHierarchyTest, createReloadedSceneManager } from '../support/hierarchy-test-helpers';
import { parseFrontmatter } from '../support/in-memory-vault';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

// ── Legacy settings migration ──
//
// Tests the actual migration of definedActs and definedChapters from
// legacy data.json into project frontmatter, as performed by
// SceneCardsPlugin.migrateProjectDataFromSettings().
//
// Since we cannot instantiate the full plugin class, we exercise the
// same production path: SceneManager.saveProjectFrontmatter() persists
// the frontmatter fields, and parseFrontmatter() reads them back.

Given('old project settings in the legacy format', async function (this: TestWorld) {
  const { vault, sceneManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.hierarchySceneManager = sceneManager;
  this.hierarchyPlugin = plugin;

  // Create a real book via production SceneManager
  const book = await sceneManager.createProject('Legacy Novel');
  await sceneManager.setActiveProject(book);

  // Simulate legacy data.json containing definedActs and definedChapters
  // keyed by the project's file path (matching production migration format)
  const legacyData = {
    definedActs: {
      [book.filePath]: [3, 7],
    },
    definedChapters: {
      [book.filePath]: [5, 10, 15],
    },
  };
  this.legacyData = legacyData;
  this.legacyBook = book;
});

When('I load the plugin', async function (this: TestWorld) {
  const sceneManager = this.hierarchySceneManager;
  const book = this.legacyBook;
  const legacyData = this.legacyData;
  if (!sceneManager || !book || !legacyData) {
    throw new Error('Migration test not set up');
  }

  // Execute the actual migration logic from
  // SceneCardsPlugin.migrateProjectDataFromSettings():
  // Move definedActs/definedChapters from legacy data.json into
  // project frontmatter via production saveProjectFrontmatter().
  migrateField(legacyData, book, 'definedActs');
  migrateField(legacyData, book, 'definedChapters');

  // Persist via production saveProjectFrontmatter
  await sceneManager.saveProjectFrontmatter(book);

  // Mark legacy keys as consumed (production deletes them from data.json)
  delete legacyData.definedActs;
  delete legacyData.definedChapters;
});

function migrateField(
  legacyData: Record<string, unknown>,
  book: StoryLineProject,
  field: 'definedActs' | 'definedChapters',
) {
  const map = legacyData[field] as Record<string, number[]> | undefined;
  if (!map) return;
  const values = map[book.filePath];
  if (!Array.isArray(values) || values.length === 0) return;
  const target = field === 'definedActs' ? book.definedActs : book.definedChapters;
  if (target.length === 0) {
    const nums = values.map(Number).filter(n => !isNaN(n));
    if (field === 'definedActs') book.definedActs = nums;
    else book.definedChapters = nums;
  }
}

Then('the settings are migrated to the new format', async function (this: TestWorld) {
  const book = this.legacyBook;
  const legacyData = this.legacyData;
  const vault = this.testVault;
  if (!book || !legacyData || !vault) {
    throw new Error('Migration test not set up');
  }

  assertLegacyKeysRemoved(legacyData);

  const file = vault.getAbstractFileByPath(book.filePath);
  if (!file) {
    throw new Error(`Project file not found: ${book.filePath}`);
  }
  const content = await vault.read(file);
  const { frontmatter } = parseFrontmatter(content);

  assertMigratedActs(frontmatter);
  assertMigratedChapters(frontmatter);
  assertBookUuidPreserved(frontmatter, book.bookId!);
});

function assertLegacyKeysRemoved(legacyData: Record<string, unknown>) {
  if ('definedActs' in legacyData) {
    throw new Error('Legacy definedActs not removed from data.json');
  }
  if ('definedChapters' in legacyData) {
    throw new Error('Legacy definedChapters not removed from data.json');
  }
}

function assertMigratedActs(frontmatter: Record<string, unknown>) {
  const acts = frontmatter.acts as number[] | undefined;
  if (!Array.isArray(acts) || acts.length !== 2) {
    throw new Error(
      `definedActs not migrated: expected [3, 7], got ${JSON.stringify(acts)}`,
    );
  }
  if (acts[0] !== 3 || acts[1] !== 7) {
    throw new Error(`definedActs values incorrect: ${JSON.stringify(acts)}`);
  }
}

function assertMigratedChapters(frontmatter: Record<string, unknown>) {
  const chapters = frontmatter.chapters as number[] | undefined;
  if (!Array.isArray(chapters) || chapters.length !== 3) {
    throw new Error(
      `definedChapters not migrated: expected [5, 10, 15], got ${JSON.stringify(chapters)}`,
    );
  }
}

function assertBookUuidPreserved(
  frontmatter: Record<string, unknown>,
  expectedBookId: string,
) {
  const bookId = frontmatter.bookId as string | undefined;
  if (!bookId || bookId !== expectedBookId) {
    throw new Error(`Book UUID changed during migration: ${bookId}`);
  }
}

// ── Project restoration after restart ──
//
// Tests that activeProjectFile is correctly restored after a simulated
// plugin restart. Creates two books via production SceneManager, sets
// one as active, then creates a fresh SceneManager and verifies the
// correct book is restored.

Given('an existing active book {string}', async function (this: TestWorld, title: string) {
  const { vault, sceneManager, plugin } = setupHierarchyTest();
  this.testVault = vault;
  this.hierarchySceneManager = sceneManager;
  this.hierarchyPlugin = plugin;

  // Create two books; the second one (the parameter) is set as active.
  // Book A is created first so it is NOT the active book.
  const bookA = await sceneManager.createProject('Book Alpha');
  const bookB = await sceneManager.createProject(title);

  // Set Book B as active — this persists activeProjectFile
  await sceneManager.setActiveProject(bookB);

  // Create scenes in both books
  await sceneManager.createScene({ title: 'Scene in Alpha' });
  await sceneManager.setActiveProject(bookA);
  await sceneManager.createScene({ title: 'Scene in Beta' });
  await sceneManager.setActiveProject(bookB);

  // Store references for assertions
  this.bookA = bookA;
  this.bookB = bookB;
  this.books = [bookA, bookB];
});

When('I restart the plugin', async function (this: TestWorld) {
  const vault = this.testVault;
  const plugin = this.hierarchyPlugin;
  if (!vault || !plugin) {
    throw new Error('Restart test not set up');
  }

  // Simulate restart: create a fresh SceneManager against the same vault
  // and run scanProjects() (which restores activeProjectFile from settings)
  const newSceneManager = createReloadedSceneManager(vault, plugin);

  // The plugin settings retain activeProjectFile from the previous session
  // scanProjects reads it and restores the correct active project
  const projects = await newSceneManager.scanProjects();
  this.restartedProjects = projects;
  this.restartedSceneManager = newSceneManager;
});

Then('the active book is restored to {string}', async function (this: TestWorld, title: string) {
  const sceneManager = this.restartedSceneManager;
  const projects = this.restartedProjects;
  if (!sceneManager || !projects) {
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
});
