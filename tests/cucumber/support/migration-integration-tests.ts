/**
 * Integration tests for migration merge helpers.
 *
 * These tests exercise actual production functions from
 * `src/services/legacyMigration.ts` to verify that malformed
 * System JSON files are not overwritten during migration.
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
  const legacyData = { tagColors: { 'tag-a': '#ff0000' } };
  const malformedExisting = '{invalid json content';
  const result = mergePlotlineData(legacyData, malformedExisting, {});
  assertNull(result, 'mergePlotlineData returns null for malformed existing file');

  const charResult = mergeCharacterData(
    { characterAliases: { 'hero': 'protagonist' } },
    malformedExisting,
    {},
  );
  assertNull(charResult, 'mergeCharacterData returns null for malformed existing file');

  const parsed = parseExisting(malformedExisting);
  assertNull(parsed, 'parseExisting returns null for malformed JSON');

  const emptyParsed = parseExisting('');
  assertNull(emptyParsed, 'parseExisting returns null for empty string');

  const nullParsed = parseExisting(null);
  assertNull(nullParsed, 'parseExisting returns null for null input');

  const validParsed = parseExisting('{"key": "value"}');
  assertNotNull(validParsed, 'parseExisting returns object for valid JSON');
  assertDeepEqual(validParsed, { key: 'value' }, 'parseExisting returns correct object');

  const arrayParsed = parseExisting('[1, 2, 3]');
  assertNull(arrayParsed, 'parseExisting returns null for JSON arrays');
}

// ─── B. Malformed plotgrid destination ───

function testMalformedPlotgrid() {
  const legacyData = { rows: ['Act 1', 'Act 2'], columns: ['Scene 1'] };
  const malformedExisting = '{plotgrid: invalid';

  const result = mergePlotgridData(legacyData, malformedExisting);
  assertNull(result, 'mergePlotgridData returns null for malformed existing file');

  const result2 = mergePlotgridData(legacyData, '{}');
  assertNotNull(result2, 'mergePlotgridData returns data for empty existing file');
  assertDeepEqual((result2 as any).rows, ['Act 1', 'Act 2'], 'rows are migrated');

  const result3 = mergePlotgridData(legacyData, '{"rows":["Existing"]}');
  assertNull(result3, 'mergePlotgridData returns null for non-empty existing file');

  const result4 = mergePlotgridData(legacyData, null);
  assertNotNull(result4, 'mergePlotgridData returns data when no existing file');
}

// ─── C. useProjectColors → projectColors round-trip ───

function testProjectColorsRoundTrip() {
  const legacyData = { useProjectColors: true, tagColors: { 'tag-a': '#ff0000' } };
  const defaults = {
    colorScheme: 'dark', plotlineHue: 200, plotlineSaturation: 80,
    plotlineLightness: 50, stickyNoteTheme: 'default', stickyNoteHue: 45,
    stickyNoteSaturation: 90, stickyNoteLightness: 50,
  };

  const result = mergePlotlineData(legacyData, null, defaults);
  assertNotNull(result, 'mergePlotlineData returns result for useProjectColors');
  const pc = (result as any).projectColors;
  assertNotNull(pc, 'projectColors object is created');
  assert(pc.colorScheme === 'dark', 'projectColors.colorScheme matches default');
  assert(pc.plotlineHue === 200, 'projectColors.plotlineHue matches default');

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
 * Run focused regression tests on migration merge helpers.
 * Call this during test bootstrap to verify migration correctness.
 */
export function runMigrationIntegrationTests() {
  testMalformedSystemJson();
  testMalformedPlotgrid();
  testProjectColorsRoundTrip();
}
