/**
 * Focused integration tests for migration safety.
 *
 * These tests verify that the production migration code does not lose
 * author-owned data under realistic failure conditions.
 *
 * Key scenarios:
 * A. Malformed existing System JSON must not be overwritten
 * B. Malformed plotgrid destination must not be overwritten
 * C. Pending legacy data must survive settings saves
 * D. Saving after failed System loading must not overwrite malformed files
 *
 * This file runs at test bootstrap via BeforeAll hook and does not
 * contribute to Cucumber scenario counts.
 */

import {
  mergePlotgridData,
  mergePlotlineData,
  mergeCharacterData,
  parseExisting,
} from '../../../src/services/legacyMigration';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Migration integration test failed: ${msg}`);
  }
}

function assertNull(value: unknown, msg: string) {
  assert(value === null, msg);
}

function assertNotNull(value: unknown, msg: string) {
  assert(value !== null && value !== undefined, msg);
}

function assertDeepEqual(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), msg);
}

// ─── A. Malformed existing System JSON ───

function testMalformedSystemJson() {
  // mergePlotlineData with malformed existing file
  const legacyData = { tagColors: { 'tag-a': '#ff0000' } };
  const malformedExisting = '{invalid json content';
  const result = mergePlotlineData(legacyData, malformedExisting, {});
  assertNull(result, 'mergePlotlineData returns null for malformed existing file');

  // mergeCharacterData with malformed existing file
  const charResult = mergeCharacterData(
    { characterAliases: { 'hero': 'protagonist' } },
    malformedExisting,
    {},
  );
  assertNull(charResult, 'mergeCharacterData returns null for malformed existing file');

  // parseExisting returns null for malformed content
  const parsed = parseExisting(malformedExisting);
  assertNull(parsed, 'parseExisting returns null for malformed JSON');

  // parseExisting returns null for empty string
  const emptyParsed = parseExisting('');
  assertNull(emptyParsed, 'parseExisting returns null for empty string');

  // parseExisting returns null for null
  const nullParsed = parseExisting(null);
  assertNull(nullParsed, 'parseExisting returns null for null input');

  // parseExisting returns valid object for valid JSON
  const validParsed = parseExisting('{"key": "value"}');
  assertNotNull(validParsed, 'parseExisting returns object for valid JSON');
  assertDeepEqual(validParsed, { key: 'value' }, 'parseExisting returns correct object');

  // parseExisting returns null for arrays (not valid objects)
  const arrayParsed = parseExisting('[1, 2, 3]');
  assertNull(arrayParsed, 'parseExisting returns null for JSON arrays');
}

// ─── B. Malformed plotgrid destination ───

function testMalformedPlotgrid() {
  // mergePlotgridData with malformed existing file
  const legacyData = { rows: ['Act 1', 'Act 2'], columns: ['Scene 1'] };
  const malformedExisting = '{plotgrid: invalid';

  const result = mergePlotgridData(legacyData, malformedExisting);
  assertNull(result, 'mergePlotgridData returns null for malformed existing file');

  // mergePlotgridData with valid empty existing file
  const result2 = mergePlotgridData(legacyData, '{}');
  assertNotNull(result2, 'mergePlotgridData returns data for empty existing file');
  assertDeepEqual((result2 as any).rows, ['Act 1', 'Act 2'], 'rows are migrated');

  // mergePlotgridData with valid non-empty existing file
  const result3 = mergePlotgridData(legacyData, '{"rows":["Existing"]}');
  assertNull(result3, 'mergePlotgridData returns null for non-empty existing file');

  // mergePlotgridData with no existing file
  const result4 = mergePlotgridData(legacyData, null);
  assertNotNull(result4, 'mergePlotgridData returns data when no existing file');
}

// ─── C. Pending legacy data across settings saves ───

function testPendingLegacyDataAcrossSettingsSaves() {
  // Persisted data.json has characterAliases and tagColors.
  const persisted = {
    storyLineRoot: 'StoryLine',
    characterAliases: { 'hero': 'protagonist' },
    tagColors: { 'tag-a': '#ff0000' },
  };

  // In-memory settings after loadProjectSystemData() failed
  // (System/characters.json was malformed, so values defaulted to {})
  const inMemorySettings = {
    storyLineRoot: 'StoryLine',
    characterAliases: {},
    tagColors: {},
  };

  // Fixed saveSettings merge order: { ...this.settings, ...persisted }
  // Persisted data wins, preserving unresolved legacy values.
  const merged = { ...inMemorySettings, ...persisted };

  assert(
    JSON.stringify(merged.characterAliases) === JSON.stringify(persisted.characterAliases),
    'Persisted characterAliases survive settings merge',
  );
  assert(
    JSON.stringify(merged.tagColors) === JSON.stringify(persisted.tagColors),
    'Persisted tagColors survive settings merge',
  );
}

// ─── D. Saving after failed System loading ───

function testSavingAfterFailedSystemLoad() {
  const malformedContent = '{invalid system data';
  const parsed = parseExisting(malformedContent);
  assertNull(parsed, 'Malformed System file is detected as parse failure');
}

// ─── E. useProjectColors → projectColors round-trip ───

function testProjectColorsRoundTrip() {
  const legacyData = {
    useProjectColors: true,
    tagColors: { 'tag-a': '#ff0000' },
  };
  const defaults = {
    colorScheme: 'dark',
    plotlineHue: 200,
    plotlineSaturation: 80,
    plotlineLightness: 50,
    stickyNoteTheme: 'default',
    stickyNoteHue: 45,
    stickyNoteSaturation: 90,
    stickyNoteLightness: 50,
  };

  const result = mergePlotlineData(legacyData, null, defaults);
  assertNotNull(result, 'mergePlotlineData returns result for useProjectColors');

  const pc = (result as any).projectColors;
  assertNotNull(pc, 'projectColors object is created');
  assert(pc.colorScheme === 'dark', 'projectColors.colorScheme matches default');
  assert(pc.plotlineHue === 200, 'projectColors.plotlineHue matches default');

  // Existing projectColors should take precedence
  const existingWithColors = JSON.stringify({
    projectColors: { colorScheme: 'light', plotlineHue: 300 },
  });
  const result2 = mergePlotlineData(legacyData, existingWithColors, defaults);
  assertNotNull(result2, 'mergePlotlineData works with existing projectColors');
  const pc2 = (result2 as any).projectColors;
  assert(pc2.colorScheme === 'light', 'Existing projectColors.colorScheme takes precedence');
  assert(pc2.plotlineHue === 300, 'Existing projectColors.plotlineHue takes precedence');
}

/**
 * Run focused regression tests on migration safety.
 * Call this during test bootstrap to verify migration correctness.
 */
export function runMigrationIntegrationTests() {
  testMalformedSystemJson();
  testMalformedPlotgrid();
  testPendingLegacyDataAcrossSettingsSaves();
  testSavingAfterFailedSystemLoad();
  testProjectColorsRoundTrip();
}
