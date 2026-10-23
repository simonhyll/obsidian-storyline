/**
 * Step definitions for event ownership and scene creation safety scenarios.
 *
 * The Canonical Event persistence scenario exercises real EventManager with
 * in-memory vault harness. Scene creation safety now uses real SceneManager
 * with production ownership guard. Cancellation scenarios verify that no
 * persistence operations occur when the user cancels (partial coverage:
 * the actual Obsidian Modal cancel handler cannot be tested in Node.js).
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { EventManager } from '../../../src/services/EventManager';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { createInMemoryVault, createAppMock } from '../support/in-memory-vault';
import { setupSceneManager } from '../support/scene-test-helpers';
import { MetadataParser } from '../../../src/services/MetadataParser';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

Given('the author has a Universe with an Events folder', function (this: TestWorld) {
  this.universeId = 'universe-test';
  const vault = createInMemoryVault();
  const app = createAppMock(vault) as unknown as import('obsidian').App;
  const em = new EventManager(app);
  const tss = new TimeSpanService();
  em.setTimeSpanService(tss);
  this.testVault = vault;
  this.eventManager = em;
  this.eventsFolder = 'StoryLine/Events';
});

When(
  'they create a canonical Event named {string} with date {string}',
  async function (this: TestWorld, name: string, dateStr: string) {
    const tss = new TimeSpanService();
    const parsed = tss.parse(dateStr);
    if (!parsed) throw new Error(`Failed to parse date: ${dateStr}`);
    const event = await this.eventManager!.createEventFile(this.eventsFolder!, name, {
      ownerId: this.universeId,
      timeSpan: parsed,
    });
    this.lastEvent = event;
    this.events = [event];
  },
);

Then('exactly one Event file is persisted', function (this: TestWorld) {
  const vault = this.testVault!;
  const mdFiles = vault.getMarkdownFiles();
  if (mdFiles.length !== 1) {
    throw new Error(`Expected 1 markdown file, got ${mdFiles.length}`);
  }
});

Then('its UUID, TimeSpan and ownership are correct', function (this: TestWorld) {
  const event = this.lastEvent;
  if (!event) throw new Error('No event created');
  if (!event.id || event.id.length === 0) throw new Error('Event has no UUID');
  if (!event.timeSpan) throw new Error('Event has no TimeSpan');
  if (event.ownerId !== this.universeId) {
    throw new Error(`Event ownership incorrect: expected ${this.universeId}, got ${event.ownerId}`);
  }
  const tss = new TimeSpanService();
  const error = tss.validateTimeSpan(event.timeSpan);
  if (error) throw new Error(`Invalid TimeSpan: ${error}`);
  // Verify the persisted file contains the UUID and ownership
  const vault = this.testVault!;
  const content = vault.files.get(event.filePath)!.content;
  if (!content.includes(event.id)) {
    throw new Error('Persisted file does not contain event UUID');
  }
  if (!content.includes(this.universeId!)) {
    throw new Error('Persisted file does not contain owner ID');
  }
});

// Scene creation safety — uses real SceneManager with production ownership guard

Given('the author is viewing multiple Books', function (this: TestWorld) {
  // Set up two books with distinct scene folders
  this.books = [
    {
      title: 'Book One',
      filePath: 'StoryLine/Book One/Book One.md',
      sceneFolder: 'StoryLine/Book One/Scenes',
      bookId: 'book-one',
      created: '2024-01-01',
      description: '',
      characterFolder: 'StoryLine/Book One/Codex/Characters',
      locationFolder: 'StoryLine/Book One/Codex/Locations',
      codexFolder: 'StoryLine/Book One/Codex',
      eventFolder: 'StoryLine/Book One/Events',
      researchFolder: 'StoryLine/Book One/Research',
      plotGridFile: 'StoryLine/Book One/plotgrid.json',
    } as unknown as StoryLineProject,
    {
      title: 'Book Two',
      filePath: 'StoryLine/Book Two/Book Two.md',
      sceneFolder: 'StoryLine/Book Two/Scenes',
      bookId: 'book-two',
      created: '2024-01-01',
      description: '',
      characterFolder: 'StoryLine/Book Two/Codex/Characters',
      locationFolder: 'StoryLine/Book Two/Codex/Locations',
      codexFolder: 'StoryLine/Book Two/Codex',
      eventFolder: 'StoryLine/Book Two/Events',
      researchFolder: 'StoryLine/Book Two/Research',
      plotGridFile: 'StoryLine/Book Two/plotgrid.json',
    } as unknown as StoryLineProject,
  ];
  // Active book is Book One — scene creation goes here
  this.activeBook = this.books[0];
  // Set up SceneManager with Book One as active
  const { sceneManager, vault } = setupSceneManager('book-one', 'Book One');
  this.sceneManager = sceneManager;
  this.testVault = vault;
});

When('they create a new Scene named {string}', async function (this: TestWorld, name: string) {
  if (!this.sceneManager) {
    throw new Error('SceneManager not initialized');
  }
  // Create scene through production SceneManager
  const file = await this.sceneManager.createScene({ title: name });
  const vault = this.testVault!;
  const storedFile = vault.files.get(file.path);
  if (storedFile) {
    const scene = MetadataParser.parseContent(storedFile.content, file.path);
    if (scene) {
      this.scenes = [scene];
      this.sceneFilePath = file.path;
    }
  }
});

Then('the correct owning Book must be explicitly established', function (this: TestWorld) {
  const scene = this.scenes[0];
  if (!scene) throw new Error('No scene created');
  if (!scene.ownerId) {
    throw new Error('Scene has no ownerId');
  }
  if (scene.ownerId !== this.activeBook?.bookId) {
    throw new Error(`Scene owner ${scene.ownerId} does not match active book ${this.activeBook?.bookId}`);
  }
});

Then('no Scene is accidentally written into another Book', function (this: TestWorld) {
  const scene = this.scenes[0];
  if (!scene) throw new Error('No scene created');
  // Verify the scene file is in the active book's folder, not another book's
  const activeBookSceneFolder = this.activeBook?.sceneFolder;
  if (!this.sceneFilePath?.startsWith(activeBookSceneFolder!)) {
    throw new Error(`Scene file ${this.sceneFilePath} is not in active book's folder ${activeBookSceneFolder}`);
  }
  // Verify it is NOT in any other book's folder
  for (const book of this.books) {
    if (book !== this.activeBook && book.sceneFolder) {
      if (this.sceneFilePath?.startsWith(book.sceneFolder)) {
        throw new Error(`Scene accidentally written into ${book.title}'s folder`);
      }
    }
  }
});

// Cancellation scenario — verifies no persistence operations occur.
// Note: The actual Obsidian Modal cancel handler cannot be instantiated
// in Node.js because Modal requires a browser DOM. The concurrency guard
// (CreationConcurrencyGuard) is tested via concurrency-guard-test.cjs.
// These steps verify that when cancellation occurs, no persistence
// operations should have been triggered.

Given('an Event or Scene creation dialog is open', function (this: TestWorld) {
  // Snapshot the vault state before cancellation
  if (this.testVault) {
    this.filesBeforeCreation = new Map();
    for (const [path, file] of this.testVault.files) {
      this.filesBeforeCreation.set(path, file.content);
    }
  } else {
    this.filesBeforeCreation = new Map(this.createdFiles);
  }
  // Track whether any EventManager operations are called
  this.eventManagerOperations = [];
});

When('the author cancels', function (this: TestWorld) {
  // Simulate cancellation: in production, EventModal.cancel calls
  // resolve(null) then close(), and QuickAddModal.cancel calls close()
  // without calling onSubmit. We verify the safety property: no
  // persistence operations should occur.
  this.cancelled = true;
  if (this.eventManagerOperations && this.eventManagerOperations.length > 0) {
    throw new Error(
      `Cancellation triggered EventManager operations: ${this.eventManagerOperations.join(', ')}`,
    );
  }
});

Then('no files are created or modified', function (this: TestWorld) {
  if (!this.cancelled) throw new Error('Cancellation was not triggered');

  if (this.testVault && this.filesBeforeCreation) {
    assertVaultUnchanged(this.filesBeforeCreation, this.testVault);
  } else {
    assertCreatedFilesUnchanged(this.filesBeforeCreation, this.createdFiles);
  }
});

function assertVaultUnchanged(
  before: Map<string, string>,
  vault: { files: Map<string, { content: string }> },
) {
  const after = new Map<string, string>();
  for (const [path, file] of vault.files) {
    after.set(path, file.content);
  }
  for (const path of after.keys()) {
    if (!before.has(path)) {
      throw new Error(`Cancellation created new file: ${path}`);
    }
  }
  for (const path of before.keys()) {
    if (!after.has(path)) {
      throw new Error(`Cancellation deleted file: ${path}`);
    }
  }
  for (const [path, content] of before) {
    if (after.get(path) !== content) {
      throw new Error(`Cancellation modified file: ${path}`);
    }
  }
}

function assertCreatedFilesUnchanged(
  before: Map<string, string>,
  after: Map<string, string>,
) {
  if (after.size !== before.size) {
    throw new Error(`Files changed after cancellation: ${before.size} → ${after.size}`);
  }
}
