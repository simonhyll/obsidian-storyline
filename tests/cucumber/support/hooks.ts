/**
 * Cucumber hooks — initialize the test world before each scenario.
 *
 * Sets up the Obsidian module mock so that production code importing
 * from 'obsidian' (TFile, parseYaml, stringifyYaml) works in Node.js.
 * Runs vault harness regression tests at bootstrap time.
 */
import { Before, BeforeAll } from '@cucumber/cucumber';
import { TestWorld } from './world';
import { runVaultHarnessTests } from './vault-harness-tests';
import { runMigrationIntegrationTests } from './migration-integration-tests';
import { runSettingsPayloadTests } from './settings-payload-tests';

// Patch the 'obsidian' module in the module registry so that production
// code (EventManager, SceneManager) can import TFile, parseYaml, and
// stringifyYaml without failing. The real 'obsidian' package is types-only.
// The ESM hook (obsidian-hook.mjs) handles ESM imports; this CJS patch
// handles any remaining CommonJS require() calls.
import { createRequire } from 'node:module';
const requireCjs = createRequire(import.meta.url);
const Module = requireCjs('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]): string {
    if (request === 'obsidian') {
        return requireCjs.resolve('./obsidian-mock');
    }
    return originalResolveFilename.apply(this, [request, ...rest]);
};

// Run vault harness, migration safety, settings payload, and headless modal regression tests
BeforeAll(async () => {
    await runVaultHarnessTests();
    runMigrationIntegrationTests();
    await runSettingsPayloadTests();
    // Load headless modal tests after the obsidian module patch is in place
    const { runHeadlessModalTests } = await import('./headless-modal-tests');
    await runHeadlessModalTests();
});

Before(function (this: TestWorld) {
  this.scenes = [];
  this.events = [];
  this.books = [];
  this.universeId = undefined;
  this.universeId2 = undefined;
  this.activeBook = undefined;
  this.createdFiles = new Map();
  this.timelineItems = [];
  this.selectableBooks = [];
  this.cancelled = false;
  this.filesBeforeCreation = new Map();
  this.eventName = undefined;
  this.timeSpan = undefined;
  this.settings = new Map();
  this.changelogOutput = undefined;
  this.changelogError = undefined;
  this.changelogCommits = undefined;
  this.classifiedCommit = undefined;
  this.changelogContent = undefined;
  this.changelogContentModified = undefined;
  this.existingTag = undefined;
  this.filesModified = undefined;
  this.lastError = undefined;
  this.createdProject = undefined;
  this.formState = undefined;
  this.seriesList = [];
  this.universesList = [];
  this.lastParseResult = undefined;
  this.compareResult = undefined;
  this.lastValidationError = undefined;
  this.exportedCount = undefined;
  this.isDesktop = undefined;
  this.bookTitle = undefined;
  this.seriesName = undefined;
  this.universeName = undefined;
  this.createCount = undefined;
  this.lastEvent = undefined;
  this.sceneTitle = undefined;
  this.sceneUuid = undefined;
  this.mockDepsLog = undefined;
  this.dropdownResults = undefined;
  this.latestRequestId = undefined;
  this.navService = undefined;
  this.lastNavigationResult = undefined;
  this.testVault = undefined;
  this.eventManager = undefined;
  this.eventsFolder = undefined;
});
