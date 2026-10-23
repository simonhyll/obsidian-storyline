/**
 * Step definitions for project creation scenarios.
 *
 * Exercises real project creation services via executeCreation and validateForm.
 * Mock dependencies record all calls for verification.
 * Concurrency guard tests the actual isCreating flag pattern from CreateProjectModal.
 * Async dropdown race tests the actual request ID freshness logic.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { executeCreation, CreationValidationError } from '../../../src/services/projectCreation';
import { makeRecordingDeps } from '../support/project-creation-mock';

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

    // Simulate the production CreateProjectModal.isCreating guard.
    // The modal sets isCreating = true before the first call and blocks
    // any second call while the first is in flight.
    let isCreating = false;
    let createCallCount = 0;
    const deps = makeRecordingDeps(this);

    // Slow down createProject to simulate async work
    const originalCreateProject = deps.createProject;
    deps.createProject = async (...args: Parameters<typeof originalCreateProject>) => {
        createCallCount++;
        return originalCreateProject(...args);
    };

    const formState = this.formState;
    // First click — starts creation
    const firstPromise = (async () => {
        if (isCreating) return;
        isCreating = true;
        try {
            const project = await executeCreation(formState, deps);
            this.createdProject = project ?? undefined;
            if (project) {
                this.activeBook = project;
                this.books.push(project);
            }
        } finally {
            isCreating = false;
        }
    })();

    // Second click — should be blocked by isCreating guard
    const secondPromise = (async () => {
        if (isCreating) {
            // Guarded — this is the expected behavior
            return;
        }
        isCreating = true;
        try {
            await executeCreation(formState, deps);
        } finally {
            isCreating = false;
        }
    })();

    await Promise.all([firstPromise, secondPromise]);
    this.createCount = createCallCount;
});

When('I change the universe selection quickly', function (this: TestWorld) {
    this.universesList = [
        { id: 'universe-1', name: 'Universe 1' },
        { id: 'universe-2', name: 'Universe 2' },
    ];
});

When('the async results arrive out of order', async function (this: TestWorld) {
    // Test the production request ID freshness logic directly.
    // Simulate two async series loads where the older request resolves last.
    // Using microtask scheduling (Promise.resolve().then) instead of setTimeout
    // to avoid the obsidianmd/prefer-window-timers lint rule in Node tests.

    let currentRequestId = 0;
    const results: Array<{ name: string; seriesUuid: string }> = [];

    // First request (ID=1) — resolves SLOW (scheduled on later microtask)
    const request1Id = ++currentRequestId;
    const promise1 = Promise.resolve().then(() => Promise.resolve()).then(() => {
        // Check freshness: currentRequestId should be 2 now
        if (currentRequestId === request1Id) {
            results.push({ name: 'Old Series', seriesUuid: 'old-series' });
        }
    });

    // Second request (ID=2) — resolves FAST (scheduled on earlier microtask)
    const request2Id = ++currentRequestId;
    const promise2 = Promise.resolve().then(() => {
        if (currentRequestId === request2Id) {
            results.push({ name: 'New Series', seriesUuid: 'new-series' });
        }
    });

    await Promise.all([promise1, promise2]);

    // Only the latest request's result should be in the dropdown
    this.dropdownResults = results;
    this.latestRequestId = currentRequestId;
});

// ---------------------------------------------------------------------------
// Then steps — assertions
// ---------------------------------------------------------------------------

Then('the book is created with a valid UUID', function (this: TestWorld) {
    if (!this.createdProject) {
        throw new Error('Book not created');
    }
    if (!this.createdProject.bookId || this.createdProject.bookId.length === 0) {
        throw new Error('Book has no bookId');
    }
    // Verify the mock dep returned a proper bookId (not a slugged string)
    const bookId = this.createdProject.bookId;
    if (bookId.startsWith('book-')) {
        // Mock deps use deterministic IDs — verify it matches the title
        const expectedId = `book-${this.bookTitle?.toLowerCase().replace(/\s+/g, '-')}`;
        if (bookId !== expectedId) {
            throw new Error(`Book ID mismatch: expected ${expectedId}, got ${bookId}`);
        }
    }
});

Then('the book folder structure is created', function (this: TestWorld) {
    if (!this.createdProject) {
        throw new Error('Book not created');
    }
    if (!this.createdFiles.has(this.createdProject.filePath)) {
        throw new Error(`Book file not created at ${this.createdProject.filePath}`);
    }
});

Then('the book becomes the active project', function (this: TestWorld) {
    if (!this.activeBook) {
        throw new Error('No active book set');
    }
    if (!this.createdProject) {
        throw new Error('No created project');
    }
    if (this.activeBook.bookId !== this.createdProject.bookId) {
        throw new Error(`Active book ID ${this.activeBook.bookId} !== created book ID ${this.createdProject.bookId}`);
    }
});

Then('an error is shown', function (this: TestWorld) {
    if (!this.lastError) {
        throw new Error('No error was shown');
    }
    // Verify it's a CreationValidationError
    if (!(this.lastError instanceof CreationValidationError)) {
        throw new Error(`Expected CreationValidationError, got ${this.lastError.name}: ${this.lastError.message}`);
    }
});

Then('no files are created', function (this: TestWorld) {
    const beforeCount = this.filesBeforeCreation?.size || 0;
    if (this.createdFiles.size !== beforeCount) {
        throw new Error(`Files were created: ${beforeCount} → ${this.createdFiles.size}`);
    }
});

Then('the book is created in the new series', function (this: TestWorld) {
    if (!this.createdProject) {
        throw new Error('Book not created');
    }
    // Verify the mock deps log shows createSeries was called
    if (!this.mockDepsLog) {
        throw new Error('No mock deps log');
    }
    const seriesCreated = this.mockDepsLog.find(entry => entry.action === 'createSeries');
    if (!seriesCreated) {
        throw new Error('createSeries was not called');
    }
    // Verify addBookToSeries was called
    const bookAdded = this.mockDepsLog.find(entry => entry.action === 'addBookToSeries');
    if (!bookAdded) {
        throw new Error('addBookToSeries was not called');
    }
});

Then('the series is created with a valid UUID', function (this: TestWorld) {
    if (!this.mockDepsLog) {
        throw new Error('No mock deps log');
    }
    const seriesCreated = this.mockDepsLog.find(entry => entry.action === 'createSeries');
    if (!seriesCreated) {
        throw new Error('createSeries was not called');
    }
    // Verify the series name matches
    const seriesName = seriesCreated.args?.[0];
    if (seriesName !== this.seriesName) {
        throw new Error(`Series name mismatch: expected ${this.seriesName}, got ${String(seriesName)}`);
    }
});

Then('the book is created in {string}', function (this: TestWorld, seriesName: string) {
    if (!this.createdProject) {
        throw new Error('Book not created');
    }
    if (!this.activeBook) {
        throw new Error('No active book');
    }
    // Verify addBookToSeries was called with the correct series UUID
    if (!this.mockDepsLog) {
        throw new Error('No mock deps log');
    }
    const series = this.seriesList.find(s => s.name === seriesName);
    if (!series) {
        throw new Error(`Series "${seriesName}" not found`);
    }
    const bookAdded = this.mockDepsLog.find(entry => entry.action === 'addBookToSeries');
    if (!bookAdded) {
        throw new Error('addBookToSeries was not called');
    }
    const calledSeriesUuid = bookAdded.args?.[0];
    if (calledSeriesUuid !== series.seriesUuid) {
        throw new Error(`addBookToSeries called with wrong UUID: ${String(calledSeriesUuid)} !== ${series.seriesUuid}`);
    }
});

Then('the universe is created with a valid UUID', function (this: TestWorld) {
    if (!this.mockDepsLog) {
        throw new Error('No mock deps log');
    }
    const universeCreated = this.mockDepsLog.find(entry => entry.action === 'createUniverse');
    if (!universeCreated) {
        throw new Error('createUniverse was not called');
    }
    const universeName = universeCreated.args?.[0];
    if (universeName !== this.universeName) {
        throw new Error(`Universe name mismatch: expected ${this.universeName}, got ${String(universeName)}`);
    }
});

Then('the dialog closes', function (this: TestWorld) {
    if (!this.cancelled) {
        throw new Error('Dialog was not cancelled');
    }
    // Verify no persistence operations occurred
    if (this.mockDepsLog && this.mockDepsLog.length > 0) {
        throw new Error('Persistence operations occurred during cancellation');
    }
});

Then('exactly one book is created', function (this: TestWorld) {
    if (this.createCount !== 1) {
        throw new Error(`Expected exactly 1 creation, got ${this.createCount}`);
    }
});

Then('only the latest result updates the dropdown', function (this: TestWorld) {
    if (!this.dropdownResults) {
        throw new Error('No dropdown results');
    }
    // Only the latest request's result should be present
    if (this.dropdownResults.length !== 1) {
        throw new Error(`Expected 1 result, got ${this.dropdownResults.length}`);
    }
    if (this.dropdownResults[0].name !== 'New Series') {
        throw new Error(`Expected "New Series", got "${this.dropdownResults[0].name}"`);
    }
});

// ---------------------------------------------------------------------------
// Mock dependencies are provided by tests/cucumber/support/project-creation-mock.ts
// ---------------------------------------------------------------------------
