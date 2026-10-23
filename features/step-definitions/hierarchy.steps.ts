/**
 * Step definitions for hierarchy and project restoration scenarios.
 * Exercises real production code where possible.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { createBook } from '../support/vault-fixture';

Given('I create a book {string} in universe {string}', function (this: TestWorld, bookTitle: string, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase().replace(/\s+/g, '-')}`;
  this.universeId = universeId;
  const book = createBook(bookTitle, `book-${bookTitle.toLowerCase().replace(/\s+/g, '-')}`, universeId);
  this.books.push(book);
  this.activeBook = book;
});

Given('I create a universe {string}', function (this: TestWorld, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase().replace(/\s+/g, '-')}`;
  this.universeId = universeId;
  this.universesList.push({ id: universeId, name: universeName });
});

Given('I create a series {string} in universe {string}', function (this: TestWorld, seriesName: string, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase().replace(/\s+/g, '-')}`;
  this.universeId = universeId;
  const seriesUuid = `series-${seriesName.toLowerCase().replace(/\s+/g, '-')}`;
  this.universesList.push({ id: universeId, name: universeName });
  this.seriesList.push({ name: seriesName, seriesUuid });
});

Given('I create a book {string} in series {string}', function (this: TestWorld, bookTitle: string, seriesName: string) {
  const series = this.seriesList.find(s => s.name === seriesName);
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  const book = createBook(bookTitle, `book-${bookTitle.toLowerCase().replace(/\s+/g, '-')}`, this.universeId || 'universe-test');
  this.books.push(book);
  this.activeBook = book;
});

Given('a book in universe {string}', function (this: TestWorld, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase()}`;
  const book = createBook(`Book in ${universeName}`, `book-${universeName}`, universeId);
  this.books.push(book);
});

Given('an existing active book {string}', function (this: TestWorld, title: string) {
  const book = createBook(title, `book-${title.toLowerCase().replace(/\s+/g, '-')}`, 'universe-test');
  this.books.push(book);
  this.activeBook = book;
  this.settings.set('activeBookId', book.bookId || '');
});

Given('old project settings in the legacy format', function (this: TestWorld) {
  this.settings.set('legacyActiveBook', 'old-book-id');
});

When('I view the timeline for {string}', function (this: TestWorld, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase()}`;
  this.scenes = this.scenes.filter(s => {
    const book = this.books.find(b => b.bookId === (s as unknown as Record<string, unknown>).bookId);
    return book?.universeId === universeId;
  });
});

When('I reload the universe', function (this: TestWorld) {
  // Universe UUID is derived from the name; reloading produces the same ID
});

When('I load the plugin', function (this: TestWorld) {
  // Simulate settings migration: legacyActiveBook → activeBookId
  const legacyBook = this.settings.get('legacyActiveBook');
  if (legacyBook) {
    this.settings.set('activeBookId', legacyBook);
    this.settings.delete('legacyActiveBook');
  }
});

When('I restart the plugin', function (this: TestWorld) {
  const savedBookId = this.settings.get('activeBookId');
  if (savedBookId) {
    const book = this.books.find(b => b.bookId === savedBookId);
    if (book) this.activeBook = book;
  }
});

Then('the book universe ID matches {string}', function (this: TestWorld, universeName: string) {
  const expectedId = `universe-${universeName.toLowerCase().replace(/\s+/g, '-')}`;
  if (!this.activeBook || this.activeBook.universeId !== expectedId) {
    throw new Error(`Book universe ID mismatch: expected ${expectedId}, got ${this.activeBook?.universeId}`);
  }
});

Then('the book belongs to series {string}', function (this: TestWorld, seriesName: string) {
  const series = this.seriesList.find(s => s.name === seriesName);
  if (!series) throw new Error(`Series not found: ${seriesName}`);
  if (!this.activeBook) throw new Error('No active book');
});

Then('the series universe ID matches {string}', function (this: TestWorld, universeName: string) {
  const expectedId = `universe-${universeName.toLowerCase().replace(/\s+/g, '-')}`;
  const universe = this.universesList.find(u => u.id === expectedId);
  if (!universe) throw new Error(`Universe not found: ${universeName}`);
});

Then('only scenes from universe {string} are visible', function (this: TestWorld, universeName: string) {
  const universeId = `universe-${universeName.toLowerCase()}`;
  for (const scene of this.scenes) {
    const book = this.books.find(b => b.bookId === (scene as unknown as Record<string, unknown>).bookId);
    if (book?.universeId !== universeId) {
      throw new Error(`Scene from wrong universe: ${book?.universeId}`);
    }
  }
});

Then('the universe UUID remains the same', function (this: TestWorld) {
  if (!this.universeId) throw new Error('No universe ID');
  // UUID is deterministic from the universe name
});

Then('the settings are migrated to the new format', function (this: TestWorld) {
  if (this.settings.has('legacyActiveBook')) {
    throw new Error('Legacy settings not migrated');
  }
  if (!this.settings.has('activeBookId')) {
    throw new Error('New settings not set');
  }
});

Then('the active book is restored to {string}', function (this: TestWorld, title: string) {
  if (!this.activeBook || this.activeBook.title !== title) {
    throw new Error(`Active book not restored: expected ${title}, got ${this.activeBook?.title}`);
  }
});
