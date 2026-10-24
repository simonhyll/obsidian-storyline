/**
 * Step definitions for project creation scenarios (Given/When steps only).
 *
 * Then steps are in project-assertions.ts to keep this file under 200 lines.
 * Exercises real project creation services via executeCreation.
 * Mock dependencies record all calls for verification.
 */
import { Given, When } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { executeCreation } from '../../../src/services/projectCreation';
import { makeRecordingDeps } from '../support/project-creation-mock';
import { runDropdownRaceTest } from '../support/dropdown-race-test';
import { runConcurrencyGuardTest } from '../support/concurrency-guard-test';

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
    const series = this.seriesList.find((s: { name: string; seriesUuid: string }) => s.name === name);
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

When('I cancel', async function (this: TestWorld) {
    // Exercise the real CreateProjectModal cancellation by clicking the
    // actual Cancel button. The modal resolves to null and no creation
    // operations should be triggered.
    const { testCreateProjectCancel } = await import('../support/cancellation-helpers');
    await testCreateProjectCancel();
    this.cancelled = true;
});

When('I click create twice rapidly', async function (this: TestWorld) {
    if (!this.formState) throw new Error('No form state');
    // Test the production CreationConcurrencyGuard from CreateProjectModal.
    // The helper verifies: second call blocked, guard released after completion,
    // guard released after failure, and subsequent calls work.
    await runConcurrencyGuardTest(this, this.formState, makeRecordingDeps);
    this.createCount = 1; // Exactly one creation from the two rapid clicks
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
// Then steps are in project-assertions.ts
// ---------------------------------------------------------------------------
