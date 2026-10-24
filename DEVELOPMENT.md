# StoryLine development / Starforge integration

StoryLine plugin source: https://github.com/simonhyll/obsidian-storyline
Starforge writing vault: https://github.com/simonhyll/author-starforge

Keep this **plugin repository** separate from the **writing vault**. The Obsidian plugin manifest ID is **`storyline`**; changing it makes Obsidian treat the plugin as a different installation.

## Project and distribution layout

- `src/`: TypeScript application source only (`.ts` and `.d.ts`).
- `assets/manifest.json`: authoritative plugin manifest.
- `assets/scss/`: modular Sass source (`main.scss` and partials in `abstracts/`, `base/`, `components/`, `views/`, `layout/` and `responsive/`).
- `dist/`: **generated** distributable plugin files (`main.js`, `manifest.json`, `styles.css`), excluded from Git.
- `tests/`: Vitest tests and Obsidian mocks.
- `scripts/sync-vault.mjs`: copies the three `dist/` files into the installed StoryLine plugin directory.

Obsidian installs the **contents** of `dist/` flat into `.obsidian/plugins/storyline/`, **not** into `.obsidian/plugins/storyline/dist/`. Do not edit generated `dist/` files as source.

## Local prerequisites

Obsidian Desktop, Git, Node.js 22, pnpm (via Corepack) and a separate disposable Obsidian test vault. Clone plugin and writing vault repos side by side if desired.

**Never test new plugin code against your only copy of a writing vault.** A plugin may modify writing files. Use a disposable test clone, for example:

    git clone https://github.com/simonhyll/author-starforge.git ../author-starforge-dev

Open the test vault in Obsidian once to create its `.obsidian/` directory. Do not push test-vault edits into the real writing repository.

## Initial build and installation

Run in the StoryLine plugin checkout:

    corepack enable
    pnpm install --frozen-lockfile
    pnpm build
    pnpm vault:install -- "/absolute/path/to/author-starforge-dev"

On Windows, use an absolute Windows path. The install script checks for an existing Obsidian vault, verifies the plugin ID and copies only `dist/main.js`, `dist/manifest.json` and `dist/styles.css` into `.obsidian/plugins/storyline/`. It does not intentionally touch StoryLine's `data.json`, other vault settings or writing documents.

## Development with automatic deployment

Start these commands in separate terminals in the plugin repository:

Terminal A — watch the TypeScript build and source assets:

    pnpm dev

Terminal B — watch `dist/` and sync changed builds into a **test** vault:

    pnpm vault:watch -- "/absolute/path/to/author-starforge-dev"

The build watches TypeScript and all nested Sass modules under `assets/scss/`, recompiling them to `dist/styles.css`; it also copies `assets/manifest.json` into `dist/manifest.json` on change. The vault sync script watches `dist/` and installs changes into the flat plugin directory. Reload StoryLine in Obsidian to pick up new JavaScript. A hot-reload plugin is optional and should only be used in the test vault; a manifest change may require restarting Obsidian.

Run `pnpm build` after changing packaging or before creating a release.

## Code quality and CI

    pnpm test
    pnpm run typecheck
    pnpm lint
    pnpm lint:changed

The full ESLint backlog has historical findings; `pnpm lint` may return nonzero. The incremental `lint:changed` gate checks new errors on changed lines relative to a Git base (in CI, based on the push/PR event). TypeScript typecheck, tests, production build and incremental lint are verified in GitHub Actions on `feat/rework`, `main` and pull requests.

CI produces and checks `dist/`, validates the source manifest version against `package.json` and `versions.json`, and uploads the three distributable files as an artifact. Builds do not auto-release.

## Conventional Commits

All new commits **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This enables automated changelog generation and clear release notes.

### Commit message format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Section in changelog     | Description                                    |
|------------|--------------------------|------------------------------------------------|
| `feat`     | Features                 | A new user-visible feature                     |
| `fix`      | Bug Fixes                | A bug fix                                      |
| `perf`     | Performance              | A performance improvement                      |
| `refactor` | Refactoring              | Code change that neither fixes nor adds a feat |
| `docs`     | Documentation            | Documentation only changes                     |

Other types (`test`, `build`, `ci`, `chore`, `style`) are valid but are **omitted** from the generated changelog to avoid internal maintenance noise.

### Scopes

Use a short scope that identifies the component or area changed, for example:

- `feat(timeline): add date navigation`
- `fix(events): preserve canonical ownership`
- `refactor(styles): split Sass modules`
- `test(bdd): cover multi-book chronology`
- `docs: update developer documentation`

The scope is optional. Omit it for cross-cutting changes.

### Breaking changes

Signal a breaking change by appending `!` before the colon or by adding a `BREAKING CHANGE:` note in the commit body:

```
feat(timeline)!: remove incompatible legacy behavior
```

or

```
fix(events): simplify ownership model

BREAKING CHANGE: Event files no longer support the old owner field.
```

### Changelog commands

```bash
# Preview what the next release notes will look like (does not modify files)
pnpm changelog:preview

# Preview commits since a specific tag
pnpm changelog:preview -- --from 1.11.0

# Generate and insert a changelog section for a version
pnpm changelog:prepare 1.11.1

# Generate from a specific baseline tag
pnpm changelog:prepare 1.11.1 -- --from 1.11.0
```

The `prepare` command:
- Refuses to proceed if a Git tag for the version already exists.
- Refuses to duplicate an existing version section in CHANGELOG.md.
- Inserts the new section after the Support StoryLine section.
- Does **not** create Git tags, bump versions, or publish releases.

### Historical commits

Older commits that do not follow Conventional Commits are listed under a **Non-conforming Commits** section. The script does not fabricate features from ambiguous messages.

## Install a tested build in the real Starforge vault

Only after testing in the disposable vault, explicitly build and install:

    pnpm install --frozen-lockfile
    pnpm build
    pnpm vault:install -- "/absolute/path/to/author-starforge"

This updates the installed plugin's three files; it is not a general migration of manuscript files. The writing-vault repository may track installed StoryLine assets, so review and commit changes there separately **only when intentionally versioning the installed plugin**. Never point the active development watcher at the main writing vault.

## Release workflow

`.github/workflows/release.yml` is manually dispatched with an existing intended version. It verifies `assets/manifest.json`, `package.json` and `versions.json`, builds on GitHub Actions, and uploads `dist/main.js`, `dist/styles.css` and `dist/manifest.json` as **flat** release assets. It does not commit generated `dist/` files. Inspect release/version metadata and tag behavior before running this workflow, especially for versions already published.

## Mandatory local quality checks (Husky)

`pnpm install --frozen-lockfile` installs Husky v9 via the package `prepare` script. In an existing checkout, run `pnpm exec husky` to register `.husky/pre-commit`.

Each local commit runs **in this order**:

1. `pnpm lint:staged`: lint only changed staged TS/JS/MJS/CJS lines (legacy full-file errors are still tracked). Partially staged source files with unstaged changes are rejected to avoid validating code different from the index.
2. `pnpm lint:architecture`: compare all current architectural violations to the recorded baseline; refuse increased debt.
3. `pnpm typecheck`: require zero TypeScript errors.

A failure **must block the commit**. Junie must not use `--no-verify`, `HUSKY=0`, altered `core.hooksPath`, force options, temporary hook deletion, or other ways to bypass checks. Repair the code or rules correctly, never hide new violations by inflating the baseline. `pnpm lint` still has historical errors, so it is *not* the pre-commit gate during Step 6B.

**Important technical limitation:** local hooks do not execute on GitHub API writes, and Git clients can bypass them. The independent build/test/typecheck/lint/architecture GitHub Actions checks must therefore be green before a pushed commit is accepted as finished. See `.github/workflows/ci.yml`.

## Architecture lint budgets

The repository enforces structural limits on all hand-authored TypeScript and JavaScript code:

| Rule | Limit | Scope |
|------|-------|-------|
| `max-lines` | 200 effective lines | Per file (blanks/comments excluded) |
| `max-lines-per-function` | 50 effective lines | Per function/method |
| `complexity` | 10 cyclomatic | Per function |
| `max-depth` | 3 | Nesting depth |
| `max-statements` | 25 | Per function |
| `max-params` | 4 | Per function/constructor |

These rules apply to `.ts`, `.mjs`, and `.cjs` files. Generated `dist/` artifacts are excluded.

The historical backlog is tracked in `scripts/baselines/architecture-baseline.json`. The regression gate (`pnpm lint:architecture`) fails if new files introduce violations or existing files increase their violation count. Step 6B will progressively decompose oversized modules until the baseline reaches zero.

### JSDoc standards

Meaningful JSDoc is required on:

- **Exported functions and public class methods** — explain purpose, behavioral contracts, and side effects.
- **Parameters** — describe meaning when not obvious from the name alone.
- **Return values** — explain semantics, especially for complex types or discriminated unions.
- **Side effects** — document file I/O, vault mutations, settings changes, or DOM modifications.
- **Errors and cancellation** — when a function can throw, return null on cancellation, or abort.
- **Async lifecycle** — for Obsidian plugin lifecycle methods, document when cleanup occurs.
- **Data ownership** — for functions that create or modify Scenes, Events, or Codex entries, document which Book/Series/Universe owns the result.
- **Calendar and TimeSpan semantics** — for date-related functions, document calendar assumptions and precision.

JSDoc comment lines do **not** count toward the 200-line file budget. Avoid restating TypeScript types or generating meaningless boilerplate.

SCSS migration, Cucumber BDD, changelog automation, and architecture linting are implemented. See `.junie/plans/storyline-maintainability-roadmap.md` for the remaining work (Step 6B decomposition, Saved Views).
