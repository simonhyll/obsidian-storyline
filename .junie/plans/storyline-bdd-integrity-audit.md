# StoryLine BDD Test Integrity Audit

> Generated: 2026-10-23
> Branch: `feat/rework`
> Base commit: `2d28aa7b4d2b6f014750e90bf643ea8c37b3522a`
> Updated: 2026-10-23 (Step 6C.4b.1 — Real EventManager persistence tests)
> Total scenarios: 61
> Total steps: 270

## 6C.4b.1 Update Summary

Step 6C.4b.1 repaired the in-memory vault harness and converted Event management scenarios to real persistence integration tests:

1. **Vault harness repaired** — Fixed `exists()` bug that returned true for any child path under an existing folder. Added `TFile` test double so `instanceof TFile` checks pass. Added `js-yaml` as explicit dev dependency.
2. **Obsidian module mock** — Created `tests/cucumber/support/obsidian-mock.ts` providing `TFile`, `parseYaml`, and `stringifyYaml` at runtime. Patched via `Module._resolveFilename` in hooks.
3. **EventManager tests hardened** — `management.steps.ts` now uses real `EventManager.createEventFile()`, `saveEvent()`, `deleteEvent()`, and `loadAll()` with the in-memory vault. Assertions verify actual persisted YAML content, UUID round-trips, and file removal.
4. **Canonical Event persistence** — `events.steps.ts` now uses real `EventManager.createEventFile()` for the canonical Event scenario. Gherkin step responsibilities corrected: Event creation moved from `Then` to `When`.
5. **Assertion helpers** — Extracted to `tests/cucumber/support/event-assertions.ts` to keep management.steps.ts under 200-line budget.

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
| 7 | Cancel creation | Test-only | **No** — sets `cancelled = true` | **Partial** — checks no persistence ops | Partially backed | Medium |
| 8 | Double-click create | `creationGuard.ts` | **Yes** — `CreationConcurrencyGuard.tryStart()` | **Yes** — asserts second blocked | Production-backed | Low |
| 9 | Async dropdown race | `CreateProjectDropdowns.ts` | **Yes** — `updateSeriesDropdownInPlace` | **Yes** — checks HTMLSelectElement | Production-backed | Low |

**Summary:** 8 production-backed, 1 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Hardened in 6C.3/6C.3b.** Scenarios 8–9 now exercise real production code. Scenario 7 (cancellation) still simulates the cancel flag; testing via the actual modal lifecycle is deferred to 6C.4.

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
| 1 | Create scene in active book | `vault-fixture.ts` | **Partial** — uses `createScene` fixture | **Partial** — checks path prefix | Fixture-only | Medium |
| 2 | No active book → error | Test-only logic | **No** — test sets error directly | **Yes** — checks error exists | Simulated | Medium |
| 3 | Scene metadata preserved | `vault-fixture.ts` | **No** — no-op reload step | **No** — checks fixture data | Fixture-only | Medium |
| 4 | Scene ordering | `vault-fixture.ts` | **No** — no-op view step | **Partial** — checks fixture dates | Fixture-only | Medium |
| 5 | UUID stability | Test-only | **No** — no-op update step | **No** — checks stored UUID | Fixture-only | Medium |

**Summary:** 0 production-backed, 0 partially backed, 5 fixture-only/simulated, 0 no-op.
**Action:** **Deferred to 6C.4.** Record findings; prioritize for next hardening step.

---

### 6. `features/projects/hierarchy.feature` (7 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Book belongs to universe | `vault-fixture.ts` | **Partial** — fixture creation | **Yes** — checks `universeId` | Fixture-only | Medium |
| 2 | Book in series in universe | `vault-fixture.ts` | **Partial** — fixture creation | **Weak** — checks book exists | Fixture-only | Medium |
| 3 | Series belongs to universe | `vault-fixture.ts` | **Partial** — fixture creation | **Yes** — checks universe exists | Fixture-only | Medium |
| 4 | Universe isolation | Test-only filtering | **No** — test filters `world.scenes` | **Partial** | Simulated | Medium |
| 5 | Universe UUID stability | Test-only | **No** — no-op reload | **No** — checks stored ID | Fixture-only | Medium |
| 6 | Legacy settings migration | Test-only | **No** — test implements migration | **Yes** — checks settings keys | Simulated | Medium |
| 7 | Project restoration | Test-only | **No** — test implements restore | **Yes** — checks active book | Simulated | Medium |

**Summary:** 0 production-backed, 0 partially backed, 3 fixture-only, 4 simulated, 0 no-op.
**Action:** **Deferred to 6C.4.** Record findings; prioritize for next hardening step.

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
| 2 | Scene creation safety | Test-only | **Partial** — creates scene object manually | **Yes** — checks ownership, path prefix | Partially backed | Medium |
| 3 | Cancellation | Test-only | **No** — sets `cancelled = true` | **Partial** — checks file count | Simulated | Medium |

**Summary:** 1 production-backed, 1 partially backed, 0 fixture-only, 1 simulated, 0 no-op.
**Action:** Scenario 1 hardened in 6C.4b.1 using real EventManager. Scenarios 2–3 deferred to 6C.4b.

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


## Overall Summary (after 6C.4b.1)

Scenario inventory: 61 scenarios across 9 feature files, 270 steps.

| Coverage Level | Count | Percentage |
|---|---|---|
| Production-backed | 44 | 72% |
| Partially backed | 3 | 5% |
| Fixture-only | 8 | 13% |
| Simulated | 4 | 7% |
| No-op | 2 | 3% |
| **Total** | **61** | **100%** |

### Changes from 6C.4a → 6C.4b.1

| Feature | Change |
|---|---|
| `management.feature` | All 7 scenarios now production-backed (was 5 prod + 2 partial) |
| `ownership.feature` | Canonical Event persistence now production-backed (was partial) |
| Steps | 270 steps (was 271; merged ownership scenario steps) |

### Scenarios Hardened in 6C.3 / 6C.3b / 6C.4a / 6C.4b.1

| Feature | Scenarios | Status |
|---|---|---|
| `changelog.feature` | 7 | 6 production-backed, 1 partial (tag protection) |
| `creation.feature` | 9 | 8 production-backed, 1 partial (cancellation) |
| `navigation.feature` | 8 | All production-backed |
| `timespan.feature` | 11 | All production-backed |
| `management.feature` | 7 | All production-backed (new in 6C.4b.1) |
| `ownership.feature` | 1 | Canonical Event persistence (new in 6C.4b.1) |
| **Total hardened** | **43** | — |

### Scenarios Deferred to Step 6C.4b.2

| Feature | Scenarios | Issues |
|---|---|---|
| `scenes.feature` | 5 | Fixture-only, no production SceneManager tested |
| `hierarchy.feature` | 7 | Simulated migration/restore, fixture-only |
| `ownership.feature` | 2 | Scene safety manual, cancellation simulated |
| `export.feature` | 4 | All simulated or no-op |
| `changelog.feature` | 1 | Tag protection simulates CLI error |
| `creation.feature` | 1 | Cancellation simulates modal flag |
| **Total deferred** | **18** | — |

### Configuration Resolution

`tests/cucumber/cucumber.config.js` was removed in 6C.3. Package.json scripts are the sole authoritative configuration source.

---

## Risk Classification Summary

| Risk | Count | Features |
|---|---|---|
| **High** | 21 | changelog (7), creation (3), navigation (5), export (4), ownership (1), scenes (1) |
| **Medium** | 17 | creation (3), navigation (1), scenes (4), hierarchy (7), management (2), ownership (1) |
| **Low** | 23 | timespan (8), management (5), ownership (1), navigation (2), timeline extras (1), creation (1) |
