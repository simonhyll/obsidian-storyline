/**
 * Pure legacy data migration logic extracted from SceneCardsPlugin.
 *
 * This module contains the actual migration algorithms used by
 * {@link SceneCardsPlugin.migrateProjectDataFromSettings}. It is
 * dependency-free so that tests can exercise the real production
 * migration without instantiating the full Obsidian plugin.
 *
 * Key invariant: a legacy entry is only removed from the source
 * data after it has been successfully written to the destination.
 * If the destination project cannot be discovered, the legacy entry
 * is preserved so the next startup can retry.
 */

import type { StoryLineProject } from '../models/StoryLineProject';

// Re-export everything from the helpers module
export {
  KEY_TO_SYSTEM_FILE,
  hasProjectDataKeys,
  stripProjectDataKeys,
  stripSpecificProjectDataKeys,
  getKeysForSystemFile,
  mergePlotgridData,
  mergePlotlineData,
  mergeCharacterData,
  mergeStatsData,
  mergeCustomSectionsData,
  parseExisting,
  deriveSystemFolder,
  deriveSystemFolderFromProjectFile,
} from './legacyMigration.helpers';

// Import PROJECT_DATA_KEYS for use in buildSettingsPayload
import { PROJECT_DATA_KEYS } from './legacyMigration.helpers';

// Re-export PROJECT_DATA_KEYS separately so it's available to consumers
export { PROJECT_DATA_KEYS };

/**
 * Outcome of migrating a single legacy entry.
 */
export type MigrationOutcome = 'copied' | 'equivalent' | 'conflicting' | 'deferred';

/** Result for a single project-path migration. */
export interface MigrationEntryResult {
  path: string;
  outcome: MigrationOutcome;
}

/**
 * Migrate a per-project field from legacy data.json into project frontmatter.
 */
export function migrateProjectField(
  legacyMap: Record<string, unknown>,
  projects: StoryLineProject[],
  field: 'definedActs' | 'definedChapters',
): MigrationEntryResult[] {
  return migrateField(legacyMap, projects, field);
}

function migrateField(
  legacyMap: Record<string, unknown>,
  projects: StoryLineProject[],
  field: 'definedActs' | 'definedChapters',
): MigrationEntryResult[] {
  const results: MigrationEntryResult[] = [];
  for (const [path, value] of Object.entries(legacyMap)) {
    results.push(migrateOne(path, value, projects, field));
  }
  return results;
}

function migrateOne(
  projectPath: string,
  value: unknown,
  projects: StoryLineProject[],
  field: 'definedActs' | 'definedChapters',
): MigrationEntryResult {
  // Malformed nonempty values must be preserved, not treated as equivalent.
  if (!Array.isArray(value)) {
    return { path: projectPath, outcome: 'deferred' };
  }
  if (value.length === 0) {
    return { path: projectPath, outcome: 'equivalent' };
  }
  // Check for invalid entries — if any element can't be converted to a number,
  // preserve the source for possible recovery.
  const legacyNums = toNumbers(value, true);
  if (legacyNums === null) {
    return { path: projectPath, outcome: 'deferred' };
  }
  const project = projects.find(p => p.filePath === projectPath);
  if (!project) {
    return { path: projectPath, outcome: 'deferred' };
  }
  const target = field === 'definedActs' ? 'definedActs' : 'definedChapters';
  const current = project[target];
  if (!Array.isArray(current) || current.length === 0) {
    project[target] = legacyNums;
    return { path: projectPath, outcome: 'copied' };
  }
  if (arraysEqual(current, legacyNums)) {
    return { path: projectPath, outcome: 'equivalent' };
  }
  return { path: projectPath, outcome: 'conflicting' };
}

/**
 * Convert an array to numbers, returning null if any element is invalid.
 * When strict is true, invalid entries cause the entire array to be rejected.
 */
function toNumbers(value: unknown[], strict: boolean): number[] | null {
  const result: number[] = [];
  for (const item of value) {
    const n = Number(item);
    if (isNaN(n)) {
      if (strict) return null;
      continue;
    }
    result.push(n);
  }
  return result;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Safely remove legacy entries that are safe to remove.
 */
export function removeMigratedEntries(
  legacyData: Record<string, unknown>,
  key: string,
  results: MigrationEntryResult[],
): boolean {
  const legacyMap = legacyData[key] as Record<string, unknown> | undefined;
  if (!legacyMap || typeof legacyMap !== 'object') return false;
  const removable = results.filter(r => r.outcome === 'copied' || r.outcome === 'equivalent');
  if (removable.length === 0) return false;
  for (const entry of removable) {
    delete legacyMap[entry.path];
  }
  if (Object.keys(legacyMap).length === 0) {
    delete legacyData[key];
    return true;
  }
  return true;
}

/**
 * Migrate filterPresets from legacy data.json to the active project.
 */
export function migrateFilterPresets(
  legacyData: Record<string, unknown>,
  activeProject: StoryLineProject | null,
): boolean {
  const presets = legacyData.filterPresets;
  if (!Array.isArray(presets) || presets.length === 0) return false;
  if (!activeProject) return false;
  if (activeProject.filterPresets.length > 0) return false;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Record<string, unknown> accepts any array
  activeProject.filterPresets = presets as unknown as typeof activeProject.filterPresets;
  delete legacyData.filterPresets;
  return true;
}

/**
 * Remove obsolete legacy folder keys from data.json.
 */
export function removeObsoleteLegacyKeys(legacyData: Record<string, unknown>): boolean {
  const obsoleteKeys = ['sceneFolder', 'characterFolder', 'locationFolder', 'plotGridFolder'];
  let dirty = false;
  for (const key of obsoleteKeys) {
    if (key in legacyData) {
      delete legacyData[key];
      dirty = true;
    }
  }
  return dirty;
}

/**
 * Build the settings payload for saveSettings().
 *
 * This function implements a selective merge:
 * - Ordinary settings come from the in-memory `currentSettings` object.
 * - Unresolved legacy migration keys (those NOT in `migratedKeys`) are
 *   preserved from the persisted `data.json` snapshot, so that a failed
 *   migration does not lose the original author data when settings are saved.
 * - Successfully migrated keys are NOT restored from persisted data,
 *   avoiding stale values.
 *
 * @param currentSettings - The current in-memory settings object.
 * @param persisted - The persisted data.json snapshot (null if never saved).
 * @param migratedKeys - Set of legacy keys that were successfully migrated.
 * @returns The merged settings payload to save.
 */
export function buildSettingsPayload(
  currentSettings: Record<string, unknown>,
  persisted: Record<string, unknown> | null,
  migratedKeys: Set<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...currentSettings };

  if (!persisted || typeof persisted !== 'object') {
    return payload;
  }

  for (const [key, value] of Object.entries(persisted)) {
    if (PROJECT_DATA_KEYS.includes(key) && !migratedKeys.has(key)) {
      if (value !== undefined && !isEmptyValue(value)) {
        payload[key] = value;
      }
    }
  }

  return payload;
}

/** Check if a value is an empty default. */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
