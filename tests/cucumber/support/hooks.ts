/**
 * Cucumber hooks — initialize the test world before each scenario.
 */
import { Before } from '@cucumber/cucumber';
import { TestWorld } from './world';

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
});
