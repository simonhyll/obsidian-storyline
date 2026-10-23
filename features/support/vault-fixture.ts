/**
 * Vault fixture — creates test fixtures for StoryLine vault structures.
 */
import type { StoryLineProject } from '../../src/models/StoryLineProject';
import { deriveProjectFoldersFromFilePath } from '../../src/models/StoryLineProject';
import type { Scene } from '../../src/models/Scene';
import type { Event } from '../../src/models/Event';
import { createEvent } from '../../src/models/Event';

/**
 * Create a test book/project fixture.
 */
export function createBook(title: string, bookId: string, universeId: string): StoryLineProject {
  const filePath = `StoryLine/${title}/${title}.md`;
  return {
    title,
    filePath,
    ...deriveProjectFoldersFromFilePath(filePath),
    bookId,
    universeId,
    created: '2024-01-01',
    description: '',
    definedActs: [],
    definedChapters: [],
    actLabels: {},
    chapterLabels: {},
    actDescriptions: {},
    chapterDescriptions: {},
    filterPresets: [],
    corkboardPositions: {},
  };
}

/**
 * Create a test scene fixture.
 */
export function createScene(title: string, storyDate: string, bookId: string, filePath: string): Scene {
  return {
    title,
    storyDate,
    filePath,
    bookId,
    sequence: 1,
    chronologicalOrder: 1,
    content: '',
  } as unknown as Scene;
}

/**
 * Create a test event fixture.
 */
export function createTestEvent(name: string, ownerId: string, dateStr: string): Event {
  return createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId,
    timeSpan: {
      kind: 'instant',
      instant: {
        calendar: 'gregorian',
        year: parseInt(dateStr.split('-')[0]),
        month: parseInt(dateStr.split('-')[1]),
        day: parseInt(dateStr.split('-')[2]),
        precision: 'day',
      },
    },
  });
}
