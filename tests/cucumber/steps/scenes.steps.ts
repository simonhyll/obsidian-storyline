/**
 * Step definitions for scene management scenarios.
 *
 * Exercises real SceneManager with in-memory vault harness for persistence
 * integration testing. Tests actual file creation, saving, loading, and
 * UUID stability through production SceneManager methods.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { MetadataParser } from '../../../src/services/MetadataParser';
import { TimeSpanService } from '../../../src/services/TimeSpanService';
import { setupSceneManager } from '../support/scene-test-helpers';
import * as assert from '../support/scene-assertions';

Given('an active book {string}', function (this: TestWorld, title: string) {
  const bookId = `book-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const { sceneManager, project, vault } = setupSceneManager(bookId, title);
  this.sceneManager = sceneManager;
  this.activeBook = project;
  this.testVault = vault;
});

Given('no active book is selected', function (this: TestWorld) {
  this.activeBook = undefined;
  const { sceneManager, vault } = setupSceneManager('none', 'None');
  (sceneManager as unknown as Record<string, unknown>)._activeProject = null;
  this.sceneManager = sceneManager;
  this.testVault = vault;
});

Given('a scene {string} with date {string}', async function (this: TestWorld, title: string, date: string) {
  if (!this.activeBook) {
    const { sceneManager, project, vault } = setupSceneManager('book-test', 'Test Book');
    this.sceneManager = sceneManager;
    this.activeBook = project;
    this.testVault = vault;
  }
  this.sceneTitle = title;
  this.sceneDate = date;
  if (!this.sceneManager) throw new Error('SceneManager not initialized');
  const tss = new TimeSpanService();
  const timeSpan = tss.parse(date);
  if (!timeSpan) throw new Error(`Failed to parse date: ${date}`);
  const file = await this.sceneManager.createScene({ title, timeSpan });
  this.sceneFilePath = file.path;
  const storedFile = this.testVault!.files.get(file.path);
  if (storedFile) {
    const scene = MetadataParser.parseContent(storedFile.content, file.path);
    if (scene) {
      this.sceneId = scene.id;
      this.scenes = [scene];
    }
  }
});

Given('{int} scenes in chronological order', async function (this: TestWorld, count: number) {
  if (!this.activeBook) {
    const { sceneManager, project, vault } = setupSceneManager('book-test', 'Test Book');
    this.sceneManager = sceneManager;
    this.activeBook = project;
    this.testVault = vault;
  }
  // Create scenes deliberately out of chronological order: March, January, February
  const dates = ['2000-03-15', '2000-01-15', '2000-02-15'];
  this.scenes = [];
  this.sceneUuidsInOrder = [];
  for (let i = 0; i < count && i < dates.length; i++) {
    const file = await this.sceneManager!.createScene({
      title: `Scene ${i + 1}`,
      storyDate: dates[i],
    });
    const storedFile = this.testVault!.files.get(file.path);
    if (storedFile) {
      const scene = MetadataParser.parseContent(storedFile.content, file.path);
      if (scene) {
        this.scenes.push(scene);
        if (scene.id) this.sceneUuidsInOrder.push(scene.id);
      }
    }
  }
});

Given('a scene with UUID {string}', async function (this: TestWorld, uuid: string) {
  if (!this.activeBook) {
    const { sceneManager, project, vault } = setupSceneManager('book-test', 'Test Book');
    this.sceneManager = sceneManager;
    this.activeBook = project;
    this.testVault = vault;
  }
  this.sceneUuid = uuid;
  this.sceneTitle = 'Test Scene';
  const file = await this.sceneManager!.createScene({
    title: 'Test Scene',
    id: uuid,
  });
  this.sceneFilePath = file.path;
  const storedFile = this.testVault!.files.get(file.path);
  if (storedFile) {
    const scene = MetadataParser.parseContent(storedFile.content, file.path);
    if (scene) {
      this.sceneId = scene.id;
      this.scenes = [scene];
    }
  }
});

When('I create a scene {string}', async function (this: TestWorld, title: string) {
  if (!this.sceneManager) throw new Error('SceneManager not initialized');
  this.sceneTitle = title;
  const file = await this.sceneManager.createScene({ title });
  this.sceneFilePath = file.path;
  const storedFile = this.testVault!.files.get(file.path);
  if (storedFile) {
    const scene = MetadataParser.parseContent(storedFile.content, file.path);
    if (scene) {
      this.sceneId = scene.id;
      this.scenes = [scene];
    }
  }
});

When('I try to create a scene', async function (this: TestWorld) {
  if (!this.sceneManager) throw new Error('SceneManager not initialized');
  try {
    await this.sceneManager.createScene({ title: 'Test Scene' });
    throw new Error('Expected createScene to throw without active book');
  } catch (err) {
    this.lastError = err instanceof Error ? err : new Error(String(err));
  }
});

When('I reload the scene', async function (this: TestWorld) {
  if (!this.sceneFilePath) throw new Error('No scene file to reload');
  const storedFile = this.testVault!.files.get(this.sceneFilePath);
  if (!storedFile) throw new Error('Scene file not found in vault');
  const scene = MetadataParser.parseContent(storedFile.content, this.sceneFilePath);
  if (!scene) throw new Error('Failed to parse reloaded scene');
  this.scenes = [scene];
  this.sceneId = scene.id;
});

When('I view the manuscript', async function (this: TestWorld) {
  if (!this.sceneManager) throw new Error('SceneManager not initialized');
  const scenes = this.sceneManager.queryService.getFilteredScenes(
    undefined,
    { field: 'storyDate', direction: 'asc' },
  );
  this.scenes = scenes;
});

When('I update the scene', async function (this: TestWorld) {
  if (!this.sceneFilePath || !this.sceneManager) throw new Error('No scene to update');
  const original = this.testVault!.files.get(this.sceneFilePath);
  if (original) this.sceneOriginalContent = original.content;
  const result = await this.sceneManager.updateScene(this.sceneFilePath, {
    title: `${this.sceneTitle} (Updated)`,
  });
  if (result && typeof result === 'string') this.sceneFilePath = result;
});

Then('the scene is created in the book\'s scene folder', function (this: TestWorld) {
  assert.assertSceneInBookFolder(this);
});

Then('the scene has a valid UUID', function (this: TestWorld) {
  assert.assertSceneHasValidUUID(this);
});

Then('the scene belongs to {string}', function (this: TestWorld, bookTitle: string) {
  assert.assertSceneBelongsToBook(this, bookTitle);
});

Then('a scene error is shown', function (this: TestWorld) {
  assert.assertSceneErrorShown(this);
});

Then('no scene is created', function (this: TestWorld) {
  assert.assertNoSceneCreated(this);
});

Then('the scene date is preserved', function (this: TestWorld) {
  assert.assertSceneDatePreserved(this);
});

Then('the scene UUID is preserved', function (this: TestWorld) {
  assert.assertSceneUUIDPreserved(this);
});

Then('the scenes appear in the correct order', function (this: TestWorld) {
  assert.assertScenesInCorrectOrder(this);
});

Then('the UUID remains {string}', function (this: TestWorld, expectedUuid: string) {
  assert.assertUUIDRemains(this, expectedUuid);
});
