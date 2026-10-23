/**
 * Step definitions for legacy migration and project restart scenarios.
 *
 * Uses real production migration functions from `legacyMigration.ts` and
 * real production SceneManager with an in-memory vault to test actual
 * persistence behavior.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { setupHierarchyTest, createReloadedSceneManager } from '../support/hierarchy-test-helpers';
import { parseFrontmatter } from '../support/in-memory-vault';
import {
  assertLegacyKeysRemoved,
  assertMigratedActs,
  assertMigratedChapters,
  assertBookUuidPreserved,
} from '../support/migration-assertions';
import {
  migrateProjectField,
  removeMigratedEntries,
} from '../../../src/services/legacyMigration';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

// ── Legacy settings migration ──
//
// Tests the actual production migration functions used by
// SceneCardsPlugin.migrateProjectDataFromSettings().
// Exercises migrateProjectField() and removeMigratedEntries() from
// src/services/legacyMigration.ts, then persists via
// SceneManager.saveProjectFrontmatter() and verifies the YAML round-trip.

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

  // Execute the actual production migration functions from
  // src/services/legacyMigration.ts — the same code used by
  // SceneCardsPlugin.migrateProjectDataFromSettings().
  const projects = sceneManager.getProjects();

  // Migrate definedActs using production logic
  const actsResult = migrateProjectField(
    legacyData.definedActs as Record<string, unknown>,
    projects,
    'definedActs',
  );
  // Persist each migrated project
  for (const path of actsResult.migratedPaths) {
    const project = projects.find(p => p.filePath === path);
    if (project) {
      await sceneManager.saveProjectFrontmatter(project);
    }
  }
  // Only remove successfully migrated entries
  removeMigratedEntries(legacyData, 'definedActs', actsResult.migratedPaths, actsResult.unmigratedPaths);

  // Migrate definedChapters using production logic
  const chaptersResult = migrateProjectField(
    legacyData.definedChapters as Record<string, unknown>,
    projects,
    'definedChapters',
  );
  for (const path of chaptersResult.migratedPaths) {
    const project = projects.find(p => p.filePath === path);
    if (project) {
      await sceneManager.saveProjectFrontmatter(project);
    }
  }
  removeMigratedEntries(legacyData, 'definedChapters', chaptersResult.migratedPaths, chaptersResult.unmigratedPaths);
});

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

  assertMigratedActs(frontmatter, [3, 7]);
  assertMigratedChapters(frontmatter, [5, 10, 15]);
  assertBookUuidPreserved(frontmatter, book.bookId!);
});

// ── Project restoration after restart ──
// (Moved to hierarchy-restart.steps.ts to stay under 200-line budget)
