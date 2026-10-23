/**
 * Cucumber test world — holds shared state between steps.
 * Uses real production services with mocked Obsidian vault.
 */
import type { TimelineNavItem } from '../../src/services/TimelineNavigationService';
import type { Event } from '../../src/models/Event';
import type { Scene } from '../../src/models/Scene';
import type { StoryLineProject } from '../../src/models/StoryLineProject';
import type { TimeSpan } from '../../src/models/TimeSpan';

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
  /** Simulated compatible Book choice, not a rendered Obsidian selector */
  selectableBooks: StoryLineProject[];
  /** Whether the last creation was cancelled */
  cancelled: boolean;
  /** Files before creation (for cancellation verification) */
  filesBeforeCreation: Map<string, string>;
  /** Event name for event creation scenarios */
  eventName?: string;
  /** TimeSpan for date-related scenarios */
  timeSpan?: TimeSpan;
  /** Characters created during the scenario */
  characters: any[];
  /** Locations created during the scenario */
  locations: any[];
  /** Codex categories */
  codexCategories: string[];
  /** Project settings */
  settings: Map<string, string>;
  /** Changelog preview output */
  changelogOutput?: string;
  /** Last error thrown */
  lastError?: Error;
  /** Created project result */
  createdProject?: StoryLineProject;
  /** Form state for project creation */
  formState?: any;
  /** Dropdown request IDs for race condition tests */
  dropdownRequestIds: number[];
  /** Series list for dropdown tests */
  seriesList: any[];
  /** Universes list */
  universesList: any[];
}
