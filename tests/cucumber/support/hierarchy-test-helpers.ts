/**
 * Test helpers for UniverseManager and SeriesManager hierarchy integration tests.
 *
 * Creates minimal plugin mocks so that production UniverseManager and SeriesManager
 * instances can be constructed and exercised against the in-memory vault harness.
 */

import { UniverseManager } from '../../../src/services/UniverseManager';
import { SeriesManager } from '../../../src/services/SeriesManager';
import type SceneCardsPlugin from '../../../src/main';
import type { SceneCardsSettings } from '../../../src/settings';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import { createInMemoryVault, createAppMock, type TestVault } from './in-memory-vault';

/**
 * Create a minimal plugin mock for hierarchy manager testing.
 *
 * The mock provides:
 * - settings.storyLineRoot for the base folder path
 * - sceneManager with getProjects(), activeProject, and saveProjectFrontmatter
 * - seriesManager (populated after SeriesManager is created)
 */
export function createHierarchyPluginMock(
  settings?: Partial<SceneCardsSettings>,
  projects?: StoryLineProject[],
): SceneCardsPlugin {
  const sceneManager = {
    getProjects: () => projects ?? [],
    activeProject: null as StoryLineProject | null,
    setActiveProject: async (_p: StoryLineProject) => {},
    saveProjectFrontmatter: async (_p: StoryLineProject) => {},
    scanProjects: async () => {},
    getSeriesFolder: () => null,
    updateProjectPath: async (_old: string, _new: string, _p: StoryLineProject) => {},
  };

  return {
    settings: {
      storyLineRoot: 'StoryLine',
      autoGenerateSequence: true,
      defaultPovCharacter: '',
      ...settings,
    },
    sceneManager,
    seriesManager: null as unknown as SeriesManager,
    flushCorkboardPositions: async () => {},
    invalidateCorkboardCache: () => {},
    saveSettings: async () => {},
  } as unknown as SceneCardsPlugin;
}

/**
 * Set up a complete hierarchy test environment with an isolated vault,
 * UniverseManager, and SeriesManager.
 *
 * Returns all components needed to test Universe → Series → Book relationships.
 */
export function setupHierarchyTest(
  settings?: Partial<SceneCardsSettings>,
) {
  const vault = createInMemoryVault();
  const app = createAppMock(vault) as unknown as import('obsidian').App;

  // Create plugin mock — will be updated with managers
  const plugin = createHierarchyPluginMock(settings);

  // Create managers
  const universeManager = new UniverseManager(app, plugin);
  const seriesManager = new SeriesManager(app, plugin);

  // Wire up mutual references
  plugin.seriesManager = seriesManager;

  return { vault, app, plugin, universeManager, seriesManager };
}

/**
 * Create a fresh UniverseManager instance against the same vault.
 * Used to test persistence reload (manager re-instantiation).
 */
export function createReloadedUniverseManager(
  vault: TestVault,
  plugin: SceneCardsPlugin,
) {
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  return new UniverseManager(app, plugin);
}

/**
 * Create a fresh SeriesManager instance against the same vault.
 * Used to test persistence reload.
 */
export function createReloadedSeriesManager(
  vault: TestVault,
  plugin: SceneCardsPlugin,
) {
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  return new SeriesManager(app, plugin);
}

/**
 * UUID v4 regex for validating generated IDs.
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verify a string is a valid UUID v4.
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}
