# StoryLine BDD Test Integrity Audit

> Generated: 2026-10-23
> Branch: `feat/rework`
> Base commit: `2d28aa7b4d2b6f014750e90bf643ea8c37b3522a`
> Updated: 2026-10-24 (Step 6C.4b.4a — Production-Backed Cancellation Safety)
> Total scenarios: 62
> Total steps: 276

## 6C.4b.4a Update Summary

Step 6C.4b.4a hardened cancellation tests and fixed the migration-integration-tests.ts file:

1. **Migration test file fixed** — `migration-integration-tests.ts` now tests real `buildSettingsPayload()` instead of manual object merges. Covers ordinary settings updates, migrated keys not restored, partial migration, consecutive saves with plugin data store, PROJECT_DATA_KEYS coverage, and empty persisted values.
2. **Cancellation tests created** — `cancellation-tests.ts` exercises real `CreateProjectModal`, `EventModal`, and `QuickAddModal` cancellation behavior with jsdom. Verifies: cancel resolves to null, no creation operations triggered, settle idempotence, and programmatic close behavior.
3. **Project cancellation step improved** — `projects.steps.ts` now verifies no creation operations in mockDepsLog when cancelled.
4. **Event/Scene cancellation step improved** — `events.steps.ts` now takes vault snapshots before cancellation and verifies no files created, deleted, or modified. Tracks EventManager operations.
5. **Obsidian mock extended** — Added `Modal` and `Setting` classes to `obsidian-mock.ts` for headless modal testing.
6. **Architecture** — 1,164 violations (delta 0 from baseline).

## 6C.4b.3b.6 Historical Summary

Step 6C.4b.3b.6 fixed a settings persistence regression and strengthened migration integration tests:

1. **saveSettings() regression fixed** — Previous merge order `{ ...this.settings, ...persisted }` made ALL persisted values override in-memory settings, so changing any setting would be lost. Replaced with `buildSettingsPayload()` selective merge: normal settings from `this.settings`, only unresolved legacy keys preserved from persisted data.
2. **`buildSettingsPayload()` added** — Production-owned function in `legacyMigration.ts` that implements the selective merge strategy. Tests exercise this real function with the plugin data store.
3. **`handleExistingDestination()` fixed** — Now detects malformed JSON destinations and refuses to overwrite them. Added write verification before deleting source files.
4. **Migration integration tests rewritten** — Replaced local object merges with tests of `buildSettingsPayload()`, covering ordinary settings updates, migrated keys not restored, partial migration, consecutive saves, and PROJECT_DATA_KEYS coverage.
5. **Architecture** — 1,164 violations (delta 0 from baseline).

## 6C.4b.3b.5 Historical Summary

Step 6C.4b.3b.5 created test-first integration evidence for migration safety and closed two remaining data-loss paths:

1. **Migration integration tests** — Created `migration-integration-tests.ts` with 23 focused tests covering malformed System JSON, malformed plotgrid, pending legacy data across settings saves, and project color round-trip. Runs at test bootstrap via `BeforeAll` hook.
2. **RED evidence captured** — Two failures observed before fixes: (a) `mergePlotgridData` allowed overwriting malformed existing files, (b) `saveSettings` merge order overwrote persisted legacy data with empty in-memory defaults.
3. **mergePlotgridData fixed** — Now returns `null` for malformed existing files (previously allowed overwrite). Extracted `parsePlotgridExisting()` helper to meet complexity budget.
4. **saveSettings merge order fixed** — Changed from `{ ...persisted, ...this.settings }` to `{ ...this.settings, ...persisted }` so persisted legacy values survive settings save calls.
5. **parseExisting exported** — Added `parseExisting` to the re-exports in `legacyMigration.ts` for test access.
6. **Architecture** — 1,164 violations (delta 0 from baseline).

## 6C.4b.3b.4 Historical Summary

Step 6C.4b.3b.4 closed the remaining migration data-loss paths and restored the architecture budget:

1. **parseExisting() returns null on malformed JSON** — Previously returned `{}`, which could cause malformed but nonempty System files to be silently overwritten. All merge helpers now return `null` when the existing file is malformed, deferring the merge.
2. **useProjectColors → projectColors migration** — `mergePlotlineData()` now creates the `projectColors` object from legacy `useProjectColors` flag and color defaults, matching the format that `saveProjectSystemData()` writes and `loadProjectSystemData()` reads.
3. **migrateJsonFilesToSystem() preserves conflicting files** — Previously always deleted the old file when the new path existed. Now only deletes when contents are semantically equivalent, when the new file is empty and old has data, or after verifying the write succeeded. Different meaningful data in both files is preserved.
4. **saveSettings() preserves unresolved legacy data** — Now loads persisted `data.json` first, then merges with `this.settings`, ensuring unresolved legacy keys survive settings save calls even if they're not in the in-memory settings object.
5. **Architecture extraction** — Extracted `saveSettings()` into `applyMigrationStripping()`, `applyColorSettings()`, `restoreGlobalColorDefaults()`, and `captureGlobalColorSnapshot()`. Extracted `migrateJsonFilesToSystem()` into `migrateOneJsonFile()`, `handleExistingDestination()`, `hasUsableData()`, `contentsEqual()`, and `trashFileIfExists()`.
6. **Architecture baseline reduced** — From 1,170 to 1,164 violations (-6), below the 1,166 target.

## 6C.4b.3b.3 Historical Summary

Step 6C.4b.3b.3 closed remaining migration data-loss paths and corrected KEY_TO_SYSTEM_FILE mappings:

1. **KEY_TO_SYSTEM_FILE corrected** — `characterCustomSections`, `locationCustomSections`, `codexCategoryCustomSections`, `codexVisualGroups`, `customLocationTypes`, `codexCustomCategories`, `codexEnabledCategories` now correctly map to `custom-sections.json` (not `characters.json`, `locations.json`, `codex.json`).
2. **mergePlotlineData() fixed** — Now includes `plotlineDescriptions` from legacy data (was missing).
3. **saveSettings() data-loss fixed** — Added `_migratedKeys` Set tracking. Only keys that were actually migrated successfully are stripped from data.json. Unresolved legacy keys survive `saveSettings()` calls.
4. **_migratedKeys restoration** — On plugin restart, `loadProjectSystemData()` populates `_migratedKeys` from keys NOT present in persisted data.json (meaning they were already migrated).
5. **custom-sections.json migration** — Added Phase 3 migration for custom sections data to `System/custom-sections.json`.
6. **Malformed value handling** — `migrateProjectField()` now treats non-array values and arrays with invalid entries as `deferred` instead of `equivalent`, preserving source for recovery.
7. **Architecture extraction** — Extracted `migrateSystemFiles()` and `writeSystemFile()` methods to reduce nesting depth. Added `mergeCustomSectionsData()` helper with data-driven approach.
8. **Architecture baseline** — Updated from 1,169 to 1,170 violations (+1 from `migrateSystemFiles` extraction).

## 6C.4b.3b.2 Historical Summary

Step 6C.4b.3b.1 replaced the test-only migration implementation with real production code and fixed a production data-loss defect:

1. **Production data-loss defect fixed** — `migrateProjectDataFromSettings()` previously deleted `definedActs`/`definedChapters` from data.json unconditionally, even when no matching project was discovered. Now only successfully migrated entries are removed; unresolved entries are preserved for the next startup retry.
2. **Migration logic extracted** — Created `src/services/legacyMigration.ts` with pure functions (`migrateProjectField`, `removeMigratedEntries`, etc.). `main.ts` now delegates to these functions. Tests import the same production functions.
3. **Migration test uses production code** — `hierarchy-deferred.steps.ts` now calls `migrateProjectField()` and `removeMigratedEntries()` from `legacyMigration.ts`, the same functions used by `SceneCardsPlugin.migrateProjectDataFromSettings()`. No test-only `migrateField()` function remains.
4. **Restart test uses persisted settings** — Created `plugin-data-store.ts` to simulate Obsidian's `loadData()`/`saveData()` boundary. The restart test now loads settings from a persisted snapshot, not from the original plugin's in-memory object.
5. **Scene verification after restart** — The restart test verifies scene files still exist and the restored book's scenes load correctly through `loadScenesForBooks()`.
6. **File split** — Extracted restart steps to `hierarchy-restart.steps.ts` and migration assertions to `migration-assertions.ts` to meet 200-line budget.
7. **Architecture baseline updated** — Decreased from 1,170 to 1,166 violations (net -4 from extracted migration functions).

## 6C.4b.3a.1 Historical Summary

Step 6C.4b.3a.1 continued hardening hierarchy tests:

1. **Exclusive series membership** — Added new scenario "Series membership is exclusive across universes". Creates a series in Universe Alpha, moves it to Universe Beta via `addSeriesToUniverse()`, then verifies: (a) series `universeId` updated to Beta, (b) Beta's `seriesIds` includes the series, (c) Alpha's `seriesIds` no longer includes the series, (d) reloaded series metadata confirms the change.
2. **Exact UUID assertions** — Universe isolation test now captures exact Scene UUIDs from `createScene()` and verifies the returned set matches exactly (no missing, no extra).
3. **Vault harness regression tests** — Added `runVaultHarnessTests()` to verify: file collision rejection, `adapter.write()` consistency with `vault.read()`, `exists()` correctness, file removal, and `adapter.list()` immediate-children-only behavior. Runs at test bootstrap via `BeforeAll`.
4. **Cross-universe negative assertion** — Isolation test now explicitly verifies no scenes from the other universe are present.

## 6C.4b.3a Historical Summary

Step 6C.4b.3a hardened five hierarchy scenarios by replacing fake implementations with real UniverseManager and SeriesManager tests:

1. **Vault harness extended** — Added `adapter.read()`, `adapter.write()`, and `adapter.list()` methods to the in-memory vault. The `list()` method returns only immediate children (not recursive descendants).
2. **Hierarchy test helpers** — Created `hierarchy-test-helpers.ts` with `setupHierarchyTest()`, `createReloadedUniverseManager()`, and UUID validation.
3. **Book belongs to universe** — Uses `UniverseManager.createUniverse()` with real UUID generation. Verifies book's `universeId` matches the generated UUID, not a name-derived slug.
4. **Book in series in universe** — Creates universe, series, and book via production APIs. Verifies `addSeriesToUniverse()` updates both universe `seriesIds` and series `universeId`.
5. **Series belongs to universe** — Verifies series `universeId` and `ownerId` match the universe. Checks `universe.seriesIds` includes the series UUID.
6. **Universe isolation** — Creates two universes (Alpha/Beta) with distinct books. Uses `getBooksInUniverse()` to verify cross-universe isolation.
7. **Universe UUID stability** — Creates a universe, then reloads via a fresh `UniverseManager` instance. Verifies the same UUID and name are restored from persisted `universe.json`.
8. **Two scenarios deferred** — Legacy migration and project restart remain simulated (deferred to 6C.4b.3b).

## 6C.4b.2a Update Summary

Step 6C.4b.2a eliminated false-green Scene acceptance tests and fixed Event date comparison:

1. **Production guard added** — `SceneManager.createScene()` now throws when no active book (for non-note scenes). Also rejects `ownerId` mismatch with active book.
2. **No-active-Book test fixed** — Tests the real production throw, verifies no file created and error message mentions active book.
3. **Scene ordering test fixed** — Uses `storyDate` sort field with explicit chronological order assertion. Scenes created out of order (March, Jan, Feb); verified sorted as Jan, Feb, March.
4. **Scene date round-trip fixed** — Verifies exact year/month/day from `serializeToYaml()` nested `instant` structure, not just non-null check.
5. **UUID stability test fixed** — Uses explicit UUID from Gherkin (`550e8400-e29b-41d4-a716-446655440000`), creates scene with that ID, verifies it survives update.
6. **Multi-book Scene safety hardened** — Uses real `SceneManager.createScene()` with two-book setup; verifies file path and `ownerId` match active book.
7. **Event date comparison fixed** — Replaced object identity (`===`) with `JSON.stringify()` deep comparison. Added assertion that reloaded date matches expected date.
8. **Notice mock added** — `obsidian-mock.ts` now exports `Notice` class for test environment.
9. **Scene assertions extracted** — `scene-assertions.ts` keeps `scenes.steps.ts` under 200-line budget.
10. **Event assertions refactored** — `assertDateUpdated()` split into smaller functions to meet complexity budget.

## 6C.4a Historical Summary

Step 6C.4a corrected the BDD audit inventory and hardened critical safety tests:

1. **Audit inventory corrected** — Rebuilt using actual Gherkin scenario discovery. `timespan.feature` has 11 scenarios (5 regular + 2 Scenario Outlines × 3 examples). Removed fictitious "timeline.steps.ts extras" category. Total reconciled to 61 scenarios across 9 feature files.
2. **Concurrency guard** — Extracted `CreationConcurrencyGuard` to `src/services/creationGuard.ts` (no Obsidian deps). `CreateProjectModal.handleCreate()` now delegates to this production class. Test exercises the real guard with controllable timing.
3. **In-memory vault harness** — Created `tests/cucumber/support/in-memory-vault.ts` for testing EventManager/SceneManager without Obsidian.
4. **Production code change** — `CreateProjectModal` now uses `CreationConcurrencyGuard` instead of inline `isCreating` flag. Behavior is identical; the extraction enables testability.

## 6C.3b Historical Summary

Step 6C.3b resolved the CI failure from Step 6C.3:

1. **Changelog architecture** — Shared logic in `scripts/changelog-lib.cjs` (CommonJS).
2. **Changelog CLI** — Fixed `parse` command, portable `git` invocation.
3. **Concurrency guard** — Tests real `CreationConcurrencyGuard` from `src/services/creationGuard.ts`.
4. **Dropdown race** — Tests real `updateSeriesDropdownInPlace()` via jsdom.

## Classification Definitions

| Level | Definition |
|---|---|
| **Production-backed** | `When` steps invoke real production code; `Then` steps assert observable results from that code. A regression in the production module would cause the test to fail. |
| **Partially backed** | Some steps exercise production code, but key assertions are weak, simulated, or self-fulfilling. The test may not detect all regressions. |
| **Fixture-only** | Steps only construct test fixtures (factory objects) and assert properties of those fixtures. No production workflow is invoked. |
| **Simulated** | Steps reimplement production logic in test code, then assert against the reimplementation. The test passes even if production is broken. |
| **No-op** | Steps contain only comments or set a flag then assert the same flag. No observable behavior is tested. |

---

## Feature-by-Feature Audit

### 1. `features/settings/changelog.feature` (7 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Preview shows changes without modifying files | `scripts/changelog-lib.cjs` | **Yes** — `generateEntries` + `generateMarkdown` | **Yes** — checks grouped output | Production-backed | Low |
| 2 | Feature commits grouped under Features | `scripts/changelog-lib.cjs` | **Yes** — `generateEntries` | **Yes** — checks section header | Production-backed | Low |
| 3 | Fix commits grouped under Bug Fixes | `scripts/changelog-lib.cjs` | **Yes** — `generateEntries` | **Yes** — checks section header | Production-backed | Low |
| 4 | Breaking changes highlighted | `scripts/changelog-lib.cjs` | **Yes** — `generateEntries` | **Yes** — checks breaking marker | Production-backed | Low |
| 5 | Non-conforming commits handled | `scripts/changelog-lib.cjs` | **Yes** — `generateEntries` | **Yes** — checks nonconforming section | Production-backed | Low |
| 6 | Duplicate prevention | `scripts/changelog-lib.cjs` | **Yes** — `insertVersionSection` throws | **Yes** — catches error | Production-backed | Low |
| 7 | Existing tag protection | `scripts/changelog.cjs` | **Partial** — sets CLI error message | **Partial** — checks message text | Partially backed | Medium |

**Summary:** 6 production-backed, 1 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Hardened in 6C.3/6C.3b.** Scenarios 1–6 exercise `scripts/changelog-lib.cjs` directly. Scenario 7 (tag protection) still simulates the CLI error message; full CLI integration with a temporary Git repo is deferred to 6C.4.

---

### 2. `features/projects/creation.feature` (9 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Create book with valid title | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — checks bookId format | Production-backed | Low |
| 2 | Empty title fails | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — `CreationValidationError` | Production-backed | Low |
| 3 | Book with new series | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — mock deps log | Production-backed | Low |
| 4 | Book in existing series | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — series UUID in log | Production-backed | Low |
| 5 | Create series | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — series name in log | Production-backed | Low |
| 6 | Create universe | `projectCreation.ts` | **Yes** — `executeCreation` | **Yes** — universe name in log | Production-backed | Low |
| 7 | Cancel creation | `CreateProjectModal.ts` | **Yes** — `settle(null)` + `close()` via cancellation-tests.ts | **Yes** — checks no creation ops in mockDepsLog | Production-backed | Low |
| 8 | Double-click create | `creationGuard.ts` | **Yes** — `CreationConcurrencyGuard.tryStart()` | **Yes** — asserts second blocked | Production-backed | Low |
| 9 | Async dropdown race | `CreateProjectDropdowns.ts` | **Yes** — `updateSeriesDropdownInPlace` | **Yes** — checks HTMLSelectElement | Production-backed | Low |

**Summary:** 9 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **All 9 scenarios now production-backed.** Scenarios 1–6, 8–9 hardened in 6C.3/6C.3b. Scenario 7 (cancellation) hardened in 6C.4b.4a: `cancellation-tests.ts` exercises real `CreateProjectModal.settle(null)` and `close()` with jsdom, verifying no creation operations occur. Cucumber step verifies no creation ops in mockDepsLog.

---

### 3. `features/timeline/navigation.feature` (8 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Navigate to first item | `TimelineNavigationService.ts` | **Yes** — `setSelectedDate()` | **Yes** — checks current item | Production-backed | Low |
| 2 | Navigate to last item | `TimelineNavigationService.ts` | **Yes** — `setSelectedDate()` | **Yes** — checks current item | Production-backed | Low |
| 3 | Navigate forward | `TimelineNavigationService.ts` | **Yes** — `navigateNext()` | **Yes** — checks next item | Production-backed | Low |
| 4 | Navigate backward | `TimelineNavigationService.ts` | **Yes** — `navigatePrevious()` | **Yes** — checks previous item | Production-backed | Low |
| 5 | Forward at end stops | `TimelineNavigationService.ts` | **Yes** — `navigateNext()` | **Yes** — asserts null | Production-backed | Low |
| 6 | Filter by book | `TimelineNavigationService.ts` | **Yes** — `updateItems()` with filter | **Yes** — checks filtered items | Production-backed | Low |
| 7 | Multi-book chronological | `TimelineNavigationService.ts` | **Yes** — `updateItems` + `getItems` | **Yes** — checks order | Production-backed | Low |
| 8 | Empty timeline | `TimelineNavigationService.ts` | **Yes** — `updateItems([], [])` | **Yes** — checks empty | Production-backed | Low |

**Summary:** 8 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Hardened in 6C.3.** All 8 scenarios use production TimelineNavigationService.

---

### 4. `features/timeline/timespan.feature` (11 scenarios)

This feature has 5 regular Scenarios and 2 Scenario Outlines (each with 3 examples), expanding to 11 executed scenarios.

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage |
|---|---|---|---|---|---|
| 1 | Parse date → TimeSpan: day | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks kind, precision | Production-backed |
| 2 | Parse date → TimeSpan: month | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks kind, precision | Production-backed |
| 3 | Parse date → TimeSpan: year | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks kind, precision | Production-backed |
| 4 | Compare: first earlier | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks negative result | Production-backed |
| 5 | Compare: first later | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks positive result | Production-backed |
| 6 | Compare: equal | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks zero result | Production-backed |
| 7 | Invalid TimeSpan validation | `TimeSpanService.ts` | **Yes** — `validateTimeSpan()` | **Yes** — checks error string | Production-backed |
| 8 | TimeSpan kind: instant | `TimeSpanService.ts` | **Yes** — constructs | **Yes** — checks `kind` field | Production-backed |
| 9 | TimeSpan kind: range | `TimeSpanService.ts` | **Yes** — constructs | **Yes** — checks `kind` field | Production-backed |
| 10 | TimeSpan kind: fuzzy | `TimeSpanService.ts` | **Yes** — constructs | **Yes** — checks `kind` field | Production-backed |
| 11 | Parse invalid date → null | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks null | Production-backed |

**Summary:** 11 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **No changes needed.** Already well-tested.

---

### 5. `features/manuscript/scenes.feature` (5 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Create scene in active book | `SceneManager.ts` | **Yes** — `createScene()` | **Yes** — checks path, UUID, ownership | Production-backed | Low |
| 2 | No active book → error | `SceneManager.ts` | **Yes** — `createScene()` | **Yes** — checks error recorded | Production-backed | Low |
| 3 | Scene metadata preserved | `SceneManager.ts` | **Yes** — `createScene()` + reload | **Yes** — reloads from vault | Production-backed | Low |
| 4 | Scene ordering | `SceneManager.ts` | **Yes** — creates out of order | **Yes** — checks sorted order | Production-backed | Low |
| 5 | UUID stability | `SceneManager.ts` | **Yes** — `updateScene()` | **Yes** — reloads and compares UUID | Production-backed | Low |

**Summary:** 5 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Hardened in 6C.4b.2.** All 5 scenarios now exercise real SceneManager with in-memory vault. Scene UUID production bug fixed: `MetadataParser` now serializes/deserializes `id`, `ownerId`, `introducedIn`; `SceneManager.createScene()` generates UUID and sets ownership.

---

### 6. `features/projects/hierarchy.feature` (8 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Book belongs to universe | `SceneManager.ts`, `UniverseManager.ts` | **Yes** — `createProject()` + `saveProjectFrontmatter()` | **Yes** — checks persisted YAML frontmatter | Production-backed | Low |
| 2 | Book in series in universe | `SceneManager.ts`, `SeriesManager.ts` | **Yes** — `createProject()` + `addBookToSeries()` | **Yes** — checks seriesUuid, universeId | Production-backed | Low |
| 3 | Series belongs to universe | `UniverseManager.ts`, `SeriesManager.ts` | **Yes** — `addSeriesToUniverse()` | **Yes** — checks seriesIds, universeId | Production-backed | Low |
| 4 | Series membership exclusive | `UniverseManager.ts` | **Yes** — `addSeriesToUniverse()` moves series | **Yes** — checks old universe removed, new added, reload | Production-backed | Low |
| 5 | Universe isolation | `SceneManager.ts`, `UniverseManager.ts` | **Yes** — `createScene()` + `loadScenesForBooks()` | **Yes** — exact UUID set match, cross-universe negative | Production-backed | Low |
| 6 | Universe UUID stability | `UniverseManager.ts` | **Yes** — fresh manager reload | **Yes** — checks UUID survives reload | Production-backed | Low |
| 7 | Legacy settings migration | `legacyMigration.ts`, `SceneManager.ts` | **Yes** — `migrateProjectField()` + `saveProjectFrontmatter()` | **Yes** — checks persisted YAML, legacy keys removed, data-loss protection | Production-backed | Low |
| 8 | Project restoration | `SceneManager.ts` | **Yes** — persisted settings reload + `scanProjects()` | **Yes** — checks activeProjectFile restored by UUID, scenes verified | Production-backed | Low |

**Summary:** 8 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **All 8 scenarios now production-backed.** Scenarios 1–6 hardened in 6C.4b.3a.1 with
real `SceneManager.createProject()`, `SeriesManager.addBookToSeries()`, `UniverseManager.addSeriesToUniverse()`,
`SceneManager.createScene()`, and `loadScenesForBooks()`. Scenario 4 (exclusive membership) verifies
that moving a series between universes removes it from the old universe. Scenario 5 (isolation) uses
exact UUID set assertions and cross-universe negative checks. Scenarios 7–8 (legacy migration and
project restart) hardened in 6C.4b.3b.1: migration exercises `migrateProjectField()` and
`removeMigratedEntries()` from `src/services/legacyMigration.ts` (the same functions used by
`SceneCardsPlugin.migrateProjectDataFromSettings()`), with data-loss protection ensuring unresolved
legacy entries are preserved. Restart test uses a plugin data store to simulate `loadData()`/`saveData()`,
loads settings from a persisted snapshot, and verifies scene files survive the restart.

---

### 7. `features/events/management.feature` (7 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Create event with date | `EventManager.ts` | **Yes** — `createEventFile()` | **Yes** — checks UUID, ownership, persisted YAML | Production-backed | Low |
| 2 | Create event without date | `EventManager.ts` | **Yes** — `createEventFile()` | **Yes** — checks no timeSpan | Production-backed | Low |
| 3 | Update event date | `EventManager.ts` | **Yes** — `saveEvent()` | **Yes** — reloads from vault, checks TimeSpan | Production-backed | Low |
| 4 | Delete event | `EventManager.ts` | **Yes** — `deleteEvent()` | **Yes** — checks file removed, event absent | Production-backed | Low |
| 5 | Canonical event ownership | `EventManager.ts` | **Yes** — `createEventFile()` | **Yes** — checks universe ownership | Production-backed | Low |
| 6 | Book-scoped event ownership | `EventManager.ts` | **Yes** — `createEventFile()` | **Yes** — checks book ownership | Production-backed | Low |
| 7 | Load existing events | `EventManager.ts` | **Yes** — `loadAll()` on fresh instance | **Yes** — checks count and required fields | Production-backed | Low |

**Summary:** 7 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Hardened in 6C.4b.1.** All 7 scenarios now exercise real EventManager with in-memory vault. Tests verify actual YAML persistence, UUID round-trips, file removal, and reload behavior.

---

### 8. `features/events/ownership.feature` (3 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Canonical Event persistence | `EventManager.ts` | **Yes** — `createEventFile()` | **Yes** — checks UUID, TimeSpan, ownership, persisted YAML | Production-backed | Low |
| 2 | Scene creation safety | `SceneManager.ts` | **Yes** — `createScene()` with production ownership guard | **Yes** — checks ownership, path prefix | Production-backed | Low |
| 3 | Cancellation | `EventModal.ts`, `QuickAddModal.ts` | **Yes** — real modal cancel via cancellation-tests.ts | **Yes** — vault snapshot comparison, no EventManager ops | Production-backed | Low |

**Summary:** 3 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** Scenario 1 hardened in 6C.4b.1 using real EventManager. Scenario 2 (Scene safety) hardened in 6C.4b.2a using real `SceneManager.createScene()`. Scenario 3 (Cancellation) hardened in 6C.4b.4a: `cancellation-tests.ts` exercises real `EventModal` and `QuickAddModal` cancel behavior with jsdom. Cucumber step takes vault snapshots and verifies no files created, deleted, or modified.

---

### 9. `features/import-export/export.feature` (4 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Export scenes to markdown | Test-only | **No** — simulates export | **Partial** — checks count | Simulated | Medium |
| 2 | Export range selection | Test-only | **No** — simulates filtering | **Partial** — checks count | Simulated | Medium |
| 3 | Scrivener import on desktop | Test-only | **No** — sets `isDesktop = true` | **No** — asserts flag value | No-op | High |
| 4 | Scrivener import hidden on mobile | Test-only | **No** — sets `isDesktop = false` | **No** — asserts flag value | No-op | High |

**Summary:** 0 production-backed, 0 partially backed, 0 fixture-only, 2 simulated, 2 no-op.
**Action:** **Deferred to 6C.4.** All scenarios need real implementation testing.

---


## Overall Summary (after 6C.4b.4a)

Scenario inventory: 62 scenarios across 9 feature files, 276 steps.

Per-feature production-backed count: changelog(6) + creation(9) + navigation(8) + timespan(11) + scenes(5) + hierarchy(8) + management(7) + ownership(3) + export(0) = **57 production-backed**.

| Coverage Level | Count | Percentage |
|---|---|---|
| Production-backed | 57 | 92% |
| Partially backed | 1 | 2% |
| Fixture-only | 0 | 0% |
| Simulated | 2 | 3% |
| No-op | 2 | 3% |
| **Total** | **62** | **100%** |

### Changes from 6C.4b.3b → 6C.4b.3b.1

| Feature | Change |
|---|---|
| `main.ts` | Fixed data-loss defect: legacy keys only deleted after successful migration |
| `legacyMigration.ts` | New production module with pure migration functions |
| `main.ts` | Delegates migration to `legacyMigration.ts` functions |
| `hierarchy-deferred.steps.ts` | Uses `migrateProjectField()` from production, not test-only `migrateField()` |
| `hierarchy-restart.steps.ts` | New file: restart test with persisted settings via plugin data store |
| `plugin-data-store.ts` | New test harness: simulates Obsidian `loadData()`/`saveData()` |
| `migration-assertions.ts` | New file: extracted migration assertions |
| Architecture | Baseline decreased from 1,170 to 1,166 violations |

### Changes from 6C.4b.3a.1 → 6C.4b.3b

| Feature | Change |
|---|---|
| `hierarchy.feature` | Legacy migration now tests `definedActs`/`definedChapters` → frontmatter |
| `hierarchy.feature` | Project restart now tests `activeProjectFile` restoration via `scanProjects()` |
| Vault harness | Fixed false-green `expectReject()` helper |
| Vault harness | Added meta-test for `expectReject()` correctness |
| Test files | `hierarchy-deferred.steps.ts` rewritten with production-backed steps |
| World | Added `legacyData`, `legacyBook`, `bookA`, `bookB`, `restartedProjects`, `restartedSceneManager` |

### Changes from 6C.4b.3a → 6C.4b.3a.1

| Feature | Change |
|---|---|
| `hierarchy.feature` | Replaced manually constructed Book objects with `SceneManager.createProject()` |
| `hierarchy.feature` | Replaced synthetic Scene objects with `SceneManager.createScene()` |
| `hierarchy.feature` | Universe isolation now uses `loadScenesForBooks()` with exact UUID set assertions |
| `hierarchy.feature` | Added exclusive series membership scenario (62nd scenario) |
| `hierarchy.feature` | Cross-universe negative assertion in isolation test |
| Test helpers | `setupHierarchyTest()` creates real `SceneManager` instance |
| Test helpers | `runVaultHarnessTests()` runs at bootstrap via `BeforeAll` |
| Test files | Split into `hierarchy.steps.ts`, `hierarchy-series.steps.ts`, `hierarchy-isolation.steps.ts`, `hierarchy-deferred.steps.ts` |
| Removed | `hierarchy-assertions.ts` (assertions now inline) |

### Changes from 6C.4b.1 → 6C.4b.2

| Feature | Change |
|---|---|
| `scenes.feature` | All 5 scenarios now production-backed (was 0) |
| `management.feature` | Assertions improved: true reload, content verification |
| `ownership.feature` | Scene safety still fixture-based (deferred) |
| Production bug | Scene UUID/ownership serialization fixed in MetadataParser + SceneManager |

### Scenarios Hardened in 6C.3 / 6C.3b / 6C.4a / 6C.4b.1 / 6C.4b.2

| Feature | Scenarios | Status |
|---|---|---|
| `changelog.feature` | 7 | 6 production-backed, 1 partial (tag protection) |
| `creation.feature` | 9 | All production-backed (cancellation in 6C.4b.4a) |
| `navigation.feature` | 8 | All production-backed |
| `timespan.feature` | 11 | All production-backed |
| `scenes.feature` | 5 | All production-backed (new in 6C.4b.2) |
| `hierarchy.feature` | 8 | 8 production-backed (6 in 6C.4b.3a.1, 2 in 6C.4b.3b) |
| `management.feature` | 7 | All production-backed (new in 6C.4b.1) |
| `ownership.feature` | 3 | All production-backed (1 in 6C.4b.1, 1 in 6C.4b.2a, 1 in 6C.4b.4a) |
| **Total hardened** | **57** | — |

### Scenarios Deferred to Step 6C.4b

| Feature | Scenarios | Issues |
|---|---|---|
| `export.feature` | 4 | All simulated or no-op |
| `changelog.feature` | 1 | Tag protection simulates CLI error |
| **Total deferred** | **5** | — |

### Vault Harness Regression Tests

The `runVaultHarnessTests()` function runs at test bootstrap and verifies:
- `expectReject()` helper correctly rejects successful operations (meta-test)
- File collision rejection (duplicate `create()` throws)
- `adapter.write()` consistency with `vault.read()`
- `exists()` returns false for nonexistent child paths
- File removal actually removes files
- `adapter.list()` returns only immediate children

### Migration Safety Integration Tests

The `runMigrationIntegrationTests()` function runs at test bootstrap and verifies the following
against real production `buildSettingsPayload()`:
- Ordinary settings updates use in-memory values
- Unresolved legacy keys preserved from persisted data
- Migrated keys not restored from stale persisted data
- Partial migration: mixed resolved/unresolved keys
- No persisted data: payload matches in-memory settings
- Consecutive saves preserve legacy data across plugin data store
- All PROJECT_DATA_KEYS recognized and preserved when not migrated
- Empty persisted values do not override in-memory values
- Malformed System JSON detected by merge helpers
- Malformed plotgrid destination preserved
- `useProjectColors` → `projectColors` round-trip

### Cancellation Safety Tests

The `runCancellationTests()` function runs at test bootstrap and verifies real modal cancellation:
- `CreateProjectModal`: cancel resolves to null, no executeCreation called
- `CreateProjectModal`: programmatic close resolves to null
- `CreateProjectModal`: settle idempotence (multiple calls only resolve once)
- `EventModal`: cancel resolves to null, no EventManager operations
- `EventModal`: programmatic close resolves to null
- `QuickAddModal`: cancel does not call onSubmit
- `QuickAddModal`: programmatic close does not call onSubmit

### Configuration Resolution

`tests/cucumber/cucumber.config.js` was removed in 6C.3. Package.json scripts are the sole authoritative configuration source.

---

## Risk Classification Summary

| Risk | Count | Features |
|---|---|---|
| **High** | 21 | changelog (7), creation (3), navigation (5), export (4), ownership (1), scenes (1) |
| **Medium** | 15 | creation (3), navigation (1), scenes (4), management (2), ownership (1), export (4) |
| **Low** | 26 | timespan (8), management (5), ownership (1), navigation (2), hierarchy (8), creation (1), changelog (1) |
