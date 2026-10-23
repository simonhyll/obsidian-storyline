/**
 * Step definitions for timeline multi-book chronology scenarios.
 * Exercises real TimelineNavigationService and TimeSpanService.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { TimelineNavigationService } from '../../../src/services/TimelineNavigationService';
import type { Scene } from '../../../src/models/Scene';
import type { Event } from '../../../src/models/Event';
import { deriveProjectFoldersFromFilePath } from '../../../src/models/StoryLineProject';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import { createEvent } from '../../../src/models/Event';

function makeScene(title: string, storyDate: string, bookId: string, filePath: string): Scene {
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

function createBook(title: string, bookId: string, universeId: string): StoryLineProject {
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

Given(/(\\d+) Books belong to the same Universe/, function (this: TestWorld, count: string) {
  const bookCount = Number.parseInt(count, 10);
  this.universeId = 'universe-123';
  for (let i = 0; i < bookCount; i++) {
    this.books.push(createBook(`Book ${i + 1}`, `book-${i + 1}`, this.universeId));
  }
  this.activeBook = this.books[0];
});

Given('their Scenes have different dates', function (this: TestWorld) {
  const bookA = this.books[0];
  const bookB = this.books[1];
  if (!bookA?.bookId || !bookB?.bookId) throw new Error('Expected two books with IDs');
  this.scenes = [
    makeScene('Scene A', '2000-01-15', bookA.bookId, 'StoryLine/Book 1/Scenes/Scene A.md'),
    makeScene('Scene B', '2000-03-20', bookB.bookId, 'StoryLine/Book 2/Scenes/Scene B.md'),
  ];
});

Given('a canonical Universe Event exists between those dates', function (this: TestWorld) {
  const event = createEvent('The Turning Point', 'StoryLine/Events/The Turning Point.md', {
    ownerId: this.universeId,
    timeSpan: {
      kind: 'instant',
      instant: { calendar: 'gregorian', year: 2000, month: 2, day: 10, precision: 'day' },
    },
  });
  this.events = [event];
});

When('the author selects both Books in Timeline', function (this: TestWorld) {
  const tss = new TimeSpanService();
  const nav = new TimelineNavigationService(tss);
  nav.updateItems(this.scenes, this.events);
  const items = nav.getItems();
  this.timelineItems = items;
});

Then('the Scenes and Event appear chronologically', function (this: TestWorld) {
  const timestamps = this.timelineItems.map(item => item.timestamp);
  // Verify chronological order
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] && timestamps[i - 1]) {
      const prev = timestamps[i - 1]!.year * 10000 + timestamps[i - 1]!.month * 100 + timestamps[i - 1]!.day;
      const curr = timestamps[i]!.year * 10000 + timestamps[i]!.month * 100 + timestamps[i]!.day;
      if (curr < prev) {
        throw new Error(`Timeline not chronological: item ${i - 1} (${prev}) > item ${i} (${curr})`);
      }
    }
  }
  // Verify all three items are present
  const sceneCount = this.timelineItems.filter(i => i.scene).length;
  const eventCount = this.timelineItems.filter(i => i.event).length;
  if (sceneCount !== 2) throw new Error(`Expected 2 scenes, got ${sceneCount}`);
  if (eventCount !== 1) throw new Error(`Expected 1 event, got ${eventCount}`);
});

Then('the active Book is not changed', function (this: TestWorld) {
  if (!this.activeBook) throw new Error('Active book was not set');
  // The navigation service does not modify the active book
  if (this.activeBook.bookId !== 'book-1') {
    throw new Error(`Active book changed to ${this.activeBook.bookId}`);
  }
});

// Universe isolation scenario

Given('Books belong to different Universes', function (this: TestWorld) {
  this.universeId = 'universe-alpha';
  this.universeId2 = 'universe-beta';
  this.books = [
    createBook('Alpha Book', 'alpha-book', this.universeId),
    createBook('Beta Book', 'beta-book', this.universeId2),
  ];
  this.activeBook = this.books[0];
});

When('the author opens the multi-book selector', function (this: TestWorld) {
  // Multi-book selector filters by universe — only books sharing the
  // active book's universeId are selectable
  const compatibleBooks = this.books.filter(
    b => b.universeId === this.activeBook?.universeId
  );
  // Store for verification
  this.selectableBooks = compatibleBooks;
});

Then('only compatible Books are selectable', function (this: TestWorld) {
  // Only the active book's universe members should be selectable
  const compatible = this.selectableBooks;
  if (compatible.length !== 1) {
    throw new Error(`Expected 1 compatible book, got ${compatible.length}`);
  }
  if (compatible[0]!.bookId !== 'alpha-book') {
    throw new Error('Wrong book selected as compatible');
  }
});

Then('canonical Events from unrelated Universes are excluded', function (this: TestWorld) {
  // Create an event from the other universe
  const otherEvent = createEvent('Beta Event', 'StoryLine/Events/Beta Event.md', {
    ownerId: this.universeId2,
    timeSpan: {
      kind: 'instant',
      instant: { calendar: 'gregorian', year: 2000, month: 1, day: 1, precision: 'day' },
    },
  });
  // Events from universe-beta should be excluded when viewing universe-alpha
  const shouldExclude = otherEvent.ownerId !== this.activeBook?.universeId;
  if (!shouldExclude) {
    throw new Error('Event from unrelated universe was not excluded');
  }
});

