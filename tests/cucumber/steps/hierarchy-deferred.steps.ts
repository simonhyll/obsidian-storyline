/**
 * Step definitions for deferred hierarchy scenarios.
 *
 * These scenarios (legacy migration and project restart) remain simulated
 * and are deferred to Step 6C.4b.3b.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

// ── Deferred: Legacy settings migration (simulated) ──

Given('old project settings in the legacy format', function (this: TestWorld) {
  this.settings.set('legacyActiveBook', 'old-book-id');
});

When('I load the plugin', function (this: TestWorld) {
  const legacyBook = this.settings.get('legacyActiveBook');
  if (legacyBook) {
    this.settings.set('activeBookId', legacyBook);
    this.settings.delete('legacyActiveBook');
  }
});

Then('the settings are migrated to the new format', function (this: TestWorld) {
  if (this.settings.has('legacyActiveBook')) throw new Error('Legacy settings not migrated');
  if (!this.settings.has('activeBookId')) throw new Error('New settings not set');
});

// ── Deferred: Project restoration after restart (simulated) ──

Given('an existing active book {string}', function (this: TestWorld, title: string) {
  const bookId = crypto.randomUUID();
  const book = { bookId, title, filePath: `StoryLine/${title}/${title}.md` } as StoryLineProject;
  this.books.push(book);
  this.activeBook = book;
  this.settings.set('activeBookId', bookId);
});

When('I restart the plugin', function (this: TestWorld) {
  const savedBookId = this.settings.get('activeBookId');
  if (savedBookId) {
    const book = this.books.find(b => b.bookId === savedBookId);
    if (book) this.activeBook = book;
  }
});

Then('the active book is restored to {string}', function (this: TestWorld, title: string) {
  if (!this.activeBook || this.activeBook.title !== title) {
    throw new Error(`Active book not restored: expected ${title}, got ${this.activeBook?.title}`);
  }
});
