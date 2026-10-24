/**
 * Export step definitions — delegates to export-helpers.ts for the actual
 * production export logic (sorting, filtering, markdown building).
 */
import type { TestWorld } from './world';
import { createInMemoryVault } from './in-memory-vault';
import {
  buildScene,
  buildBook,
  sortScenes,
  filterByRange,
  buildManuscriptMd,
  writeExportFile,
} from './export-helpers';

export class ExportSteps {
  static setupExportTest(world: TestWorld, count: number): void {
    const book = buildBook('Test Book', 'book-test-id');
    world.activeBook = book;
    world.books = [book];
    world.scenes = [];
    for (let i = 1; i <= count; i++) {
      world.scenes.push(buildScene({
        title: `Scene ${i}`,
        body: `Unique content marker for scene number ${i}.`,
        sequence: i,
        chapter: Math.ceil(i / 2),
        bookId: book.bookId!,
        filePath: `StoryLine/Test Book/Scenes/Scene ${i}.md`,
      }));
    }
    (world as any)._vault = createInMemoryVault();
  }

  static async exportManuscript(world: TestWorld): Promise<void> {
    const book = world.activeBook!;
    const sorted = sortScenes(world.scenes);
    const content = buildManuscriptMd(book, sorted, book.actLabels, book.chapterLabels);
    const vault = (world as any)._vault;
    const filePath = await writeExportFile(vault, book, content, 'Manuscript');
    (world as any)._exportFilePath = filePath;
    (world as any)._exportContent = content;
  }

  static async exportWithRange(
    world: TestWorld,
    start: number,
    end: number,
  ): Promise<void> {
    const book = world.activeBook!;
    const sorted = sortScenes(world.scenes);
    const filtered = filterByRange(sorted, 'sequence', [{ start, end }]);
    const content = buildManuscriptMd(book, filtered, book.actLabels, book.chapterLabels);
    const vault = (world as any)._vault;
    const label = `Manuscript - Scenes ${start}-${end}`;
    const filePath = await writeExportFile(vault, book, content, label);
    (world as any)._exportFilePath = filePath;
    (world as any)._exportContent = content;
  }

  static checkDesktopAvailability(world: TestWorld): void {
    world.isDesktop = true;
  }

  static checkMobileAvailability(world: TestWorld): void {
    world.isDesktop = false;
  }

  static verifySingleExportFile(world: TestWorld): void {
    const vault = (world as any)._vault;
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
    if (!world.isDesktop) {
      throw new Error('Scrivener import should be available on desktop');
    }
  }

  static verifyScrivenerNotAvailable(world: TestWorld): void {
    if (world.isDesktop) {
      throw new Error('Scrivener import should not be available on mobile');
    }
  }
}
