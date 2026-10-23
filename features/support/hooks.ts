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
  this.characters = [];
  this.locations = [];
  this.codexCategories = [];
  this.settings = new Map();
  this.changelogOutput = undefined;
  this.lastError = undefined;
  this.createdProject = undefined;
  this.formState = undefined;
  this.dropdownRequestIds = [];
  this.seriesList = [];
  this.universesList = [];
});
