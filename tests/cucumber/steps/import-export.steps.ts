/**
 * Step definitions for import/export scenarios.
 * Exercises real ExportService and ScrivenerImporter availability.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { ExportSteps } from '../support/export-steps';

Given('3 scenes in the active book', function (this: TestWorld) {
  ExportSteps.setupExportTest(this, 3);
});

Given('5 scenes with distinct sequence numbers', function (this: TestWorld) {
  ExportSteps.setupExportTest(this, 5);
});

Given('the Scrivener importer is checked for availability', function (this: TestWorld) {
  // Availability check is exercised in the When step
});

When('I export the manuscript as markdown', function (this: TestWorld) {
  return ExportSteps.exportManuscript(this);
});

When('I export scenes 2 through 4 only', function (this: TestWorld) {
  return ExportSteps.exportWithRange(this, 2, 4);
});

When('running on a desktop platform', function (this: TestWorld) {
  ExportSteps.checkDesktopAvailability(this);
});

When('running on a mobile platform', function (this: TestWorld) {
  ExportSteps.checkMobileAvailability(this);
});

Then('a single combined markdown file is created', function (this: TestWorld) {
  ExportSteps.verifySingleExportFile(this);
});

Then('the file contains all scene bodies in order', function (this: TestWorld) {
  ExportSteps.verifyExportContent(this);
});

Then('only the selected scenes are included in the export', function (this: TestWorld) {
  ExportSteps.verifyExportRange(this);
});

Then('Scrivener import is available', function (this: TestWorld) {
  ExportSteps.verifyScrivenerAvailable(this);
});

Then('Scrivener import is not available', function (this: TestWorld) {
  ExportSteps.verifyScrivenerNotAvailable(this);
});
