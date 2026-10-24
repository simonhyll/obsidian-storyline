
import { register } from 'tsx/esm/api';
import { register as registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register();

// Patch ESM resolution so that 'obsidian' imports resolve to our mock
// instead of the types-only package. This runs before any support/step
// files are loaded, so production code importing from 'obsidian' works.
const obsidianMockPath = pathToFileURL(
  path.resolve('tests/cucumber/support/obsidian-mock.ts')
).toString();

registerHooks('./tests/cucumber/support/obsidian-hook.mjs', import.meta.url);

const rerunFile = 'tests/cucumber/rerun.txt';

const common = {
  import: [
    'tests/cucumber/support/**/*.ts',
    'tests/cucumber/steps/**/*.ts'
  ],
  tags: 'not @ignore'
};

export default {
  ...common,
  paths: ['features/**/*.feature'],
  format: [
    'progress-bar',
    `rerun:${rerunFile}`
  ]
};

export const rerun = {
  ...common,
  paths: [`@${rerunFile}`],
  format: [
    'progress-bar',
    `rerun:${rerunFile}`
  ]
};
