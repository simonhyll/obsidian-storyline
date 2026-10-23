# Future Plan — Visible störyline Brand and Transparent StoryLine Fork Credit

**Status:** Deferred proposal only — do not rename anything yet.
**Desired displayed name:** **störyline** (lowercase; with ö).
**Technical compatibility name:** **storyline** (ASCII; unchanged).
**Verified upstream:** [PixeroJan/obsidian-storyline](https://github.com/PixeroJan/obsidian-storyline); this repository is currently registered as its GitHub fork. The current source manifest identifies the plugin as `id: storyline`, `name: StoryLine`, with historical upstream author/support metadata; the repository license is MIT.

## Objective

Give the independently developed fork its own **visible identity** without creating an unnecessary plugin migration or breaking users' existing Obsidian vaults. Describe its origin transparently: störyline is **based on the original StoryLine**, but has diverged into an independently maintained fork. Do not imply ownership of or official endorsement by the original maintainer.

## Core rule: visible name changes, technical identity stays stable

**Change only author-facing presentation when this plan is implemented:**

- Display label in `assets/manifest.json` (`name`, **not** `id`), help, About screen, onboarding, plugin descriptions, screenshot captions, website headings and other genuine human-facing UI text.
- Ensure grammar/capitalization around “störyline” is consistent and readable; original “StoryLine” remains in attribution and historical references.
- If applicable, plan a matching, distinct icon and accessible wordmark, rather than borrowing an upstream asset without reviewing its license/permission.

**Keep the machine-facing names unchanged unless the user explicitly changes the decision:**

- `assets/manifest.json` `id: storyline`, `dist/` packaging and `.obsidian/plugins/storyline/`.
- GitHub slug/URL `simonhyll/obsidian-storyline`, package name `obsidian-storyline`, command IDs, constants, class/type names and internal imports.
- Vault paths, frontmatter fields, stable UUIDs, settings keys, API identifiers, saved data and references that depend on old names.
- Existing compatibility aliases and old content labels where changing them would require a migration.

Avoid blind search-and-replace: the same string can be brand text in one place and a persistent identifier in another.

## Fork attribution and provenance

Make a visible, concise credit block in README, the forthcoming website, and a suitable plugin Help/About location. Proposed wording (adjust for context/language):

> **störyline** is an independently developed fork based on **StoryLine** by its original contributors. We have taken the project in a different direction; störyline is not the original StoryLine project. Original project: [PixeroJan/obsidian-storyline](https://github.com/PixeroJan/obsidian-storyline).

- Verify and correctly credit original authors and subsequent upstream contributors rather than attributing the entire history to the fork.
- Keep license and copyright notices required by MIT; do not remove historical credit.
- Audit `assets/manifest.json`'s existing `author`, `authorUrl` and `fundingUrl` before any release: the current values refer to the original maintainer. Future visible branding and support/donation links must not misrepresent who maintains or receives support for the fork. Resolve the correct values explicitly, without inventing contact or funding addresses.
- Distinguish original upstream releases/screenshots from fork-specific material.

## Important listing/compatibility decision

Check Obsidian's current Community Plugins submission and ID uniqueness requirements **before** promising a separate “störyline” plugin-directory listing. The existing `storyline` ID may already identify the upstream plugin, so independent listing and the requirement to preserve this ID could conflict.

Do not silently change the ID to solve listing constraints. Document the choices for the user: maintain the original technical ID and distribute through GitHub, or consciously approve a separately identified plugin and its resulting migration/compatibility consequences. Any choice requires explicit author approval.

Never use the upstream community-plugin page as if it represented the independently maintained fork.

## Future implementation steps

1. Inventory all visible strings: manifest metadata, settings tab, command palette, ribbon tooltip, notifications, help, README, future `docs/`/Pages and releases. Categorize each occurrence as user-visible text, historical attribution or technical identifier.
2. Finalize the brand spelling, short tagline, fork-credit copy and maintainership details; verify any domain/store requirements.
3. Change only human-facing occurrences and support metadata after approval. Preserve machine-facing `storyline` IDs and existing vault compatibility.
4. Update feature screenshots, installer guidance, website navigation and README once the brand is ready.
5. Add tests asserting both the **visible** manifest name `störyline` and the **unchanged** manifest ID `storyline`, plus representative checks against accidental renaming of settings/files/data.
6. Audit upgrade/reinstall behavior with a disposable existing StoryLine vault; validate release assets and all CI/Husky checks.

## Completion criteria

- A user sees **störyline** in the appropriate UI and promotional text, but existing projects load without data migrations caused by branding.
- README, site and Help/About explicitly state the relationship to the original StoryLine and link to the verified upstream repository.
- Licenses and original-contributor credit are retained; author and funding details are honest.
- GitHub URL, Obsidian plugin ID and programmatic identifiers remain `storyline`.
- Any official Obsidian-directory eligibility issue has a documented decision rather than an accidental breaking rename.
- Do not change anything until the project owner schedules this initiative.

**Dependencies:** Coordinate with the `docs/` example-vault and GitHub Pages plan for a consistent public launch; the technical refactoring and Saved Views work continue independently.
