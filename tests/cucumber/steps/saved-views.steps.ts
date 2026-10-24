/**
 * Step definitions for saved timeline views.
 *
 * Exercises the production SavedViewService against an in-memory vault.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import type { TestWorld } from '../support/world';
import { createInMemoryVault } from '../support/in-memory-vault';
import { SavedViewService, type SavedViewConfig } from '../../../src/services/SavedViewService';
import { deriveProjectFoldersFromFilePath } from '../../../src/models/StoryLineProject';
import { createSavedViewPluginMock } from '../support/saved-view-fixtures';

/**
 * Helper to build a SavedViewConfig from a table.
 */
function buildConfigFromTable(rows: { setting: string; value: string }[]): Omit<SavedViewConfig, 'version' | 'id' | 'created' | 'name'> {
    const config: Partial<SavedViewConfig> = {};
    for (const row of rows) {
        const key = row.setting;
        const raw = row.value;
        if (key === 'order') {
            config.timelineOrder = raw as 'reading' | 'chronological';
        } else if (key === 'swimlaneMode') {
            config.swimlaneMode = raw === 'true';
        } else if (key === 'swimlaneGroupBy') {
            config.swimlaneGroupBy = raw as 'pov' | 'character' | 'location' | 'plotline' | 'tag';
        } else if (key === 'zoomLevel') {
            config.zoomLevel = parseFloat(raw);
        }
    }
    return config;
}

// ── Scenario: Save current Timeline configuration ──

Given('I have an active Book with scenes', function (this: TestWorld) {
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
});

Given('the Timeline is configured with:', function (this: TestWorld, table) {
    this.currentTimelineConfig = buildConfigFromTable(table.hashes()) as import('../../../src/services/SavedViewService').SavedViewConfig;
});

When('I save the current view as {string}', async function (this: TestWorld, name) {
    if (!this.savedViewService || !this.currentTimelineConfig) {
        throw new Error('Test setup incomplete');
    }
    await this.savedViewService.createSavedView(name, this.currentTimelineConfig);
});

Then(/^a saved view named "([^"]+)" exists$/, async function (this: TestWorld, name) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (!found) {
        throw new Error(`Saved view "${name}" not found. Available: ${views.map(v => v.name).join(', ')}`);
    }
    this.lastSavedView = found;
});

Then('the saved view preserves the configuration:', async function (this: TestWorld, table) {
    if (!this.savedViewService || !this.lastSavedView) {
        throw new Error('No saved view loaded');
    }
    const config = await this.savedViewService.loadSavedView(this.lastSavedView.id);
    if (!config) throw new Error('Could not load saved view');

    const expected = buildConfigFromTable(table.hashes());
    const fields = ['timelineOrder', 'swimlaneMode', 'swimlaneGroupBy', 'zoomLevel'] as const;
    for (const field of fields) {
        if (expected[field] !== undefined && config[field] !== expected[field]) {
            throw new Error(`Expected ${field} ${expected[field]}, got ${config[field]}`);
        }
    }
});

// ── Scenario: Change Timeline and restore a saved view ──

Given('a saved view named {string} with configuration:', async function (this: TestWorld, name, table) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const config = buildConfigFromTable(table.hashes());
    await this.savedViewService.createSavedView(name, config);
});

When('I change the Timeline to chronological order with swimlanes', function (this: TestWorld) {
    this.currentTimelineConfig = {
        timelineOrder: 'chronological',
        swimlaneMode: true,
        swimlaneGroupBy: 'pov',
        zoomLevel: 2.0,
    } as import('../../../src/services/SavedViewService').SavedViewConfig;
});

When('I restore the saved view {string}', async function (this: TestWorld, name) {
    if (!this.savedViewService) throw new Error('Service not initialized');
    const views = await this.savedViewService.listSavedViews();
    const found = views.find(v => v.name === name);
    if (!found) throw new Error(`Saved view "${name}" not found`);
    const config = await this.savedViewService.loadSavedView(found.id);
    if (!config) throw new Error(`Could not load saved view "${name}"`);

    // Apply the config to the current timeline state
    this.currentTimelineConfig = {
        timelineOrder: config.timelineOrder,
        swimlaneMode: config.swimlaneMode,
        swimlaneGroupBy: config.swimlaneGroupBy,
        zoomLevel: config.zoomLevel,
    } as import('../../../src/services/SavedViewService').SavedViewConfig;
});

Then('the Timeline order is {string}', function (this: TestWorld, expected) {
    if (!this.currentTimelineConfig) throw new Error('No timeline config');
    if (this.currentTimelineConfig.timelineOrder !== expected) {
        throw new Error(`Expected order "${expected}", got "${this.currentTimelineConfig.timelineOrder}"`);
    }
});

Then('swimlane mode is disabled', function (this: TestWorld) {
    if (!this.currentTimelineConfig) throw new Error('No timeline config');
    if (this.currentTimelineConfig.swimlaneMode !== false) {
        throw new Error(`Expected swimlaneMode false, got ${this.currentTimelineConfig.swimlaneMode}`);
    }
});

Then('the swimlane group-by is {string}', function (this: TestWorld, expected) {
    if (!this.currentTimelineConfig) throw new Error('No timeline config');
    if (this.currentTimelineConfig.swimlaneGroupBy !== expected) {
        throw new Error(`Expected group-by "${expected}", got "${this.currentTimelineConfig.swimlaneGroupBy}"`);
    }
});

Then('the zoom level is {float}', function (this: TestWorld, expected) {
    if (!this.currentTimelineConfig) throw new Error('No timeline config');
    if (this.currentTimelineConfig.zoomLevel !== expected) {
        throw new Error(`Expected zoom ${expected}, got ${this.currentTimelineConfig.zoomLevel}`);
    }
});

