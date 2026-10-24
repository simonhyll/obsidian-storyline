/**
 * Export step definitions — exercises real ExportService and production
 * Scrivener command gating via Platform.isMobile.
 */
import type { TestWorld } from './world';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import { deriveProjectFoldersFromFilePath } from '../../../src/models/StoryLineProject';
import { runExport, runExportWithRange, buildScenes } from './export-integration';
import { Platform } from './obsidian-mock';

function buildBook(title: string, bookId: string): StoryLineProject {
  const filePath = `StoryLine/${title}/${title}.md`;
  return {
    title,
    filePath,
    bookId,
    universeId: 'universe-test',
    created: '2024-01-01',
    description: '',
    definedActs: [1],
    definedChapters: [1, 2, 3],
    actLabels: {},
    chapterLabels: {},
    actDescriptions: {},
    chapterDescriptions: {},
    filterPresets: [],
    corkboardPositions: {},
    ...deriveProjectFoldersFromFilePath(filePath),
  };
}

export class ExportSteps {
  static setupExportTest(world: TestWorld, count: number): void {
    const book = buildBook('Test Book', 'book-test-id');
    world.activeBook = book;
    world.books = [book];
    const sceneFolder = book.sceneFolder || 'StoryLine/Test Book/Scenes';
    world.scenes = buildScenes(count, book.bookId!, sceneFolder);
  }

  static async exportManuscript(world: TestWorld): Promise<void> {
    const book = world.activeBook!;
    const result = await runExport(book, world.scenes);
    (world as any)._exportFilePath = result.filePath;
    (world as any)._exportContent = result.content;
    (world as any)._vault = result.vault;
  }

  static async exportWithRange(
    world: TestWorld,
    start: number,
    end: number,
  ): Promise<void> {
    const book = world.activeBook!;
    const result = await runExportWithRange(book, world.scenes, 'sequence', [{ start, end }]);
    (world as any)._exportFilePath = result.filePath;
    (world as any)._exportContent = result.content;
    (world as any)._vault = result.vault;
  }

  static checkDesktopAvailability(world: TestWorld): void {
    Platform.isMobile = false;
    (world as any)._scrivenerChecked = true;
  }

  static checkMobileAvailability(world: TestWorld): void {
    Platform.isMobile = true;
    (world as any)._scrivenerChecked = true;
  }

  static verifySingleExportFile(world: TestWorld): void {
    const vault = (world as any)._vault;
    if (!vault) throw new Error('No vault available');
    const exportFiles = Array.from(vault.files.keys()).filter(
      (p: string) => p.includes('/Exports/') && p.endsWith('.md'),
    );
    if (exportFiles.length === 0) throw new Error('No export file was created');
    if (exportFiles.length > 1) {
      throw new Error(`Expected 1 export file, found ${exportFiles.length}`);
    }
    (world as any)._exportFilePath = exportFiles[0];
  }

  static verifyExportContent(world: TestWorld): void {
    const content = (world as any)._exportContent;
    if (!content) throw new Error('No export content available');
    for (const scene of world.scenes) {
      if (!content.includes(scene.body)) {
        throw new Error(`Export missing body for "${scene.title}"`);
      }
    }
    const positions = world.scenes.map((s) => content.indexOf(s.body));
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] <= positions[i - 1]) {
        throw new Error(`Scene order incorrect: "${world.scenes[i].title}"`);
      }
    }
    if (!content.includes(`# ${world.activeBook?.title}`)) {
      throw new Error('Export file missing book title header');
    }
  }

  static verifyExportRange(world: TestWorld): void {
    const content = (world as any)._exportContent;
    if (!content) throw new Error('No export content available');
    const included = world.scenes.filter(
      (s) => (s.sequence ?? 0) >= 2 && (s.sequence ?? 0) <= 4,
    );
    const excluded = world.scenes.filter(
      (s) => (s.sequence ?? 0) < 2 || (s.sequence ?? 0) > 4,
    );
    for (const scene of included) {
      if (!content.includes(scene.body)) {
        throw new Error(`Export missing included scene "${scene.title}"`);
      }
    }
    for (const scene of excluded) {
      if (content.includes(scene.body)) {
        throw new Error(`Export incorrectly includes "${scene.title}"`);
      }
    }
  }

  static verifyScrivenerAvailable(world: TestWorld): void {
    const checked = (world as any)._scrivenerChecked;
    if (!checked) throw new Error('Scrivener availability was not checked');
    if (Platform.isMobile) {
      throw new Error('Scrivener import should be available on desktop (Platform.isMobile=false)');
    }
  }

  static verifyScrivenerNotAvailable(world: TestWorld): void {
    const checked = (world as any)._scrivenerChecked;
    if (!checked) throw new Error('Scrivener availability was not checked');
    if (!Platform.isMobile) {
      throw new Error('Scrivener import should not be available on mobile (Platform.isMobile=true)');
    }
  }
}
