/**
 * Legacy migration merge helpers and key mappings.
 *
 * Extracted from legacyMigration.ts to stay under the 200-line file budget.
 * These pure functions merge legacy data.json values into System/ JSON files.
 */

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
 * Map each PROJECT_DATA_KEY to the System/ file it migrates into.
 */
export const KEY_TO_SYSTEM_FILE: Record<string, string> = {
  tagColors: 'plotlines.json',
  tagTypeOverrides: 'plotlines.json',
  characterAliases: 'characters.json',
  ignoredCharacters: 'characters.json',
  writingTrackerData: 'stats.json',
  useProjectColors: 'plotlines.json',
  plotlineDescriptions: 'plotlines.json',
  characterCustomSections: 'characters.json',
  locationCustomSections: 'locations.json',
  codexCategoryCustomSections: 'codex.json',
  codexVisualGroups: 'codex.json',
  customLocationTypes: 'locations.json',
  codexCustomCategories: 'codex.json',
  codexEnabledCategories: 'codex.json',
};

/**
 * Check if legacy data contains any per-project keys that need System/ migration.
 */
export function hasProjectDataKeys(legacyData: Record<string, unknown>): boolean {
  return PROJECT_DATA_KEYS.some(k => k in legacyData);
}

/**
 * Strip per-project data keys from data.json after System/ migration.
 * (Legacy convenience wrapper — prefer stripSpecificProjectDataKeys.)
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
 * Strip only the specified keys from data.json.
 */
export function stripSpecificProjectDataKeys(
  legacyData: Record<string, unknown>,
  keys: string[],
): boolean {
  let dirty = false;
  for (const key of keys) {
    if (key in legacyData) {
      delete legacyData[key];
      dirty = true;
    }
  }
  return dirty;
}

/**
 * Get the set of legacy keys that map to a given System file.
 */
export function getKeysForSystemFile(systemFile: string): string[] {
  return PROJECT_DATA_KEYS.filter(k => KEY_TO_SYSTEM_FILE[k] === systemFile);
}

/**
 * Merge legacy plotgrid data into System/plotgrid.json.
 */
export function mergePlotgridData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
): Record<string, unknown> | null {
  const hasLegacy = 'rows' in legacyData || 'columns' in legacyData || 'cells' in legacyData;
  if (!hasLegacy) return null;

  let existingHasData = false;
  if (existingContent) {
    try {
      const existing: Record<string, unknown> = JSON.parse(existingContent) as Record<string, unknown>;
      existingHasData = Object.keys(existing).length > 0;
    } catch {
      // Unreadable — allow overwrite
    }
  }
  if (existingHasData) return null;

  return buildPlotgridData(legacyData);
}

function buildPlotgridData(legacyData: Record<string, unknown>): Record<string, unknown> {
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
 */
export function mergePlotlineData(
  legacyData: Record<string, unknown>,
  existingContent: string | null,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const existing = parseExisting(existingContent);
  return {
    ...existing,
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
  const existing = parseExisting(existingContent);
  return {
    ...existing,
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
  const existing = parseExisting(existingContent);
  const writingTrackerData =
    legacyData.writingTrackerData ?? existing.writingTrackerData ?? null;
  if (!writingTrackerData) {
    if (Object.keys(existing).length > 0) return existing;
    return null;
  }
  return { ...existing, writingTrackerData };
}

function parseExisting(content: string | null): Record<string, unknown> {
  if (!content) return {};
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
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
 */
export function deriveSystemFolderFromProjectFile(projectFile: string): string | null {
  const base = String(projectFile).replace(/\/[^/]+\.md$/i, '');
  if (!base) return null;
  return `${base}/System`;
}
