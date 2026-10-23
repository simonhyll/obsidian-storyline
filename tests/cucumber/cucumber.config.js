/** @type {import('@cucumber/cucumber').Configuration} */
module.exports = {
  // Gherkin specifications live in features/ (human-readable, used for docs).
  // Executable test infrastructure lives in tests/cucumber/.
  // All paths are relative to the project root (CWD).
  defaultDurations: {
    stepTimeout: 30_000,
  },
  paths: ['features/**/*.feature'],
  require: ['tests/cucumber/support/**/*.ts', 'tests/cucumber/steps/**/*.ts'],
  requireModule: ['tsx/cjs'],
  format: ['progress-bar', 'summary'],
  publishQuiet: true,
};
