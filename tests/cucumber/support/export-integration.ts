/**
 * Export integration — instantiates the real ExportService with mocked
 * dependencies so that ExportService.export() runs production code for
 * sorting, range filtering, markdown building, and vault file writing.
 *
 * The mocked SceneManager provides scenes and project metadata.
 * CharacterManager and LocationManager return empty collections so the
 * outline sections are minimal. The in-memory vault captures the written
 * export file for verification.
 */
import type { Scene } from '../../../src/models/Scene';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import type { Character } from '../../../src/models/Character';
import type { StoryLocation } from '../../../src/models/Location';
import type { StoryWorld } from '../../../src/models/Location';
import { ExportService } from '../../../src/services/ExportService';
import type { TestVault } from './in-memory-vault';
import { createInMemoryVault } from './in-memory-vault';

/** Minimal SceneQueryService mock that returns the provided scenes. */
interface SceneQueryServiceMock {
  getFilteredScenes(): Scene[];
}

/** Minimal SceneManager mock satisfying ExportService's needs. */
interface SceneManagerMock {
  activeProject: StoryLineProject | null;
  queryService: SceneQueryServiceMock;
  getActLabel(act: number): string;
  getChapterLabel(chapter: number): string;
}

/** Minimal CharacterManager mock. */
interface CharacterManagerMock {
  getAllCharacters(): Character[];
}

/** Minimal LocationManager mock. */
interface LocationManagerMock {
  getAllWorlds(): StoryWorld[];
  getAllLocations(): StoryLocation[];
  getLocationsForWorld(_world: string): StoryLocation[];
  getOrphanLocations(): StoryLocation[];
}

/** Minimal App mock with vault. */
interface AppMock {
  vault: TestVault;
}

export interface ExportTestResult {
  /** Path of the written export file. */
  filePath: string;
  /** Content of the written export file. */
  content: string;
  /** The in-memory vault for further assertions. */
  vault: TestVault;
}

/**
 * Build a mock SceneManager that returns the given scenes and project.
 */
function buildSceneManager(
  project: StoryLineProject,
  scenes: Scene[],
): SceneManagerMock {
  return {
    activeProject: project,
    queryService: {
      getFilteredScenes: () => [...scenes],
    },
    getActLabel: () => '',
    getChapterLabel: () => '',
  };
}

/**
 * Build a mock CharacterManager that returns no characters.
 */
function buildCharacterManager(): CharacterManagerMock {
  return {
    getAllCharacters: () => [],
  };
}

/**
 * Build a mock LocationManager that returns no locations.
 */
function buildLocationManager(): LocationManagerMock {
  return {
    getAllWorlds: () => [],
    getAllLocations: () => [],
    getLocationsForWorld: () => [],
    getOrphanLocations: () => [],
  };
}

/**
 * Create scenes with distinct markers for export testing.
 */
export function buildScenes(
  count: number,
  bookId: string,
  sceneFolder: string,
): Scene[] {
  const scenes: Scene[] = [];
  for (let i = 1; i <= count; i++) {
    scenes.push({
      title: `Scene ${i}`,
      body: `Unique content marker for scene number ${i}.`,
      sequence: i,
      chapter: Math.ceil(i / 2),
      act: 1,
      bookId,
      filePath: `${sceneFolder}/Scene ${i}.md`,
      id: `scene-${i}`,
      ownerId: bookId,
      status: 'draft',
      wordcount: 6,
      tags: [],
      characters: [],
    } as unknown as Scene);
  }
  return scenes;
}

/**
 * Common setup: seed vault, build mocks, and return ExportService instance.
 */
function buildExportService(
  project: StoryLineProject,
  scenes: Scene[],
): { service: ExportService; vault: TestVault } {
  const vault = createInMemoryVault();
  for (const scene of scenes) {
    const content = `---\ntitle: ${scene.title}\n---\n${scene.body}`;
    void vault.create(scene.filePath, content);
  }
  const sceneManager = buildSceneManager(project, scenes);
  const characterManager = buildCharacterManager();
  const locationManager = buildLocationManager();
  const app: AppMock = { vault };
  const service = new ExportService(
    app as any,
    sceneManager as any,
    characterManager as any,
    locationManager as any,
  );
  return { service, vault };
}

/**
 * Read the exported file from the vault and return the result.
 */
async function readExportedFile(vault: TestVault, filePath: string): Promise<ExportTestResult> {
  const exportedFile = vault.getAbstractFileByPath(filePath);
  if (!exportedFile) {
    throw new Error(`Export file not found at ${filePath}`);
  }
  const content = await vault.read(exportedFile);
  return { filePath, content, vault };
}

/**
 * Run the real ExportService.export('md', 'manuscript') and return the
 * written file path and content.
 */
export async function runExport(
  project: StoryLineProject,
  scenes: Scene[],
): Promise<ExportTestResult> {
  const { service, vault } = buildExportService(project, scenes);
  const filePath = await service.export('md', 'manuscript');
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Export returned no file path');
  }
  return readExportedFile(vault, filePath);
}

/**
 * Run export with a range filter.
 */
export async function runExportWithRange(
  project: StoryLineProject,
  scenes: Scene[],
  field: 'sequence' | 'chapter',
  ranges: Array<{ start: number; end: number }>,
): Promise<ExportTestResult> {
  const { service, vault } = buildExportService(project, scenes);
  service.setExportRange({ field, sequenceRanges: ranges });
  const filePath = await service.export('md', 'manuscript');
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Export returned no file path');
  }
  return readExportedFile(vault, filePath);
}

/**
 * Run export with options (includeInactiveScenes, includeCorkboardNotes).
 */
export async function runExportWithOptions(
  project: StoryLineProject,
  scenes: Scene[],
  options: { includeInactiveScenes?: boolean; includeCorkboardNotes?: boolean },
): Promise<ExportTestResult> {
  const { service, vault } = buildExportService(project, scenes);
  if (options.includeInactiveScenes !== undefined) {
    service.setExportOptions({ includeInactiveScenes: options.includeInactiveScenes });
  }
  if (options.includeCorkboardNotes !== undefined) {
    service.setExportOptions({ includeCorkboardNotes: options.includeCorkboardNotes });
  }
  const filePath = await service.export('md', 'manuscript');
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Export returned no file path');
  }
  return readExportedFile(vault, filePath);
}

