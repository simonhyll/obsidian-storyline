/** Multi-book navigation steps extracted from navigation.steps.ts. */
import { Given, When, Then } from '@cucumber/cucumber';
import type { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { TimelineNavigationService } from '../../../src/services/TimelineNavigationService';
import type { Scene } from '../../../src/models/Scene';
import { createBook, createScene } from '../support/vault-fixture';

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
    const book1 = this.books[0];
    const book2 = this.books[1];
    if (!book1 || !book2) throw new Error('Book missing');
    this.scenes = [
        createScene('Scene A', '2000-01-15', book1.bookId || '', 'StoryLine/Book One/Scenes/Scene A.md'),
        createScene('Scene B', '2000-03-20', book2.bookId || '', 'StoryLine/Book Two/Scenes/Scene B.md'),
    ];
    const tss = new TimeSpanService();
    const nav = new TimelineNavigationService(tss);
    nav.updateItems(this.scenes, []);
    this.navService = nav;
    this.timelineItems = nav.getItems();
});

Given('scenes with different dates from both books', function (this: TestWorld) {
    const book1 = this.books[0];
    const book2 = this.books[1];
    if (!book1 || !book2) throw new Error('Book missing');
    this.scenes = [
        createScene('Scene A', '2000-01-15', book1.bookId || '', 'StoryLine/Book One/Scenes/Scene A.md'),
        createScene('Scene B', '2000-03-20', book2.bookId || '', 'StoryLine/Book Two/Scenes/Scene B.md'),
    ];
});

When('I filter to show only the first book', function (this: TestWorld) {
    if (!this.activeBook) throw new Error('No active book');
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

Then('only scenes from the first book are visible', function (this: TestWorld) {
    if (!this.activeBook) throw new Error('No active book');
    for (const item of this.timelineItems) {
        const sceneBookId = (item.scene as Scene & { bookId?: string }).bookId;
        if (sceneBookId !== this.activeBook.bookId) {
            throw new Error(`Scene from wrong book: ${sceneBookId}`);
        }
    }
});
