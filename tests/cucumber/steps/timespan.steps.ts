/**
 * Step definitions for TimeSpan calculations and date precision.
 * Exercises real TimeSpanService and TimeSpan model.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import type { TimeSpan } from '../../../src/models/TimeSpan';

Given('I parse the date {string}', function (this: TestWorld, dateStr: string) {
  const tss = new TimeSpanService();
  this.lastParseResult = tss.parse(dateStr) ?? null;
  this.timeSpan = this.lastParseResult || undefined;
});

Given('I have a date {string}', function (this: TestWorld, dateStr: string) {
  const tss = new TimeSpanService();
  const ts = tss.parse(dateStr);
  if (!ts) throw new Error(`Failed to parse date: ${dateStr}`);
  this.timeSpan = ts;
});

Given('another date {string}', function (this: TestWorld, dateStr: string) {
  // Stored for comparison
  this.changelogOutput = dateStr;
});

Given('I create an invalid TimeSpan', function (this: TestWorld) {
  this.timeSpan = { kind: 'instant', instant: { calendar: 'invalid' } } as TimeSpan;
});

Given('I have a TimeSpan of kind {string}', function (this: TestWorld, kind: string) {
  const tss = new TimeSpanService();
  switch (kind) {
    case 'instant':
      this.timeSpan = tss.parse('2000-01-15') || undefined;
      break;
    case 'range':
      this.timeSpan = {
        kind: 'range',
        start: tss.parse('2000-01-01')!,
        end: tss.parse('2000-12-31')!,
      } as unknown as TimeSpan;
      break;
    case 'fuzzy':
      this.timeSpan = { kind: 'fuzzy', description: 'sometime in 2000' } as unknown as TimeSpan;
      break;
    default:
      throw new Error(`Unknown TimeSpan kind: ${kind}`);
  }
});

When('I compare the dates', function (this: TestWorld) {
  if (!this.timeSpan) throw new Error('No TimeSpan set');
  const date2 = this.changelogOutput;
  if (!date2) throw new Error('No second date');
  const tss = new TimeSpanService();
  const ts2 = tss.parse(date2);
  if (!ts2) throw new Error(`Failed to parse second date: ${date2}`);
  if (this.timeSpan.kind === 'instant' && ts2.kind === 'instant') {
    this.compareResult = tss.compareTimestamps(this.timeSpan.instant, ts2.instant);
  }
});

When('I validate it', function (this: TestWorld) {
  if (!this.timeSpan) throw new Error('No TimeSpan to validate');
  const tss = new TimeSpanService();
  this.lastValidationError = tss.validateTimeSpan(this.timeSpan) || null;
});

When('I inspect its structure', function (this: TestWorld) {
  // Structure is inspected in the Then step
});

Then('the result is a valid TimeSpan', function (this: TestWorld) {
  if (this.lastParseResult === null || this.lastParseResult === undefined) {
    throw new Error('Expected valid TimeSpan, got null');
  }
});

Then('the result is null', function (this: TestWorld) {
  if (this.lastParseResult !== null) {
    throw new Error(`Expected null, got ${JSON.stringify(this.lastParseResult)}`);
  }
});

Then('the precision is {string}', function (this: TestWorld, expectedPrecision: string) {
  if (!this.lastParseResult || this.lastParseResult.kind !== 'instant') {
    throw new Error('Expected instant TimeSpan');
  }
  const actual = this.lastParseResult.instant.precision;
  if (actual !== expectedPrecision) {
    throw new Error(`Expected precision ${expectedPrecision}, got ${actual}`);
  }
});

Then('the first date is before the second', function (this: TestWorld) {
  if (this.compareResult === undefined) throw new Error('No comparison result');
  if (this.compareResult >= 0) {
    throw new Error(`Expected negative comparison, got ${this.compareResult}`);
  }
});

Then('the first date is after the second', function (this: TestWorld) {
  if (this.compareResult === undefined) throw new Error('No comparison result');
  if (this.compareResult <= 0) {
    throw new Error(`Expected positive comparison, got ${this.compareResult}`);
  }
});

Then('the dates are equal', function (this: TestWorld) {
  if (this.compareResult === undefined) throw new Error('No comparison result');
  if (this.compareResult !== 0) {
    throw new Error(`Expected equal comparison, got ${this.compareResult}`);
  }
});

Then('a validation error is reported', function (this: TestWorld) {
  if (!this.lastValidationError) {
    throw new Error('Expected validation error, got null');
  }
});

Then('it has the expected properties for {string}', function (this: TestWorld, kind: string) {
  if (!this.timeSpan) throw new Error('No TimeSpan set');
  if (this.timeSpan.kind !== kind) {
    throw new Error(`Expected kind ${kind}, got ${this.timeSpan.kind}`);
  }
});
