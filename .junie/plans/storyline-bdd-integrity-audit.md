# StoryLine BDD Test Integrity Audit

> Generated: 2026-10-23
> Branch: `feat/rework`
> Base commit: `2d28aa7b4d2b6f014750e90bf643ea8c37b3522a`
> Total scenarios: 61
> Total steps: 271

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

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Expected Independently Constructed? | Coverage | Risk | Remediation |
|---|---|---|---|---|---|---|---|---|
| 1 | Preview shows changes without modifying files | `scripts/changelog.cjs` | **No** — simulates output string | **No** — checks simulated string | **No** | Simulated | High | Extract pure parsing logic; test preview does not modify files |
| 2 | Feature commits grouped under Features | `scripts/changelog.cjs` | **No** — test duplicates regex | **No** — asserts against test-generated markdown | **No** | Simulated | High | Test production `parseLine` + `generateEntries` |
| 3 | Fix commits grouped under Bug Fixes | `scripts/changelog.cjs` | **No** — test duplicates regex | **No** — asserts against test-generated markdown | **No** | Simulated | High | Test production `parseLine` + `generateEntries` |
| 4 | Breaking changes highlighted | `scripts/changelog.cjs` | **No** — test duplicates regex | **No** — asserts against test-generated markdown | **No** | Simulated | High | Test production `parseLine` + `generateEntries` |
| 5 | Non-conforming commits handled | `scripts/changelog.cjs` | **No** — test duplicates regex | **No** — asserts against test-generated markdown | **No** | Simulated | High | Test production `parseLine` returns null for non-conforming |
| 6 | Duplicate prevention | `scripts/changelog.cjs` | **No** — sets error message directly | **No** — asserts the pre-set message | **No** | Simulated | High | Test `insertIntoChangelog` duplicate detection with temp file |
| 7 | Existing tag protection | `scripts/changelog.cjs` | **No** — sets error message directly | **No** — asserts the pre-set message | **No** | Simulated | High | Test `tagExists` + prepare refusal with temp git repo |

**Summary:** 0 production-backed, 0 partially backed, 0 fixture-only, 7 simulated, 0 no-op.
**Action:** **Hardened in this step (6C.3).** All 7 scenarios rewritten.

---

### 2. `features/projects/creation.feature` (9 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Expected Independently Constructed? | Coverage | Risk | Remediation |
|---|---|---|---|---|---|---|---|---|
| 1 | Create book with valid title | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Partial** — `bookId` exists check is weak | **Partial** | Partially backed | Medium | Verify UUID format, assert mock dep calls |
| 2 | Empty title fails | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Yes** — checks `lastError` | **Yes** | Production-backed | Low | Already adequate |
| 3 | Book with new series | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Weak** — only checks `createdProject` exists | **No** | Partially backed | Medium | Assert series creation dep call, book-series link |
| 4 | Book in existing series | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Weak** — checks `activeBook` exists | **No** | Partially backed | Medium | Assert correct series UUID propagation |
| 5 | Create series | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Weak** — checks `createCount === 1` | **No** | Partially backed | Medium | Assert series dep call with correct name |
| 6 | Create universe | `projectCreation.ts` | **Yes** — calls `executeCreation` | **Weak** — checks `createCount === 1` | **No** | Partially backed | Medium | Assert universe dep call with correct name |
| 7 | Cancel creation | `CreateProjectModal.ts` | **No** — sets `cancelled = true` | **No** — asserts `cancelled` flag | **No** | Simulated | High | Test modal cancel via production flow |
| 8 | Double-click create | `CreateProjectModal.ts` | **No** — manually sets `createCount = 1` | **No** — asserts `createCount === 1` | **No** | Simulated | High | Test actual `isCreating` guard with two overlapping calls |
| 9 | Async dropdown race | `CreateProjectDropdowns.ts` | **No** — no-op step | **No** — no-op assertion | **No** | No-op | High | Test `updateSeriesDropdownInPlace` with stale request IDs |

**Summary:** 1 production-backed, 5 partially backed, 0 fixture-only, 2 simulated, 1 no-op.
**Action:** **Hardened in this step (6C.3).** All 9 scenarios rewritten.

---

### 3. `features/timeline/navigation.feature` (8 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Expected Independently Constructed? | Coverage | Risk | Remediation |
|---|---|---|---|---|---|---|---|---|
| 1 | Navigate to first item | `TimelineNavigationService.ts` | **No** — sets `_selected` manually | **No** — checks `_selected` property | **No** | Simulated | High | Use `setSelectedDate` + `findCurrentIndex` |
| 2 | Navigate to last item | `TimelineNavigationService.ts` | **No** — sets `_selected` manually | **No** — checks `_selected` property | **No** | Simulated | High | Use production navigation |
| 3 | Navigate forward | `TimelineNavigationService.ts` | **No** — manual `_selected` swap | **No** — checks `_selected` property | **No** | Simulated | High | Use `navigateNext()` |
| 4 | Navigate backward | `TimelineNavigationService.ts` | **No** — manual `_selected` swap | **No** — checks `_selected` property | **No** | Simulated | High | Use `navigatePrevious()` |
| 5 | Forward at end stops | `TimelineNavigationService.ts` | **No** — manual `_selected` swap | **Partial** — checks selected count | **No** | Simulated | High | Use `navigateNext()` and assert null |
| 6 | Filter by book | `TimelineNavigationService.ts` | **Partial** — uses `updateItems` but filters `world.scenes` | **Partial** | **Partial** | Partially backed | Medium | Test filtering via production service |
| 7 | Multi-book chronological | `TimelineNavigationService.ts` | **Yes** — uses `updateItems` + `getItems` | **Yes** — checks chronological order | **Yes** | Production-backed | Low | Already adequate |
| 8 | Empty timeline | `TimelineNavigationService.ts` | **Yes** — uses `updateItems([], [])` | **Yes** — checks `getItems().length === 0` | **Yes** | Production-backed | Low | Already adequate |

**Summary:** 2 production-backed, 1 partially backed, 0 fixture-only, 5 simulated, 0 no-op.
**Action:** **Hardened in this step (6C.3).** All 8 scenarios rewritten.

---

### 4. `features/timeline/timespan.feature` (8 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage |
|---|---|---|---|---|---|
| 1 | Parse date → TimeSpan (3 examples) | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks kind, precision | Production-backed |
| 2 | Compare: first earlier | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks negative result | Production-backed |
| 3 | Compare: first later | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks positive result | Production-backed |
| 4 | Compare: equal | `TimeSpanService.ts` | **Yes** — `compareTimestamps()` | **Yes** — checks zero result | Production-backed |
| 5 | Invalid TimeSpan validation | `TimeSpanService.ts` | **Yes** — `validateTimeSpan()` | **Yes** — checks error string | Production-backed |
| 6 | TimeSpan kind properties (3 examples) | `TimeSpanService.ts` | **Yes** — parses/constructs | **Yes** — checks `kind` field | Production-backed |
| 7 | Parse invalid date → null | `TimeSpanService.ts` | **Yes** — `tss.parse()` | **Yes** — checks null | Production-backed |

**Summary:** 8 production-backed, 0 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
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
| 1 | Create event with date | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks UUID, ownership, file | Production-backed | Low |
| 2 | Create event without date | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks no timeSpan | Production-backed | Low |
| 3 | Update event date | Test-only mutation | **Partial** — mutates event object directly | **Partial** — checks mutated value | Partially backed | Medium |
| 4 | Delete event | Test-only | **Partial** — deletes from map | **Yes** — checks map empty | Partially backed | Medium |
| 5 | Canonical event ownership | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks universe ownership | Production-backed | Low |
| 6 | Book-scoped event ownership | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks book ownership | Production-backed | Low |
| 7 | Load existing events | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks count | Production-backed | Low |

**Summary:** 5 production-backed, 2 partially backed, 0 fixture-only, 0 simulated, 0 no-op.
**Action:** **Deferred to 6C.4.** Mostly good; update/delete could use production manager.

---

### 8. `features/events/ownership.feature` (3 scenarios)

| # | Scenario | Production Module | When Invokes Production? | Assertions Observe Results? | Coverage | Risk |
|---|---|---|---|---|---|---|
| 1 | Canonical Event persistence | `createEvent()` | **Yes** — calls production `createEvent` | **Yes** — checks UUID, TimeSpan, ownership | Production-backed | Low |
| 2 | Scene creation safety | Test-only | **Partial** — creates scene object manually | **Yes** — checks ownership, path prefix | Partially backed | Medium |
| 3 | Cancellation | Test-only | **No** — sets `cancelled = true` | **Partial** — checks file count | Simulated | Medium |

**Summary:** 1 production-backed, 1 partially backed, 0 fixture-only, 1 simulated, 0 no-op.
**Action:** **Deferred to 6C.4.** Cancellation scenario needs real modal test.

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

### 10. `features/timeline/timeline.steps.ts` (additional scenarios from timeline.steps.ts)

These scenarios are not in a separate `.feature` file but are matched by step definitions in `timeline.steps.ts`. They cover multi-book chronology and universe isolation.

| # | Scenario | Production Module | Coverage |
|---|---|---|---|
| 1 | Scenes + Event chronological order | `TimelineNavigationService.ts` | Production-backed |
| 2 | Active book not changed | Test-only | Partially backed |
| 3 | Universe isolation — compatible books | Test-only filtering | Partially backed |
| 4 | Canonical events excluded from unrelated universes | `createEvent()` | Partially backed |

**Summary:** 1 production-backed, 3 partially backed.
**Action:** **Deferred to 6C.4.**

---

## Overall Summary

| Coverage Level | Count | Percentage |
|---|---|---|
| Production-backed | 19 | 31% |
| Partially backed | 10 | 16% |
| Fixture-only | 8 | 13% |
| Simulated | 18 | 29% |
| No-op | 6 | 10% |
| **Total** | **61** | **100%** |

### Scenarios Hardened in This Step (6C.3)

| Feature | Scenarios | Before | After |
|---|---|---|---|
| `changelog.feature` | 7 | All simulated | Production-backed |
| `creation.feature` | 9 | Mixed | Production-backed |
| `navigation.feature` | 8 | 5 simulated, 2 production-backed, 1 partial | All production-backed |
| **Total hardened** | **24** | — | — |

### Scenarios Deferred to Step 6C.4

| Feature | Scenarios | Issues |
|---|---|---|
| `scenes.feature` | 5 | Fixture-only, no production scene manager tested |
| `hierarchy.feature` | 7 | Simulated migration/restore, fixture-only hierarchy |
| `management.feature` | 2 | Update/delete use direct mutation |
| `ownership.feature` | 2 | Cancellation is simulated |
| `export.feature` | 4 | All simulated or no-op |
| `timeline.steps.ts` extras | 3 | Partially backed filtering |
| **Total deferred** | **23** | — |

### Configuration Issue

`tests/cucumber/cucumber.config.js` exists but is **not consumed** — `package.json` scripts (`test` and `test:bdd`) specify all Cucumber CLI arguments directly. The config file is an unused reference. Resolution: consolidate into one authoritative source.

---

## Risk Classification Summary

| Risk | Count | Features |
|---|---|---|
| **High** | 21 | changelog (7), creation (3), navigation (5), export (4), ownership (1), scenes (1) |
| **Medium** | 17 | creation (3), navigation (1), scenes (4), hierarchy (7), management (2), ownership (1) |
| **Low** | 23 | timespan (8), management (5), ownership (1), navigation (2), timeline extras (1), creation (1) |
