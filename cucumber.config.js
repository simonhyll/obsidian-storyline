/** @type {import('@cucumber/cucumber').Configuration} */
module.exports = {
  require: ['features/support/**/*.ts', 'features/step-definitions/**/*.ts'],
  requireModule: ['tsx/cjs'],
  format: ['progress-bar', 'summary'],
  publishQuiet: true,
};
