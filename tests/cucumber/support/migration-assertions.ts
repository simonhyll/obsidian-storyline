/**
 * Assertions for legacy migration tests.
 * Extracted to keep hierarchy-deferred.steps.ts under the 200-line budget.
 */

/**
 * Verify legacy keys were removed from data.json after migration.
 */
export function assertLegacyKeysRemoved(legacyData: Record<string, unknown>): void {
  if ('definedActs' in legacyData) {
    throw new Error('Legacy definedActs not removed from data.json');
  }
  if ('definedChapters' in legacyData) {
    throw new Error('Legacy definedChapters not removed from data.json');
  }
}

/**
 * Verify the migrated acts values in persisted YAML frontmatter.
 */
export function assertMigratedActs(
  frontmatter: Record<string, unknown>,
  expected: number[],
): void {
  const acts = frontmatter.acts as number[] | undefined;
  if (!Array.isArray(acts) || acts.length !== expected.length) {
    throw new Error(
      `definedActs not migrated: expected ${JSON.stringify(expected)}, got ${JSON.stringify(acts)}`,
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (acts[i] !== expected[i]) {
      throw new Error(`definedActs[${i}] incorrect: expected ${expected[i]}, got ${acts[i]}`);
    }
  }
}

/**
 * Verify the migrated chapters values in persisted YAML frontmatter.
 */
export function assertMigratedChapters(
  frontmatter: Record<string, unknown>,
  expected: number[],
): void {
  const chapters = frontmatter.chapters as number[] | undefined;
  if (!Array.isArray(chapters) || chapters.length !== expected.length) {
    throw new Error(
      `definedChapters not migrated: expected ${JSON.stringify(expected)}, got ${JSON.stringify(chapters)}`,
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (chapters[i] !== expected[i]) {
      throw new Error(
        `definedChapters[${i}] incorrect: expected ${expected[i]}, got ${chapters[i]}`,
      );
    }
  }
}

/**
 * Verify the book UUID was preserved during migration.
 */
export function assertBookUuidPreserved(
  frontmatter: Record<string, unknown>,
  expectedBookId: string,
): void {
  const bookId = frontmatter.bookId as string | undefined;
  if (!bookId || bookId !== expectedBookId) {
    throw new Error(`Book UUID changed during migration: ${bookId}`);
  }
}
