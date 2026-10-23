/**
 * Step definitions for TimeSpan calculations and date precision.
 * Exercises real TimeSpanService and TimeSpan model.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { TimeSpanService } from '../../src/services/TimeSpanService';
import type { TimeSpan } from '../../src/models/TimeSpan';

let timeSpanService: TimeSpanService;
let timeSpan1: TimeSpan | null = null;
let timeSpan2: TimeSpan | null = null;
let compareResult: number = 0;
let lastParseResult: TimeSpan | null = null;
let lastValidationError: string | null = null;

Given('I parse the date {string}', function (this: TestWorld, dateStr: string) {
  timeSpanService = new TimeSpanService();
  lastParseResult = timeSpanService.parse(dateStr);
  this.timeSpan = lastParseResult || undefined;
});

Given('I have a date {string}', function (this: TestWorld, dateStr: string) {
  timeSpanService = new TimeSpanService();
  timeSpan1 = timeSpanService.parse(dateStr);
  if (!timeSpan1) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }
});

Given('another date {string}', function (this: TestWorld, dateStr: string) {
  timeSpan2 = timeSpanService.parse(dateStr);
  if (!timeSpan2) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }
});

Given('I create an invalid TimeSpan', function (this: TestWorld) {
  // Create a malformed TimeSpan
  this.timeSpan = { kind: 'instant', instant: { calendar: 'invalid' } } as TimeSpan;
});

Given('I have a TimeSpan of kind {string}', function (this: TestWorld, kind: string) {
  timeSpanService = new TimeSpanService();
  switch (kind) {
    case 'instant':
      this.timeSpan = timeSpanService.parse('2000-01-15') || undefined;
      break;
    case 'range':
      this.timeSpan = {
        kind: 'range',
        start: timeSpanService.parse('2000-01-01')!,
        end: timeSpanService.parse('2000-12-31')!,
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
  if (!timeSpan1 || !timeSpan2) {
    throw new Error('TimeSpans not set');
  }
  if (timeSpan1.kind === 'instant' && timeSpan2.kind === 'instant') {
    compareResult = timeSpanService.compareTimestamps(
      timeSpan1.instant,
      timeSpan2.instant,
    );
  }
});

When('I validate it', function (this: TestWorld) {
  if (!this.timeSpan) {
    throw new Error('No TimeSpan to validate');
  }
  lastValidationError = timeSpanService.validateTimeSpan(this.timeSpan);
});

When('I inspect its structure', function (this: TestWorld) {
  // Structure is inspected in the Then step
});

Then('the result is a valid TimeSpan', function (this: TestWorld) {
  if (!lastParseResult) {
    throw new Error('Expected valid TimeSpan, got null');
  }
});

Then('the result is null', function (this: TestWorld) {
  if (lastParseResult !== null) {
    throw new Error(`Expected null, got ${JSON.stringify(lastParseResult)}`);
  }
});

Then('the precision is {string}', function (this: TestWorld, expectedPrecision: string) {
  if (!lastParseResult || lastParseResult.kind !== 'instant') {
    throw new Error('Expected instant TimeSpan');
  }
  const actual = lastParseResult.instant.precision;
  if (actual !== expectedPrecision) {
    throw new Error(`Expected precision ${expectedPrecision}, got ${actual}`);
  }
});

Then('the first date is before the second', function (this: TestWorld) {
  if (compareResult >= 0) {
    throw new Error(`Expected negative comparison, got ${compareResult}`);
  }
});

Then('the first date is after the second', function (this: TestWorld) {
  if (compareResult <= 0) {
    throw new Error(`Expected positive comparison, got ${compareResult}`);
  }
});

Then('the dates are equal', function (this: TestWorld) {
  if (compareResult !== 0) {
    throw new Error(`Expected equal comparison, got ${compareResult}`);
  }
});

Then('a validation error is reported', function (this: TestWorld) {
  if (!lastValidationError) {
    throw new Error('Expected validation error, got null');
  }
});

Then('it has the expected properties for {string}', function (this: TestWorld, kind: string) {
  if (!this.timeSpan) {
    throw new Error('No TimeSpan set');
  }
  if (this.timeSpan.kind !== kind) {
    throw new Error(`Expected kind ${kind}, got ${this.timeSpan.kind}`);
  }
});
