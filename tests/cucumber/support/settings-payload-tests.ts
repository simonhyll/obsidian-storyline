/**
 * Integration tests for buildSettingsPayload().
 *
 * These tests exercise the real production function from
 * `src/services/legacyMigration.ts` to verify that settings
 * persistence correctly handles legacy migration keys.
 *
 * This file runs at test bootstrap via BeforeAll hook.
 */

import { buildSettingsPayload, PROJECT_DATA_KEYS } from '../../../src/services/legacyMigration';
import { createPluginDataStore } from './plugin-data-store';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Settings payload test failed: ${msg}`);
  }
}

function assertDeepEqual(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), msg);
}

// ─── Ordinary settings update ───

function testSettingsPayloadOrdinaryUpdate() {
  const persisted = {
    defaultProjectLanguage: 'en',
    storyLineRoot: 'StoryLine',
    characterAliases: { 'hero': 'protagonist' },
  };
  const inMemorySettings = {
    defaultProjectLanguage: 'sv',
    storyLineRoot: 'MyBooks',
    characterAliases: {},
  };
  const migratedKeys = new Set<string>();
  const payload = buildSettingsPayload(inMemorySettings, persisted, migratedKeys);

  assert(payload.defaultProjectLanguage === 'sv', 'defaultProjectLanguage updated');
  assert(payload.storyLineRoot === 'MyBooks', 'storyLineRoot updated');
  assertDeepEqual(payload.characterAliases, { 'hero': 'protagonist' }, 'Pending characterAliases preserved');
}

// ─── Migrated keys not restored ───

function testSettingsPayloadMigratedKeysNotRestored() {
  const persisted = { defaultProjectLanguage: 'en', tagColors: { 'old-tag': '#ff0000' } };
  const inMemorySettings = { defaultProjectLanguage: 'en', tagColors: { 'new-tag': '#00ff00' } };
  const migratedKeys = new Set<string>(['tagColors']);
  const payload = buildSettingsPayload(inMemorySettings, persisted, migratedKeys);

  assertDeepEqual(payload.tagColors, { 'new-tag': '#00ff00' }, 'Migrated tagColors uses in-memory value');
}

// ─── Partial migration ───

function testSettingsPayloadPartialMigration() {
  const persisted = {
    defaultProjectLanguage: 'en',
    characterAliases: { 'hero': 'protagonist' },
    tagColors: { 'legacy-tag': '#ff0000' },
  };
  const inMemorySettings = {
    defaultProjectLanguage: 'sv',
    characterAliases: {},
    tagColors: { 'new-tag': '#00ff00' },
  };
  const migratedKeys = new Set<string>(['tagColors']);
  const payload = buildSettingsPayload(inMemorySettings, persisted, migratedKeys);

  assert(payload.defaultProjectLanguage === 'sv', 'defaultProjectLanguage updated');
  assertDeepEqual(payload.characterAliases, { 'hero': 'protagonist' }, 'Unresolved characterAliases preserved');
  assertDeepEqual(payload.tagColors, { 'new-tag': '#00ff00' }, 'Migrated tagColors uses in-memory value');
}

// ─── No persisted data ───

function testSettingsPayloadNoPersistedData() {
  const inMemorySettings = { defaultProjectLanguage: 'en', storyLineRoot: 'StoryLine' };
  const payload = buildSettingsPayload(inMemorySettings, null, new Set<string>());
  assertDeepEqual(payload, inMemorySettings, 'Payload matches in-memory settings');
}

// ─── Consecutive saves preserve legacy data ───

async function testSettingsPayloadConsecutiveSaves() {
  const dataStore = createPluginDataStore();

  await dataStore.saveData({
    defaultProjectLanguage: 'en',
    storyLineRoot: 'StoryLine',
    characterAliases: { 'hero': 'protagonist' },
  });

  const persisted1 = dataStore.getPersisted();
  const payload1 = buildSettingsPayload(
    { defaultProjectLanguage: 'sv', storyLineRoot: 'StoryLine', characterAliases: {} },
    persisted1,
    new Set<string>(),
  );
  await dataStore.saveData(payload1);

  const reloaded = dataStore.getPersisted();
  assert(reloaded!.defaultProjectLanguage === 'sv', 'Language updated after first save');
  assertDeepEqual((reloaded! as any).characterAliases, { 'hero': 'protagonist' }, 'characterAliases preserved after first save');

  const persisted2 = dataStore.getPersisted();
  const payload2 = buildSettingsPayload(
    { defaultProjectLanguage: 'sv', storyLineRoot: 'MyBooks', characterAliases: {} },
    persisted2,
    new Set<string>(),
  );
  await dataStore.saveData(payload2);

  const final = dataStore.getPersisted();
  assert(final!.defaultProjectLanguage === 'sv', 'Language still sv');
  assert(final!.storyLineRoot === 'MyBooks', 'storyLineRoot updated');
  assertDeepEqual((final! as any).characterAliases, { 'hero': 'protagonist' }, 'characterAliases preserved after second save');
}

// ─── PROJECT_DATA_KEYS coverage ───

function testProjectDataKeysCoverage() {
  const persisted: Record<string, unknown> = {};
  for (const key of PROJECT_DATA_KEYS) {
    persisted[key] = { migrated: true };
  }
  const inMemorySettings: Record<string, unknown> = { defaultProjectLanguage: 'en' };
  const payload = buildSettingsPayload(inMemorySettings, persisted, new Set<string>());

  for (const key of PROJECT_DATA_KEYS) {
    assert(
      JSON.stringify(payload[key]) === JSON.stringify(persisted[key]),
      `${key} preserved from persisted data when not migrated`,
    );
  }
}

// ─── Empty persisted values not preserved ───

function testSettingsPayloadEmptyPersistedValues() {
  const persisted = { defaultProjectLanguage: 'en', characterAliases: {} };
  const inMemorySettings = { defaultProjectLanguage: 'sv', characterAliases: { 'hero': 'protagonist' } };
  const payload = buildSettingsPayload(inMemorySettings, persisted, new Set<string>());

  assertDeepEqual(payload.characterAliases, { 'hero': 'protagonist' }, 'Empty persisted value does not override in-memory');
}

/** Run all buildSettingsPayload integration tests. */
export async function runSettingsPayloadTests() {
  testSettingsPayloadOrdinaryUpdate();
  testSettingsPayloadMigratedKeysNotRestored();
  testSettingsPayloadPartialMigration();
  testSettingsPayloadNoPersistedData();
  await testSettingsPayloadConsecutiveSaves();
  testProjectDataKeysCoverage();
  testSettingsPayloadEmptyPersistedValues();
}
