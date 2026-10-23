---
sessionId: session-261022-231027-1052
---

# Revised Architecture Plan

## 1. Current Architecture — Key Findings

### Project Structure

TypeScript Obsidian plugin with a flat structure:

- **main.ts** (4190 lines) — Monolithic plugin entry. All managers, views, and services instantiated in `SceneCardsPlugin.onload()`. No DI framework.
- **settings.ts** (3856 lines) — All settings interfaces and settings tab UI.
- **models/** — `Scene.ts` (800 lines), `StoryLineProject.ts` (155 lines), `Character.ts` (1079 lines), `Location.ts` (319 lines), `Codex.ts` (528 lines), `Research.ts`, `PlotGridData.ts`.
- **services/** — `SceneManager.ts` (2999 lines), `SceneQueryService.ts`, `SeriesManager.ts` (662 lines), `CharacterManager.ts`, `LocationManager.ts`, `CodexManager.ts`, `ExportService.ts`, `DocxConverter.ts`, `PdfConverter.ts`, `MetadataParser.ts`, `LinkScanner.ts`, `ViewSnapshotService.ts`, and more.
- **views/** — `BoardView.ts`, `TimelineView.ts` (1846 lines), `StorylineView.ts`, `CharacterView.ts`, `LocationView.ts`, `CodexView.ts`, `ManuscriptView.ts`, `NavigatorView.ts` (712 lines), `PlotgridView.ts`, `StatsView.ts`, and more.
- **components/** — `SceneCard.ts`, `Inspector.ts`, `StoryGraph.ts` (766 lines), `RelationshipMap.ts` (562 lines), `Filters.ts`, `ViewSwitcher.ts`, `ProjectSelector.ts` (115 lines), modals, etc.
- **utils/** — `actChapter.ts`, `locale.ts` (37k lines), `narrow.ts`, `vault.ts`.

### Key Architectural Patterns

1. **Monolithic main.ts** — All wiring in `SceneCardsPlugin.onload()`. Direct constructor calls, no DI.
2. **Manager-per-domain** — Each entity type has its own manager (SceneManager, CharacterManager, LocationManager, CodexManager). Managers own CRUD + persistence.
3. **YAML frontmatter as data layer** — All entities are Markdown files with YAML frontmatter. Portable, Obsidian-native.
4. **Series support (thin)** — `SeriesManager` manages `series.json` + shared Codex folder. Books reference series via `seriesId`/`seriesUuid` in project frontmatter. No shared Events, no multi-book timeline.
5. **Views extend ItemView** — Each view is an Obsidian `ItemView` subclass. Views render their own DOM, toolbar, and data.
6. **SceneQueryService** — Read-only query layer (filter, sort, stats) separated from SceneManager (write layer). Good pattern to extend.
7. **No TimeSpan model** — Dates are free-form strings (`storyDate`, `storyTime` on `Scene`). No intervals, no uncertainty, no calendar abstraction.
8. **No Event model** — Scenes carry temporal data but there is no separate "Event" entity. Scenes are both narrative and temporal.
9. **Graph is visual only** — `StoryGraph` and `RelationshipMap` render SVG graphs but don't persist graph structure. Relationships are derived from Character fields.
10. **ViewSnapshotService** — Existing pattern for saved view state (corkboard positions, plotgrid, kanban order). Stored as JSON in `System/Snapshots/`. Limited to BoardView/PlotgridView.

### Existing Series Architecture

SeriesFolder/series.json contains SeriesMetadata (name, bookOrder, bookIds, seriesUuid). Codex/ folder is shared across books. Each Book has its own Scenes/ folder. No Universe concept above series. No shared Events. No multi-book timeline. seriesArcView setting exists but is scaffolded only.

### Existing Entity Identity and Ownership

- `StoryLineProject` has optional `bookId` (UUID) and `seriesUuid`
- `SeriesMetadata` has optional `seriesUuid`
- `Character`, `Location`, and `CodexEntry` have `books?: string[]` and `booksById?: string[]` for series filtering
- No concept of "introduced in" or ownership vs. reference
- No Universe-level identity

### Noveler Plugin Assessment

- **Repository:** `DylanComas/noveler-a-storyline-expansion` (GitHub)
- **License:** MIT — compatible for absorption
- **Language:** JavaScript (single `main.js` bundle, minified) — **not** straightforward TypeScript migration
- **Version:** 1.2.4, minAppVersion 1.12.7, desktop only
- **Key features:** Dedicated manuscript editor view, page mode (paper size, margins, rulers, headers/footers), focus mode (distraction-free, typewriter behavior), rich formatting toolbar, StoryLine bridge integration, formatted exports, Antidote Connect support, i18n system (`.lang/` directory with JSON catalogs)
- **Integration feasibility:** HIGH — MIT license permits absorption, features complement StoryLine's existing ManuscriptView
- **Migration complexity:** **HIGH** — bundle is minified; direct JS→TS migration is impractical. Requires behavioral analysis and selective reimplementation as clean TypeScript modules. More labor-intensive but produces cleaner, maintainable code than a direct migration would.

### Architectural Limitations

1. No hierarchy above Series — Universe concept doesn't exist
2. Scene = Event conflation — no separation between narrative and objective events
3. No TimeSpan model — dates are free-form strings
4. Single-book timeline — TimelineView works on one project's scenes; no multi-book swimlanes
5. No temporal validity — Codex entries and relationships have no time bounds
6. No graph persistence — relationships are derived, not stored as first-class edges
7. Monolithic main.ts (4190 lines) and settings.ts (3856 lines)
8. No publishing infrastructure — Export is file-format focused, not publishing-focused
9. ProjectSelector is flat — no hierarchy (Universe → Series → Book) in navigation
10. No entity ownership model — no distinction between ownership, reference, introduction, and visibility

### Reusable Components

- `SceneManager` + `SceneQueryService` pattern — extend for multi-book queries
- `SeriesManager` — foundation for Universe/Series hierarchy
- `TimelineView` swimlane infrastructure — extend for multi-book
- `StoryGraph` / `RelationshipMap` — extend for entity-relationship graph
- `ExportService` — extend for publishing formats
- `MetadataParser` — extend for new entity types
- `FieldTemplateService` — already supports universal fields across entity types
- `ViewSnapshotService` — pattern for saved view presets (needs generalization)
- `Codex` generic model — already designed for extensible categories
- `Character` model — already has `books`/`booksById` fields for series filtering
- `Location` model — already has `books`/`booksById` fields
- `locale.ts` — word counting infrastructure, extensible for custom calendars

---

## 2. Entity Identity and Ownership Model

### Core Principle

Entities have globally stable identities within the vault. A single canonical entity record is preferred over duplicated entity records, even when the same entity appears at multiple hierarchy levels.

### Entity Identity Contract

Every entity (Character, Location, CodexEntry, Event, Scene) has:

- **`id`**: Stable UUID (v4), generated on first scan. Stored in frontmatter as `id` field. Globally unique within the vault.
- **`type`**: Entity type discriminator (e.g., `character`, `location`, `event`, `item`, `scene`).
- **`filePath`**: Vault-relative path of the Markdown file. The file is the canonical source of truth.
- **`ownerId`**: UUID of the Universe, Series, or Book that owns this entity. Determines where the entity "lives" in the hierarchy.
- **`introducedIn`**: UUID of the Book that first introduces this entity. For author organization, not reader-facing spoiler filtering.

### Ownership vs. Reference vs. Introduction vs. Visibility vs. Supplementary Metadata

| Concept | Meaning | Stored As |
|---------|---------|-----------|
| **Ownership** | Which Universe, Series, or Book owns the entity | `ownerId` field + folder location |
| **References** | Which Books or Series use or reference the entity | `booksById` array (existing pattern) |
| **Introduction** | Which Book first introduces the entity | `introducedIn` field |
| **Visibility** | Which information the author chooses to display | View-level filter state, not entity metadata |
| **Supplementary metadata** | Scope-specific notes, aliases, or local context for an inherited entity | Separate JSON sidecar file, not the entity's frontmatter |

### Inherited Entities — No Duplication

An entity inherited from Universe or Series must **not** be replaced by another entity merely because the same UUID appears at a lower scope. There is one canonical entity per UUID.

If a Book needs scope-specific information about an inherited entity (e.g., a local alias or book-specific notes), that supplementary metadata is stored in a separate sidecar file (e.g., `System/entity-supplement.json`) and never modifies the original entity's frontmatter.

### Duplicate ID Behavior

Two different files sharing a persisted UUID constitute an identity conflict, regardless of hierarchy scope. The system never silently selects a canonical winner based on scope precedence.

On detection:
1. The conflict is reported to the user immediately.
2. The user must explicitly resolve the conflict by merging, re-UUIDing, or deleting one of the files.
3. Until resolved, both entities remain visible with a conflict warning.

### Conflicting Metadata

If the same property appears in both the canonical entity and a supplementary metadata file:
- The canonical entity value is used by default.
- The supplementary value can override for display purposes within that scope only.
- The override is explicit and visible to the author.

### Collection Inheritance

Collections support inherited access from parent levels:

- A Book's effective Characters = Universe Characters ∪ Series Characters ∪ Book Characters
- A Book's effective Events = Universe Events ∪ Series Events ∪ Book Events
- Shared entries are not duplicated — they are referenced from their owner's folder

### Scope Resolution

When resolving an entity by ID:
1. Check Book-level collection
2. Check Series-level collection (if Book belongs to a Series)
3. Check Universe-level collection (if Series belongs to a Universe)
4. Return the single canonical entity found (not the first match — the entity itself)
5. Apply any scope-specific supplementary metadata for display

### Existing Code Impact

- `StoryLineProject.ts`: Add `universeId?: string`, `ownerId?: string` fields
- `SeriesMetadata`: Add `universeId?: string`, `ownerId?: string` fields
- `Character.ts`, `Location.ts`, `Codex.ts`: Add `id`, `ownerId`, `introducedIn` fields
- `SeriesManager.ts`: Integrate into or delegate to new `UniverseManager`

---

## 3. Universe → Series → Book Hierarchy

### ContainerEntity Abstraction

Universe and Series share a common architectural abstraction:

```
interface ContainerEntity {
  id: string;              // UUID
  type: 'universe' | 'series';
  name: string;
  parentId?: string;       // Universe ID for Series
  childIds?: string[];     // Series IDs (for Universe) or Book IDs (for Series)
  created: string;
}
```

### Hierarchy Structure

```
Universe (container)
├── universe.json          ← UniverseMetadata
├── Codex/                 ← shared across all series/books
│   ├── Characters/
│   ├── Locations/
│   └── [custom categories]
├── Events/                ← universe-level events
├── Series A (container)
│   ├── series.json        ← enhanced with universeId
│   ├── Codex/             ← series-specific (inherited from Universe)
│   ├── Events/            ← series-specific events
│   ├── Book 1
│   │   ├── Book 1.md      ← enhanced with universeId, seriesUuid
│   │   ├── Scenes/
│   │   ├── Codex/         ← book-specific codex
│   │   ├── Events/        ← book-specific events
│   │   └── System/
│   └── Book 2
└── Series B
    ├── Book 3
```

### Backward Compatibility

- All new fields are optional
- Existing series continue to work without a Universe
- `series.json` format extended with optional `universeId`
- Project frontmatter extended with optional `universeId`
- Standalone books (no series, no universe) remain fully supported

### New Services

- **`UniverseManager.ts`** — Universe/Series/Book CRUD, hierarchy navigation, inherited collection resolution
- Integrates or replaces `SeriesManager` functionality
- Owns `universe.json` persistence

### New Models

- **`Universe.ts`** — `UniverseMetadata`, `ContainerEntity`, hierarchy types

---

## 4. Shared TimeSpan Model

### Design Goals

- Reusable across Events, Scenes, Codex entities, graph relationships, and future timeline-compatible objects
- Does not assume JavaScript `Date` is sufficient for canonical representation
- Separates canonical time representation from display formatting and calendar conversion
- Initial implementation is practical, extensible, and testable

### Canonical Representation

```
interface TimeSpan {
  kind: 'instant' | 'interval' | 'open-ended' | 'uncertain' | 'unknown' | 'relative';
  
  // For instant
  instant?: Timestamp;
  
  // For interval
  start?: Timestamp;
  end?: Timestamp;
  
  // For open-ended
  start?: Timestamp;  // end is undefined
  
  // For uncertain
  range?: { start: Timestamp; end: Timestamp };
  confidence?: number;  // 0-1
  
  // For relative (machine-readable expression, not free-form text)
  relativeTo?: string;  // event ID or scene ID
  offset?: TemporalOffset;  // structured offset, not free-form string
  
  // Display
  display?: string;     // author-facing label
}

interface TemporalOffset {
  amount: number;       // e.g. 3, -1, 365
  unit: 'day' | 'week' | 'month' | 'year' | 'season';
  direction: 'before' | 'after';
}

interface Timestamp {
  calendar: string;     // 'gregorian' default, extensible
  year: number;         // supports large values (BC/AD, fantasy calendars)
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  precision?: 'year' | 'month' | 'day' | 'hour' | 'minute';
}
```

### Key Decisions

- **No JavaScript Date** — `Timestamp` uses explicit year/month/day fields to support very large historical and future time scales
- **Calendar is pluggable** — `calendar` field defaults to `'gregorian'`, extensible for custom calendars
- **Relative dates are machine-readable** — `TemporalOffset` struct replaces free-form strings like "3 days before" with a parseable expression (`{amount: 3, unit: 'day', direction: 'before'}`)
- **Unknown dates** — `kind: 'unknown'` for entities with no temporal information
- **Display separation** — `display` field stores author-facing label; parsing/formatting is handled by `TimeSpanService`
- **Date precision** — `precision` field on `Timestamp` indicates the granularity of the date (year-only, month-level, etc.)
- **Calendar-independent comparison** — Comparison rules operate on normalized timestamps within the same calendar; cross-calendar comparison requires a conversion adapter
- **Unresolved relative dates** — If `relativeTo` references an entity with no TimeSpan, the relative date resolves to `kind: 'unknown'` until the reference resolves
- **Uncertain and interval coexistence** — An uncertain range is itself an interval with a confidence score; they are not mutually exclusive

### New Services

- **`TimeSpanService.ts`** — Parsing, comparison, overlap detection, calendar conversion, display formatting

### New Components

- **`TimeSpanPicker.ts`** — UI for selecting instants, intervals, uncertain ranges, and unknown dates

### Existing Code Impact

- `Scene.ts`: Replace `storyDate?: string` and `storyTime?: string` with `timeSpan?: TimeSpan`
- `Event.ts` (new): Uses `timeSpan?: TimeSpan`
- `Codex.ts`: Optional `validFrom?: TimeSpan`, `validTo?: TimeSpan` on entities
- Graph relationships: Optional `validFrom?: TimeSpan`, `validTo?: TimeSpan`

---

## 5. Events vs Scenes

### Event Model

Events represent objective canonical occurrences within the fictional universe:

```
interface Event {
  id: string;              // UUID
  type: 'event';
  filePath: string;
  name: string;
  timeSpan?: TimeSpan;     // When the event occurs (objective)
  location?: string;       // Wikilink to Location
  participants?: string[]; // Character IDs involved
  description?: string;    // Canonical description
  ownerId?: string;        // Which Universe/Series/Book owns this event
  introducedIn?: string;   // Which Book first introduces this event
  booksById?: string[];    // Which Books reference this event
  universalFields?: Record<string, unknown>;
}
```

### Scene-Event Relationship

- A Scene may reference multiple Events via `eventRefs?: string[]` (Event UUIDs)
- An Event may be referenced by multiple Scenes
- Scenes are **not** constrained to depict their referenced Events accurately
- No canonical consistency enforcement on literary Scenes
- Unreliable narrators, incomplete perspectives, conflicting accounts are all valid

### Existing Code Impact

- `Scene.ts`: Add `eventRefs?: string[]` field
- New `Event.ts` model
- New `EventManager.ts` service

---

## 6. Entity Graph and Temporal Codex

### Graph-Oriented Architecture

The model supports:

- Stable entity identifiers (UUIDs)
- Typed nodes and relationships
- Directed and symmetric relations
- Inverse relationship definitions
- Temporal validity on relationships
- References across books, series, and universes
- Efficient graph traversal and filtering
- Integration with existing relationship ontology (Character relations)
- Future continuity checking and historical state queries

### Entity Node and Edge Models

```
interface EntityNode {
  id: string;           // UUID
  type: string;         // 'character' | 'location' | 'event' | 'codex' | 'scene' | custom
  name: string;
  ownerId?: string;
  validFrom?: TimeSpan;
  validTo?: TimeSpan;
  properties: Record<string, unknown>;
}

interface EntityEdge {
  id: string;
  from: string;         // entity UUID
  to: string;
  relationType: string; // 'ally' | 'enemy' | 'presentAt' | 'references' | 'parentOf' | custom
  inverseType?: string; // e.g. 'childOf' for 'parentOf'
  symmetric?: boolean;  // if true, relation is bidirectional
  validFrom?: TimeSpan;
  validTo?: TimeSpan;
  properties?: Record<string, unknown>;
}
```

### Storage and Indexing Assessment

**Requirement:** Markdown and YAML frontmatter remain the portable, editable source of truth. Any derived graph index must be reconstructible from canonical source files and remain consistent when files are modified directly in Obsidian.

**Evaluated options:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **JSON file index** | Simple, portable, rebuildable from frontmatter | No query engine, manual indexing | Baseline — good for Phase 0-4 |
| **SQLite (via better-sqlite3)** | Embedded, ACID, fast queries, full-text search | Binary file, not portable across editors | Future option if performance requires |
| **DuckDB** | Analytical queries, columnar | Overkill for plugin scope | Not recommended |
| **In-memory index only** | Fast, no persistence | Rebuilds on every load | Not viable for large universes |
| **Neo4j embedded** | True graph database | Heavy dependency, Java-based | Not suitable for Obsidian plugin |

**Recommended approach:** Two-phase strategy

1. **Phase 0-4:** JSON file index derived from frontmatter on save. Rebuildable. Simple in-memory query layer.
2. **Future (if needed):** Migrate to SQLite if query performance becomes a bottleneck. The JSON index serves as a migration path.

**Derived index storage location:** To avoid unnecessary Git changes in author repositories, derived indexes should be stored in a location that can be gitignored. Recommended: `.storyline/system/entity-graph.json` (under the `.storyline` hidden directory, parallel to Obsidian's `.obsidian`). This keeps derived data out of the author's tracked files while remaining vault-local and portable.

**Graph is never the canonical source of truth.** The derived index is always reconstructible from frontmatter. If the index becomes stale or corrupted, it can be rebuilt from source files.

### Graph Derivation

- Graph is derived from existing frontmatter on save (Characters, Locations, Codex, Scenes, Events)
- Character relations → EntityEdges
- Scene-Event links → EntityEdges
- Scene-Character presence → EntityEdges
- Custom relations → EntityEdges
- No changes to existing frontmatter format — graph is a derived index

### Temporal Codex

- Builds on the shared TimeSpan model
- Entities and individual facts or relationships have validity periods
- Does not complicate every Codex metadata field — temporal validity is optional
- `validFrom`/`validTo` on `EntityNode` and `EntityEdge`

### Temporal Property Assertions

Temporal validity must eventually support individual facts and property values, not only complete entities and relationships. For example, a character's title, employer, location, or political affiliation may change over time.

**Extensible approach:** Property-level temporal assertions are stored as structured facts separate from the entity's main frontmatter:

```
interface TemporalFact {
  entityId: string;        // UUID of the entity
  property: string;        // e.g. "title", "employer", "location"
  value: unknown;          // the property value during this period
  validFrom?: TimeSpan;
  validTo?: TimeSpan;
}
```

- Stored in `System/temporal-facts.json` (derived index) or as YAML lists in frontmatter (e.g., `titleHistory: [{value: "Captain", validFrom: ...}, {value: "Admiral", validFrom: ...}]`)
- The architecture accommodates both approaches; initial implementation uses frontmatter YAML lists for portability
- Full implementation is deferred to Phase 4+ but the model is defined in Phase 0

### New Services

- **`EntityGraphService.ts`** — Graph storage (JSON index), derivation from frontmatter, queries, temporal filtering

### Existing Code Impact

- `StoryGraph.ts` and `RelationshipMap.ts` — extend to use graph data
- `Character.ts` relations → derived into EntityEdges
- New `System/entity-graph.json` file

---

## 7. Multi-Book Timeline and Saved Views

### Multi-Book Timeline

Timeline must evolve from a book-specific view into a configurable timeline capable of combining:

- Multiple Books
- Series-level Events
- Universe-level Events
- Scene and Event entries
- Relevant Codex entities and temporal relationships

### Architecture

- New `TimelineService.ts` assembles scenes and events from multiple books
- Uses `TimeSpan` for timeline positioning
- Uses `UniverseManager` for hierarchy-aware collection resolution
- Swimlanes configurable per book, per character, per series
- Events appear as shared markers across book swimlanes

### Author-Controlled Filtering

Filtering is a fundamental requirement, not a secondary feature. Support:

- Universe, Series, and Book selection
- Entity type filtering (Scenes, Events, Codex entities)
- Specific entity filtering (by character, location, etc.)
- Date or TimeSpan range filtering
- Scenes vs Events toggle
- View-specific attributes

### Saved Views

- Extend the filtering architecture with **Saved Views**
- Saved Views are named, reusable configurations of source selection, filters, temporal ranges, swimlanes, and display settings
- Usable across appropriate StoryLine views (Timeline, Codex, Graph)
- View-specific settings where necessary
- Multiple instances of the same view can display different configurations independently
- **No custom Workspace system** — Obsidian already provides pane management and workspace functionality

### Existing Code Impact

- `TimelineView.ts` — major extension for multi-book, swimlanes, filtering
- `ViewSnapshotService.ts` — generalize from BoardView-specific to cross-view Saved Views
- `ProjectSelector.ts` — replace with hierarchy-aware selector

### New Services

- **`TimelineService.ts`** — Multi-book timeline assembly, filtering, swimlane configuration

---

## 8. Project Library and Navigation

### Project Library

A first-class Project Library supporting:

- Universes
- Series
- Books
- Standalone works
- Cover imagery
- Hierarchical navigation
- Convenient switching between authoring scopes

### Design

- The interface should feel like an organized literary library, not a collection of basic dropdowns
- `UniverseSelector.ts` replaces `ProjectSelector.ts`
- Tree view with expandable Universe → Series → Book hierarchy
- Cover thumbnails for visual identification
- Quick access to standalone books

### Existing Code Impact

- `ProjectSelector.ts` — replaced by `UniverseSelector.ts`
- `NavigatorView.ts` — extended to show hierarchical structure
- `main.ts` — ribbon icon opens Universe library

### New Components

- **`UniverseSelector.ts`** — Hierarchy-aware project selector with tree navigation

---

## 9. Noveler Absorption

### Integration Strategy

- Absorb Noveler plugin into StoryLine (not a runtime dependency)
- **Incremental extraction and selective reimplementation** — Noveler is distributed as a minified JavaScript bundle, not source code. Converting a bundle to maintainable TypeScript is not straightforward.
- Strategy: Extract behavior from the bundle, understand the architecture, and reimplement in TypeScript as clean StoryLine modules
- Preserve all required MIT copyright and attribution notices
- Avoid duplicating existing manuscript functionality — one coherent architecture after absorption
- Preserve StoryLine's existing mobile support; desktop-only features may be capability-gated

### Migration Approach

1. **Behavioral analysis** — Run the Noveler bundle in a test vault, observe behavior, and document the feature surface
2. **Selective reimplement** — Reimplement features as TypeScript modules within StoryLine, following StoryLine patterns
3. **Feature parity** — Validate reimplemented features against original Noveler behavior
4. **Integration** — Wire reimplemented features into `ManuscriptView` and `ExportService`

### Feature Mapping

| Noveler Feature | StoryLine Equivalent | Action |
|-----------------|---------------------|--------|
| Manuscript editor view | `ManuscriptView.ts` | Enhance existing view |
| Page mode (paper size, margins, rulers) | None | Reimplement in ManuscriptView |
| Focus mode | None | Reimplement in ManuscriptView |
| Formatting toolbar | None | Reimplement in ManuscriptView |
| StoryLine bridge | Internal routing in `main.ts` | Internalize |
| Formatted exports | `ExportService.ts` | Merge/export profiles |
| i18n system | None | Adopt `.lang/` pattern |
| Antidote Connect | None | Optional integration |

### Duplicated Functionality

- `ManuscriptView.ts` currently provides basic manuscript editing — Noveler's page mode and formatting toolbar will replace/enhance this
- `ExportService.ts` handles file-format exports — Noveler's formatted exports will be merged
- No competing implementations — one coherent architecture after absorption

### Existing Code Impact

- `ManuscriptView.ts` — major enhancement with reimplemented Noveler features
- `ExportService.ts` — merge Noveler export profiles
- New `i18n/` directory for language files

### Complexity Assessment

**Revised complexity: HIGH** — Previously assessed as straightforward JS→TS migration. Corrected: the bundle is minified, making direct migration impractical. Reimplementation from behavioral analysis is required, which is more labor-intensive but produces cleaner, maintainable code.

---

## 10. Publishing and Book Design Studio

### Publishing Architecture

Separates:

- Author identities and pseudonyms
- Books and manuscript content
- Language versions or variants
- Publication editions
- ISBN assignments
- Print and digital formats
- Export profiles and providers
- Visual book design assets

### Models

```
interface AuthorProfile {
  id: string;
  name: string;
  pseudonyms: string[];
  bio?: string;
}

interface BookEdition {
  id: string;
  bookId: string;        // References StoryLineProject
  title: string;
  subtitle?: string;
  authorId: string;      // References AuthorProfile
  language?: string;     // BCP-47 tag
  isbn?: string;
  format: 'ebook' | 'paperback' | 'hardcover' | 'audiobook';
  distributor?: 'KDP' | 'BOD' | string;
  coverImage?: string;
  designSettings?: DesignSettings;
  publishedDate?: string;
}

interface DesignSettings {
  trimSize?: { width: number; height: number; unit: string };
  bleed?: number;
  margins?: { top: number; bottom: number; inner: number; outer: number };
  spineWidth?: number;
  fontSettings?: Record<string, unknown>;
}
```

### Book Design Studio

- Dedicated StoryLine tab/view
- Supports: front covers, back covers, book spines, full print cover layouts
- Top, bottom, and fore-edge artwork
- Special editions, multi-book spine artwork
- Double fore-edge painting artwork preparation where technically feasible
- Print dimensions, bleed, trim, and production parameters
- Distinguishes between artwork preparation and actual printing capabilities

### Existing Code Impact

- `ExportService.ts` — extend for publishing formats
- New `PublishingService.ts` — edition management
- New `PublishingView.ts` — Book Design Studio
- New `System/editions.json` per book

### New Models

- **`Publishing.ts`** — `AuthorProfile`, `BookEdition`, `DesignSettings`

### New Services

- **`PublishingService.ts`** — Edition management, export pipelines

### New Views

- **`PublishingView.ts`** — Book Design Studio

---

# Compatibility and Migration Strategy

## 11. Backward Compatibility

### Principles

1. **All new fields are optional** — existing data formats remain valid
2. **Migration is opt-in, per-project** — no forced migration
3. **Backward compatibility layer reads old formats** — legacy projects work unchanged
4. **No breaking changes to existing frontmatter** — new fields are additive
5. **Creating a Universe must not automatically reorganize or move existing directories** — the hierarchy is a logical overlay, not a file system reorganization

### UUID Generation on Legacy Files

**When UUIDs are generated:**
- UUIDs are generated on first scan of a file that does not have an `id` field
- The UUID is stored in memory and used for the current session
- **The UUID is NOT written to the file automatically** — it is only persisted when the author explicitly saves the entity through StoryLine (e.g., via the Inspector or a StoryLine command)
- This avoids automatic modifications to files the author has not touched

**When legacy files are modified:**
- A legacy file is only modified when the author performs a write operation through StoryLine (edit via Inspector, cascade rename, etc.)
- On write, the `id` field is added to frontmatter if missing
- No batch migration of all files on plugin load
- The author can choose to migrate files incrementally as they work with them

**Compatibility during the transition:**
- Files without `id` fields continue to work using file-path-based identity
- The system treats file path as a temporary identity surrogate until `id` is present
- Once `id` is added, it becomes the primary identity
- No data loss during the transition

### Specific Compatibility Measures

| Existing Feature | Compatibility Approach |
|-----------------|----------------------|
| `StoryLineProject` | Add optional `universeId`, `ownerId` fields |
| `SeriesMetadata` | Add optional `universeId`, `ownerId` fields |
| `Scene.storyDate`/`storyTime` | Keep as legacy fields; add optional `timeSpan` |
| `Character.books`/`booksById` | Extend with `ownerId`, `introducedIn` |
| `Location.books`/`booksById` | Extend with `ownerId`, `introducedIn` |
| `CodexEntry.books` | Extend with `ownerId`, `introducedIn` |
| `series.json` | Extend with optional `universeId` |
| `ViewSnapshotService` | Generalize to cross-view Saved Views |
| `ProjectSelector` | Replace with `UniverseSelector` (backward compat via flat mode) |

### Data Migration

- **Automatic on first load:** Existing projects receive `bookId` and `seriesUuid` if missing (already done in `SeriesManager.ensureProjectSeriesIdentity`)
- **Opt-in Universe migration:** User creates a Universe and adds existing Series
- **No data loss:** All existing data preserved during migration
- **Graph rebuild:** Entity graph is derived from frontmatter on first save after migration
- **No automatic file reorganization:** Creating a Universe does not move existing book or series directories

---

# Revised Implementation Roadmap

## 12. Phase 0 — Architecture and Migration Foundations

**Dependencies:** None
**Estimated effort:** Small-Medium

### What

Define the contracts, interfaces, and conventions that every other phase depends on. This phase is intentionally lightweight — it defines but does not fully implement the temporal and graph subsystems. Those are delivered in their respective phases.

### Deliverables

- **`models/EntityIdentity.ts`** — `EntityIdentity` interface with `id`, `type`, `filePath`, `ownerId`, `introducedIn`
- **`models/TimeSpan.ts`** — `TimeSpan`, `Timestamp`, `TemporalOffset` type **definitions only** (no service implementation)
- **`models/EntityGraph.ts`** — `EntityNode`, `EntityEdge` type **definitions only** (no service implementation)
- **`models/TemporalFact.ts`** — `TemporalFact` type definition for property-level temporal assertions
- **Shared service interfaces** — Interface definitions for `TimeSpanService`, `EntityGraphService`, `UniverseManager` (signatures only, no implementation)
- **Persistence conventions** — Documented conventions for frontmatter fields, derived index storage (`.storyline/` directory), and migration rules
- **Testing infrastructure** — Basic test harness and compatibility tests for existing project loading

### What Phase 0 Does NOT Include

- No `TimeSpanService` implementation (moved to Phase 2)
- No `TimeSpanPicker` component (moved to Phase 2)
- No `EntityGraphService` implementation (moved to Phase 4)
- No graph indexing or persistence logic (moved to Phase 4)
- No functional graph engine

### Existing Modules Affected

- `models/Scene.ts` — Add `id`, `ownerId` fields (all optional; `timeSpan` and `eventRefs` deferred to later phases)
- `models/StoryLineProject.ts` — Add `universeId`, `ownerId` fields (optional)
- `models/Character.ts` — Add `id`, `ownerId`, `introducedIn` fields (optional)
- `models/Location.ts` — Add `id`, `ownerId`, `introducedIn` fields (optional)
- `models/Codex.ts` — Add `id`, `ownerId`, `introducedIn` fields (optional)
- `services/SeriesManager.ts` — Add `universeId` to `SeriesMetadata` (optional)
- `main.ts` — No new service initialization yet (services don't exist yet)

### Acceptance Criteria

- Entity identity contract is defined and documented
- TimeSpan types are defined (instant, interval, open-ended, uncertain, unknown, relative with TemporalOffset)
- EntityGraph types are defined (EntityNode, EntityEdge with temporal validity)
- TemporalFact type is defined for property-level temporal assertions
- Shared service interfaces are defined (signatures only)
- Persistence conventions are documented (frontmatter fields, `.storyline/` derived index location, migration rules)
- Compatibility tests verify existing projects open without errors
- All new fields are optional — no migration required for existing data
- **No functional graph engine is required**
- **No TimeSpan parsing or comparison is required**
- Phase 0 does not modify any existing frontmatter files

---

## 13. Phase 1 — Universe, Series, Book, and Initial Project Library

**Dependencies:** Phase 0
**Estimated effort:** Large

### What

Introduce Universe as a first-class container above Series. Implement the hierarchy, inherited collections, and initial navigation redesign.

### Deliverables

- **`models/Universe.ts`** — `UniverseMetadata`, `ContainerEntity`, hierarchy types
- **`services/UniverseManager.ts`** — Universe/Series/Book CRUD, hierarchy navigation, inherited collection resolution
- **`components/UniverseSelector.ts`** — Replaces `ProjectSelector` with hierarchy navigation
- **`views/UniverseView.ts`** — Library navigation view (Universe/Series/Book)
- **`universe.json`** — Universe metadata persistence

### Existing Modules Affected

- `models/StoryLineProject.ts` — Add `universeId` field
- `models/Character.ts`, `Location.ts`, `Codex.ts` — Use `ownerId` for scope resolution
- `services/SeriesManager.ts` — Integrate into or delegate to `UniverseManager`
- `components/ProjectSelector.ts` — Replaced by `UniverseSelector`
- `views/NavigatorView.ts` — Extended to show hierarchical structure
- `main.ts` — Register new views and commands

### Acceptance Criteria

- Users can create a Universe and add Series to it
- Codex entries defined at Universe level are visible in all books
- Series-level Codex entries override/augment Universe entries
- `UniverseSelector` replaces `ProjectSelector` with hierarchy navigation
- Existing projects without a Universe continue to work unchanged
- `series.json` and project frontmatter remain valid
- Standalone books and Series without a Universe are supported
- Ownership, reference, introduction, and visibility are correctly distinguished
- Collection inheritance works: Book effective Codex = Universe ∪ Series ∪ Book

---

## 14. Phase 2 — TimeSpan and Events

**Dependencies:** Phase 0 (type definitions), Phase 1 (Universe hierarchy for scope resolution)
**Estimated effort:** Medium

### What

Implement the shared TimeSpan model and separate objective Events from narrative Scenes. Events use the shared TimeSpan model and can be shared across books via the Universe/Series hierarchy.

### Deliverables

- **`models/Event.ts`** — Event model with `timeSpan`, `location`, `participants`, `ownerId`, `introducedIn`
- **`services/EventManager.ts`** — Event CRUD, hierarchy-aware queries
- **`services/TimeSpanService.ts`** — **Full implementation**: parsing, comparison, overlap detection, Gregorian calendar as default, calendar conversion, display formatting
- **`components/TimeSpanPicker.ts`** — UI for selecting instants, intervals, uncertain ranges, and unknown dates
- **`components/EventCard.ts`** — Event rendering in views
- Events appear in Entity Graph as nodes (using Phase 0 type definitions; graph indexing in Phase 4)
- Scenes link to Events via `eventRefs`

### Existing Modules Affected

- `models/Scene.ts` — Add `eventRefs?: string[]` and `timeSpan?: TimeSpan` fields
- `services/SceneManager.ts` — Multi-book scene queries (prepare for Phase 3)
- `views/TimelineView.ts` — Show Events as markers (prepare for Phase 3)
- `main.ts` — Initialize TimeSpanService and EventManager

### Acceptance Criteria

- TimeSpan can represent instants, intervals, uncertain ranges, open-ended intervals, unknown dates, and relative references
- Gregorian dates parse and compare correctly
- Overlap detection works across all TimeSpan types
- Custom calendar interface is defined and testable
- TimeSpanPicker renders and produces valid TimeSpan values
- Events can be created, edited, and linked from Scenes
- Scene-Event links are stored in frontmatter (portable)
- Existing Scenes work without `eventRefs`
- Events support all TimeSpan variants (instant, interval, uncertain, etc.)
- Events can be shared across books via Universe/Series inheritance
- No canonical consistency enforcement on Scenes referencing Events
- **Events appearing in TimelineView is NOT required** (that is Phase 3)
- **Events indexed in Entity Graph is NOT required** (that is Phase 4)

---

## 15. Phase 3 — Multi-Book Timeline and Saved Views

**Dependencies:** Phase 1 (Universe), Phase 2 (Events, TimeSpan)
**Estimated effort:** Large

### What

Extend TimelineView to support multi-book swimlanes, Events, filtering, and Saved Views. Implement the reusable Saved Views infrastructure and integrate it into Timeline first. Codex and Graph views will integrate Saved Views as their relevant features become available.

### Deliverables

- **`services/TimelineService.ts`** — Multi-book timeline assembly, filtering, swimlane configuration
- Extended `TimelineView` with:
  - Configurable multi-book swimlanes
  - Event markers across books
  - Filtering (by book, character, tag, time range, entity type)
  - Saved view presets (filters, swimlane configs, time ranges)
- **Reusable Saved Views infrastructure** — Generalized from `ViewSnapshotService` to cross-view Saved Views
- Saved Views are named, reusable configurations of source selection, filters, temporal ranges, swimlanes, and display settings
- Multiple instances of the same view can display different configurations independently
- **No custom Workspace system** — uses Obsidian's pane management

### Existing Modules Affected

- `views/TimelineView.ts` — Major extension for multi-book, swimlanes, filtering
- `services/ViewSnapshotService.ts` — Generalize from BoardView-specific to cross-view Saved Views
- `components/ViewSnapshotModal.ts` — Extend for Saved Views
- `main.ts` — Register TimelineService

### Acceptance Criteria

- TimelineView can display scenes from multiple books in parallel swimlanes
- Events appear as shared markers across swimlanes
- Users can save and restore timeline view presets
- Filtering works across books (by Universe, Series, Book, entity type, date range, etc.)
- Performance is acceptable with 100+ scenes across 3+ books
- Multiple instances of TimelineView can display different configurations independently
- Saved Views infrastructure is reusable (other views can adopt it)
- No custom Workspace system — uses Obsidian's pane management
- **Codex Saved Views integration is NOT required** (deferred to when Codex view features are ready)
- **Graph Saved Views integration is NOT required** (deferred to Phase 4+)

---

## 16. Phase 4 — Entity Graph and Temporal Codex

**Dependencies:** Phase 0 (type definitions), Phase 2 (Events, TimeSpan)
**Estimated effort:** Medium

### What

Build the graph-oriented entity and relationship layer with temporal validity. This phase implements the EntityGraphService, graph indexing, and full temporal relationship support.

### Deliverables

- **`services/EntityGraphService.ts`** — **Full implementation**: Graph storage (JSON index in `.storyline/system/`), derivation from frontmatter, queries, temporal filtering
- Full graph derivation from frontmatter (Characters, Locations, Codex, Scenes, Events)
- Typed nodes and relationships
- Directed and symmetric relations
- Inverse relationship definitions
- Temporal validity on edges
- Graph traversal and filtering queries
- Extend `StoryGraph` and `RelationshipMap` to use graph data
- Add temporal validity fields to Character relations and Codex entries
- Continuity-analysis foundations
- **Graph Saved Views integration** — Integrate Saved Views into Graph view
- Temporal property assertions initial support (TemporalFact model from Phase 0)

### Existing Modules Affected

- `components/StoryGraph.ts` — Render from graph data
- `components/RelationshipMap.ts` — Render from graph data
- `models/Character.ts` — Relations derived into EntityEdges
- `models/Codex.ts` — Optional `validFrom`/`validTo` on entities
- `main.ts` — Initialize EntityGraphService

### Acceptance Criteria

- Graph is derived from existing frontmatter on save
- Graph queries support temporal filtering (e.g., "show relations valid in 1850")
- StoryGraph and RelationshipMap render from graph data
- No changes to existing frontmatter format
- Graph index is stored in `.storyline/system/` (gitignoreable location)
- Graph is reconstructible from source files (never the canonical source of truth)
- Inverse relationships work correctly
- Symmetric relations are bidirectional
- Continuity-analysis foundations are in place for future use
- Events are indexed in Entity Graph as nodes
- Graph Saved Views work in the Graph view

---

## 17. Phase 5 — Noveler Absorption

**Dependencies:** None (can run in parallel with Phases 0-4)
**Estimated effort:** Large
**Complexity:** HIGH — bundle is minified; reimplementation from behavioral analysis required

### What

Absorb Noveler plugin functionality into StoryLine through incremental extraction and selective reimplementation. Noveler is distributed as a minified JavaScript bundle, so direct migration is not practical.

### Deliverables

- **Behavioral analysis** of Noveler bundle (feature surface documentation)
- Reimplemented manuscript editor features in `ManuscriptView`:
  - Page mode (paper size, margins, rulers, headers/footers)
  - Focus mode (distraction-free, typewriter behavior)
  - Rich formatting toolbar
  - Scene-aware editing
- Internalized StoryLine bridge logic
- Adopted i18n system (`.lang/` directory)
- Merged formatted exports into `ExportService`
- MIT attribution preserved in credits
- Desktop-only features capability-gated (mobile support preserved)

### Existing Modules Affected

- `views/ManuscriptView.ts` — Major enhancement with reimplemented Noveler features
- `services/ExportService.ts` — Merge Noveler export profiles
- `main.ts` — Remove Noveler bridge, integrate internal routing

### Acceptance Criteria

- ManuscriptView has page mode, focus mode, and formatting toolbar
- StoryLine scenes open in the enhanced ManuscriptView
- i18n system works for Noveler-derived UI strings
- No external Noveler plugin required
- Existing ManuscriptView users see enhanced features
- MIT attribution visible in credits/help
- One coherent manuscript editing and layout architecture (no competing implementations)
- StoryLine's existing mobile support is preserved
- Desktop-only features are capability-gated

---

## 18. Phase 6 — Publishing and Book Design Studio

**Dependencies:** Phase 1 (Universe), Phase 5 (Noveler for design tools)
**Estimated effort:** Medium

### What

Add publishing support with author profiles, editions, ISBNs, and distribution.

### Deliverables

- **`models/Publishing.ts`** — `AuthorProfile`, `BookEdition`, `DesignSettings`
- **`services/PublishingService.ts`** — Edition management, export pipelines
- **`views/PublishingView.ts`** — Book Design Studio
- Store editions in `System/editions.json` + project frontmatter
- Extend ExportService for publishing formats (KDP, BOD-ready outputs)
- Support multiple editions per book (ebook, paperback, hardcover)
- Support pseudonyms and author profiles
- Book Design Studio with cover/layout preview

### Existing Modules Affected

- `services/ExportService.ts` — Extend for publishing formats
- `models/StoryLineProject.ts` — Add publishing-related fields

### Acceptance Criteria

- Users can create author profiles with pseudonyms
- Books can have multiple editions with ISBNs
- Design Studio provides cover/layout preview
- Export pipelines produce publishing-ready outputs
- Edition data is portable (JSON in vault)
- Multiple editions share manuscript content where appropriate
- Print dimensions, bleed, trim parameters are supported
- KDP and BOD export profiles are available

---

## 19. Phase 7 — Stabilization and UX Completion

**Dependencies:** All previous phases
**Estimated effort:** Medium

### What

Refactor monolithic files, clean up technical debt, optimize performance, and finalize documentation.

### Deliverables

- Split `main.ts` into modular initialization (e.g., `init/` directory)
- Split `settings.ts` into domain-specific setting modules
- Audit and clean up eslint suppressions
- Performance audit for large projects (100+ scenes, 5+ books)
- Documentation update
- Migration guide for existing projects
- Regression testing

### Existing Modules Affected

- `main.ts` — Split into modular init
- `settings.ts` — Split by domain
- All views — UI refinement

### Acceptance Criteria

- `main.ts` reduced to wiring-only (no business logic)
- Settings organized by domain
- No new eslint suppressions added
- Performance benchmarks pass for large projects
- Migration guide covers all changes
- All existing functionality still works (regression testing)
- Documentation is up to date

---

# Dependency Graph

```
Phase 0 (Foundations: types, interfaces, conventions)
  → Phase 1 (Universe, Hierarchy, Navigation)
    → Phase 3 (Multi-Book Timeline, Saved Views)
  → Phase 2 (TimeSpan impl, Events)
    → Phase 3 (Multi-Book Timeline, Saved Views)
    → Phase 4 (Entity Graph, Temporal Codex)
Phase 1 (Universe) → Phase 6 (Publishing) ← Phase 5 (Noveler)
All phases → Phase 7 (Stabilization)
```

**Parallel execution:** Phase 5 (Noveler) can run in parallel with Phases 0-4.

**Phase boundary guarantees:**
- Phase 0 does not require a functional graph engine
- Phase 2 does not require completed multi-book Timeline behavior
- Phase 3 does not require completed Graph Saved Views
- Phase 4 introduces graph indexing and full temporal relationship support
- Automated tests, regression protection, and incremental refactoring occur throughout development

---

# Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-------------|
| Breaking existing projects | High | All new fields optional; backward compat layer; opt-in migration; existing projects work unchanged |
| Noveler reimplementation complexity | **High** | Bundle is minified; behavioral analysis + selective reimplement; can run in parallel; produces cleaner code than direct migration |
| Performance with large universes | Medium | Entity Graph indexed; lazy loading; virtual scroller already exists; Phase 7 performance audit |
| Calendar abstraction complexity | Medium | Start with Gregorian; custom calendars are opt-in extensions; pluggable interface |
| Settings file bloat | Low | Phase 7 splits settings; incremental improvement |
| main.ts monolith | Low | Phase 7 refactors; no blocking dependency |
| Graph storage scalability | Medium | JSON index in `.storyline/` for Phase 0-4; SQLite migration path if needed |
| Saved Views vs ViewSnapshotService confusion | Low | Clear naming: Saved Views are filter/display presets, not workspace layouts |
| Derived index becoming stale | Medium | Index is always rebuildable from frontmatter; rebuild command available; `.storyline/` location is gitignoreable |
| UUID generation modifying files | Low | UUIDs only written on explicit author save; no batch migration; file-path-based identity during transition |

---

# Unresolved Technical Questions

1. **Graph storage for very large universes:** JSON index in `.storyline/` is sufficient for Phase 0-4, but should we evaluate SQLite earlier if the user expects 1000+ entities?
2. **Custom calendar implementation:** The pluggable calendar interface is defined, but the first custom calendar implementation is deferred. Should we include a sample calendar (e.g., D&D calendar) as a proof of concept?
3. **Noveler Antidote Connect:** Should we integrate Antidote Connect support, or leave it as an optional external dependency?
4. **Book Design Studio depth:** How much artwork preparation functionality is needed initially? Full print cover layout vs. basic cover preview?
5. **KDP/BOD integration:** Should we integrate directly with KDP/BOD APIs, or just produce format-compliant exports?
6. **Starforge data migration:** The revision mentions Starforge data. What is the scope of Starforge integration and what data needs to be migrated?
7. **Temporal property assertions storage:** Should temporal facts (e.g., character title history) be stored as YAML lists in frontmatter or in a separate JSON index? The architecture supports both; the initial approach needs confirmation.

---

# Delivery Steps

### ✓ Step 1: Produce corrected architecture plan
Deliver the complete corrected architecture plan incorporating all user feedback from the final revision.

- Reduced Phase 0 scope: types, interfaces, and conventions only (no TimeSpan or graph implementation)
- Corrected entity identity model: single canonical entity per UUID, supplementary metadata for scope-specific info, explicit duplicate ID behavior
- Extended temporal codex design: TemporalFact model for property-level temporal assertions
- Corrected Saved Views dependencies: implemented in Phase 3, integrated into Timeline first; Codex and Graph integration deferred
- Clarified migration strategy: UUID generation on explicit save only, no automatic file modifications, no directory reorganization on Universe creation
- Improved TimeSpan specification: machine-readable TemporalOffset, calendar-independent comparison rules, date precision, unresolved relative date behavior
- Reassessed Noveler migration: HIGH complexity, incremental extraction and selective reimplementation strategy
- Corrected phase dependencies and acceptance criteria: Phase 0 requires no graph engine, Phase 2 requires no multi-book timeline, Phase 3 requires no Graph Saved Views
- Updated dependency graph and risk assessment
- Defined `.storyline/` directory for derived indexes (gitignoreable)

### ✓ Step 2: Implement Phase 0 — Architecture and Migration Foundations
Create type definitions, interfaces, and update existing models with optional new fields. No service implementations yet.

- ✓ Create models/EntityIdentity.ts — EntityIdentity interface, EntitySupplement, SCOPE_PRECEDENCE, generateEntityId(), isValidEntityId(), generateLegacyIdentity(), detectDuplicateIdConflicts()
- ✓ Create models/TimeSpan.ts (discriminated union types) — 6 variant interfaces, CalendarAdapter, factory functions
- ✓ Create models/EntityGraph.ts (types only) — EntityNode, EntityEdge, EntityGraphIndex, GraphQueryFilter, GraphQueryResult
- ✓ Create models/TemporalFact.ts — TemporalFact, TemporalFactCollection, TemporalFactIndex
- ✓ Create services/ServiceInterfaces.ts — TimeSpanService, EntityGraphService, UniverseManager interfaces
- ✓ Update models/Scene.ts — added optional id, ownerId, introducedIn
- ✓ Update models/StoryLineProject.ts — added optional universeId, ownerId to StoryLineProject and SeriesMetadata
- ✓ Update models/Character.ts — added optional id, ownerId, introducedIn
- ✓ Update models/Location.ts — added optional id, ownerId, introducedIn to LocationBase
- ✓ Update models/Codex.ts — added optional id, ownerId, introducedIn
- ✓ Add typecheck script to package.json (separate from esbuild)
- ✓ Add Vitest test infrastructure with 43 passing tests
- ✓ Fix tsconfig.json (removed invalid ignoreDeprecations option)
- ✓ Document reconstructibility in EntityGraph.ts and TemporalFact.ts
- ✓ Build verification — pnpm run build passes successfully
- ✓ Test verification — 43/43 tests pass
- ✓ Typecheck verification — Phase 0 files pass; 18 pre-existing baseline errors documented
- ✓ Lint verification — Phase 0 files pass; 8 pre-existing baseline errors documented
- ✓ Committed to feat/rework branch

### ✓ Step 3: Implement Phase 1 — Universe, Series, Book Hierarchy
Create the Universe model, UniverseManager service, hierarchy navigation, and integrate with existing SeriesManager.

- ✓ Create models/Universe.ts — UniverseMetadata, ContainerEntity, HierarchyPath, InheritedCollectionResult, helper functions
- ✓ Create services/UniverseManager.ts — Universe CRUD, series membership, hierarchy resolution, inherited collections, discovery
- ✓ Update services/SeriesManager.ts — load/save universeId and ownerId in series.json
- ✓ Create components/UniverseSelector.ts — Tree-based hierarchy selector with async refresh, no throwing functions
- ✓ Create views/UniverseView.ts — Dedicated Project Library view with hierarchy tree and action buttons
- ✓ Update constants.ts — Added UNIVERSE_VIEW_TYPE
- ✓ Update main.ts — Register UniverseView, add "Open project library" command, make modal methods public, fix Remove Series modal
- ✓ Update services/UniverseManager.ts — Fixed resolveHierarchyPath and resolveInheritedCollections to use supplied project
- ✓ Update styles.css — Added UniverseSelector and UniverseView styling
- ✓ Create tests/universe-integration.test.ts — 18 integration tests with mocked Obsidian vault
- ✓ Create tests/__mocks__/obsidian.ts — Obsidian API mock for integration tests
- ✓ Update vitest.config.ts — Added obsidian mock alias
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 96/96 tests pass (78 existing + 18 new integration tests)
- ✓ Typecheck verification — No new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 4: Finish Phase 1 Integration
Complete remaining Phase 1 integration: Codex inheritance, exclusive universe membership, active-project dependency removal, and Project Library UI fixes.

- ✓ Fix exclusive Universe membership in addSeriesToUniverse — removes series from old universe first
- ✓ Validate removeSeriesFromUniverse ownership — rejects if series doesn't belong to specified universe
- ✓ Remove active-project fallback in resolveHierarchyPath — no getSeriesFolder() fallback
- ✓ Wire Codex inheritance — added loadInheritedFolders to CodexManager, called from main.ts
- ✓ Fix UniverseSelector DOM ordering — headers inserted before children via insertAdjacentElement
- ✓ Show hierarchy even with single project — removed single-project early return
- ✓ Add 4 integration tests: exclusive membership both sides, ownership validation, idempotent add, active-project fallback
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 100/100 tests pass (96 existing + 4 new)
- ✓ Typecheck verification — no new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 5: Fix Codex Inheritance Bugs
Fix two functional bugs in Codex inheritance: resolveInheritedCollections('all') scanning wrong folder, and refresh paths losing inherited entries.

- ✓ Add getInheritedCodexFolders to UniverseManager — returns parent Codex folder paths directly, no string manipulation
- ✓ Fix main.ts startup — uses getInheritedCodexFolders instead of broken resolveInheritedCollections('all')
- ✓ Fix performRefreshOpenViews — restores inherited codex after loadAll clears entries
- ✓ Add 8 integration tests: getInheritedCodexFolders (3), Codex inheritance end-to-end (5)
- ✓ Tests cover: non-Characters categories, empty parent folders, duplicate UUID conflicts, book-level precedence, project switching
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 108/108 tests pass (100 existing + 8 new)
- ✓ Typecheck verification — no new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 6: Fix Codex Lifecycle Bug and Replace Tests
Fix reloadEntities() losing inherited codex, add id parsing to CodexManager, and replace fake end-to-end tests with real CodexManager tests.

- ✓ Fix reloadEntities() in main.ts — restores inherited codex after loadAll() clears entries
- ✓ Add id field parsing to CodexManager.parseEntry — extracts id from frontmatter
- ✓ Add parseYaml/stringifyYaml to obsidian mock — enables real frontmatter parsing in tests
- ✓ Replace 5 fake end-to-end tests with 7 real CodexManager tests that instantiate the manager
- ✓ Tests cover: inherited entries from universe+series, empty parent folders, duplicate UUID conflicts, book-level precedence, project switching, reload cycles, same-name different-ID entities
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 110/110 tests pass (103 existing + 7 new)
- ✓ Typecheck verification — no new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 7: Implement Phase 2 — TimeSpan and Events
### ✓ Step 8: Project Library UX and Final UI Polish
Complete the Project Library redesign, Event UX improvements, and navigation fixes.

- ✓ Redesign UniverseView and UniverseSelector — replaced 16:9 cover banner with portrait-oriented book cards (2:3 aspect ratio), fallback covers with deterministic colors and initials, expandable Universe/Series groupings, proper empty states, and responsive grid layout
- ✓ Fix ribbon icon — restored `storyline-logo` icon for Project Library (was `book-open-text`)
- ✓ Event creation scope selection — added dropdown in Event browser for choosing Book/Series/Universe scope when creating Events
- ✓ Fix EventSelectorModal cancellation — Cancel now returns null (not modified selections), Escape key resolves promise safely via onClose
- ✓ Fix EventModal lifecycle — added onClose handler so Escape key resolves promise with null instead of hanging
- ✓ Inspector Event linking — handles null return from cancelled EventSelectorModal
- ✓ CSS redesign — complete rewrite of Project Library styles: card grid, portrait covers, fallback initials, hover effects, active selection outline, empty states, responsive breakpoints
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 209/209 tests pass
- ✓ Typecheck verification — no new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 9: Fix Project Library Navigation and Integrate Events
Fix seven reported UI integration issues: duplicate modals, book card navigation, live-refresh, cover editing, Events in Codex/BoardView, Event modal save regression, and integration tests.

- ✓ Fix duplicate project creation modals — added `_newProjectModalOpen` guard with try/finally cleanup and button disable during creation
- ✓ Book card opens BoardView — click handler now calls `setActiveProject`, `refreshOpenViews(true)`, then `activateView(BOARD_VIEW_TYPE)`
- ✓ Live-refresh Project Library — added `UNIVERSE_VIEW_TYPE` to `performRefreshOpenViews` viewTypes array
- ✓ Restore book cover editing — pencil icon on each book card's cover opens ImagePicker, persists via `saveProjectFrontmatter`, with `stopPropagation` to avoid triggering card click
- ✓ Events in Codex — added "Events" pseudo-tab in CodexView with `renderEventsList` showing all events with TimeSpan and scope badges, click-to-edit via `openEditEventModal`
- ✓ Events in BoardView — added "+ New Event" button next to "+ New Scene" in Kanban mode
- ✓ Removed Events ribbon icon — no longer the primary Events entry point
- ✓ Fix EventModal save regression — all button handlers (save/cancel/delete) now set `resolved=true` and call `resolve()` BEFORE `this.close()`, so `onClose()` never preempts the result
- ✓ Fix EventSelectorModal save regression — same fix: resolved before close for both save and cancel
- ✓ 13 integration tests — Event modal lifecycle (4), project creation guard (1), BoardView navigation (1), Events in Codex (2), ribbon icon removal (1), live refresh (1), cover editing (2), BoardView New Event (1)
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 222/222 tests pass (209 existing + 13 new)
- ✓ Typecheck verification — no new errors in changed files; pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch

### ✓ Step 10: Phase 3 Milestone 1 — Integrate Events into Existing Timeline
Integrate canonical Events into the existing TimelineView, fix Codex dropdown, and add behavioral tests.

- ✓ Add "+ New Event" button in TimelineView toolbar — opens EventModal, refreshes timeline after creation
- ✓ Add Events to ViewSwitcher Codex dropdown — opens CodexView with 'events' category selected
- ✓ Render Events alongside Scenes in TimelineView linear mode — distinct visual styling, non-draggable, click-to-edit
- ✓ Render Events in swimlane mode — dedicated "Canonical Events" lane at the end
- ✓ Fix EventManager.getEventsInRange — uses TimeSpanService.getEarliestPoint safely, no `as any` casts
- ✓ Preserve Reading Order — Events appended after Scenes with "Canonical Events" divider
- ✓ Preserve Chronological Order — Scenes and Events interleaved by TimeSpan, unknown dates sort last
- ✓ TimeSpanService.getEarliestPoint and compareTimestamps made public for TimelineView/EventManager access
- ✓ CSS styling — event cards with accent border, event dots, uncertain/unknown badges, swimlane event cards
- ✓ Empty state updated — mentions both scenes and events
- ✓ 23 integration tests: TimeSpan placement (6), chronological sorting (3), EventManager range queries (3), TimeSpan edge cases (5), swimlane mode (1), reading order (2), inherited events (1), ViewSwitcher (1), toolbar (1)
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 245/245 tests pass (222 existing + 23 new)
- ✓ Typecheck verification — no new errors; pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch
Implement the shared TimeSpan model, Event entities, Scene-Event references, Event UI, and validation.

- ✓ Create services/TimeSpanService.ts — Full implementation: Gregorian calendar adapter, parsing all 6 TimeSpan kinds, comparison, overlap detection, contains, relative date resolution with chain accumulation, legacy storyDate/storyTime migration, display formatting, validateTimestamp, validateTimeSpan
- ✓ TimeSpanService: fixed date arithmetic — proper month/year boundary handling, leap year support, day clamping for month overflow
- ✓ TimeSpanService: added serializeToYaml/deserializeFromYaml — lossless TimeSpan round-trips through YAML for all 6 variants
- ✓ TimeSpanService: added validateTimestamp/validateTimeSpan — Gregorian date validation, leap year checks, month/day range, interval ordering, calendar verification
- ✓ TimeSpanService: made shiftTimestamp and parseTimestamp public for test access
- ✓ Create models/Event.ts (114 lines) — Event model with timeSpan, location, participants, ownerId, introducedIn, createEvent factory
- ✓ Rewrite services/EventManager.ts — Uses Obsidian parseYaml/stringifyYaml, TimeSpan serialization in frontmatter, body preservation, unknown frontmatter field preservation, setTimeSpanService, deleteEvent, buildEventContent
- ✓ Update models/Scene.ts — Added optional timeSpan and eventRefs fields
- ✓ Update services/MetadataParser.ts — Added parseTimeSpan for reading TimeSpan from Scene frontmatter, eventRefs parsing, and timeSpan/eventRefs serialization in generateSceneContent
- ✓ Create components/TimeSpanPicker.ts (447 lines) — UI for selecting all 6 TimeSpan kinds with Obsidian Setting API
- ✓ Create components/EventCard.ts (92 lines) — Event rendering component for views
- ✓ Create components/EventModal.ts (368 lines) — EventModal (create/edit/delete) and EventSelectorModal (multi-select Event linking for Scenes)
- ✓ Add SceneManager.getBookEventsFolder() — Book-level Events folder resolution (independent of Series/Universe)
- ✓ Add UniverseManager.getInheritedEventFolders() — Universe/Series event inheritance
- ✓ Wire up in main.ts — TimeSpanService + EventManager initialization, loadActiveProjectEvents on startup/reload/refresh, Event commands (create-event, browse-events), Event modal integration
- ✓ Fix Event hierarchy loading — getBookEventsFolder() loads book events independently; loadInheritedFolders loads Series/Universe without duplication
- ✓ Fix Event save data preservation — saveEvent preserves unknown frontmatter fields and Markdown body content
- ✓ Fix buildEventContent — proper YAML frontmatter formatting with trailing newline
- ✓ Add styles.css — Event modal and browser styling
- ✓ 46 tests for TimeSpanService: parsing (11), formatting (7), comparison (5), overlap (7), contains (4), relative resolution (5), legacy migration (4), calendar registration (3)
- ✓ 24 tests for EventManager: TimeSpan round-trips (6), persistence (4), CRUD (6), duplicate UUID detection (1), date arithmetic (6), overlap queries (1)
- ✓ 24 new integration tests: Event hierarchy loading (3), Event persistence (5), Scene-Event integration (3), TimeSpan validation (9), TimeSpan arithmetic edge cases (4)
- ✓ Build verification — pnpm run build passes
- ✓ Test verification — 204/204 tests pass (180 existing + 24 new)
- ✓ Typecheck verification — no new errors; 18 pre-existing baseline errors unchanged
- ✓ Committed to feat/rework branch