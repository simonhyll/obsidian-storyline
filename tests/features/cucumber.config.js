/** @type {import('@cucumber/cucumber').Configuration} */
module.exports = {
  require: ['tests/features/support/**/*.ts', 'tests/features/steps/**/*.ts'],
  requireModule: ['tsx/cjs'],
  format: ['progress-bar', 'summary'],
  publishQuiet: true,
};
