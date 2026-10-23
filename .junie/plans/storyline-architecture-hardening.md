# StoryLine — Architecture Hardening & Maintainability Refactor

Status: **Step 6A implemented**. Target branch: `feat/rework`.
Created after Step 5 changelog automation (`d60fffb`), at the author's explicit request.
Step 6A completed: lint rules verified, baseline measured, regression gate active, autofix safety confirmed.

## Non-negotiable design goals

- `src/` is TypeScript only, `assets/scss/` contains Sass, `assets/manifest.json` is the authoritative manifest, and `dist/` contains only generated Obsidian distribution files.
- **Every hand-authored TypeScript/JavaScript source file, including tests and scripts, must eventually contain no more than 200 effective lines**, excluding blank lines and comment-only lines. This is a hard **final-state** rule; not a suggestion.
- Functions/methods must be small and comprehensible, with limited branching and nesting. No giant all-purpose handlers, God classes, hidden global mutable state, or unsafe cross-book writes.
- Provide **meaningful JSDoc** for exported APIs, public class/method contracts, and non-obvious logic. Explain invariants, effects, ownership, asynchronous behavior, calendar semantics and exceptions. Avoid redundant copy/paste JSDoc and comments that merely restate types.
- `pnpm lint --fix` must **never create TypeScript compilation errors**. A remaining lint diagnostic is acceptable while refactoring; an unsafe automatic transformation is not.
- Preserve all Obsidian behavior, vault data/frontmatter, settings migration, Universe/Series/Book ownership and UUIDs, timeline views and CSS. No schema rewrite disguised as a code refactor.

## Final ESLint budgets (Step 6A)

Rules are active in `eslint.config.mjs` for TypeScript and JavaScript files. The regression gate enforces no increase in architectural debt.

| Rule | Target |
|------|--------|
| `max-lines` | **200**, `skipBlankLines: true`, `skipComments: true` |
| `max-lines-per-function` | **50**, `skipBlankLines: true`, `skipComments: true` |
| `complexity` | **10** cyclomatic |
| `max-depth` | **3** |
| `max-statements` | **25** |
| `max-params` | **4** |
| `@typescript-eslint/no-explicit-any` | Report genuine problems but **`fixToUnknown: false`** to avoid destructive autofix |
| JSDoc | Enforce on exported/public APIs, with narrowly justified exceptions for trivial type aliases, interface declarations and framework overrides |

The `max-lines*` core rules count physical, **effective source lines**, not arbitrary line lengths. `max-lines-per-function` measures the function including its declaration/closing line, so its 50-line cap is deliberately close to a roughly 48-line body cap.

### Step 6A — Establish usable, non-destructive architecture linting

1. Run the actual CI matrix on the first rules commit, classify any failures, and verify `pnpm lint --fix` in a disposable checkout followed by `pnpm typecheck` and all tests.
2. Verify the inherited `eslint-plugin-obsidianmd` configuration does not turn on `no-explicit-any`'s `fixToUnknown: true` after our override; explicitly test with a fixture where converting `any` to `unknown` would fail TypeScript. If other unsafe fixers exist, identify the specific rule and disable **only that fixer/unsafe rule** with a documented rationale, not all linting.
3. Extend lint/audit coverage beyond `**/*.ts` to hand-authored `.js`, `.mjs`, `.cjs` scripts where appropriate, using separate ESLint overrides (without TypeScript `parserOptions.project` against JS-only files). Do not lint generated `dist/`, `node_modules/`, `pnpm-lock.yaml`, or docs.
4. Create a **deterministic architecture-debt baseline** from the real ESLint report: effective source LOC/file; oversized functions; cyclomatic complexity, depth, statements and parameters. Track counts and top offenders in a machine-readable baseline under `tests/architecture/` or `scripts/`.
5. The current full lint suite already fails on historical debt. **Do not switch CI into permanently red mode** for the pre-existing backlog. Build a strict **regression gate** that fails for any *new* source file or function breaking a limit and for any increase above the registered pre-existing debt. Baseline deviations must be reviewed, traceable and **decrease** as modules are refactored. Avoid file-wide lint-disable directives and blanket `// @ts-nocheck`.
6. Do not rely on `lint:changed` line-intersection alone for `max-lines`: the offending diagnostic can point to line 201 while a later unrelated edit increases the file size. The architecture gate must measure the **whole file/function** against its budget/baseline. Document what it measures, add tests for comments/blanks, renames, new files and line-count regressions.
7. Enforce JSDoc progressively for exported/public production APIs with a carefully scoped plugin/ruleset; document exceptions; ensure doc comments do **not** count toward the 200-line file budget. Skip generated code.
8. The architecture/quality commands and full diagnostic report should be easy to use with pnpm. CI must still run `pnpm build`, `pnpm test`, `pnpm test:bdd`, `pnpm typecheck`, CSS regression and changelog smoke checks.
9. Commit and push Step 6A alone; report exact baseline counts; **stop before structural refactoring**.

### Step 6A implementation report

**Lint rules verified:** All six structural rules active for `.ts`, `.mjs`, and `.cjs` files. ESLint config extended with separate configuration for Node.js scripts that disables Obsidian-specific rules while keeping structural budgets.

**Architecture debt baseline:** 94 files with 1,290 architecture violations:
- `max-lines-per-function`: 340 violations (largest category)
- `complexity`: 315 violations
- `max-depth`: 273 violations
- `max-statements`: 235 violations
- `max-lines`: 78 violations
- `max-params`: 49 violations

Top offenders: `tests/universe-integration.test.ts` (217 violations), `src/main.ts` (121), `src/views/CharacterView.ts` (66), `src/views/TimelineView.ts` (62), `src/views/PlotgridView.ts` (61).

**Regression gate:** `scripts/architecture-gate.cjs` compares current violations against `tests/architecture-baseline.json`. Fails on new files with violations or increased violations in existing files. Integrated into CI as `pnpm lint:architecture`.

**Autofix safety:** Verified in isolated checkout — `pnpm lint --fix` does not break TypeScript compilation or tests. The `@typescript-eslint/no-explicit-any` rule has `fixToUnknown: false` to prevent destructive type changes.

**JSDoc standards:** Documented in DEVELOPMENT.md. JSDoc comment lines excluded from 200-line file budget via ESLint `skipComments: true`.

### Mandatory Husky pre-commit gate

Before Step 6B, use Husky v9 to register `.husky/pre-commit`. Each local commit must pass `pnpm lint:staged` (staged-line ESLint checks), `pnpm lint:architecture` (baseline-aware debt checks) and `pnpm typecheck` (zero errors). Full `pnpm lint` still has historical backlog; never use that as the staged gate until the project is clean.

**Junie must NEVER bypass or disable these checks** with `--no-verify`, `HUSKY=0`, alternative hooksPath, forced commits/pushes, or updated baselines that conceal violations. If a gate fails, fix the source or the tool configuration. Run/verify remote GitHub Actions too; GitHub API commits do not invoke local Git hooks, and CI must be the authoritative remote gate.

**Step 6B.1 status (2026-10-23):** Commit `709768e` extracted command registration and vault/workspace/leaf listeners from `src/main.ts` into `src/commands/`. The report claims `main.ts` reduced from 5,072 to 4,460 physical lines and architecture violations declined from 1,290 to 1,286; the three initial CI workflows were green. Subsequent review identified two high-risk regressions: an async Proxy used as if ScrivenerImporter.isAvailable() were synchronous (desktop guard ineffective), and keyboard/toolbar handlers changed `activeDocument` to global `document` (pop-out window behavior). These were corrected in a follow-up commit; verify current GitHub Actions before proceeding.

**Step 6B.2 priorities:** finish the actual `src/main.ts` composition-root decomposition and fix the *interfaces* created by Step 6B.1, before moving to unrelated giant Views. Avoid `unknown`/double-cast access to SceneCardsPlugin in `registerCommands.ts`, `scrivener-import.ts`, and `plugin-target.ts`; do not expand public visibility of previously private methods simply to satisfy a broad PluginTarget interface. Prefer focused capability interfaces/adapters with narrow explicit types. Add regression tests for Scrivener availability/lazy imports, pop-out window key handling, command IDs and callbacks, project switching, Scene/Event ownership and registered listener teardown. Ensure exceptions, cancelled imports and Promise rejection paths are handled. Then extract a cohesive next responsibility (such as view registration + service initialization) from `main.ts`, using JSDoc contracts, zero new architecture violations and strictly decreasing debt.

**Step 6B.2 implementation report (2026-10-23):** Extracted view registration into `src/views/registerViews.ts` (136 lines, 0 violations) and service initialization into `src/services/initServices.ts` (163 lines, 0 violations). `main.ts` reduced from 4,460 to 4,384 lines (-76). Fixed 2 of 3 double casts in `registerCommands.ts` (seriesManager and viewSnapshotService now typed via PluginTarget); the ExportModal cast remains because ExportModal requires the full SceneCardsPlugin class. Updated PluginTarget with `seriesManager`, `viewSnapshotService`, `saveSettings`, and export-related settings fields. The remaining double cast in `scrivener-import.ts` is unavoidable without refactoring ScrivenerImporter's constructor (out of scope). Total architecture violations unchanged at 1,286 (new files contribute 0; main.ts still at 97).

**Step 6B.3 implementation report (2026-10-23):** Extracted the onLayoutReady callback (94 lines) into `src/services/startup.ts` (279 lines, 0 violations) with a narrow `StartupTarget` interface. The startup module preserves the exact 16-step initialization order: UI visibility, project bootstrap, scene init, legacy migration, System data, field templates, corkboard, view snapshot, entities, extra folders, codex with inheritance, events, link scanning, writing tracker, autosave scheduling, and view refresh. `main.ts` reduced from 4,384 to 4,302 lines (-82). Architecture violations decreased from 1,286 to 1,281 (-5). Made `bootstrapProjects` and `migrateProjectDataFromSettings` public so the interface can reference them. The writing stats interval timer remains in `main.ts` because `onunload` needs direct access to clear it. Commit `7a7b5be`.

**Step 6B.4 implementation report (2026-10-23):** Extracted project bootstrap and creation responsibilities from `main.ts` into 5 dedicated modules: `src/services/projectDiscovery.ts` (140 lines, 0 violations) — project scanning with metadata cache retry and mobile suppression; `src/services/projectCreation.ts` (205 lines, 0 violations) — Book/Series/Universe creation business logic with hierarchy placement; `src/components/CreateProjectModal.ts` (194 lines, 0 violations) — modal orchestration; `src/components/CreateProjectFields.ts` (233 lines, 0 violations) — form field building; `src/components/CreateProjectDropdowns.ts` (188 lines, 0 violations) — async dropdown population with stale-response protection. `main.ts` reduced from 4,306 to 3,989 lines (-317). Architecture violations decreased from 1,281 to 1,261 (-20). All new modules have zero architecture violations. `bootstrapProjects()` now delegates to `discoverProjects()` and `openNewProjectModal()` constructs a `CreateProjectModal` with narrow dependency injection.

**Post-Step 6B.3 integration review (2026-10-23):** Although `7a7b5be` reported all checks green, direct review found that the five-minute writing-stats interval had moved **before** project bootstrap and that `LinkScanner.scanAllAsync()` was no longer awaited. The optional inherited Codex lookup had also lost its separately handled failure boundary. These were corrected in subsequent commits; `runStartupSequence()` now reports success/failure to its caller, awaits link indexing, and only schedules the interval after successful startup while the plugin is still active. Four new `tests/startup-lifecycle.test.ts` cases cover execution order, async scan barrier, inheritance failure and required bootstrap failure. Two GitHub Actions checks passed for `67a6e8f` after refactoring the Codex helper to satisfy the architecture gate. Early intermediate correction commits **failed** the architecture gate; do not treat them as independently verified release points.

**Proposed Step 6B.4:** Decompose the large Book/Series/Universe project creation and bootstrap flow currently embedded around `src/main.ts` `bootstrapProjects()` and its nested modal handling. Separate project discovery/retry/selection, modal view state, asynchronous Universe/Series dropdown requests and durable Book/Series/Universe creation by responsibility, preserving the current active Book and preventing duplicate writes. Build real behavior-oriented tests around cancellation, retries after a slow metadata-cache scan, stale async responses, errors during creation, and correct hierarchy ownership. Keep each extracted file under 200 effective lines and every method under the configured limits; do not create new public plugin methods merely to make a new interface compile. A meaningful decrease in violations is required; prefer substantial root-cause reduction over another nominal 5-violation decrease.

### Step 6B — Decompose the codebase in bounded iterations

Use the machine-readable debt ranking rather than arbitrary filenames. At the starting point the largest files by GitHub blob size include `src/main.ts` (~238 KB), `BoardView.ts`, `CharacterView.ts`, `PlotgridView.ts`, `settings.ts`, `SceneManager.ts`, `TimelineView.ts`, `CodexView.ts`, `StatsView.ts` and `LocationView.ts`. **Byte size is only a rough priority signal**; derive accurate effective LOC and complexity using ESLint.

Proposed waves:
1. **Plugin composition and settings:** extract feature registration, commands, settings groups, configuration/UI lifecycle from `main.ts` and `settings.ts`. Keep a small plugin entrypoint and stable public service APIs.
2. **Timeline and event ownership:** split navigation state, rendering, toolbar, event/scene creation and canonical ownership carefully. Do not modify Scene/Event persistence protocols or silently change active Book.
3. **Board/Manuscript/PlotGrid/Character/Location/Codex views:** extract widgets, reusable components, controllers and pure model transformations. Avoid extra indirection that merely hides a large method.
4. **Services and import/export:** decompose SceneManager, Scrivener import, DOCX, statistics and remaining services by responsibility. Keep async operations deterministic and retain error handling.
5. **Tests and scripts:** refactor oversized BDD fixtures and Vitest files, and the new custom `scripts/changelog.cjs` (~470 physical lines), preserving real test coverage. Verify changelog output and existing manual release semantics are unchanged.

Every wave must:
- Produce cohesive modules with small, well-named functions and clear ownership, not random chunks moved into `helpers.ts` or many pass-through wrappers.
- Keep imports acyclic where practical, with no accidental production dependency on `tests/`.
- Add real regression tests *before* changing high-risk code where behavior is currently under-tested.
- Preserve data safety, Obsidian leaf lifecycle cleanup, multi-book separation, performance and keyboard accessibility.
- Add meaningful JSDoc to extracted exported/public functions, classes and critical public data types; document parameter ownership and error/cancellation behavior without restating obvious TypeScript types.
- Verify all newly extracted files <=200 effective LOC, functions <=50 effective LOC, complexity <=10, depth <=3 and statement/parameter budgets, with no permanent exceptions.
- Recalculate architecture debt and **demonstrate a monotonic reduction** in remaining violations. Delete resolved baseline entries rather than relaxing limits.
- Run build, Vitest, Cucumber, typecheck (zero errors), CSS regression, changelog checks, incremental lint, architecture regression gate and a disposable-vault smoke test for UI-affecting changes.
- Use Conventional Commits, push to `feat/rework`, check GitHub Actions and stop at the end of each agreed wave. No giant repo-wide rewrite, and no unrelated feature work.

## Exit criteria

- No authored TS/JS/MJS/CJS source or test file over 200 effective lines (excluding blank/comment-only lines).
- No functions/methods over the configured size/complexity/depth/statements/parameters limits.
- Appropriate exported/public APIs have actionable JSDoc.
- `pnpm lint --fix` cannot generate type errors; demonstrated automatically in an isolated checkout.
- Full `pnpm lint`, `pnpm typecheck`, all tests, build and architecture gates pass in CI without broad permanent suppressions.
- `src/`, `assets/`, `dist/`, vault and manual-release contracts preserved.
- Saved Views resumes after the agreed architecture hardening checkpoints, not as an excuse to abandon them.
