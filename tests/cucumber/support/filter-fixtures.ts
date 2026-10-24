/**
 * Fixture builders for timeline filtering tests.
 */

import type { Scene } from '../../../src/models/Scene';
import type { Event } from '../../../src/models/Event';
import type { StoryLineProject } from '../../../src/models/StoryLineProject';

/**
 * Build a minimal StoryLineProject fixture.
 */
export function buildProject(bookId: string, title: string, universeId?: string): StoryLineProject {
    return {
        filePath: `StoryLine/${title}/${title}.md`,
        title,
        created: '2024-01-01T00:00:00Z',
        description: '',
        sceneFolder: `StoryLine/${title}/Scenes`,
        characterFolder: `StoryLine/${title}/Codex/Characters`,
        locationFolder: `StoryLine/${title}/Codex/Locations`,
        codexFolder: `StoryLine/${title}/Codex`,
        notesFolder: `StoryLine/${title}/Notes`,
        sceneNotesFolder: `StoryLine/${title}/SceneNotes`,
        archiveFolder: `StoryLine/${title}/Archive`,
        researchFolder: `StoryLine/${title}/Research`,
        definedActs: [],
        definedChapters: [],
        actLabels: {},
        chapterLabels: {},
        actDescriptions: {},
        chapterDescriptions: {},
        filterPresets: [],
        corkboardPositions: {},
        bookId,
        universeId: universeId ?? undefined,
    };
}

/**
 * Build a scene fixture.
 */
export function buildScene(filePath: string, title: string, tags: string[] = [], storyDate?: string): Scene {
    return {
        filePath,
        type: 'scene',
        title,
        sequence: 1,
        tags,
        storyDate: storyDate ?? undefined,
    };
}

/**
 * Build an event fixture.
 */
export function buildEvent(filePath: string, id: string, name: string, opts?: { tags?: string[]; ownerId?: string; booksById?: string[] }): Event {
    return {
        filePath,
        type: 'event',
        id,
        name,
        tags: opts?.tags ?? [],
        // Ordinary test Events belong to the active Book. Explicit ownership
        // is supplied for universe/series and cross-book visibility scenarios.
        ownerId: opts?.ownerId ?? 'book-1',
        booksById: opts?.booksById,
    };
}

/**
 * Build a single-book context.
 */
export function buildSingleBookContext(bookId: string, projects: StoryLineProject[]) {
    return {
        activeBookId: bookId,
        selectedBookIds: new Set<string>(),
        universeId: null,
        seriesId: null,
        projects,
    };
}

/**
 * Build a multi-book context.
 */
export function buildMultiBookContext(bookId: string, selectedBookIds: Set<string>, universeId: string | null, projects: StoryLineProject[]) {
    return {
        activeBookId: bookId,
        selectedBookIds,
        universeId,
        seriesId: null,
        projects,
    };
}
