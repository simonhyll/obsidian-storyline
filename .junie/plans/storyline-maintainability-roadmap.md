# StoryLine — Maintainability & Tooling Roadmap

Status: **in progress**. Steps 1A/1B (quality cleanup), 2 (source/distribution), 3 (SCSS), 4 (Cucumber BDD), and 5 (changelog automation) implemented; **Step 6A architecture linting and Step 6B maintainability refactor are next, before Saved Views**. Owner: development team / Junie. Target branch: `feat/rework`.

Created after Phase 3 Milestone 2B, commit `516bc72`. This roadmap addresses technical debt before Saved Views expands view-state, persistence and UI complexity.

## Historical baseline (before the modernization)

- TypeScript lives at repository root (`main.ts`, `settings.ts`, `constants.ts`) and in top-level `components/`, `models/`, `services/`, `utils/`, `views/`.
- `esbuild.config.mjs` bundles `main.ts` to **root `main.js`**; the Obsidian manifest's `main` is `main.js`.
- `styles.css` is a very large root-level stylesheet (>14,000 lines).
- `vitest.config.ts` discovers `tests/**/*.test.ts`, with the Obsidian test mock at `tests/__mocks__/obsidian.ts`.
- `.github/workflows/ci.yml` runs build and Vitest but does **not** currently enforce typecheck or ESLint, and runs on `main` pushes and PRs (not every direct `feat/rework` push).
- `pnpm run typecheck` currently has **27 reported errors**; confirm exact baseline rather than assuming their provenance.
- `CHANGELOG.md` is maintained manually and currently has duplicate `1.11.0` headings and a TODO placeholder.
- `scripts/sync-vault.mjs` and release/CI workflows **currently** expect root `main.js`, `manifest.json`, `styles.css`. `main.js` is intentionally tracked today. **The user explicitly wants all three distributable files moved to `dist/`** during the tooling migration; current root paths are dependencies to migrate, not requirements to preserve.
- Release publication is currently a **manual workflow dispatch**. Do not change that without a separate release-design decision.

## Decision and ordering

**Before starting Saved Views:** 0 (verification), 1 (quality baseline), 2 (source/assets layout), 3 (modular SCSS). These are bounded, sequential changes, not a giant rewrite.

**Parallel / immediately after:** 4 (Cucumber BDD pilot, in addition to Vitest), 5 (commit-based changelog). Conventional Commits can be adopted immediately by all assistants even before automation is added.

Do not start all workstreams in one agent task or commit. Each stage must be independently buildable, testable and reviewable. Prefer one stage per PR/commit series; automatically push work to `feat/rework` after verifying, respecting the user's usual no-manual-merge workflow. Preserve manuscript/vault file safety.

### 0. Finish and verify the 2B feature before refactoring

**Code-audit finding at `516bc72`: do not treat the reported 2B completion as verified.** The actual `services/TimelineNavigationService.ts` still calls JavaScript `Date` in daily-marker and day-of-year logic (`new Date(...)`), notwithstanding the completion summary. The `516bc72` diff contains no `views/TimelineView.ts` change, and the current view does not render `getTimeMarkers()`, call `getTimestampAtPosition()`, or present a time-marker creation menu. New ruler CSS alone does not provide these behaviors.

- **Update after `52a3c5b` (2026-10-23):** TimelineView now renders a linear-view temporal ruler and creation menu, and TimelineNavigationService no longer uses JavaScript `Date` for the implemented daily markers and day-of-year helpers. These earlier missing-code findings were historical and have been substantially addressed. **Do not claim the entire user workflow is verified**: the ruler is not yet rendered in swimlane mode; Book/Series/Universe owner scope selection is missing for ruler-created Events (the UI currently creates Book-level Events); real persisted Scene/Event creation tests and actual Obsidian smoke tests are still needed. The per-leaf navigation and clicked-time/Scene-precision protection were added after the initial commit. Record these limitations as a follow-up quality checklist; proceed with Step 1 independently instead of expanding Step 0 into a new architectural rewrite.
- First **verify the actual ruler UI, precision and ownership workflow** on an isolated testing vault; no checklist item counts as verified solely because a CSS class or helper exists.
- On a disposable Obsidian vault, smoke-test: real ruler display, year jump and empty years, time-marker click, Scene/Event date prefill and actual persisted frontmatter, canonical scope ownership, multibook context and per-leaf navigation.
- Distinguish service-only tests from real UI integration coverage, and add meaningful tests of rendered behavior or production handlers. The nine reported new tests do not establish these UI behaviors.
- Record an explicit `pnpm test`, `pnpm build`, `pnpm run typecheck`, `pnpm run lint:obsidian` baseline on current `feat/rework` and the resulting artefacts. Do not call baseline errors resolved until measured.
- Make sure direct `feat/rework` pushes receive CI verification (branch trigger or equivalent), without making a failing historical typecheck an immediate unreviewable global gate.

### 1. TypeScript and lint quality gates

- Classify and **fix the existing TypeScript errors** (currently reported as 27) in a separate bounded cleanup, not by suppressing compiler output.
- Use staged TypeScript strictness: turn on `strict` and other valuable checks only once the source actually passes; prefer explicit types, discriminated unions, and `unknown` narrowing over `any` / unsafe casts.
- Add `pnpm lint` and enforce ESLint in CI; keep Obsidian-specific lint rules. Add type-aware rules with conscious scope and documented exceptions, especially around Obsidian's dynamic APIs.
- Adopt automated formatting consistently (one formatter, minimal churn and one dedicated formatting commit if necessary). No drive-by format changes in behavioral patches.
- Run test/build/typecheck/lint on PRs and direct development-branch pushes. Fail on **new** errors throughout migration; make full typecheck/lint mandatory once baseline is clean.
- Acceptance: reproducible clean gates, no blanket `eslint-disable` or `@ts-ignore` added solely to make the dashboard green.

**Progress (2026-10-23):** Step 1A removed the 27 typecheck errors and added mandatory CI typecheck, verified on `feat/rework`. Step 1B cleaned a targeted subset of ESLint and MarkdownRenderer lifecycle errors; the last reported baseline remains approximately 787 lint problems (594 errors / 193 warnings). The changed-line lint gate is active. **The remaining historical lint backlog does not block Step 2**, provided `pnpm typecheck`, `pnpm test`, build and the incremental lint gate stay green. Avoid delaying the structure migration with mass lint reformatting.

### 2. Move TS source to `src/`, source assets to `assets/`, and ALL plugin outputs to `dist/`

Desired source structure (illustrative; adjust for existing modules and plugin requirements):

```text
src/
  main.ts
  settings.ts
  constants.ts
  components/
  models/
  services/
  utils/
  views/
  types/             # only if needed
assets/
  manifest.json       # authoritative SOURCE manifest; copied to dist/
  scss/
    main.scss          # Sass entry point
    abstracts/
    base/
    components/
    views/
    layout/
    responsive/
  images/             # shipped source images/icons, if any
  templates/          # resource files only if actually bundled/used
tests/
  __mocks__/
  features/           # later Cucumber pilot
scripts/
dist/                  # generated plugin distribution; ignored by git
  main.js
  styles.css
  manifest.json
package.json
versions.json
```

- Move application `.ts` files into `src/` as a coherent change; keep `tests/`, config, workflows and scripts at repository root. Handle `.d.ts` appropriately.
- **Historical Step 2 staging:** the temporary stylesheet lived at `src/styles/legacy.css` during the initial distribution migration. This staging path is now retired. **Final invariant: `src/` contains only TypeScript (`.ts`, `.d.ts`), all SCSS belongs under `assets/scss/`, and generated CSS is only `dist/styles.css`.**
- Use `git mv` when practical; update all relative imports and aliases in `tsconfig.json`, `esbuild.config.mjs`, ESLint configuration, Vitest, developer tooling, Junie instructions and IDE references.
- The esbuild entry becomes `src/main.ts`, and its output becomes **`dist/main.js`**, NOT root `main.js`. The authoring SCSS entry compiles to **`dist/styles.css`**. The authoritative source manifest moves to **`assets/manifest.json`** and is copied deterministically to **`dist/manifest.json`**. Do not maintain two hand-edited manifests. Preserve the Obsidian plugin ID `storyline`, name, version and compatibility metadata.
- Move only real **source** assets under `assets/`, including `assets/manifest.json` as the source-of-truth manifest. Keep documentation screenshots in `screenshots/` unless there is a concrete reason to reorganize them. Do not put release artefacts into `assets/`.
- If runtime code needs static assets, explicitly copy/bundle them under `dist/` and check packaging and vault sync. Do not assume Obsidian can resolve source-relative paths in a packaged plugin.
- **Source root is not the installed plugin root.** Obsidian must receive the three files at the **root of the installed plugin directory** (`.obsidian/plugins/storyline/main.js`, `styles.css`, `manifest.json`). The deployment and release processes copy/upload the *contents* of `dist/`, never create a nested `.obsidian/plugins/storyline/dist/` directory.
- Update `scripts/sync-vault.mjs` to read and watch `dist/`; handle a missing `dist/` directory with a helpful “run build” error. Update both `.github/workflows/ci.yml` and `release.yml` to install/build/validate/package from `dist/`. Update `DEVELOPMENT.md`, any docs and old root-path checks. Keep the existing manual-release behavior, version checks and `versions.json` sync. Ensure `pnpm dev` and `pnpm vault:watch` work together as before.
- Treat `dist/` as disposable generated output and add it to `.gitignore` **after** the CI/release/vault processes are updated to build their own dist output. Remove previously tracked root build artefacts (`main.js`, `styles.css`, `manifest.json`) in the same verified migration; never delete or change `assets/manifest.json` accidentally. Do not include generated bundles in ordinary feature commits.
- Never change the vault folder structure or move user manuscript files as part of this refactor.
- Acceptance: build produces all three files under `dist/` and no distributable files at repository root; all existing tests pass; vault-install/watch installs exactly `dist/` contents into Obsidian's normal flat plugin folder; CI uploads `dist/` artifacts; manual GitHub Release uploads the three correctly named files (without a nested dist directory); metadata checks read `assets/manifest.json` and `dist/manifest.json`; no behavioral changes to the bundle.

**Step 2 implementation report (2026-10-23):** Commits `50f5915` and `6ab211e` moved 97 TS source files to `src/`, `manifest.json` to `assets/`, CSS source to `src/styles/legacy.css` and generated plugin artifacts to `dist/`. The GitHub CI run for `6ab211e` initially failed incremental lint due to newly modified source-read lines in two test files; typed `node:fs` imports were added in subsequent fixes. The dev-mode `esbuild` asset watcher and `DEVELOPMENT.md` were also corrected subsequently. Preserve these fixes before Step 3. **CI/test success does not establish an actual Obsidian desktop smoke test** unless separately reported.

**Step 3 implementation report (2026-10-23):** Commit `ea66591` replaced the 14,680-line `src/styles/legacy.css` with modular SCSS. A later correction moved all **32 SCSS files** (entry point and partials) into `assets/scss/` as required by the user; `src/` now contains TypeScript only. The build compiles Sass to `dist/styles.css`. The CSS regression check verifies 2,159 selectors, 8,150 declarations, and 11 at-rules match the baseline exactly. Build pipeline updated to compile SCSS with watch support. ESLint postinstall patch added for `assets/manifest.json` path. **An actual Obsidian desktop smoke test is still needed** to verify visual parity.

**Typecheck correction:** The 113 TypeScript errors reported with Step 3 were **not historical**: commit `618021a` had replaced valid types with `unknown` in TypeScript and test mocks immediately before the SCSS migration. Those substitutions were reverted to restore the previously passing typecheck. New lint changes must preserve valid types rather than replace `any` with `unknown` without narrowing.

### 3. Adopt modular SCSS with one output file

- Add Sass tooling and compile **`assets/scss/main.scss`** to **`dist/styles.css`**, never the repository root or `src/`.
- Split the current stylesheet by responsibility: variables/tokens, base, forms, components, Timeline, Project Library, Codex, responsive/layout, etc. Use explicit `@use` / `@forward` modules rather than legacy global `@import`.
- **Preserve current selector behavior and cascade order** during the mechanical split. No UI redesign in the same commit. Avoid changing CSS specificity unintentionally.
- Integrate Sass into `pnpm dev` and `pnpm build` (including watch), and maintain `pnpm vault:watch` support for generated **`dist/styles.css`**.
- Keep generated `dist/styles.css` untracked with the rest of `dist/`; CI and release builds must regenerate it deterministically, not assume tracked output. Obsidian never reads `.scss` directly.
- Acceptance: `dist/styles.css` compiles deterministically, a documented smoke checklist across desktop/mobile views passes, existing CSS behavior is preserved, and CI/release/vault sync continue to work.

### 4. Add Cucumber for real acceptance scenarios; retain Vitest for unit/service tests

**Do not wholesale replace Vitest.** Cucumber/Gherkin describes feature behavior; the step definitions still require a meaningful integration harness.

- Introduce `@cucumber/cucumber` for a small BDD pilot, with `tests/features/**/*.feature`, step definitions and a documented `pnpm test:bdd` command.
- Keep Vitest (`pnpm test`) for TimeSpan arithmetic, parsers, metadata/UUID rules, and other fast isolated service tests.
- The first feature should cover: select Books A+B in one Universe, Event X from a sibling scope, confirm chronological Timeline, jump to an empty year, create a canonical Event, verify one persisted file and correct ownership; ensure wrong-universe Book cannot be selected.
- Step definitions MUST invoke production services and, when claiming a UI behavior, a real rendered view or appropriate Obsidian integration harness. Assertions on local test-only state or duplicated algorithms are **not** acceptance tests.
- Use a disposable test vault with fixture data. Never run mutating scenarios against the only authoring vault.
- Capture why a desktop/electron Obsidian smoke test might still be required if mocks cannot reproduce real DOM/workspace behavior.
- Evaluate pilot maintenance and signal before expanding Cucumber to more scenarios. Do not translate 400+ existing unit tests into prose merely to increase BDD test counts.
- Acceptance: reliable, failing-on-regression end-to-end-ish acceptance tests executed in CI, plus fast Vitest suite intact.

### 5. Commit-driven changelog automation

- Adopt **Conventional Commits** for all new changes, e.g. `feat(timeline): ...`, `fix(projects): ...`, `refactor(styles): ...`, `test(bdd): ...`, `docs: ...`; reserve `BREAKING CHANGE` for actual compatibility breaks.
- Choose a single reliable generator such as `conventional-changelog` or Release Please after comparing it against current manual `release.yml`. Prefer changelog generation on an explicit preparation step / release PR rather than silent release publication.
- Preserve existing historical changelog content; fix duplicate `1.11.0` headings and TODO placeholders with an explicit, reviewed change. Older nonconforming commits may require a curated initial baseline.
- Version metadata `package.json`, `assets/manifest.json`, `dist/manifest.json` and `versions.json` must stay synchronized. Never auto-bump a version or force-update tags in an unreviewed automation.
- Keep the existing **manual release workflow** unless separately approved to change publishing semantics. Ensure release notes in `CHANGELOG.md` and release artefacts match the released version.
- Add optional commit-message validation (commitlint or similar), with a migration policy that does not retroactively invalidate existing history.
- Acceptance: new conventional commits produce reproducible release notes, manual release packaging still works, no automatically created release or moved tag, and published changelog accurately reflects user-facing changes.

**Step 5 implementation report (2026-10-23):** Custom changelog script (`scripts/changelog.cjs`) implemented with pure-regex Conventional Commits parsing (no external parser dependency). Commands: `pnpm changelog:preview` (read-only) and `pnpm changelog:prepare <version>` (inserts into CHANGELOG.md). Duplicate 1.11.0 sections in CHANGELOG.md consolidated. Release workflow (`release.yml`) now **refuses to overwrite existing tags** instead of force-tagging. Conventional Commits guidelines documented in `DEVELOPMENT.md`. 25 automated tests cover parsing, preview, prepare, tag protection, duplicate prevention, and historical commit handling. CI validates changelog script syntax and preview. **Total tests: 455** (430 Vitest + 25 changelog).

### Step 6 — Architecture lint budgets and JSDoc-led refactoring

**Canonical plan:** [storyline-architecture-hardening.md](storyline-architecture-hardening.md). The user explicitly requires **no more than 200 effective code lines per authored source/test file (excluding comment-only and blank lines)**, plus limits on function length, cyclomatic complexity, nesting and statement/parameter counts, followed by deliberate decomposition with meaningful JSDoc.

The initial ESLint rules are enabled, but the legacy backlog is not yet resolved, and the changed-line lint gate alone does not enforce whole-file structural budgets. **Step 6A** must finish architecture-debt measurement, CI regression enforcement and safe autofix behavior. **Step 6B** then refactors all affected modules in small verified waves, reducing remaining debt to zero. Keep Saved Views after those checkpoints, not immediately after changelog.

#### Historical ESLint autofix defect

The user explicitly requires `pnpm lint --fix` to be safe to run without breaking `pnpm run typecheck`. The current ESLint configuration has twice produced invalid `as any` → `as unknown` autofixes (commits `618021a` and `0926256`). This is **a tooling/configuration defect**, not expected author behavior.

Do not repeat blanket suppression as a permanent fix. Audit Obsidian ESLint preset rules and fixers, disable or override only the unsafe automatic *fix behavior* where supported (while keeping diagnostics), introduce representative typed mock fixtures, and add a controlled CI fixture/regression that runs `lint --fix` in an isolated disposable checkout and confirms `typecheck` and tests still pass. This should not block Step 5 changelog automation; schedule as an explicitly tracked subsequent tooling task.

## Order of operations for Junie

1. Verify current 2B implementation on a safe test vault and capture exact quality/tooling baselines.
2. Do quality/typecheck/lint cleanup and CI gating; finish and verify it.
3. Move TS to `src/`, source manifest/assets to `assets/`, and generated plugin outputs to `dist/`; migrate CI, release and vault sync together. Finish and verify it.
4. Split stylesheet into SCSS modules and compile to `dist/styles.css`. Finish and verify it.
5. Add a Cucumber acceptance pilot while retaining Vitest.
6. Introduce Conventional Commits / generated changelog workflow without changing release publication.
7. **Step 6A:** establish hard structural budgets, accurate architecture-debt baseline, whole-file/function CI regression gate and safe autofix verification.
8. **Step 6B:** progressively decompose the monoliths with meaningful JSDoc and no behavioral changes until architectural budgets are met.
9. Resume Saved Views after the architecture checkpoints are complete.

**Every stage:** run build, Vitest, the applicable BDD tests, lint, typecheck and a disposable-vault smoke test where behavior or packaging may change. Report failures honestly with new-vs-existing provenance. Verify the latest two commits and remote HEAD before and after work. Commit and push actual code, not only updates to a planning checkbox.
