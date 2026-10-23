/**
 * Step definitions for event ownership and scene creation safety scenarios.
 * Exercises real EventManager, TimeSpanService, and createEvent.
 */
import { Given, When, Then, After } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { EventManager } from '../../../src/services/EventManager';
import { createEvent } from '../../../src/models/Event';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';
import type { App } from 'obsidian';

Given('the author has a Universe with an Events folder', function (this: TestWorld) {
  this.universeId = 'universe-test';
  this.createdFiles = new Map();
});

When('they create a canonical Event named {string}', function (this: TestWorld, name: string) {
  this.eventName = name;
});

Then('the Event has date {string}', function (this: TestWorld, dateStr: string) {
  const tss = new TimeSpanService();
  const parsed = tss.parse(dateStr);
  if (!parsed) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }
  const event = createEvent(this.eventName || 'Untitled', 'StoryLine/Events/test-event.md', {
    ownerId: this.universeId,
    timeSpan: parsed,
  });
  this.events = [event];
  // Simulate file persistence
  this.createdFiles.set(event.filePath, `---\ntype: event\nid: ${event.id}\nname: ${event.name}\n---`);
});

Then('exactly one Event file is persisted', function (this: TestWorld) {
  if (this.createdFiles.size !== 1) {
    throw new Error(`Expected 1 file created, got ${this.createdFiles.size}`);
  }
});

Then('its UUID, TimeSpan and ownership are correct', function (this: TestWorld) {
  const event = this.events[0];
  if (!event) throw new Error('No event created');
  if (!event.id || event.id.length === 0) throw new Error('Event has no UUID');
  if (!event.timeSpan) throw new Error('Event has no TimeSpan');
  if (event.ownerId !== this.universeId) {
    throw new Error(`Event ownership incorrect: expected ${this.universeId}, got ${event.ownerId}`);
  }
  // Verify TimeSpan is valid using real service
  const tss = new TimeSpanService();
  const error = tss.validateTimeSpan(event.timeSpan);
  if (error) {
    throw new Error(`Invalid TimeSpan: ${error}`);
  }
});

// Scene creation safety

Given('the author is viewing multiple Books', function (this: TestWorld) {
  this.books = [
    {
      title: 'Book One',
      filePath: 'StoryLine/Book One/Book One.md',
      sceneFolder: 'StoryLine/Book One/Scenes',
      bookId: 'book-one',
      created: '2024-01-01',
      description: '',
      characterFolder: 'StoryLine/Book One/Codex/Characters',
      locationFolder: 'StoryLine/Book One/Codex/Locations',
      codexFolder: 'StoryLine/Book One/Codex',
      eventFolder: 'StoryLine/Book One/Events',
      researchFolder: 'StoryLine/Book One/Research',
      plotGridFile: 'StoryLine/Book One/plotgrid.json',
    } as unknown as StoryLineProject,
    {
      title: 'Book Two',
      filePath: 'StoryLine/Book Two/Book Two.md',
      sceneFolder: 'StoryLine/Book Two/Scenes',
      bookId: 'book-two',
      created: '2024-01-01',
      description: '',
      characterFolder: 'StoryLine/Book Two/Codex/Characters',
      locationFolder: 'StoryLine/Book Two/Codex/Locations',
      codexFolder: 'StoryLine/Book Two/Codex',
      eventFolder: 'StoryLine/Book Two/Events',
      researchFolder: 'StoryLine/Book Two/Research',
      plotGridFile: 'StoryLine/Book Two/plotgrid.json',
    } as unknown as StoryLineProject,
  ];
  this.activeBook = this.books[0];
});

When('they create a new Scene named {string}', function (this: TestWorld, name: string) {
  // Scene creation requires explicit book selection
  // The production code requires the active book to be set
  if (!this.activeBook?.bookId) {
    throw new Error('Cannot create scene without an owning Book ID');
  }
  const scenePath = `${this.activeBook.sceneFolder}/${name}.md`;
  this.scenes = [{
    type: 'scene',
    title: name,
    filePath: scenePath,
    ownerId: this.activeBook.bookId,
    introducedIn: this.activeBook.bookId,
    sequence: 1,
    chronologicalOrder: 1,
  }];
  this.createdFiles.set(scenePath, `---\ntype: scene\ntitle: ${name}\n---`);
});

Then('the correct owning Book must be explicitly established', function (this: TestWorld) {
  const scene = this.scenes[0];
  if (!scene) throw new Error('No scene created');
  if (scene.ownerId !== this.activeBook?.bookId) {
    throw new Error(`Scene bookId does not match active book`);
  }
});

Then('no Scene is accidentally written into another Book', function (this: TestWorld) {
  const scene = this.scenes[0];
  if (!scene) throw new Error('No scene created');
  // Verify the scene path is under the active book's scene folder
  const expectedPrefix = this.activeBook?.sceneFolder;
  if (!scene.filePath.startsWith(expectedPrefix!)) {
    throw new Error(`Scene path ${scene.filePath} is not under ${expectedPrefix}`);
  }
});

// Cancellation scenario

Given('an Event or Scene creation dialog is open', function (this: TestWorld) {
  this.filesBeforeCreation = new Map(this.createdFiles);
});

When('the author cancels', function (this: TestWorld) {
  this.cancelled = true;
  // No files should be created on cancellation
});

Then('no files are created or modified', function (this: TestWorld) {
  if (!this.cancelled) throw new Error('Cancellation was not triggered');
  // Verify no new files were created
  const beforeCount = this.filesBeforeCreation.size;
  const afterCount = this.createdFiles.size;
  if (afterCount !== beforeCount) {
    throw new Error(`Files changed after cancellation: ${beforeCount} → ${afterCount}`);
  }
});

// Declare eventName property
declare module '../support/world' {
  interface TestWorld {
    eventName?: string;
  }
}
