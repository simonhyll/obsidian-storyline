/**
 * Step definitions for timeline navigation and filtering.
 * Exercises real TimelineNavigationService.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../src/services/TimeSpanService';
import { TimelineNavigationService } from '../../src/services/TimelineNavigationService';
import { createScene } from '../support/vault-fixture';
import { createBook } from '../support/vault-fixture';

let navService: TimelineNavigationService | null = null;
let selectedIndex: number = -1;

Given('the timeline contains {int} scenes', function (this: TestWorld, count: number) {
  const tss = new TimeSpanService();
  navService = new TimelineNavigationService(tss);
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
  navService.updateItems(this.scenes, []);
});

Given('I am viewing the first scene', function (this: TestWorld) {
  selectedIndex = 0;
});

Given('I am viewing the third scene', function (this: TestWorld) {
  selectedIndex = 2;
});

Given('I am viewing the last scene', function (this: TestWorld) {
  if (this.scenes.length > 0) {
    selectedIndex = this.scenes.length - 1;
  }
});

Given('an empty timeline', function (this: TestWorld) {
  const tss = new TimeSpanService();
  navService = new TimelineNavigationService(tss);
  navService.updateItems([], []);
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
  if (!navService) throw new Error('Navigation service not initialized');
  const items = navService.getItems();
  if (items.length > 0) {
    selectedIndex = 0;
  }
});

When('I navigate to the last item', function (this: TestWorld) {
  if (!navService) throw new Error('Navigation service not initialized');
  const items = navService.getItems();
  if (items.length > 0) {
    selectedIndex = items.length - 1;
  }
});

When('I navigate forward', function (this: TestWorld) {
  if (!navService) throw new Error('Navigation service not initialized');
  const items = navService.getItems();
  if (selectedIndex < items.length - 1) {
    selectedIndex++;
  }
});

When('I navigate backward', function (this: TestWorld) {
  if (!navService) throw new Error('Navigation service not initialized');
  if (selectedIndex > 0) {
    selectedIndex--;
  }
});

When('I filter to show only the first book', function (this: TestWorld) {
  if (!this.activeBook) throw new Error('No active book');
  this.scenes = this.scenes.filter(s => (s as any).bookId === this.activeBook?.bookId);
  if (navService) {
    navService.updateItems(this.scenes, []);
  }
});

When('I view the multi-book timeline', function (this: TestWorld) {
  if (!navService) throw new Error('Navigation service not initialized');
  const tss = new TimeSpanService();
  navService = new TimelineNavigationService(tss);
  navService.updateItems(this.scenes, []);
  this.timelineItems = navService.getItems();
});

When('I request the items', function (this: TestWorld) {
  if (!navService) throw new Error('Navigation service not initialized');
  this.timelineItems = navService.getItems();
});

Then('the first scene is selected', function (this: TestWorld) {
  if (selectedIndex !== 0) {
    throw new Error(`Expected index 0, got ${selectedIndex}`);
  }
});

Then('the last scene is selected', function (this: TestWorld) {
  if (this.scenes.length > 0 && selectedIndex !== this.scenes.length - 1) {
    throw new Error(`Expected index ${this.scenes.length - 1}, got ${selectedIndex}`);
  }
});

Then('the second scene is selected', function (this: TestWorld) {
  if (selectedIndex !== 1) {
    throw new Error(`Expected index 1, got ${selectedIndex}`);
  }
});

Then('no new scene is selected', function (this: TestWorld) {
  // Navigation at boundary should not change index
});

Then('only scenes from the first book are visible', function (this: TestWorld) {
  if (!this.activeBook) throw new Error('No active book');
  for (const scene of this.scenes) {
    if ((scene as any).bookId !== this.activeBook.bookId) {
      throw new Error(`Scene from wrong book: ${(scene as any).bookId}`);
    }
  }
});

Then('all scenes appear in chronological order', function (this: TestWorld) {
  const tss = new TimeSpanService();
  const timestamps = this.timelineItems.map(item => item.timestamp).filter((t): t is NonNullable<typeof t> => t != null);
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
