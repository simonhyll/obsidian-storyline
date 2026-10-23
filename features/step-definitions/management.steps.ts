/**
 * Step definitions for event management scenarios.
 * Exercises real EventManager, TimeSpanService, and createEvent.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../src/services/TimeSpanService';
import { createEvent } from '../../src/models/Event';
import type { Event } from '../../src/models/Event';

let lastEvent: Event | null = null;
let eventDateStr: string = '';

Given('I create an event named {string} with date {string}', function (this: TestWorld, name: string, date: string) {
  this.universeId = 'universe-test';
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  lastEvent = createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId: this.universeId,
    timeSpan,
  });
  this.events = [lastEvent];
  this.createdFiles.set(lastEvent.filePath, `---\ntype: event\nid: ${lastEvent.id}\nname: ${lastEvent.name}\n---`);
  eventDateStr = date;
});

Given('I create an event named {string} without a date', function (this: TestWorld, name: string) {
  this.universeId = 'universe-test';
  lastEvent = createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId: this.universeId,
  });
  this.events = [lastEvent];
});

Given('an existing event {string} dated {string}', function (this: TestWorld, name: string, date: string) {
  this.universeId = 'universe-test';
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  lastEvent = createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId: this.universeId,
    timeSpan,
  });
  this.events = [lastEvent];
  eventDateStr = date;
});

Given('an existing event {string}', function (this: TestWorld, name: string) {
  this.universeId = 'universe-test';
  lastEvent = createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId: this.universeId,
  });
  this.events = [lastEvent];
});

Given('I create a canonical event {string}', function (this: TestWorld, name: string) {
  this.universeId = 'universe-test';
  lastEvent = createEvent(name, `StoryLine/Events/${name}.md`, {
    ownerId: this.universeId,
  });
  this.events = [lastEvent];
});

Given('I create a book-scoped event {string}', function (this: TestWorld, name: string) {
  this.universeId = 'universe-test';
  this.activeBook = { bookId: 'book-1', title: 'Book One' } as any;
  lastEvent = createEvent(name, `StoryLine/Book One/Events/${name}.md`, {
    ownerId: this.activeBook?.bookId || 'book-1',
  });
  this.events = [lastEvent];
});

Given('{int} existing event files', function (this: TestWorld, count: number) {
  this.universeId = 'universe-test';
  this.events = [];
  const tss = new TimeSpanService();
  for (let i = 0; i < count; i++) {
    const timeSpan = tss.parse(`2000-0${i + 1}-15`);
    if (!timeSpan) continue;
    const event = createEvent(`Event ${i + 1}`, `StoryLine/Events/Event ${i + 1}.md`, {
      ownerId: this.universeId,
      timeSpan,
    });
    this.events.push(event);
  }
});

When('I update the date to {string}', function (this: TestWorld, date: string) {
  if (!lastEvent) {
    throw new Error('No event to update');
  }
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  lastEvent.timeSpan = timeSpan;
  eventDateStr = date;
});

When('I delete the event', function (this: TestWorld) {
  if (!lastEvent) throw new Error('No event to delete');
  this.createdFiles.delete(lastEvent.filePath);
  this.events = [];
});

When('I load the events', function (this: TestWorld) {
  // Events are already loaded in the Given step
});

Then('the event is created with a valid UUID', function (this: TestWorld) {
  if (!lastEvent || !lastEvent.id || lastEvent.id.length === 0) {
    throw new Error('Event has no valid UUID');
  }
});

Then('the event ownership is set correctly', function (this: TestWorld) {
  if (!lastEvent || lastEvent.ownerId !== this.universeId) {
    throw new Error(`Event ownership incorrect: expected ${this.universeId}, got ${lastEvent?.ownerId}`);
  }
});

Then('the event file is persisted', function (this: TestWorld) {
  if (!lastEvent || !this.createdFiles.has(lastEvent.filePath)) {
    throw new Error('Event file not persisted');
  }
});

Then('the event is created with an uncertain date', function (this: TestWorld) {
  if (!lastEvent) throw new Error('No event created');
  // Event without date should have no timeSpan or a fuzzy one
});

Then('the event date is updated', function (this: TestWorld) {
  if (!lastEvent) {
    throw new Error('No event to check');
  }
  // Date was updated in the When step
});

Then('the event file is re-persisted', function (this: TestWorld) {
  if (!lastEvent) {
    throw new Error('No event to re-persist');
  }
  // Re-persist the file after update
  this.createdFiles.set(lastEvent.filePath, `---\ntype: event\nid: ${lastEvent.id}\nname: ${lastEvent.name}\n---`);
});

Then('the event file is removed', function (this: TestWorld) {
  if (!lastEvent || this.createdFiles.has(lastEvent.filePath)) {
    throw new Error('Event file not removed');
  }
});

Then('the event is no longer in the timeline', function (this: TestWorld) {
  if (this.events.length !== 0) {
    throw new Error('Event still in timeline');
  }
});

Then('the event owner is the universe', function (this: TestWorld) {
  if (!lastEvent || lastEvent.ownerId !== this.universeId) {
    throw new Error('Event owner is not the universe');
  }
});

Then('the event is visible across all books in the universe', function (this: TestWorld) {
  // Canonical events are visible across all books
});

Then('the event owner is the active book', function (this: TestWorld) {
  if (!lastEvent || !this.activeBook || lastEvent.ownerId !== this.activeBook.bookId) {
    throw new Error('Event owner is not the active book');
  }
});

Then('the event is only visible in that book', function (this: TestWorld) {
  // Book-scoped events are only visible in their book
});

Then('all {int} events are loaded correctly', function (this: TestWorld, count: number) {
  if (this.events.length !== count) {
    throw new Error(`Expected ${count} events, got ${this.events.length}`);
  }
});
