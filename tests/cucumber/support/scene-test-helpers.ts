/**
 * Test helpers for SceneManager persistence integration tests.
 *
 * Creates a minimal plugin mock and SceneManager instance that works with
 * the in-memory vault harness.
 */

import { SceneManager } from '../../../src/services/SceneManager';
import { StoryLineProject, deriveProjectFolders } from '../../../src/models/StoryLineProject';
import type { SceneCardsSettings } from '../../../src/settings';
import type SceneCardsPlugin from '../../../src/main';
import { createInMemoryVault, createAppMock, type TestVault, type AppMock } from './in-memory-vault';

/**
 * Create a minimal plugin mock for SceneManager testing.
 */
export function createPluginMock(settings?: Partial<SceneCardsSettings>): SceneCardsPlugin {
  return {
    settings: {
      storyLineRoot: 'StoryLine',
      autoGenerateSequence: true,
      defaultPovCharacter: '',
      ...settings,
    },
    flushCorkboardPositions: async () => {},
    invalidateCorkboardCache: () => {},
  } as unknown as SceneCardsPlugin;
}

/**
 * Set up a complete SceneManager test environment with an isolated vault,
 * plugin mock, and active project.
 */
export function setupSceneManager(
  bookId: string,
  bookTitle: string,
  settings?: Partial<SceneCardsSettings>,
) {
  const vault = createInMemoryVault();
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  const plugin = createPluginMock(settings);
  const sm = new SceneManager(app, plugin);

  // Create and activate a project
  const project: Record<string, unknown> = {
    bookId,
    title: bookTitle,
    filePath: `StoryLine/${bookTitle}/project.json`,
    universeId: 'universe-test',
  };
  const folders = deriveProjectFolders('StoryLine', bookTitle);
  project.sceneFolder = folders.sceneFolder;
  project.characterFolder = folders.characterFolder;
  project.locationFolder = folders.locationFolder;
  project.codexFolder = folders.codexFolder;
  project.notesFolder = folders.notesFolder;
  project.sceneNotesFolder = folders.sceneNotesFolder;
  project.archiveFolder = folders.archiveFolder;
  project.researchFolder = folders.researchFolder;

  // Set active project via private field (test-only access)
  (sm as unknown as Record<string, unknown>)._activeProject = project;

  return { vault, app, plugin, sceneManager: sm, project: project as unknown as StoryLineProject };
}

/**
 * UUID v4 regex for validating generated scene IDs.
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verify a string is a valid UUID v4.
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}
