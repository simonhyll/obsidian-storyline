# Future Plan — störyline Companion AI Skills for Authors

**Status:** Deferred proposal only — no skills or installers implemented yet.
**Purpose:** Create a separately installable **editorial companion skill package** for people who write with StoryLine/störyline in Obsidian. This is **not** the Junie development agent, repository coding automation or a new mandatory feature inside the Obsidian plugin.

## Vision and audience

An author should be able to install one or more focused skills in a compatible AI coding/writing agent and ask for help with the book or universe stored as ordinary Markdown and YAML in their vault. The agent should understand StoryLine's Scene/Event metadata, chronology, character and location links, and Universe → Series → Book structure **without needing to modify the plugin or possess the author's full private vault by default**.

Explore skill packaging approaches similar in spirit to Archify, but **verify the actual supported conventions and host integrations when implementation begins**. Do not assume that one directory format or installer works in every assistant/IDE.

## Initial editorial skill catalog (proposed)

1. **Grammar & language review:** spelling, grammar, punctuation, dialogue punctuation, idiom/clarity, Swedish and English varieties, configurable dialect/style sheet. Suggest corrections with context instead of flattening voice.
2. **Chronology and timeline audit:** read Scene `timeSpan` / `storyDate`, canonical Events and `eventRefs`; compare story order with manuscript sequence, chronology, gaps, flashbacks, overlaps, durations and precision. Respect non-Gregorian calendars and partial dates; explicitly report ambiguous or insufficiently dated passages rather than inventing dates.
3. **Continuity and consistency:** compare POV, characterization, names, relationships, locations, objects, ages, recurring facts, arc progression and Universe/Series inheritance. Cite conflicting source passages and distinguish genuine contradiction from intentional narrative misdirection.
4. **Scene copyediting and clean rewrite:** offer targeted tightening, prose clean-up, dialogue improvement and optional full scene rewrite. Preserve characters, meaning, POV, tense, tone, in-world terminology, author voice and Markdown/YAML structure unless explicitly instructed otherwise. Return a reviewable proposed edit or diff; do not overwrite automatically.
5. **Editorial/developmental review:** scene goals and stakes, pacing, setup/payoff, plot holes, repetition, motivation, theme, story arc and beta-reader-style feedback. Avoid presenting subjective editorial judgments as factual errors.
6. **StoryLine-aware project briefing:** summarize a Book, Series or Universe with scoped context, navigation links to relevant files, open continuity questions and a structured handoff for another editing session.

Prioritize (1) grammar, (2) timeline and (4) scene clean-up for an MVP. Treat the others as follow-up skills, not requirements for initial launch.

## Packaging, compatibility and installation

- Assess vendor-neutral conventions for skills (`SKILL.md`, scoped supporting references, example prompts and schemas) and the install locations supported by major agent hosts **at the time of development**.
- Proposed source organization is a distinct `skills/` or `companion/skills/` package, with each skill independently installable; do not put editing instructions into the plugin's `src/`, generated `dist/` or Junie's development plans.
- Provide both a clear manual install path and, if justified, a small auditable installer; avoid post-install scripts that read manuscripts or send content to services.
- Keep skill prompts concise, with optional linked format references and checklists. Do not hardwire a specific LLM, paid provider or editor in the core skill logic.
- Separate skill **instructions** from optional future tools/adapters that inspect the active vault. A model without file access must ask for the relevant scenes/context rather than claiming it inspected a full book.

## Project data contracts

- Understand Markdown + YAML frontmatter, wikilinks, Scene ownership and stable UUIDs, `timeSpan`, `eventRefs`, canonical Event ownership, and scoped Universe/Series/Book data. Read actual formats from the production models and tests, not from hand-waved examples.
- Honor optional, absent and legacy metadata; do not conflate `sequence` / chapter order with chronological time.
- Timeline checks must use appropriate calendar semantics and temporal precision; “unknown” must stay unknown, not silently become January 1.
- Respect manuscript structure: separate `body` content from metadata, notes, research, draft fragments and externally linked files. Never treat editor notes as narrative text unless requested.
- Every proposed continuity finding should identify the source file/scene and evidence excerpt, with confidence/uncertainty indicated where useful.

## Trust, privacy and editorial control

- **Read-only by default.** A skill may propose edits, but file writes, bulk rewrites, deletions, renames or frontmatter changes require an explicit user request and a reviewable diff/preview.
- Never modify an author's production vault as a test. Use a disposable fixture/demo vault (ideally the planned `docs/` example vault).
- Respect unpublished manuscripts, privacy and copyrighted text. No undeclared network transmission, telemetry, auto-upload or external model calls; document data movement for each supported host.
- Avoid “AI normalization” of author voice or unnecessary rewriting. The writer decides what to accept.
- Preserve ownership and relationship metadata on any approved edit. A grammar suggestion should not reorder scenes or mutate TimeSpan silently.

## Future phases

1. **Research:** survey host skill specs/installability, similar companion packages, actual StoryLine source metadata and user needs. Select a minimum supported set of hosts; record unsupported formats honestly.
2. **MVP design:** define versioned skill API/contract, feature prompts, scoped input/output formats and explicit acceptance/rejection workflow.
3. **Implement three MVP skills:** grammar review, timeline check and scene cleanup, with small reusable reference docs rather than duplicated giant prompts.
4. **Fixtures and validation:** build representative fictional scenes, Events, conflicting chronology, partial dates, flashbacks and Swedish/English errors; test against the sample `docs/` vault or dedicated test fixtures.
5. **Distribution:** publish installation/upgrade/uninstall guidance and links from README, the future GitHub Pages site and, if appropriate, the plugin Help UI. Skill versions need not match plugin versions but their data-contract compatibility should be documented.
6. **Expansion:** add continuity, developmental editing, project summaries and more languages based on author feedback.

## Acceptance criteria

- Skills are independently installable and useful to an author who already uses StoryLine; **no changes to plugin runtime are required** for baseline usage.
- Grammar, chronology and scene rewriting are grounded in supplied/read context and preserve user intent.
- Timeline findings have file/scene evidence; no invented chronology or silent schema changes.
- A user can see, approve or reject suggested scene changes before anything is written.
- Install/uninstall is documented, with no hidden manuscript access or network behavior.
- Tests include legitimate and intentionally contradictory fictional cases, and do not operate on private user writing projects.
- Repo structure remains `src/` for TypeScript, `assets/` for resources, `dist/` for generated plugin files.

## Sequencing

**Do not implement now.** This is an ecosystem/product plan for after current refactoring priorities. It can be designed independently of GitHub Pages but should reuse its vetted example vault when available and use the same visible **störyline** brand with transparent upstream fork credit.
