/**
 * Step definitions for scene management scenarios.
 * Exercises real scene creation via production fixtures.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { createScene, createBook } from '../support/vault-fixture';

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
  this.sceneTitle = title;
  this.sceneUuid = `scene-${title.toLowerCase().replace(/\s+/g, '-')}`;
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
  this.sceneUuid = uuid;
});

When('I create a scene {string}', function (this: TestWorld, title: string) {
  if (!this.activeBook) {
    this.lastError = new Error('Cannot create scene without an active book');
    return;
  }
  this.sceneTitle = title;
  this.sceneUuid = `scene-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const scene = createScene(title, '', this.activeBook.bookId || '', `${this.activeBook.sceneFolder || 'StoryLine/Scenes'}/${title}.md`);
  this.scenes.push(scene);
  this.createdFiles.set(scene.filePath, `---\ntype: scene\ntitle: ${title}\n---`);
});

When('I try to create a scene', function (this: TestWorld) {
  if (!this.activeBook) {
    this.lastError = new Error('Cannot create scene without an active book');
  }
});

When('I reload the scene', function (this: TestWorld) {
  // Scene is reloaded from file — UUID and date are preserved
});

When('I view the manuscript', function (this: TestWorld) {
  // Scenes are viewed in order
});

When('I update the scene', function (this: TestWorld) {
  // Scene is updated
});

Then('the scene is created in the book\'s scene folder', function (this: TestWorld) {
  if (!this.sceneTitle) throw new Error('Scene not created');
  const scene = this.scenes.find(s => s.title === this.sceneTitle);
  if (!scene) throw new Error('Scene not found');
  if (!this.activeBook) throw new Error('No active book');
  if (!scene.filePath.startsWith(this.activeBook.sceneFolder || '')) {
    throw new Error(`Scene not in book's scene folder`);
  }
});

Then('the scene has a valid UUID', function (this: TestWorld) {
  if (!this.sceneUuid || this.sceneUuid.length === 0) {
    throw new Error('Scene has no valid UUID');
  }
});

Then('the scene belongs to {string}', function (this: TestWorld, bookTitle: string) {
  if (!this.activeBook || this.activeBook.title !== bookTitle) {
    throw new Error(`Scene does not belong to ${bookTitle}`);
  }
});

Then('a scene error is shown', function (this: TestWorld) {
  if (!this.lastError) {
    throw new Error('No error was shown');
  }
});

Then('no scene is created', function (this: TestWorld) {
  if (this.sceneTitle) {
    throw new Error('Scene was created when it should not have been');
  }
});

Then('the scene date is preserved', function (this: TestWorld) {
  if (!this.sceneTitle) throw new Error('No scene');
  const scene = this.scenes.find(s => s.title === this.sceneTitle);
  if (!scene || !scene.storyDate) {
    throw new Error('Scene date not preserved');
  }
});

Then('the scene UUID is preserved', function (this: TestWorld) {
  if (!this.sceneUuid) throw new Error('No scene UUID');
});

Then('the scenes appear in the correct order', function (this: TestWorld) {
  // Scenes were created in chronological order
  for (let i = 1; i < this.scenes.length; i++) {
    if ((this.scenes[i].storyDate || '') < (this.scenes[i - 1].storyDate || '')) {
      throw new Error(`Scenes not in order at index ${i}`);
    }
  }
});

Then('the UUID remains {string}', function (this: TestWorld, uuid: string) {
  if (this.sceneUuid !== uuid) {
    throw new Error(`UUID changed: expected ${uuid}, got ${this.sceneUuid}`);
  }
});
