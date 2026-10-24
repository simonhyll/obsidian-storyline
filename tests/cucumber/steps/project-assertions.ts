/**
 * Assertion step definitions for project creation scenarios.
 *
 * Separated from projects.steps.ts to keep each file under the 200-line
 * architectural limit.
 */

import { Then } from '@cucumber/cucumber';
import { CreationValidationError } from '../../../src/services/projectCreation';

Then('the book is created with a valid UUID', function () {
	if (!this.createdProject) throw new Error('Book not created');
	if (!this.createdProject.bookId || !this.createdProject.bookId.length) {
		throw new Error('Book has no bookId');
	}
	const bookId = this.createdProject.bookId;
	if (bookId.startsWith('book-')) {
		const expected = `book-${this.bookTitle?.toLowerCase().replace(/\s+/g, '-')}`;
		if (bookId !== expected) {
			throw new Error(`Book ID mismatch: expected ${expected}, got ${bookId}`);
		}
	}
});

Then('the book folder structure is created', function () {
	if (!this.createdProject) throw new Error('Book not created');
	if (!this.createdFiles.has(this.createdProject.filePath)) {
		throw new Error(`Book file not created at ${this.createdProject.filePath}`);
	}
});

Then('the book becomes the active project', function () {
	if (!this.activeBook) throw new Error('No active book set');
	if (!this.createdProject) throw new Error('No created project');
	if (this.activeBook.bookId !== this.createdProject.bookId) {
		throw new Error(`Active book ID mismatch`);
	}
});

Then('an error is shown', function () {
	if (!this.lastError) throw new Error('No error was shown');
	if (!(this.lastError instanceof CreationValidationError)) {
		throw new Error(`Expected CreationValidationError, got ${this.lastError.name}`);
	}
});

Then('no files are created', function () {
	const before = this.filesBeforeCreation?.size || 0;
	if (this.createdFiles.size !== before) {
		throw new Error(`Files were created: ${before} -> ${this.createdFiles.size}`);
	}
});

Then('the book is created in the new series', function () {
	if (!this.createdProject) throw new Error('Book not created');
	if (!this.mockDepsLog) throw new Error('No mock deps log');
	if (!this.mockDepsLog.find((e: { action: string; args?: unknown[] }) => e.action === 'createSeries')) {
		throw new Error('createSeries was not called');
	}
	if (!this.mockDepsLog.find((e: { action: string; args?: unknown[] }) => e.action === 'addBookToSeries')) {
		throw new Error('addBookToSeries was not called');
	}
});

Then('the series is created with a valid UUID', function () {
	if (!this.mockDepsLog) throw new Error('No mock deps log');
	const entry = this.mockDepsLog.find((e: { action: string; args?: unknown[] }) => e.action === 'createSeries');
	if (!entry) throw new Error('createSeries was not called');
	if (entry.args?.[0] !== this.seriesName) {
		throw new Error(`Series name mismatch: expected ${this.seriesName}, got ${String(entry.args?.[0])}`);
	}
});

Then('the book is created in {string}', function (seriesName: string) {
	if (!this.createdProject) throw new Error('Book not created');
	if (!this.activeBook) throw new Error('No active book');
	if (!this.mockDepsLog) throw new Error('No mock deps log');
	const series = this.seriesList.find((s: { name: string; seriesUuid: string }) => s.name === seriesName);
	if (!series) throw new Error(`Series "${seriesName}" not found`);
	const entry = this.mockDepsLog.find((e: { action: string; args?: unknown[] }) => e.action === 'addBookToSeries');
	if (!entry) throw new Error('addBookToSeries was not called');
	if (entry.args?.[0] !== series.seriesUuid) {
		throw new Error(`addBookToSeries called with wrong UUID`);
	}
});

Then('the universe is created with a valid UUID', function () {
	if (!this.mockDepsLog) throw new Error('No mock deps log');
	const entry = this.mockDepsLog.find((e: { action: string; args?: unknown[] }) => e.action === 'createUniverse');
	if (!entry) throw new Error('createUniverse was not called');
	if (entry.args?.[0] !== this.universeName) {
		throw new Error(`Universe name mismatch: expected ${this.universeName}, got ${String(entry.args?.[0])}`);
	}
});

Then('the dialog closes', function () {
	if (!this.cancelled) throw new Error('Dialog was not cancelled');
	if (this.mockDepsLog && this.mockDepsLog.length > 0) {
		throw new Error('Persistence operations occurred during cancellation');
	}
});

Then('exactly one book is created', function () {
	if (this.createCount !== 1) {
		throw new Error(`Expected exactly 1 creation, got ${this.createCount}`);
	}
});

Then('only the latest result updates the dropdown', function () {
	if (!this.dropdownResults) throw new Error('No dropdown results');
	if (this.dropdownResults.length !== 1) {
		throw new Error(`Expected 1 result, got ${this.dropdownResults.length}`);
	}
	const result = this.dropdownResults[0];
	if (result.seriesUuid !== 'series-b') {
		throw new Error(`Expected series-b, got "${result.seriesUuid}"`);
	}
	if (result.name !== 'Series B') {
		throw new Error(`Expected "Series B", got "${result.name}"`);
	}
});
