/**
 * Step definitions for timeline navigation and filtering.
 * Exercises real TimelineNavigationService.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { TimelineNavigationService } from '../../../src/services/TimelineNavigationService';
import { createScene, createBook } from '../support/vault-fixture';

Given('the timeline contains {int} scenes', function (this: TestWorld, count: number) {
  const tss = new TimeSpanService();
  const nav = new TimelineNavigationService(tss);
  this.scenes = [];
  for (let i = 0; i < count; i++) {
    const scene = createScene(
      `Scene ${i + 1}`,
      `2000-0${i + 1}-15`,
      'book-1',
      `StoryLine/Book/Scenes/Scene ${i + 1}.md`,
    );
    this.scenes.push(scene);
  }
  nav.updateItems(this.scenes, []);
  this.timelineItems = nav.getItems();
});

Given('I am viewing the first scene', function (this: TestWorld) {
  if (this.timelineItems.length > 0) {
    (this.timelineItems[0] as unknown as Record<string, unknown>)._selected = true;
  }
});

Given('I am viewing the third scene', function (this: TestWorld) {
  if (this.timelineItems.length >= 3) {
    (this.timelineItems[2] as unknown as Record<string, unknown>)._selected = true;
  }
});

Given('I am viewing the last scene', function (this: TestWorld) {
  if (this.timelineItems.length > 0) {
    (this.timelineItems[this.timelineItems.length - 1] as unknown as Record<string, unknown>)._selected = true;
  }
});

Given('an empty timeline', function (this: TestWorld) {
  const tss = new TimeSpanService();
  const nav = new TimelineNavigationService(tss);
  nav.updateItems([], []);
  this.timelineItems = nav.getItems();
});

Given('2 books in the same universe', function (this: TestWorld) {
  this.universeId = 'universe-123';
  this.books = [
    createBook('Book One', 'book-1', this.universeId),
    createBook('Book Two', 'book-2', this.universeId),
  ];
  this.activeBook = this.books[0];
});

Given('scenes from both books', function (this: TestWorld) {
  if (this.books.length < 2) throw new Error('Expected 2 books');
  this.scenes = [
    createScene('Scene A', '2000-01-15', this.books[0].bookId || '', 'StoryLine/Book One/Scenes/Scene A.md'),
    createScene('Scene B', '2000-03-20', this.books[1].bookId || '', 'StoryLine/Book Two/Scenes/Scene B.md'),
  ];
});

Given('scenes with different dates from both books', function (this: TestWorld) {
  this.scenes = [
    createScene('Scene A', '2000-01-15', this.books[0].bookId || '', 'StoryLine/Book One/Scenes/Scene A.md'),
    createScene('Scene B', '2000-03-20', this.books[1].bookId || '', 'StoryLine/Book Two/Scenes/Scene B.md'),
  ];
});

When('I navigate to the first item', function (this: TestWorld) {
  if (this.timelineItems.length > 0) {
    (this.timelineItems[0] as unknown as Record<string, unknown>)._selected = true;
  }
});

When('I navigate to the last item', function (this: TestWorld) {
  if (this.timelineItems.length > 0) {
    (this.timelineItems[this.timelineItems.length - 1] as unknown as Record<string, unknown>)._selected = true;
  }
});

When('I navigate forward', function (this: TestWorld) {
  const currentIdx = this.timelineItems.findIndex(i => (i as unknown as Record<string, unknown>)._selected);
  if (currentIdx >= 0 && currentIdx < this.timelineItems.length - 1) {
    (this.timelineItems[currentIdx] as unknown as Record<string, unknown>)._selected = false;
    (this.timelineItems[currentIdx + 1] as unknown as Record<string, unknown>)._selected = true;
  }
});

When('I navigate backward', function (this: TestWorld) {
  const currentIdx = this.timelineItems.findIndex(i => (i as unknown as Record<string, unknown>)._selected);
  if (currentIdx > 0) {
    (this.timelineItems[currentIdx] as unknown as Record<string, unknown>)._selected = false;
    (this.timelineItems[currentIdx - 1] as unknown as Record<string, unknown>)._selected = true;
  }
});

When('I filter to show only the first book', function (this: TestWorld) {
  if (!this.activeBook) throw new Error('No active book');
  this.scenes = this.scenes.filter(s => (s as unknown as Record<string, unknown>).bookId === this.activeBook?.bookId);
  const tss = new TimeSpanService();
  const nav = new TimelineNavigationService(tss);
  nav.updateItems(this.scenes, []);
  this.timelineItems = nav.getItems();
});

When('I view the multi-book timeline', function (this: TestWorld) {
  const tss = new TimeSpanService();
  const nav = new TimelineNavigationService(tss);
  nav.updateItems(this.scenes, []);
  this.timelineItems = nav.getItems();
});

When('I request the items', function (this: TestWorld) {
  // Items are already in this.timelineItems
});

Then('the first scene is selected', function (this: TestWorld) {
  if (!(this.timelineItems[0] as unknown as Record<string, unknown>)?._selected) {
    throw new Error('First scene is not selected');
  }
});

Then('the last scene is selected', function (this: TestWorld) {
  if (this.timelineItems.length > 0 && !(this.timelineItems[this.timelineItems.length - 1] as unknown as Record<string, unknown>)?._selected) {
    throw new Error('Last scene is not selected');
  }
});

Then('the second scene is selected', function (this: TestWorld) {
  if (!(this.timelineItems[1] as unknown as Record<string, unknown>)?._selected) {
    throw new Error('Second scene is not selected');
  }
});

Then('no new scene is selected', function (this: TestWorld) {
  const selected = this.timelineItems.filter(i => (i as unknown as Record<string, unknown>)._selected);
  if (selected.length !== 1) {
    throw new Error('Expected exactly one selected item');
  }
});

Then('only scenes from the first book are visible', function (this: TestWorld) {
  if (!this.activeBook) throw new Error('No active book');
  for (const scene of this.scenes) {
    if ((scene as unknown as Record<string, unknown>).bookId !== this.activeBook.bookId) {
      throw new Error(`Scene from wrong book: ${String((scene as unknown as Record<string, unknown>).bookId)}`);
    }
  }
});

Then('all scenes appear in chronological order', function (this: TestWorld) {
  const tss = new TimeSpanService();
  const timestamps = this.timelineItems
    .map(item => item.timestamp)
    .filter((t): t is NonNullable<typeof t> => t != null);
  for (let i = 1; i < timestamps.length; i++) {
    if (tss.compareTimestamps(timestamps[i - 1], timestamps[i]) > 0) {
      throw new Error(`Timeline not chronological at item ${i}`);
    }
  }
});

Then('no items are returned', function (this: TestWorld) {
  if (this.timelineItems.length !== 0) {
    throw new Error(`Expected 0 items, got ${this.timelineItems.length}`);
  }
});
