/**
 * Shared assertion helpers for event management tests.
 *
 * Extracted from management.steps.ts to keep file sizes under budget.
 */

import { TestWorld } from '../support/world';
import { EventManager } from '../../../src/services/EventManager';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { createInMemoryVault, createAppMock } from '../support/in-memory-vault';

/** Verify the event was created with a valid UUID v4. */
export function assertValidUUID(world: TestWorld): void {
  if (!world.lastEvent || !world.lastEvent.id || world.lastEvent.id.length === 0) {
    throw new Error('Event has no valid UUID');
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(world.lastEvent.id)) {
    throw new Error(`Event ID is not a valid UUID v4: ${world.lastEvent.id}`);
  }
}

/** Verify event ownership matches expected universe ID. */
export function assertOwnershipCorrect(world: TestWorld): void {
  if (!world.lastEvent || world.lastEvent.ownerId !== world.universeId) {
    throw new Error(
      `Event ownership incorrect: expected ${world.universeId}, got ${world.lastEvent?.ownerId}`,
    );
  }
}

/** Verify the event file was persisted to the vault with correct content. */
export function assertFilePersisted(world: TestWorld): void {
  if (!world.lastEvent) throw new Error('No event to check');
  const vault = world.testVault!;
  if (!vault.files.has(world.lastEvent.filePath)) {
    throw new Error(`Event file not persisted at ${world.lastEvent.filePath}`);
  }
  const content = vault.files.get(world.lastEvent.filePath)!.content;
  if (!content.includes(world.lastEvent.id)) {
    throw new Error('Persisted file does not contain event UUID');
  }
  if (!content.includes(world.lastEvent.name)) {
    throw new Error('Persisted file does not contain event name');
  }
}

/** Verify event has no timeSpan (undated event). */
export function assertUncertainDate(world: TestWorld): void {
  if (!world.lastEvent) throw new Error('No event created');
  if (world.lastEvent.timeSpan) {
    throw new Error('Event without date should have no timeSpan');
  }
}

/**
 * Verify event date was updated and persisted.
 * Does a true persistence round-trip: creates a fresh EventManager,
 * loads from vault, and compares the reloaded event.
 */
export async function assertDateUpdated(world: TestWorld): Promise<void> {
  if (!world.lastEvent) throw new Error('No event to check');
  const vault = world.testVault!;
  // Create a fresh EventManager and reload from persisted files
  const freshApp = createAppMock(vault) as unknown as import('obsidian').App;
  const freshEM = new EventManager(freshApp);
  freshEM.setTimeSpanService(new TimeSpanService());
  await freshEM.loadAll(world.eventsFolder!);
  const reloaded = freshEM.getEvent(world.lastEvent.id);
  if (!reloaded) throw new Error('Event not found after reload from persisted file');
  if (!reloaded.timeSpan) {
    throw new Error('Event date was not persisted');
  }
  // Verify UUID, owner ID and file path are unchanged
  if (reloaded.id !== world.lastEvent.id) {
    throw new Error(`Event UUID changed after reload: ${reloaded.id} !== ${world.lastEvent.id}`);
  }
  if (reloaded.ownerId !== world.lastEvent.ownerId) {
    throw new Error(`Event owner changed after reload: ${reloaded.ownerId} !== ${world.lastEvent.ownerId}`);
  }
  if (reloaded.filePath !== world.lastEvent.filePath) {
    throw new Error(`Event path changed after reload: ${reloaded.filePath} !== ${world.lastEvent.filePath}`);
  }
  // Verify the new date is actually different from the original
  if (world.originalDate && reloaded.timeSpan) {
    const tss = new TimeSpanService();
    const origSerialized = tss.serializeToYaml(world.originalDate);
    const newSerialized = tss.serializeToYaml(reloaded.timeSpan);
    if (origSerialized === newSerialized) {
      throw new Error('Event date was not actually changed');
    }
  }
}

/**
 * Verify event file was re-persisted after update.
 * Checks that the persisted content actually reflects the updated state.
 */
export function assertFileRePersisted(world: TestWorld): void {
  if (!world.lastEvent) throw new Error('No event to re-persist');
  const vault = world.testVault!;
  const file = vault.files.get(world.lastEvent.filePath);
  if (!file) {
    throw new Error('Event file not re-persisted');
  }
  // Verify the file content contains the updated event data
  if (world.lastEvent.timeSpan) {
    const content = file.content;
    // The persisted file should contain timeSpan data
    if (!content.includes('timeSpan')) {
      throw new Error('Re-persisted file does not contain updated timeSpan');
    }
  }
  // Verify the file content contains the event name
  if (!file.content.includes(world.lastEvent.name)) {
    throw new Error('Re-persisted file does not contain event name');
  }
}

/** Verify event file was removed from vault. */
export function assertFileRemoved(world: TestWorld): void {
  if (!world.lastEvent) throw new Error('No event to check');
  const vault = world.testVault!;
  if (vault.files.has(world.lastEvent.filePath)) {
    throw new Error('Event file still exists after deletion');
  }
}

/**
 * Verify deleted event is no longer in manager collection.
 * Also verifies a fresh reload from vault does not resurrect it.
 */
export async function assertNotInTimeline(world: TestWorld): Promise<void> {
  const em = world.eventManager!;
  const allEvents = em.getAllEvents();
  const lastId = world.lastEvent?.id;
  if (lastId && allEvents.some(e => e.id === lastId)) {
    throw new Error('Deleted event still in manager collection');
  }
  // Verify a fresh reload from vault also excludes the deleted event
  const vault = world.testVault!;
  const freshApp = createAppMock(vault) as unknown as import('obsidian').App;
  const freshEM = new EventManager(freshApp);
  freshEM.setTimeSpanService(new TimeSpanService());
  await freshEM.loadAll(world.eventsFolder!);
  const reloadedEvents = freshEM.getAllEvents();
  if (lastId && reloadedEvents.some(e => e.id === lastId)) {
    throw new Error('Deleted event resurrected after fresh reload from vault');
  }
}

/** Verify event owner is the universe. */
export function assertOwnerIsUniverse(world: TestWorld): void {
  if (!world.lastEvent || world.lastEvent.ownerId !== world.universeId) {
    throw new Error('Event owner is not the universe');
  }
}

/** Verify event is a canonical universe event. */
export function assertVisibleAcrossBooks(world: TestWorld): void {
  if (!world.lastEvent || world.lastEvent.ownerId !== world.universeId) {
    throw new Error('Event is not a canonical universe event');
  }
}

/** Verify event owner is the active book. */
export function assertOwnerIsActiveBook(world: TestWorld): void {
  if (!world.lastEvent || !world.activeBook || world.lastEvent.ownerId !== world.activeBook.bookId) {
    throw new Error('Event owner is not the active book');
  }
}

/** Verify event is book-scoped, not universe-scoped. */
export function assertOnlyVisibleInBook(world: TestWorld): void {
  if (!world.lastEvent || !world.activeBook) {
    throw new Error('No event or active book');
  }
  if (world.lastEvent.ownerId === world.universeId) {
    throw new Error('Event is universe-scoped, not book-scoped');
  }
}

/** Verify all events were loaded with required fields. */
export function assertAllEventsLoaded(world: TestWorld, count: number): void {
  const em = world.eventManager!;
  const allEvents = em.getAllEvents();
  if (allEvents.length !== count) {
    throw new Error(`Expected ${count} events loaded, got ${allEvents.length}`);
  }
  for (const event of allEvents) {
    if (!event.id) throw new Error('Loaded event has no ID');
    if (!event.name) throw new Error('Loaded event has no name');
    if (!event.filePath) throw new Error('Loaded event has no file path');
  }
}
