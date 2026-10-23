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

## Install a tested build in the real Starforge vault

Only after testing in the disposable vault, explicitly build and install:

    pnpm install --frozen-lockfile
    pnpm build
    pnpm vault:install -- "/absolute/path/to/author-starforge"

This updates the installed plugin's three files; it is not a general migration of manuscript files. The writing-vault repository may track installed StoryLine assets, so review and commit changes there separately **only when intentionally versioning the installed plugin**. Never point the active development watcher at the main writing vault.

## Release workflow

`.github/workflows/release.yml` is manually dispatched with an existing intended version. It verifies `assets/manifest.json`, `package.json` and `versions.json`, builds on GitHub Actions, and uploads `dist/main.js`, `dist/styles.css` and `dist/manifest.json` as **flat** release assets. It does not commit generated `dist/` files. Inspect release/version metadata and tag behavior before running this workflow, especially for versions already published.

SCSS migration is implemented. See `.junie/plans/storyline-maintainability-roadmap.md` for the remaining Cucumber and changelog work.
