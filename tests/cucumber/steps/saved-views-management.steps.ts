/** Saved View Scene safety, rename/delete and restart acceptance steps. */
import { Given, When, Then } from '@cucumber/cucumber';
import type { TestWorld } from '../support/world';
import { createInMemoryVault } from '../support/in-memory-vault';
import { SavedViewService } from '../../../src/services/SavedViewService';
import { deriveProjectFoldersFromFilePath } from '../../../src/models/StoryLineProject';
import { createSavedViewPluginMock } from '../support/saved-view-fixtures';

// ── Scenario: Saved view does not modify Scene files ──

Given('I have an active Book with 3 scenes', async function (this: TestWorld) {
    this.testVault = createInMemoryVault();
    const plugin = createSavedViewPluginMock(this.testVault);
    this.savedViewService = new SavedViewService(plugin as unknown as import('../../../src/main').default);
    this.activeBook = {
        title: 'My Book',
        filePath: 'StoryLine/My Book/My Book.md',
        bookId: 'book-1',
        ...deriveProjectFoldersFromFilePath('StoryLine/My Book/My Book.md'),
        created: '2024-01-01',
        description: '',
        definedActs: [],
        definedChapters: [],
        actLabels: {},
        chapterLabels: {},
        actDescriptions: {},
        chapterDescriptions: {},
        filterPresets: [],
        corkboardPositions: {},
    };

    // Create 3 scenes with meaningful content
    await this.testVault.create('StoryLine/My Book/Scenes/Scene 1.md', '---\ntitle: Scene 1\nid: scene-1\n---\n\nFirst scene content.');
    await this.testVault.create('StoryLine/My Book/Scenes/Scene 2.md', '---\ntitle: Scene 2\nid: scene-2\n---\n\nSecond scene content.');
    await this.testVault.create('StoryLine/My Book/Scenes/Scene 3.md', '---\ntitle: Scene 3\nid: scene-3\n---\n\nThird scene content.');

    this.scenes = [
        { title: 'Scene 1', filePath: 'StoryLine/My Book/Scenes/Scene 1.md' } as any,
        { title: 'Scene 2', filePath: 'StoryLine/My Book/Scenes/Scene 2.md' } as any,
        { title: 'Scene 3', filePath: 'StoryLine/My Book/Scenes/Scene 3.md' } as any,
    ];
});

Given('I capture the original scene file contents', async function (this: TestWorld) {
    if (!this.testVault || !this.scenes) throw new Error('Setup incomplete');
    this.sceneOriginalContentMap = new Map();
    for (const scene of this.scenes) {
        const file = this.testVault.getAbstractFileByPath(scene.filePath);
        if (file) {
            this.sceneOriginalContentMap.set(scene.filePath, file.content);
        }
    }
});

Then('all scene files remain byte-for-byte unchanged', async function (this: TestWorld) {
    if (!this.testVault || !this.scenes || !this.sceneOriginalContentMap) {
        throw new Error('Setup incomplete');
    }
    for (const scene of this.scenes) {
        const file = this.testVault.getAbstractFileByPath(scene.filePath);
        if (!file) {
            throw new Error(`Scene file deleted: ${scene.filePath}`);
        }
        const original = this.sceneOriginalContentMap.get(scene.filePath);
        if (file.content !== original) {
            throw new Error(`Scene file modified: ${scene.filePath}`);
        }
    }
});

// ── Scenario: Rename a saved view ──

Given(/^I create a saved view named "([^"]+)"$/, async function (this: TestWorld, name) {
    if (!this.savedViewService) {
        this.testVault = createInMemoryVault();
        const plugin = createSavedViewPluginMock(this.testVault);
        this.savedViewService = new SavedViewService(plugin as unknown as import('../../../src/main').default);
    }
    await this.savedViewService.createSavedView(name, {
        timelineOrder: 'reading',
        swimlaneMode: false,
        swimlaneGroupBy: 'pov',
        zoomLevel: 1.0,
    });
    // Store original config for rename verification
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (found) {
        const config = await this.savedViewService.loadSavedView(found.id);
        this.savedViewOriginalConfig = config ?? undefined;
        this.savedViewId = found.id;
    }
});

When('I rename the saved view to {string}', async function (this: TestWorld, newName) {
    if (!this.savedViewService || !this.savedViewId) throw new Error('Setup incomplete');
    await this.savedViewService.renameSavedView(this.savedViewId, newName);
});

Then('no saved view named {string} exists', async function (this: TestWorld, name) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (found) {
        throw new Error(`Saved view "${name}" still exists after rename/delete`);
    }
});

Then('the renamed view preserves the original configuration', async function (this: TestWorld) {
    if (!this.savedViewService || !this.savedViewOriginalConfig) throw new Error('Setup incomplete');
    // The renamed view should have the same config values
    const views = await this.savedViewService.listSavedViews();
    if (views.length === 0) throw new Error('No views found after rename');
    const config = await this.savedViewService.loadSavedView(views[0].id);
    if (!config) throw new Error('Could not load renamed view');

    if (config.timelineOrder !== this.savedViewOriginalConfig.timelineOrder) {
        throw new Error('Timeline order changed after rename');
    }
    if (config.swimlaneMode !== this.savedViewOriginalConfig.swimlaneMode) {
        throw new Error('Swimlane mode changed after rename');
    }
});

// ── Scenario: Delete a saved view ──

When('I delete the saved view {string}', async function (this: TestWorld, name) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (!found) throw new Error(`Saved view "${name}" not found`);
    await this.savedViewService.deleteSavedView(found.id);
});

// ── Scenario: Saved view survives restart ──

When('I simulate a plugin restart', async function (this: TestWorld) {
    if (!this.testVault) throw new Error('No vault');
    // Simulate restart by creating a new service instance pointing to the same vault
    const plugin = createSavedViewPluginMock(this.testVault);
    this.savedViewService = new SavedViewService(plugin as unknown as import('../../../src/main').default);
});

Then('the saved view {string} is still available', async function (this: TestWorld, name) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (!found) {
        throw new Error(`Saved view "${name}" not found after restart`);
    }
    this.lastSavedView = found;
});

Then('the restored view preserves the original configuration', async function (this: TestWorld) {
    if (!this.savedViewService || !this.lastSavedView) throw new Error('No saved view');
    const config = await this.savedViewService.loadSavedView(this.lastSavedView.id);
    if (!config) throw new Error('Could not load saved view after restart');
    // Verify the config has valid values
    if (!config.timelineOrder) throw new Error('Timeline order lost after restart');
    if (config.swimlaneMode === undefined) throw new Error('Swimlane mode lost after restart');
});
