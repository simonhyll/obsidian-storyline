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
 * If the destination project cannot be found, the legacy entry
 * is preserved so the next startup can retry.
 */

import type { StoryLineProject } from '../models/StoryLineProject';

/**
 * Migrate a per-project field (definedActs or definedChapters) from
 * legacy data.json into the project's frontmatter fields.
 *
 * Only migrates when:
 * 1. The project is discovered by file path.
 * 2. The destination field is currently empty.
 *
 * @returns true if the entry was migrated and can be safely removed.
 */
export function migrateProjectField(
  legacyMap: Record<string, unknown>,
  projects: StoryLineProject[],
  field: 'definedActs' | 'definedChapters',
): { migratedPaths: string[]; unmigratedPaths: string[] } {
  const migratedPaths: string[] = [];
  const unmigratedPaths: string[] = [];

  for (const [projectPath, value] of Object.entries(legacyMap)) {
    if (!Array.isArray(value) || value.length === 0) {
      // Empty or invalid entries are safe to discard.
      migratedPaths.push(projectPath);
      continue;
    }

    const project = projects.find(p => p.filePath === projectPath);
    if (!project) {
      // Project not discovered — preserve legacy data for next startup.
      unmigratedPaths.push(projectPath);
      continue;
    }

    const targetField = field === 'definedActs' ? 'definedActs' : 'definedChapters';
    const currentValue = project[targetField];
    if (!Array.isArray(currentValue) || currentValue.length > 0) {
      // Destination already has data — do not overwrite.
      // Mark as migrated so we don't retry indefinitely.
      migratedPaths.push(projectPath);
      continue;
    }

    // Perform the migration: copy values into the project object.
    const nums = value.map(Number).filter(n => !isNaN(n));
    project[targetField] = nums;
    migratedPaths.push(projectPath);
  }

  return { migratedPaths, unmigratedPaths };
}

/**
 * Safely remove migrated entries from the legacy data object.
 *
 * Only removes entries whose paths were successfully migrated.
 * Unmigrated entries are preserved for the next startup attempt.
 *
 * @returns true if any entries were removed (data.json is dirty).
 */
export function removeMigratedEntries(
  legacyData: Record<string, unknown>,
  key: string,
  migratedPaths: string[],
  unmigratedPaths: string[],
): boolean {
  const legacyMap = legacyData[key] as Record<string, unknown> | undefined;
  if (!legacyMap || typeof legacyMap !== 'object') return false;

  if (migratedPaths.length === 0) {
    // Nothing was migrated — keep the entire entry.
    return false;
  }

  // Remove only the successfully migrated paths.
  for (const path of migratedPaths) {
    delete legacyMap[path];
  }

  // If no entries remain, remove the top-level key entirely.
  if (Object.keys(legacyMap).length === 0) {
    delete legacyData[key];
    return true;
  }

  // Some entries remain (unmigrated) — data.json is still dirty
  // because we modified the map.
  return true;
}

/**
 * Migrate filterPresets from legacy data.json to the active project.
 *
 * @returns true if migration occurred.
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
 * These keys are no longer used and can be safely discarded.
 *
 * @returns true if any keys were removed.
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
 * Per-project field keys that live in System/ files, not data.json.
 * Used by Phase 3 migration to move data from data.json to System/.
 */
export const PROJECT_DATA_KEYS: string[] = [
  'tagColors',
  'tagTypeOverrides',
  'characterAliases',
  'ignoredCharacters',
  'writingTrackerData',
  'useProjectColors',
  'plotlineDescriptions',
  'characterCustomSections',
  'locationCustomSections',
  'codexCategoryCustomSections',
  'codexVisualGroups',
  'customLocationTypes',
  'codexCustomCategories',
  'codexEnabledCategories',
];

/**
 * Check if legacy data contains any per-project keys that need System/ migration.
 */
export function hasProjectDataKeys(legacyData: Record<string, unknown>): boolean {
  return PROJECT_DATA_KEYS.some(k => k in legacyData);
}

/**
 * Strip per-project data keys from data.json after System/ migration.
 *
 * @returns true if any keys were removed.
 */
export function stripProjectDataKeys(legacyData: Record<string, unknown>): boolean {
  let dirty = false;
  for (const key of PROJECT_DATA_KEYS) {
    if (key in legacyData) {
      delete legacyData[key];
      dirty = true;
    }
  }
  return dirty;
}

/**
 * Merge legacy plotgrid data into System/plotgrid.json.
 * Only writes if the existing file has no data.
 *
 * @returns the merged data object, or null if nothing to write.
 */
export function mergePlotgridData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
): Record<string, unknown> | null {
  const hasLegacy = 'rows' in legacyData || 'columns' in legacyData || 'cells' in legacyData;
  if (!hasLegacy) return null;

  // Check if existing file has data
  let existingHasData = false;
  if (existingContent) {
    try {
      const existing: Record<string, unknown> = JSON.parse(existingContent) as Record<string, unknown>;
      existingHasData = Array.isArray(existing?.rows) && existing.rows.length > 0;
    } catch {
      // Unreadable — allow overwrite
    }
  }
  if (existingHasData) return null;

  const pgData: Record<string, unknown> = {};
  if (Array.isArray(legacyData.rows)) pgData.rows = legacyData.rows;
  if (Array.isArray(legacyData.columns)) pgData.columns = legacyData.columns;
  if (legacyData.cells && typeof legacyData.cells === 'object') pgData.cells = legacyData.cells;
  if (legacyData.zoom !== undefined) pgData.zoom = legacyData.zoom;
  if (legacyData.stickyHeaders !== undefined) pgData.stickyHeaders = legacyData.stickyHeaders;
  if (legacyData.labelColumnWidth !== undefined) pgData.labelColumnWidth = legacyData.labelColumnWidth;
  if (legacyData.collapsedSections !== undefined) pgData.collapsedSections = legacyData.collapsedSections;
  return pgData;
}

/**
 * Merge legacy plotline data (tagColors, tagTypeOverrides).
 *
 * Priority: legacy data.json > existing System file > defaults.
 */
export function mergePlotlineData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  let existing: Record<string, unknown> = {};
  if (existingContent) {
    try {
      existing = JSON.parse(existingContent) as Record<string, unknown>;
    } catch { /* */ }
  }

  return {
    tagColors:
      legacyData.tagColors ?? existing.tagColors ?? defaults.tagColors ?? {},
    tagTypeOverrides:
      legacyData.tagTypeOverrides ?? existing.tagTypeOverrides ?? defaults.tagTypeOverrides ?? {},
  };
}

/**
 * Merge legacy character data (characterAliases, ignoredCharacters).
 */
export function mergeCharacterData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  let existing: Record<string, unknown> = {};
  if (existingContent) {
    try {
      existing = JSON.parse(existingContent) as Record<string, unknown>;
    } catch { /* */ }
  }

  return {
    characterAliases:
      legacyData.characterAliases ?? existing.characterAliases ?? defaults.characterAliases ?? {},
    ignoredCharacters:
      legacyData.ignoredCharacters ?? existing.ignoredCharacters ?? defaults.ignoredCharacters ?? [],
  };
}

/**
 * Merge legacy writing tracker data.
 */
export function mergeStatsData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
): Record<string, unknown> | null {
  let existing: Record<string, unknown> = {};
  if (existingContent) {
    try {
      existing = JSON.parse(existingContent) as Record<string, unknown>;
    } catch { /* */ }
  }

  const writingTrackerData =
    legacyData.writingTrackerData ?? existing.writingTrackerData ?? null;
  if (!writingTrackerData) return null;

  return { writingTrackerData };
}

/**
 * Derive the System/ folder path from a project's scene folder.
 */
export function deriveSystemFolder(sceneFolder: string): string {
  const base = sceneFolder.replace(/\\/g, '/').replace(/\/Scenes\/?$/, '');
  return `${base}/System`;
}

/**
 * Derive the System/ folder path from an activeProjectFile setting.
 * e.g. "StoryLine/Foo/Foo.md" → "StoryLine/Foo/System"
 */
export function deriveSystemFolderFromProjectFile(projectFile: string): string | null {
  const base = String(projectFile).replace(/\/[^/]+\.md$/i, '');
  if (!base) return null;
  return `${base}/System`;
}
