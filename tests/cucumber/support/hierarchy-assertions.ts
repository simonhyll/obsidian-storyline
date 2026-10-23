/**
 * Shared assertion helpers for hierarchy management tests.
 *
 * Extracted from hierarchy.steps.ts to keep file sizes under budget.
 */

import { TestWorld } from '../support/world';
import { isValidUUID } from './hierarchy-test-helpers';

/** Verify the book's universe ID matches the created universe. */
export function assertBookUniverseIdMatches(world: TestWorld, universeName: string): void {
  const book = world.activeBook;
  if (!book) throw new Error('No active book');
  if (!book.universeId) {
    throw new Error('Book has no universeId');
  }
  if (!isValidUUID(book.universeId)) {
    throw new Error(`Book universeId is not a valid UUID: ${book.universeId}`);
  }
  const universe = world.universeMetadata;
  if (!universe) throw new Error('No universe metadata');
  if (book.universeId !== universe.id) {
    throw new Error(
      `Book universeId ${book.universeId} does not match universe ${universe.id} (${universe.name})`,
    );
  }
  const expectedName = universeName.replace(/[\\/:*?"<>|]/g, '-');
  if (universe.name !== expectedName) {
    throw new Error(`Universe name mismatch: expected ${expectedName}, got ${universe.name}`);
  }
}

/** Verify the book belongs to the expected series. */
export function assertBookBelongsToSeries(world: TestWorld, seriesName: string): void {
  const book = world.activeBook;
  if (!book) throw new Error('No active book');
  const series = world.seriesMetadata;
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  if (!book.seriesUuid) {
    throw new Error('Book has no seriesUuid');
  }
  if (book.seriesUuid !== series.seriesUuid) {
    throw new Error(
      `Book seriesUuid ${book.seriesUuid} does not match series ${series.seriesUuid} (${series.name})`,
    );
  }
}

/** Verify the series universe ID matches the created universe. */
export function assertSeriesUniverseIdMatches(world: TestWorld, universeName: string): void {
  const series = world.seriesMetadata;
  if (!series) throw new Error('No series metadata');
  if (!series.universeId) {
    throw new Error('Series has no universeId');
  }
  const universe = world.universeMetadata;
  if (!universe) throw new Error('No universe metadata');
  if (series.universeId !== universe.id) {
    throw new Error(
      `Series universeId ${series.universeId} does not match universe ${universe.id}`,
    );
  }
  if (!universe.seriesIds?.includes(series.seriesUuid!)) {
    throw new Error(`Universe seriesIds does not include series ${series.seriesUuid}`);
  }
}

/** Verify only scenes from the expected universe are visible. */
export function assertOnlyScenesFromUniverse(world: TestWorld, universeName: string): void {
  const expectedId = universeName === 'Alpha' ? world.universeAlphaId : world.universeBetaId;
  const scenes = universeName === 'Alpha' ? world.alphaScenes : world.betaScenes;

  if (!scenes || scenes.length === 0) {
    throw new Error(`No scenes found for universe ${universeName}`);
  }

  for (const scene of scenes) {
    const book = world.books.find(b => b.bookId === scene.ownerId);
    if (!book) {
      throw new Error(`Scene owner book not found: ${scene.ownerId}`);
    }
    if (book.universeId !== expectedId) {
      throw new Error(
        `Scene from wrong universe: book ${book.title} belongs to ${book.universeId}, expected ${expectedId}`,
      );
    }
  }
}

/** Verify the universe UUID remains stable after reload. */
export function assertUniverseUUIDRemainsSame(world: TestWorld): void {
  const originalId = world.universeId;
  const reloaded = world.universeMetadata;
  if (!originalId) throw new Error('No original universe ID');
  if (!reloaded) throw new Error('No reloaded universe');
  if (reloaded.id !== originalId) {
    throw new Error(`Universe UUID changed: expected ${originalId}, got ${reloaded.id}`);
  }
  if (!reloaded.name) {
    throw new Error('Reloaded universe has no name');
  }
}
