/**
 * Cucumber test world — holds per-scenario state.
 * All mutable state lives here; step definitions must NOT use module-level variables.
 */
import type { TimelineNavItem } from '../../src/services/TimelineNavigationService';
import type { Event } from '../../src/models/Event';
import type { Scene } from '../../src/models/Scene';
import type { StoryLineProject } from '../../src/models/StoryLineProject';
import type { TimeSpan } from '../../src/models/TimeSpan';
import type { CreationFormState } from '../../src/services/projectCreation';

export interface TestWorld {
  /** Scenes created during the scenario */
  scenes: Scene[];
  /** Events created during the scenario */
  events: Event[];
  /** Books/projects created during the scenario */
  books: StoryLineProject[];
  /** Universe ID shared by books in the same universe */
  universeId: string | undefined;
  /** Second universe ID for cross-universe tests */
  universeId2: string | undefined;
  /** Active book (simulates active project) */
  activeBook: StoryLineProject | undefined;
  /** Files that would be created (simulated filesystem) */
  createdFiles: Map<string, string>;
  /** Timeline items after sorting (scenes + events merged) */
  timelineItems: TimelineNavItem[];
  /** Simulated compatible Book choice */
  selectableBooks: StoryLineProject[];
  /** Whether the last creation was cancelled */
  cancelled: boolean;
  /** Files before creation (for cancellation verification) */
  filesBeforeCreation: Map<string, string>;
  /** Event name for event creation scenarios */
  eventName?: string;
  /** TimeSpan for date-related scenarios */
  timeSpan?: TimeSpan;
  /** Project settings */
  settings: Map<string, string>;
  /** Changelog preview output */
  changelogOutput?: string;
  /** Changelog error output */
  changelogError?: string;
  /** Last error thrown */
  lastError?: Error;
  /** Created project result */
  createdProject?: StoryLineProject;
  /** Form state for project creation */
  formState?: CreationFormState;
  /** Series list for dropdown tests */
  seriesList: Array<{ name: string; seriesUuid: string }>;
  /** Universes list */
  universesList: Array<{ id: string; name: string }>;
  /** Last parsed TimeSpan (for timespan steps) */
  lastParseResult?: TimeSpan | null;
  /** Comparison result (for timespan steps) */
  compareResult?: number;
  /** Last validation error (for timespan steps) */
  lastValidationError?: string | null;
  /** Exported file count (for export steps) */
  exportedCount?: number;
  /** Whether platform is desktop (for import-export steps) */
  isDesktop?: boolean;
  /** Book title entered for project creation */
  bookTitle?: string;
  /** Series name entered for project creation */
  seriesName?: string;
  /** Universe name entered for project creation */
  universeName?: string;
  /** Number of times create was called (concurrency guard) */
  createCount?: number;
  /** Last event for management steps */
  lastEvent?: Event;
  /** Scene title for scene steps */
  sceneTitle?: string;
  /** Scene UUID for scene steps */
  sceneUuid?: string;
}
