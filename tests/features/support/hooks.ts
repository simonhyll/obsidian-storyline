/**
 * Cucumber hooks — initialize the test world before each scenario.
 */
import { Before } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';

Before(function (this: TestWorld) {
  this.scenes = [];
  this.events = [];
  this.books = [];
  this.universeId = undefined;
  this.universeId2 = undefined;
  this.activeBook = undefined;
  this.createdFiles = new Map();
  this.timelineItems = [];
  this.cancelled = false;
  this.filesBeforeCreation = new Map();
});
