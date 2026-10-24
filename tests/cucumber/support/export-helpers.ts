/**
 * Export test helpers — production-owned export logic for testing.
 *
 * Because ExportService imports DocxConverter (requires Obsidian's requestUrl),
 * we cannot instantiate it in Node.js. These helpers reproduce the same
 * sorting, filtering, and markdown-building logic used by the real ExportService.
 */
import type { Scene } from '../../../src/models/Scene';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import { deriveProjectFoldersFromFilePath } from '../../../src/models/StoryLineProject';
import { compareActChapter, getActDisplayLabel } from '../../../src/utils/actChapter';
import { createInMemoryVault } from './in-memory-vault';

export interface SceneParams {
  title: string;
  body: string;
  sequence: number;
  chapter: number;
  bookId: string;
  filePath: string;
}

export function buildScene(p: SceneParams): Scene {
  return {
    title: p.title,
    body: p.body,
    sequence: p.sequence,
    chapter: p.chapter,
    act: 1,
    bookId: p.bookId,
    filePath: p.filePath,
    id: `scene-${p.sequence}`,
    ownerId: p.bookId,
    status: 'draft',
    wordcount: p.body.split(/\s+/).filter(Boolean).length,
    tags: [],
    characters: [],
    content: p.body,
  } as unknown as Scene;
}

export function buildBook(title: string, bookId: string): StoryLineProject {
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

export function sortScenes(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) => {
    const actCmp = compareActChapter(a.act, b.act);
    if (actCmp !== 0) return actCmp;
    const chCmp = compareActChapter(a.chapter, b.chapter);
    if (chCmp !== 0) return chCmp;
    return (a.sequence ?? 9999) - (b.sequence ?? 9999);
  });
}

export function filterByRange(
  scenes: Scene[],
  field: 'sequence' | 'chapter',
  ranges: Array<{ start: number; end: number }>,
): Scene[] {
  return scenes.filter((scene) => {
    const rawValue = field === 'sequence' ? scene.sequence : scene.chapter;
    if (rawValue === undefined) return false;
    const value = Number(rawValue);
    return Number.isFinite(value) && ranges.some((r) => value >= r.start && value <= r.end);
  });
}

function appendActHeading(
  lines: string[],
  act: string | number,
  actLabels: Record<number, string>,
): void {
  const actLabel = actLabels[Number(act)] || '';
  const actDisplay = getActDisplayLabel(act);
  lines.push(actLabel ? `## ${actDisplay}: ${actLabel}` : `## ${actDisplay}`);
  lines.push('');
}

function appendChapterHeading(
  lines: string[],
  chapter: string | number,
  chapterLabels: Record<number, string>,
): void {
  const chapLabel = chapterLabels[Number(chapter)] || '';
  lines.push(
    chapLabel ? `### Chapter ${chapter}: ${chapLabel}` : `### Chapter ${chapter}`,
  );
  lines.push('');
}

function appendSceneBlock(lines: string[], scene: Scene): void {
  lines.push(`#### ${scene.title || 'Untitled Scene'}`);
  lines.push('');
  if (scene.body && scene.body.trim()) {
    lines.push(scene.body.trim());
  } else {
    lines.push('*No content yet.*');
  }
  lines.push('');
}

export function buildManuscriptMd(
  book: StoryLineProject,
  scenes: Scene[],
  actLabels: Record<number, string>,
  chapterLabels: Record<number, string>,
): string {
  const lines: string[] = [`# ${book.title}`, ''];
  let currentAct: string | number | undefined;
  let currentChapter: string | number | undefined;

  for (const scene of scenes) {
    if (scene.act !== undefined && scene.act !== currentAct) {
      currentAct = scene.act;
      appendActHeading(lines, currentAct, actLabels);
      currentChapter = undefined;
    }
    if (scene.chapter !== undefined && scene.chapter !== currentChapter) {
      currentChapter = scene.chapter;
      appendChapterHeading(lines, currentChapter, chapterLabels);
    }
    appendSceneBlock(lines, scene);
  }
  return lines.join('\n');
}

export async function writeExportFile(
  vault: ReturnType<typeof createInMemoryVault>,
  book: StoryLineProject,
  content: string,
  label: string,
): Promise<string> {
  const projectFolder = book.sceneFolder.replace(/\/Scenes\/?$/, '');
  const exportFolder = `${projectFolder}/Exports`;
  const timestamp = new Date().toISOString().replace(/T.*$/, '');
  const filename = `${book.title} - ${label} (${timestamp}).md`;
  const filePath = `${exportFolder}/${filename}`;
  await vault.createFolder(exportFolder);
  await vault.create(filePath, content);
  return filePath;
}
