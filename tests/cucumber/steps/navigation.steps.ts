/**
 * Step definitions for timeline navigation and filtering.
 *
 * Exercises real TimelineNavigationService methods:
 * updateItems, setSelectedDate, navigateNext, navigatePrevious,
 * getSelectedDate, getItems, findCurrentIndex.
 *
 * No manual manipulation of internal _selected properties.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { TimelineNavigationService } from '../../../src/services/TimelineNavigationService';
import type { Scene } from '../../../src/models/Scene';
import { createScene, createBook } from '../support/vault-fixture';

// ---------------------------------------------------------------------------
// Given steps — timeline setup
// ---------------------------------------------------------------------------

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
    this.navService = nav;
    this.timelineItems = nav.getItems();
});

Given('I am viewing the first scene', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    // Set selection to the first item's timestamp using production method
    const firstItem = this.timelineItems[0];
    if (firstItem.timestamp) {
        this.navService.setSelectedDate(firstItem.timestamp);
    }
});

Given('I am viewing the third scene', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length < 3) throw new Error('Not enough items');
    const thirdItem = this.timelineItems[2];
    if (thirdItem.timestamp) {
        this.navService.setSelectedDate(thirdItem.timestamp);
    }
});

Given('I am viewing the last scene', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    const lastItem = this.timelineItems[this.timelineItems.length - 1];
    if (lastItem.timestamp) {
        this.navService.setSelectedDate(lastItem.timestamp);
    }
});

Given('an empty timeline', function (this: TestWorld) {
    const tss = new TimeSpanService();
    const nav = new TimelineNavigationService(tss);
    nav.updateItems([], []);
    this.navService = nav;
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
    // Initialize navigation service for filtering scenarios
    const tss = new TimeSpanService();
    const nav = new TimelineNavigationService(tss);
    nav.updateItems(this.scenes, []);
    this.navService = nav;
    this.timelineItems = nav.getItems();
});

Given('scenes with different dates from both books', function (this: TestWorld) {
    this.scenes = [
        createScene('Scene A', '2000-01-15', this.books[0].bookId || '', 'StoryLine/Book One/Scenes/Scene A.md'),
        createScene('Scene B', '2000-03-20', this.books[1].bookId || '', 'StoryLine/Book Two/Scenes/Scene B.md'),
    ];
});

// ---------------------------------------------------------------------------
// When steps — navigation actions
// ---------------------------------------------------------------------------

When('I navigate to the first item', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    // Navigate to first by setting the date to the first item's timestamp
    const firstItem = this.timelineItems[0];
    if (firstItem.timestamp) {
        this.navService.setSelectedDate(firstItem.timestamp);
    }
});

When('I navigate to the last item', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    const lastItem = this.timelineItems[this.timelineItems.length - 1];
    if (lastItem.timestamp) {
        this.navService.setSelectedDate(lastItem.timestamp);
    }
});

When('I navigate forward', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    const nextItem = this.navService.navigateNext();
    this.lastNavigationResult = nextItem;
});

When('I navigate backward', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    const prevItem = this.navService.navigatePrevious();
    this.lastNavigationResult = prevItem;
});

When('I filter to show only the first book', function (this: TestWorld) {
    if (!this.activeBook) throw new Error('No active book');
    // Filter scenes to only those from the active book, then update the service
    const filteredScenes = this.scenes.filter(
        s => (s as Scene & { bookId?: string }).bookId === this.activeBook?.bookId,
    );
    if (!this.navService) throw new Error('No navigation service');
    this.navService.updateItems(filteredScenes, []);
    this.timelineItems = this.navService.getItems();
});

When('I view the multi-book timeline', function (this: TestWorld) {
    const tss = new TimeSpanService();
    const nav = new TimelineNavigationService(tss);
    nav.updateItems(this.scenes, []);
    this.navService = nav;
    this.timelineItems = nav.getItems();
});

When('I request the items', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    this.timelineItems = this.navService.getItems();
});

// ---------------------------------------------------------------------------
// Then steps — assertions
// ---------------------------------------------------------------------------

Then('the first scene is selected', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    const selectedDate = this.navService.getSelectedDate();
    if (!selectedDate) throw new Error('No date selected');
    const firstItem = this.timelineItems[0];
    if (!firstItem?.timestamp) throw new Error('First item has no timestamp');
    const tss = new TimeSpanService();
    const cmp = tss.compareTimestamps(selectedDate, firstItem.timestamp);
    if (cmp !== 0) {
        throw new Error('Selected date does not match first scene');
    }
});

Then('the last scene is selected', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    const selectedDate = this.navService.getSelectedDate();
    if (!selectedDate) throw new Error('No date selected');
    const lastItem = this.timelineItems[this.timelineItems.length - 1];
    if (!lastItem?.timestamp) throw new Error('Last item has no timestamp');
    const tss = new TimeSpanService();
    const cmp = tss.compareTimestamps(selectedDate, lastItem.timestamp);
    if (cmp !== 0) {
        throw new Error('Selected date does not match last scene');
    }
});

Then('the second scene is selected', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    const selectedDate = this.navService.getSelectedDate();
    if (!selectedDate) throw new Error('No date selected');
    const secondItem = this.timelineItems[1];
    if (!secondItem?.timestamp) throw new Error('Second item has no timestamp');
    const tss = new TimeSpanService();
    const cmp = tss.compareTimestamps(selectedDate, secondItem.timestamp);
    if (cmp !== 0) {
        throw new Error('Selected date does not match second scene');
    }
});

Then('no new scene is selected', function (this: TestWorld) {
    // navigateNext() at the end returns null
    if (this.lastNavigationResult !== null) {
        throw new Error('Expected null from navigateNext at end, got an item');
    }
});

Then('only scenes from the first book are visible', function (this: TestWorld) {
    if (!this.activeBook) throw new Error('No active book');
    for (const item of this.timelineItems) {
        const sceneBookId = (item.scene as Scene & { bookId?: string }).bookId;
        if (sceneBookId !== this.activeBook.bookId) {
            throw new Error(`Scene from wrong book: ${sceneBookId}`);
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
