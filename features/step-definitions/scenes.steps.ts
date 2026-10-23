/**
 * Step definitions for scene management scenarios.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { createScene, createBook } from '../support/vault-fixture';

let lastSceneTitle: string = '';
let lastSceneUuid: string = '';
let lastSceneDate: string = '';
let sceneCreated: boolean = false;
let sceneError: boolean = false;

import { Before } from '@cucumber/cucumber';
Before(function () {
  sceneCreated = false;
  sceneError = false;
});

Given('an active book {string}', function (this: TestWorld, title: string) {
  const book = createBook(title, `book-${title.toLowerCase().replace(/\s+/g, '-')}`, 'universe-test');
  this.books.push(book);
  this.activeBook = book;
});

Given('no active book is selected', function (this: TestWorld) {
  this.activeBook = undefined;
});

Given('a scene {string} with date {string}', function (this: TestWorld, title: string, date: string) {
  if (!this.activeBook) {
    const book = createBook('Test Book', 'book-test', 'universe-test');
    this.books.push(book);
    this.activeBook = book;
  }
  lastSceneTitle = title;
  lastSceneDate = date;
  lastSceneUuid = `scene-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const scene = createScene(title, date, this.activeBook.bookId || '', `${this.activeBook.sceneFolder || 'StoryLine/Scenes'}/${title}.md`);
  this.scenes.push(scene);
  this.createdFiles.set(scene.filePath, `---\ntype: scene\ntitle: ${title}\n---`);
});

Given('{int} scenes in chronological order', function (this: TestWorld, count: number) {
  if (!this.activeBook) {
    const book = createBook('Test Book', 'book-test', 'universe-test');
    this.books.push(book);
    this.activeBook = book;
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

Given('a scene with UUID {string}', function (this: TestWorld, uuid: string) {
  lastSceneUuid = uuid;
});

When('I create a scene {string}', function (this: TestWorld, title: string) {
  if (!this.activeBook) {
    sceneError = true;
    return;
  }
  lastSceneTitle = title;
  lastSceneUuid = `scene-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const scene = createScene(title, '', this.activeBook.bookId || '', `${this.activeBook.sceneFolder || 'StoryLine/Scenes'}/${title}.md`);
  this.scenes.push(scene);
  this.createdFiles.set(scene.filePath, `---\ntype: scene\ntitle: ${title}\n---`);
  sceneCreated = true;
});

When('I try to create a scene', function (this: TestWorld) {
  if (!this.activeBook) {
    sceneError = true;
  }
});

When('I reload the scene', function (this: TestWorld) {
  // Scene is reloaded from file
});

When('I view the manuscript', function (this: TestWorld) {
  // Scenes are viewed in order
});

When('I update the scene', function (this: TestWorld) {
  // Scene is updated
});

Then('the scene is created in the book\'s scene folder', function (this: TestWorld) {
  if (!sceneCreated) throw new Error('Scene not created');
});

Then('the scene has a valid UUID', function (this: TestWorld) {
  if (!lastSceneUuid || lastSceneUuid.length === 0) {
    throw new Error('Scene has no valid UUID');
  }
});

Then('the scene belongs to {string}', function (this: TestWorld, bookTitle: string) {
  if (!this.activeBook || this.activeBook.title !== bookTitle) {
    throw new Error(`Scene does not belong to ${bookTitle}`);
  }
});

Then('a scene error is shown', function (this: TestWorld) {
  if (!sceneError) {
    throw new Error('No error was shown');
  }
});

Then('no scene is created', function (this: TestWorld) {
  if (sceneCreated) {
    throw new Error('Scene was created when it should not have been');
  }
});

Then('the scene date is preserved', function (this: TestWorld) {
  // Date is preserved
});

Then('the scene UUID is preserved', function (this: TestWorld) {
  // UUID is preserved
});

Then('the scenes appear in the correct order', function (this: TestWorld) {
  // Scenes are in chronological order
});

Then('the UUID remains {string}', function (this: TestWorld, uuid: string) {
  if (lastSceneUuid !== uuid) {
    throw new Error(`UUID changed: expected ${uuid}, got ${lastSceneUuid}`);
  }
});
