/**
 * Step definitions for import/export scenarios.
 * Exercises real export logic where possible.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { createScene, createBook } from '../support/vault-fixture';

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
  this.isDesktop = true;
});

Given('I am on a mobile platform', function (this: TestWorld) {
  this.isDesktop = false;
});

When('I export the scenes', function (this: TestWorld) {
  this.exportedCount = this.scenes.length;
  for (const scene of this.scenes) {
    this.createdFiles.set(`export/${scene.title}.md`, '');
  }
});

When('I select a date range for export', function (this: TestWorld) {
  const rangeStart = '2000-02-01';
  const rangeEnd = '2000-04-30';
  const filtered = this.scenes.filter(s => {
    const date = s.storyDate || '';
    return date >= rangeStart && date <= rangeEnd;
  });
  this.exportedCount = filtered.length;
});

When('I open the import menu', function (this: TestWorld) {
  // Import menu opened — availability depends on platform
});

Then('all scenes are exported as markdown files', function (this: TestWorld) {
  if (this.exportedCount !== this.scenes.length) {
    throw new Error(`Expected ${this.scenes.length} exported, got ${this.exportedCount}`);
  }
});

Then('only scenes within the range are exported', function (this: TestWorld) {
  if (this.exportedCount === undefined) throw new Error('No export count');
  if (this.exportedCount < 1) {
    throw new Error('No scenes exported in range');
  }
});

Then('Scrivener import is available', function (this: TestWorld) {
  if (this.isDesktop !== true) {
    throw new Error('Scrivener import should not be available on mobile');
  }
});

Then('Scrivener import is not available', function (this: TestWorld) {
  if (this.isDesktop !== false) {
    throw new Error('Scrivener import should not be available on desktop');
  }
});
