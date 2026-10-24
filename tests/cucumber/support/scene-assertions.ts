/**
 * Shared assertion helpers for scene management tests.
 *
 * Extracted from scenes.steps.ts to keep file sizes under budget.
 */

import type { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { MetadataParser } from '../../../src/services/MetadataParser';
import { isValidUUID } from '../support/scene-test-helpers';

/** Verify the scene is created in the book's scene folder. */
export function assertSceneInBookFolder(world: TestWorld): void {
  if (!world.sceneFilePath) throw new Error('Scene file not created');
  if (!world.activeBook) throw new Error('No active book');
  const sm = world.sceneManager!;
  const sceneFolder = (sm as unknown as Record<string, unknown>)._activeProject
    ? ((sm as unknown as Record<string, unknown>)._activeProject as { sceneFolder: string }).sceneFolder
    : 'StoryLine/Scenes';
  if (!world.sceneFilePath.startsWith(sceneFolder)) {
    throw new Error(`Scene not in book's scene folder: ${world.sceneFilePath} does not start with ${sceneFolder}`);
  }
}

/** Verify the scene has a valid UUID v4. */
export function assertSceneHasValidUUID(world: TestWorld): void {
  if (!world.sceneId) {
    throw new Error('Scene has no UUID');
  }
  if (!isValidUUID(world.sceneId)) {
    throw new Error(`Scene ID is not a valid UUID v4: ${world.sceneId}`);
  }
}

/** Verify the scene belongs to the expected book. */
export function assertSceneBelongsToBook(world: TestWorld, bookTitle: string): void {
  if (!world.scenes.length) throw new Error('No scenes to check');
  const scene = world.scenes[0];
  if (!scene) throw new Error('First scene missing');
  if (!scene.ownerId) {
    throw new Error('Scene has no ownerId');
  }
  if (!world.activeBook || world.activeBook.title !== bookTitle) {
    throw new Error(`Scene does not belong to ${bookTitle}`);
  }
  if (scene.ownerId !== world.activeBook.bookId) {
    throw new Error(`Scene owner ${scene.ownerId} does not match book ${world.activeBook.bookId}`);
  }
}

/** Verify a scene error was shown. */
export function assertSceneErrorShown(world: TestWorld): void {
  if (!world.lastError) {
    throw new Error('No error was shown');
  }
  if (!world.lastError.message.includes('active book')) {
    throw new Error(`Error message does not mention active book: ${world.lastError.message}`);
  }
}

/** Verify no scene file was created in the vault. */
export function assertNoSceneCreated(world: TestWorld): void {
  const vault = world.testVault!;
  const sceneFiles = Array.from(vault.files.keys()).filter(p => p.endsWith('.md'));
  if (sceneFiles.length > 0) {
    throw new Error(`Scene file was created despite no active book: ${sceneFiles.join(', ')}`);
  }
}

/** Verify the scene date survived the persistence round-trip. */
export function assertSceneDatePreserved(world: TestWorld): void {
  if (!world.scenes.length) throw new Error('No scene to check');
  const scene = world.scenes[0];
  if (!scene) throw new Error('First scene missing');
  if (!world.sceneDate) throw new Error('No expected date');
  const tss = new TimeSpanService();
  if (scene.timeSpan) {
    const serialized = tss.serializeToYaml(scene.timeSpan);
    const instant = extractInstant(serialized);
    if (!instant) {
      throw new Error(`Scene timeSpan has no instant/start: ${JSON.stringify(serialized)}`);
    }
    const expectedParts = world.sceneDate.split('-');
    if (!checkDateParts(instant, expectedParts)) {
      throw new Error(
        `Scene date not preserved: expected ${world.sceneDate}, got ${JSON.stringify(serialized)}`,
      );
    }
  } else if (scene.storyDate) {
    if (scene.storyDate !== world.sceneDate) {
      throw new Error(`Scene storyDate not preserved: expected ${world.sceneDate}, got ${scene.storyDate}`);
    }
  } else {
    throw new Error('Scene date not preserved after reload: no timeSpan or storyDate');
  }
}

/** Verify the scene UUID is preserved after reload. */
export function assertSceneUUIDPreserved(world: TestWorld): void {
  if (!world.sceneId) throw new Error('No scene UUID after reload');
  if (!isValidUUID(world.sceneId)) {
    throw new Error(`Reloaded scene UUID is invalid: ${world.sceneId}`);
  }
}

/** Verify scenes appear in the correct chronological order. */
export function assertScenesInCorrectOrder(world: TestWorld): void {
  if (world.scenes.length < 2) {
    throw new Error(`Need at least 2 scenes to verify order, got ${world.scenes.length}`);
  }
  const expectedDates = ['2000-01-15', '2000-02-15', '2000-03-15'];
  for (let i = 0; i < world.scenes.length && i < expectedDates.length; i++) {
    const scene = world.scenes[i];
    const expectedDate = expectedDates[i];
    if (!scene) throw new Error(`Scene at index ${i} is missing`);
    if (!scene.storyDate) {
      throw new Error(`Scene at index ${i} has no storyDate for comparison`);
    }
    if (scene.storyDate !== expectedDate) {
      throw new Error(
        `Scene at index ${i} has wrong date: expected ${expectedDate}, got ${scene.storyDate}`,
      );
    }
  }
  verifySceneUuids(world);
}

function verifySceneUuids(world: TestWorld): void {
  if (!world.sceneUuidsInOrder || world.sceneUuidsInOrder.length !== world.scenes.length) return;
  const returnedUuids = world.scenes.map(s => s.id);
  for (const uuid of world.sceneUuidsInOrder) {
    if (!returnedUuids.includes(uuid)) {
      throw new Error(`Expected scene UUID ${uuid} not found in sorted results`);
    }
  }
}

/** Verify the UUID remains stable after update. */
export function assertUUIDRemains(world: TestWorld, expectedUuid: string): void {
  if (!world.sceneId) throw new Error('No scene UUID after update');
  if (!world.sceneFilePath) throw new Error('No scene file path');
  const vault = world.testVault!;
  const storedFile = vault.files.get(world.sceneFilePath);
  if (!storedFile) throw new Error('Scene file not found after update');
  const reloaded = MetadataParser.parseContent(storedFile.content, world.sceneFilePath);
  if (!reloaded) throw new Error('Failed to parse updated scene');
  if (!reloaded.id) throw new Error('Reloaded scene has no UUID');
  if (reloaded.id !== expectedUuid) {
    throw new Error(`UUID changed after update: expected ${expectedUuid}, got ${reloaded.id}`);
  }
  if (world.scenes[0] && reloaded.ownerId !== world.scenes[0].ownerId) {
    throw new Error(`Ownership changed after update: ${reloaded.ownerId} !== ${world.scenes[0].ownerId}`);
  }
}

/** Extract the instant/start object from a serialized TimeSpan. */
function extractInstant(serialized: Record<string, unknown>): Record<string, unknown> | null {
  const instant = serialized.instant ?? serialized.start;
  if (instant && typeof instant === 'object') {
    return instant as Record<string, unknown>;
  }
  return null;
}

/** Check that the instant matches the expected date parts. */
function checkDateParts(instant: Record<string, unknown>, expectedParts: string[]): boolean {
  const hasYear = Number(instant.year) === Number(expectedParts[0]);
  const hasMonth = Number(instant.month) === Number(expectedParts[1]);
  const hasDay = Number(instant.day) === Number(expectedParts[2]);
  return hasYear && hasMonth && hasDay;
}
