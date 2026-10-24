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
import type { TestWorld } from '../support/world';
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
    if (!firstItem) throw new Error('First item missing');
    if (firstItem.timestamp) {
        this.navService.setSelectedDate(firstItem.timestamp);
    }
});

Given('I am viewing the third scene', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length < 3) throw new Error('Not enough items');
    const thirdItem = this.timelineItems[2];
    if (!thirdItem) throw new Error('Third item missing');
    if (thirdItem.timestamp) {
        this.navService.setSelectedDate(thirdItem.timestamp);
    }
});

Given('I am viewing the last scene', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    const lastItem = this.timelineItems[this.timelineItems.length - 1];
    if (!lastItem) throw new Error('Last item missing');
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

When('I navigate to the first item', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    const firstItem = this.timelineItems[0];
    if (!firstItem) throw new Error('First item missing');
    if (firstItem.timestamp) {
        this.navService.setSelectedDate(firstItem.timestamp);
    }
});

When('I navigate to the last item', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    if (this.timelineItems.length === 0) throw new Error('No items');
    const lastItem = this.timelineItems[this.timelineItems.length - 1];
    if (!lastItem) throw new Error('Last item missing');
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

When('I request the items', function (this: TestWorld) {
    if (!this.navService) throw new Error('No navigation service');
    this.timelineItems = this.navService.getItems();
});

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
    if (this.lastNavigationResult !== null) {
        throw new Error('Expected null from navigateNext at end, got an item');
    }
});

Then('all scenes appear in chronological order', function (this: TestWorld) {
    const tss = new TimeSpanService();
    const timestamps = this.timelineItems
        .map(item => item.timestamp)
        .filter((t): t is NonNullable<typeof t> => t != null);
    for (let i = 1; i < timestamps.length; i++) {
        const prev = timestamps[i - 1];
        const curr = timestamps[i];
        if (!prev || !curr) continue;
        if (tss.compareTimestamps(prev, curr) > 0) {
            throw new Error(`Timeline not chronological at item ${i}`);
        }
    }
});

Then('no items are returned', function (this: TestWorld) {
    if (this.timelineItems.length !== 0) {
        throw new Error(`Expected 0 items, got ${this.timelineItems.length}`);
    }
});
