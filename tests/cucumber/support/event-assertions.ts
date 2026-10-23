/**
 * Shared assertion helpers for event management tests.
 *
 * Extracted from management.steps.ts to keep file sizes under budget.
 */

import { TestWorld } from '../support/world';

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

/** Verify event date was updated and persisted. */
export async function assertDateUpdated(world: TestWorld): Promise<void> {
  if (!world.lastEvent) throw new Error('No event to check');
  const reloaded = world.eventManager!.getEvent(world.lastEvent.id);
  if (!reloaded) throw new Error('Event not found after update');
  if (!reloaded.timeSpan) {
    throw new Error('Event date was not persisted');
  }
}

/** Verify event file was re-persisted after update. */
export function assertFileRePersisted(world: TestWorld): void {
  if (!world.lastEvent) throw new Error('No event to re-persist');
  const vault = world.testVault!;
  if (!vault.files.has(world.lastEvent.filePath)) {
    throw new Error('Event file not re-persisted');
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

/** Verify deleted event is no longer in manager collection. */
export function assertNotInTimeline(world: TestWorld): void {
  const em = world.eventManager!;
  const allEvents = em.getAllEvents();
  const lastId = world.lastEvent?.id;
  if (lastId && allEvents.some(e => e.id === lastId)) {
    throw new Error('Deleted event still in manager collection');
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
