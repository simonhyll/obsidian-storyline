# Future Plan — Example Obsidian Vault and GitHub Pages

**Status:** Deferred proposal only — do not implement yet.
**Repository:** `simonhyll/obsidian-storyline`; the technical plugin ID remains `storyline`.
**Related plans:** `storyline-visible-brand-fork.md`, `storyline-author-companion-skills.md`.

## Objective

Replace the root-level `Sample Project.zip` with a **real, browsable example Obsidian vault at `docs/`**. The same Markdown content should become the source for a simple, attractive GitHub Pages marketing/documentation site. The static-site framework has **not** been selected; do not commit to one until a small evaluation confirms Obsidian compatibility.

## Existing state to inventory later

- `Sample Project.zip` currently exists at the repository root; inspect its **actual contents** before deleting or replacing it. Preserve useful sample data, relationships and references.
- README currently describes many views and references `screenshots/`.
- Plugin source and generated artifacts remain separate: `src/`, `assets/`, `dist/`. `dist/` is ignored by Git.
- No `docs/` vault or Pages pipeline has been created by this plan.

## Proposed `docs/` layout

`docs/` should itself be the **vault root**, not merely a directory containing a ZIP:

- `docs/.obsidian/` — minimal, portable vault configuration; enable the StoryLine plugin; no personal workspace state, credentials, caches or machine-specific paths.
- `docs/.obsidian/plugins/storyline/` — a working installation of the plugin for the example vault, with `main.js`, `styles.css`, `manifest.json`, and optional demo-only `data.json`. Decide and document a reproducible/pinned distribution policy: checked-in generated copies for immediate clone-and-open use, or a one-command bootstrap that installs **exactly** from `dist/`. The final acceptance criterion is that opening `docs/` in Obsidian can run the matching plugin version without hunting for old artifacts.
- `docs/index.md` or `docs/Welcome.md` — a clear start page for the sample author/vault, compatible with both Obsidian and website generation.
- Example Universe / Series / Book data, Scenes, canonical Events, characters, locations, codex entries, tags and timeline connections, using current supported StoryLine frontmatter and stable UUIDs.
- `docs/guide/` or equivalent — quick start, feature walkthroughs and troubleshooting; screenshots or illustration assets only when grounded in the actual version.

Plan sample content for editorial clarity, safe fictional examples and cross-feature demonstrations; it should be useful to explore, not simply a synthetic database dump. Do **not** import private writing-vault content or user manuscripts.

## GitHub Pages strategy (framework undecided)

1. Compare a small set of Obsidian-friendly generators (for example Quartz, MkDocs, Astro-based templates), assessing wiki-link support, embeds, search, build reproducibility, GitHub Actions/Pages deployment, performance, simple styling and long-term maintenance.
2. Keep the **vault Markdown as the source of truth**. The public site should be **generated** into a separate CI artifact/output, rather than requiring duplicate copies of every documentation page or putting generated HTML inside the vault.
3. Use the existing repository's GitHub Pages facility and a normal build/deploy workflow when the project is ready; avoid requiring a custom domain, external CMS or new repository.
4. The first website can be deliberately simple: hero/intro, product screenshots, major features, installation instructions, example vault, documentation, explicit fork credit, support/contact and links back to GitHub.
5. Add an Obsidian community-plugin-page link **only after verifying which listing, if any, belongs to this fork**. Never imply the upstream plugin's listing is the independent fork's listing. Until then, link to verified GitHub installation/releases and label any upstream page clearly.
6. Accessibility, responsive/mobile navigation, alt text, basic discoverability/metadata and no misleading product screenshots are launch requirements.

## Delivery phases (future)

- **A — Audit:** inspect the ZIP and README references; design the example vault's actual contents, upgrade compatibility and content licenses.
- **B — Vault:** create `docs/`, portable `.obsidian` settings and a reproducible installed plugin; verify a disposable checkout can open it in Obsidian without touching private vaults.
- **C — Site prototype:** evaluate a generator and demonstrate correct Obsidian wiki-link conversion, screenshots and navigation.
- **D — Pages:** wire up GitHub Pages publication from the `docs/` source without committing generated site bundles; prepare simple promotional copy and verified links.
- **E — Cleanup:** only after parity checks, delete `Sample Project.zip` from the root, update README/download links and remove obsolete references. Do not remove the archive in advance.

## Verification / acceptance

- `docs/` opens as an ordinary, portable Obsidian vault with StoryLine enabled and meaningful sample content.
- Example Book/Series/Universe, Scenes, Events, TimeSpan, codex and wikilinks work with the current plugin; **never** use the author's real project as a test fixture.
- A clean clone can reproducibly provision any plugin binaries; distribution/source roles stay explicit.
- Site builds and publishes using Pages; no broken Markdown/wiki-links/asset paths, on both desktop and mobile.
- GitHub and any fork-owned Obsidian listing links are verified, not guessed.
- Documentation credits the StoryLine upstream appropriately, consistent with the visible-brand plan.
- Existing build/test/typecheck/architecture checks remain green; Husky is never bypassed.

## Scope boundaries and sequencing

**No implementation now.** This work is a future product/docs initiative, independent of ongoing Step 6B refactoring and Saved Views. Coordinate the public site launch with the visible **störyline** branding and accurate fork attribution, but the vault/site framework may be selected later. Do not edit the current sample ZIP, website settings, README or plugin files as part of writing this plan.
