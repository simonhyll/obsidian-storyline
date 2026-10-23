/**
 * Step definitions for event management scenarios.
 *
 * Exercises real EventManager with in-memory vault harness for persistence
 * integration testing. Tests actual file creation, saving, loading, and deletion
 * through production EventManager methods.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { EventManager } from '../../../src/services/EventManager';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { createInMemoryVault, createAppMock } from '../support/in-memory-vault';
import * as assert from '../support/event-assertions';

function setupEM(world: TestWorld): void {
  const vault = createInMemoryVault();
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  const em = new EventManager(app);
  const tss = new TimeSpanService();
  em.setTimeSpanService(tss);
  world.testVault = vault;
  world.eventManager = em;
  world.eventsFolder = 'StoryLine/Events';
  world.universeId = 'universe-test';
}

Given('I create an event named {string} with date {string}', async function (
  this: TestWorld, name: string, date: string,
) {
  setupEM(this);
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
    ownerId: this.universeId, timeSpan,
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('I create an event named {string} without a date', async function (
  this: TestWorld, name: string,
) {
  setupEM(this);
  const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
    ownerId: this.universeId,
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('an existing event {string} dated {string}', async function (
  this: TestWorld, name: string, date: string,
) {
  setupEM(this);
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
    ownerId: this.universeId, timeSpan,
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('an existing event {string}', async function (this: TestWorld, name: string) {
  setupEM(this);
  const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
    ownerId: this.universeId,
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('I create a canonical event {string}', async function (this: TestWorld, name: string) {
  setupEM(this);
  const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
    ownerId: this.universeId,
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('I create a book-scoped event {string}', async function (this: TestWorld, name: string) {
  setupEM(this);
  this.activeBook = { bookId: 'book-1', title: 'Book One' } as any;
  const event = await this.eventManager!.createEventFile('StoryLine/Book One/Events', name, {
    ownerId: 'book-1',
  });
  this.lastEvent = event;
  this.events = [event];
});

Given('{int} existing event files', async function (this: TestWorld, count: number) {
  setupEM(this);
  const tss = new TimeSpanService();
  this.events = [];
  for (let i = 0; i < count; i++) {
    const timeSpan = tss.parse(`2000-0${i + 1}-15`);
    if (!timeSpan) continue;
    const event = await this.eventManager!.createEventFile(this.eventsFolder!, `Event ${i + 1}`, {
      ownerId: this.universeId, timeSpan,
    });
    this.events.push(event);
  }
});

When('I update the date to {string}', async function (this: TestWorld, date: string) {
  if (!this.lastEvent) throw new Error('No event to update');
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  this.lastEvent.timeSpan = timeSpan;
  await this.eventManager!.saveEvent(this.lastEvent);
});

When('I delete the event', async function (this: TestWorld) {
  if (!this.lastEvent) throw new Error('No event to delete');
  await this.eventManager!.deleteEvent(this.lastEvent);
});

When('I load the events', async function (this: TestWorld) {
  // Access private app field via any cast for test access
  const em = new EventManager((this.eventManager! as any).app);
  const tss = new TimeSpanService();
  em.setTimeSpanService(tss);
  await em.loadAll(this.eventsFolder!);
  this.eventManager = em;
  this.events = em.getAllEvents();
});

Then('the event is created with a valid UUID', function (this: TestWorld) {
  assert.assertValidUUID(this);
});

Then('the event ownership is set correctly', function (this: TestWorld) {
  assert.assertOwnershipCorrect(this);
});

Then('the event file is persisted', function (this: TestWorld) {
  assert.assertFilePersisted(this);
});

Then('the event is created with an uncertain date', function (this: TestWorld) {
  assert.assertUncertainDate(this);
});

Then('the event date is updated', async function (this: TestWorld) {
  await assert.assertDateUpdated(this);
});

Then('the event file is re-persisted', function (this: TestWorld) {
  assert.assertFileRePersisted(this);
});

Then('the event file is removed', function (this: TestWorld) {
  assert.assertFileRemoved(this);
});

Then('the event is no longer in the timeline', function (this: TestWorld) {
  assert.assertNotInTimeline(this);
});

Then('the event owner is the universe', function (this: TestWorld) {
  assert.assertOwnerIsUniverse(this);
});

Then('the event is visible across all books in the universe', function (this: TestWorld) {
  assert.assertVisibleAcrossBooks(this);
});

Then('the event owner is the active book', function (this: TestWorld) {
  assert.assertOwnerIsActiveBook(this);
});

Then('the event is only visible in that book', function (this: TestWorld) {
  assert.assertOnlyVisibleInBook(this);
});

Then('all {int} events are loaded correctly', function (this: TestWorld, count: number) {
  assert.assertAllEventsLoaded(this, count);
});
