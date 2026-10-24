/**
 * Shared assertion helpers for event management tests.
 *
 * Extracted from management.steps.ts to keep file sizes under budget.
 */

import type { TestWorld } from '../support/world';
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
  const reloaded = await reloadEventFromVault(world);
  if (!reloaded) throw new Error('Event not found after reload from persisted file');
  if (!reloaded.timeSpan) throw new Error('Event date was not persisted');
  assertEventIdentityUnchanged(world, reloaded);
  assertDateChanged(world, reloaded);
  assertDateMatchesExpected(world, reloaded);
}

/** Reload an event from the vault using a fresh EventManager. */
async function reloadEventFromVault(
  world: TestWorld,
): Promise<import('../../../src/models/Event').Event | null> {
  const vault = world.testVault!;
  const freshApp = createAppMock(vault) as unknown as import('obsidian').App;
  const freshEM = new EventManager(freshApp);
  freshEM.setTimeSpanService(new TimeSpanService());
  await freshEM.loadAll(world.eventsFolder!);
  return freshEM.getEvent(world.lastEvent!.id) ?? null;
}

/** Verify UUID, owner ID and file path are unchanged after reload. */
function assertEventIdentityUnchanged(
  world: TestWorld,
  reloaded: import('../../../src/models/Event').Event,
): void {
  const orig = world.lastEvent!;
  if (reloaded.id !== orig.id) {
    throw new Error(`Event UUID changed after reload: ${reloaded.id} !== ${orig.id}`);
  }
  if (reloaded.ownerId !== orig.ownerId) {
    throw new Error(`Event owner changed after reload: ${reloaded.ownerId} !== ${orig.ownerId}`);
  }
  if (reloaded.filePath !== orig.filePath) {
    throw new Error(`Event path changed after reload: ${reloaded.filePath} !== ${orig.filePath}`);
  }
}

/** Verify the date actually changed from the original. */
function assertDateChanged(
  world: TestWorld,
  reloaded: import('../../../src/models/Event').Event,
): void {
  if (!world.originalDate || !reloaded.timeSpan) return;
  const tss = new TimeSpanService();
  const origJson = JSON.stringify(tss.serializeToYaml(world.originalDate));
  const newJson = JSON.stringify(tss.serializeToYaml(reloaded.timeSpan));
  if (origJson === newJson) {
    throw new Error('Event date was not actually changed');
  }
}

/** Verify the reloaded date matches the expected updated date. */
function assertDateMatchesExpected(
  world: TestWorld,
  reloaded: import('../../../src/models/Event').Event,
): void {
  const expected = world.lastEvent;
  if (!expected?.timeSpan || !reloaded.timeSpan) return;
  const tss = new TimeSpanService();
  const expectedJson = JSON.stringify(tss.serializeToYaml(expected.timeSpan));
  const reloadedJson = JSON.stringify(tss.serializeToYaml(reloaded.timeSpan));
  if (expectedJson !== reloadedJson) {
    throw new Error(
      `Event date mismatch after reload: expected ${expectedJson}, got ${reloadedJson}`,
    );
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
  const content = file.content;
  // The persisted file should contain timeSpan data
  if (!content.includes('timeSpan')) {
    throw new Error('Re-persisted file does not contain timeSpan');
  }
  // Verify the file content contains the event name
  if (!content.includes(world.lastEvent.name)) {
    throw new Error('Re-persisted file does not contain event name');
  }
  // Verify the persisted timeSpan matches the expected updated date
  if (world.lastEvent.timeSpan) {
    const tss = new TimeSpanService();
    const serialized = tss.serializeToYaml(world.lastEvent.timeSpan);
    // serializeToYaml returns { kind, instant: { year, month, day, ... }, display }
    const instant = (serialized.instant as Record<string, unknown>) ??
      (serialized.start as Record<string, unknown>);
    if (instant && instant.year !== undefined) {
      const yearStr = String(Number(instant.year));
      if (!content.includes(yearStr)) {
        throw new Error(
          `Re-persisted file does not contain expected year ${yearStr} from updated timeSpan`,
        );
      }
    }
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
