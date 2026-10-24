/**
 * ESM loader hook that intercepts 'obsidian' imports and redirects them
 * to the obsidian-mock.ts file, so production code works in Node.js tests.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const obsidianMockUrl = pathToFileURL(
  path.resolve('tests/cucumber/support/obsidian-mock.ts')
).toString();

export async function resolve(specifier, parent, nextResolve) {
  if (specifier === 'obsidian') {
    return nextResolve(obsidianMockUrl, parent, { conditionNames: ['import'] });
  }
  return nextResolve(specifier, parent);
}
