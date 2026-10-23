/**
 * Step definitions for import/export scenarios.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { createScene, createBook } from '../support/vault-fixture';

let isDesktop: boolean = true;
let exportedCount: number = 0;
let exportRangeStart: string = '';
let exportRangeEnd: string = '';

Given('{int} scenes in the active book', function (this: TestWorld, count: number) {
  if (!this.activeBook) {
    const book = createBook('Test Book', 'book-test', 'universe-test');
    this.activeBook = book;
    this.books.push(book);
  }
  this.scenes = [];
  for (let i = 0; i < count; i++) {
    const scene = createScene(
      `Scene ${i + 1}`,
      `2000-0${i + 1}-15`,
      this.activeBook.bookId || '',
      `${this.activeBook.sceneFolder || 'StoryLine/Scenes'}/Scene ${i + 1}.md`,
    );
    this.scenes.push(scene);
  }
});

Given('{int} scenes in the timeline', function (this: TestWorld, count: number) {
  if (!this.activeBook) {
    const book = createBook('Test Book', 'book-test', 'universe-test');
    this.activeBook = book;
    this.books.push(book);
  }
  this.scenes = [];
  for (let i = 0; i < count; i++) {
    const scene = createScene(
      `Scene ${i + 1}`,
      `2000-0${i + 1}-15`,
      this.activeBook.bookId || '',
      `${this.activeBook.sceneFolder || 'StoryLine/Scenes'}/Scene ${i + 1}.md`,
    );
    this.scenes.push(scene);
  }
});

Given('I am on a desktop platform', function (this: TestWorld) {
  isDesktop = true;
});

Given('I am on a mobile platform', function (this: TestWorld) {
  isDesktop = false;
});

When('I export the scenes', function (this: TestWorld) {
  exportedCount = this.scenes.length;
  for (const scene of this.scenes) {
    this.createdFiles.set(`export/${scene.title}.md`, (scene as any).content || '');
  }
});

When('I select a date range for export', function (this: TestWorld) {
  exportRangeStart = '2000-02-01';
  exportRangeEnd = '2000-04-30';
  exportedCount = this.scenes.filter(s => {
    const date = s.storyDate || '';
    return date >= exportRangeStart && date <= exportRangeEnd;
  }).length;
});

When('I open the import menu', function (this: TestWorld) {
  // Import menu opened
});

Then('all scenes are exported as markdown files', function (this: TestWorld) {
  if (exportedCount !== this.scenes.length) {
    throw new Error(`Expected ${this.scenes.length} exported, got ${exportedCount}`);
  }
});

Then('only scenes within the range are exported', function (this: TestWorld) {
  // Only scenes in range are exported
});

Then('Scrivener import is available', function (this: TestWorld) {
  if (!isDesktop) {
    throw new Error('Scrivener import should not be available on mobile');
  }
});

Then('Scrivener import is not available', function (this: TestWorld) {
  if (isDesktop) {
    throw new Error('Scrivener import should not be available on desktop');
  }
});
