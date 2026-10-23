/**
 * Step definitions for project creation scenarios (Given/When steps only).
 *
 * Then steps are in project-assertions.cjs to keep this file under 200 lines.
 * Exercises real project creation services via executeCreation.
 * Mock dependencies record all calls for verification.
 */
import { Given, When } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { executeCreation } from '../../../src/services/projectCreation';
import { makeRecordingDeps } from '../support/project-creation-mock';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS test helpers
const { runDropdownRaceTest } = require('../support/dropdown-race-test.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS test helper
const { runConcurrencyGuardTest } = require('../support/concurrency-guard-test.cjs');

// ---------------------------------------------------------------------------
// Given steps — form state setup
// ---------------------------------------------------------------------------

Given('I enter a book title {string}', function (this: TestWorld, title: string) {
    this.bookTitle = title;
    this.formState = {
        projectType: 'book',
        title,
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
    };
});

Given('I enter an empty book title', function (this: TestWorld) {
    this.bookTitle = '';
    this.formState = {
        projectType: 'book',
        title: '',
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
    };
});

Given('I select to create a new series {string}', function (this: TestWorld, name: string) {
    this.seriesName = name;
    if (this.formState) {
        this.formState.selectedSeriesUuid = '__new__';
        this.formState.newSeriesName = name;
    }
});

Given('an existing series {string}', function (this: TestWorld, name: string) {
    const seriesUuid = `series-${name.toLowerCase().replace(/\s+/g, '-')}`;
    this.seriesList.push({ name, seriesUuid });
});

Given('I select series {string}', function (this: TestWorld, name: string) {
    const series = this.seriesList.find(s => s.name === name);
    if (series && this.formState) {
        this.formState.selectedSeriesUuid = series.seriesUuid;
    }
});

Given('I enter a series name {string}', function (this: TestWorld, name: string) {
    this.seriesName = name;
    this.formState = {
        projectType: 'series',
        title: name,
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
    };
});

Given('I enter a universe name {string}', function (this: TestWorld, name: string) {
    this.universeName = name;
    this.formState = {
        projectType: 'universe',
        title: name,
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
    };
});

Given('I have opened the project creation dialog', function (this: TestWorld) {
    this.filesBeforeCreation = new Map(this.createdFiles);
});

// ---------------------------------------------------------------------------
// When steps — creation execution
// ---------------------------------------------------------------------------

When('I create the book', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    const deps = makeRecordingDeps(this);
    try {
        const project = await executeCreation(this.formState, deps);
        this.createdProject = project ?? undefined;
        if (project) {
            this.activeBook = project;
            this.books.push(project);
        }
    } catch (e) {
        this.lastError = e instanceof Error ? e : new Error(String(e));
    }
});

When('I try to create the book', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    try {
        await executeCreation(this.formState, makeRecordingDeps(this));
    } catch (e) {
        this.lastError = e instanceof Error ? e : new Error(String(e));
    }
});

When('I create the series', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    const deps = makeRecordingDeps(this);
    try {
        await executeCreation(this.formState, deps);
    } catch (e) {
        this.lastError = e instanceof Error ? e : new Error(String(e));
    }
});

When('I create the universe', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    const deps = makeRecordingDeps(this);
    try {
        await executeCreation(this.formState, deps);
    } catch (e) {
        this.lastError = e instanceof Error ? e : new Error(String(e));
    }
});

When('I cancel', function (this: TestWorld) {
    // Cancellation: no executeCreation call is made
    this.cancelled = true;
});

When('I click create twice rapidly', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    // Test the production isCreating guard from CreateProjectModal.handleCreate()
    const result = await runConcurrencyGuardTest(this, this.formState, makeRecordingDeps);
    if (result.createCallCount !== 1) {
        throw new Error(`Expected exactly 1 createProject call, got ${result.createCallCount}`);
    }
    this.createCount = result.createCallCount;
});

When('I change the universe selection quickly', function (this: TestWorld) {
    // Universe list setup — the actual async test runs in the next step
    this.universesList = [
        { id: 'universe-1', name: 'Universe 1' },
        { id: 'universe-2', name: 'Universe 2' },
    ];
});

When('the async results arrive out of order', async function (this: TestWorld) {
    // Exercise the real updateSeriesDropdownInPlace() via the dedicated helper.
    this.dropdownResults = await runDropdownRaceTest();
});

// ---------------------------------------------------------------------------
// Then steps are in project-assertions.cjs
// ---------------------------------------------------------------------------
