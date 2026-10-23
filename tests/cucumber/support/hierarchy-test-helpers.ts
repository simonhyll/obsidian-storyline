/**
 * Test helpers for UniverseManager, SeriesManager, and SceneManager hierarchy
 * integration tests.
 *
 * Creates real production manager instances backed by an in-memory vault so that
 * Book creation, membership, Scene creation, and Universe isolation are tested
 * against actual production code.
 */

import { UniverseManager } from '../../../src/services/UniverseManager';
import { SeriesManager } from '../../../src/services/SeriesManager';
import { SceneManager } from '../../../src/services/SceneManager';
import type SceneCardsPlugin from '../../../src/main';
import type { SceneCardsSettings } from '../../../src/settings';
import {
  createInMemoryVault,
  createAppMock,
  type TestVault,
} from './in-memory-vault';

/**
 * Create a minimal plugin mock for hierarchy manager testing.
 *
 * The mock provides:
 * - settings.storyLineRoot for the base folder path
 * - sceneManager (populated after SceneManager is created)
 * - seriesManager (populated after SeriesManager is created)
 */
export function createHierarchyPluginMock(
  settings?: Partial<SceneCardsSettings>,
): SceneCardsPlugin {
  return {
    settings: {
      storyLineRoot: 'StoryLine',
      autoGenerateSequence: true,
      defaultPovCharacter: '',
      ...settings,
    },
    sceneManager: null as unknown as SceneManager,
    seriesManager: null as unknown as SeriesManager,
    flushCorkboardPositions: async () => {},
    invalidateCorkboardCache: () => {},
    saveSettings: async () => {},
    flushPendingWritingChanges: () => {},
    saveProjectSystemData: async () => {},
    loadProjectSystemData: async () => {},
    fieldTemplates: { load: async () => {}, getAll: () => [] },
  } as unknown as SceneCardsPlugin;
}

/**
 * Set up a complete hierarchy test environment with an isolated vault,
 * real SceneManager, UniverseManager, and SeriesManager.
 *
 * Returns all components needed to test Universe → Series → Book relationships
 * using actual production operations.
 */
export function setupHierarchyTest(
  settings?: Partial<SceneCardsSettings>,
) {
  const vault = createInMemoryVault();
  const appMock = createAppMock(vault);
  const app = appMock as unknown as import('obsidian').App;

  // Create plugin mock — will be updated with managers
  const plugin = createHierarchyPluginMock(settings);

  // Create real production managers
  const sceneManager = new SceneManager(app, plugin);
  const universeManager = new UniverseManager(app, plugin);
  const seriesManager = new SeriesManager(app, plugin);

  // Wire up mutual references
  plugin.sceneManager = sceneManager;
  plugin.seriesManager = seriesManager;

  return {
    vault,
    app: appMock,
    plugin,
    sceneManager,
    universeManager,
    seriesManager,
  };
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
 * Create a fresh SceneManager instance against the same vault.
 * Used to test persistence reload.
 */
export function createReloadedSceneManager(
  vault: TestVault,
  plugin: SceneCardsPlugin,
) {
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  const sm = new SceneManager(app, plugin);
  plugin.sceneManager = sm;
  return sm;
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
