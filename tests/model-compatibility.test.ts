import { describe, it, expect } from 'vitest';
import type { Scene } from '../models/Scene';
import type { StoryLineProject, SeriesMetadata } from '../models/StoryLineProject';
import type { Character } from '../models/Character';
import type { StoryLocation } from '../models/Location';
import type { CodexEntry } from '../models/Codex';

describe('Model Compatibility', () => {
    describe('Scene model backward compatibility', () => {
        it('accepts scene without new optional fields', () => {
            const scene: Scene = {
                filePath: 'Scenes/Chapter1.md',
                type: 'scene',
                title: 'Chapter 1',
            };
            expect(scene.filePath).toBe('Scenes/Chapter1.md');
        });

        it('accepts scene with new optional fields', () => {
            const scene: Scene = {
                filePath: 'Scenes/Chapter1.md',
                type: 'scene',
                title: 'Chapter 1',
                id: '11111111-1111-4111-8111-111111111111',
                ownerId: 'book-uuid',
                introducedIn: 'book-uuid',
            };
            expect(scene.id).toBe('11111111-1111-4111-8111-111111111111');
            expect(scene.ownerId).toBe('book-uuid');
        });

        it('preserves existing storyDate and storyTime fields', () => {
            const scene: Scene = {
                filePath: 'Scenes/Chapter1.md',
                type: 'scene',
                title: 'Chapter 1',
                storyDate: '2024-01-15',
                storyTime: '10:00',
            };
            expect(scene.storyDate).toBe('2024-01-15');
            expect(scene.storyTime).toBe('10:00');
        });
    });

    describe('StoryLineProject backward compatibility', () => {
        it('accepts project without new optional fields', () => {
            const project: StoryLineProject = {
                filePath: 'Book1.md',
                title: 'Book 1',
                created: '2024-01-01T00:00:00Z',
                description: '',
                sceneFolder: 'Book1/Scenes',
                characterFolder: 'Book1/Codex/Characters',
                locationFolder: 'Book1/Codex/Locations',
                codexFolder: 'Book1/Codex',
                notesFolder: 'Book1/Notes',
                sceneNotesFolder: 'Book1/SceneNotes',
                archiveFolder: 'Book1/Archive',
                researchFolder: 'Book1/Research',
                definedActs: [],
                definedChapters: [],
                actLabels: {},
                chapterLabels: {},
                actDescriptions: {},
                chapterDescriptions: {},
                filterPresets: [],
                corkboardPositions: {},
            };
            expect(project.filePath).toBe('Book1.md');
        });

        it('accepts project with universeId and ownerId', () => {
            const project: StoryLineProject = {
                filePath: 'Book1.md',
                title: 'Book 1',
                created: '2024-01-01T00:00:00Z',
                description: '',
                sceneFolder: 'Book1/Scenes',
                characterFolder: 'Book1/Codex/Characters',
                locationFolder: 'Book1/Codex/Locations',
                codexFolder: 'Book1/Codex',
                notesFolder: 'Book1/Notes',
                sceneNotesFolder: 'Book1/SceneNotes',
                archiveFolder: 'Book1/Archive',
                researchFolder: 'Book1/Research',
                definedActs: [],
                definedChapters: [],
                actLabels: {},
                chapterLabels: {},
                actDescriptions: {},
                chapterDescriptions: {},
                filterPresets: [],
                corkboardPositions: {},
                universeId: 'universe-uuid',
                ownerId: 'series-uuid',
            };
            expect(project.universeId).toBe('universe-uuid');
            expect(project.ownerId).toBe('series-uuid');
        });

        it('accepts project with existing series fields', () => {
            const project: StoryLineProject = {
                filePath: 'Book1.md',
                title: 'Book 1',
                created: '2024-01-01T00:00:00Z',
                description: '',
                sceneFolder: 'Book1/Scenes',
                characterFolder: 'Book1/Codex/Characters',
                locationFolder: 'Book1/Codex/Locations',
                codexFolder: 'Book1/Codex',
                notesFolder: 'Book1/Notes',
                sceneNotesFolder: 'Book1/SceneNotes',
                archiveFolder: 'Book1/Archive',
                researchFolder: 'Book1/Research',
                definedActs: [],
                definedChapters: [],
                actLabels: {},
                chapterLabels: {},
                actDescriptions: {},
                chapterDescriptions: {},
                filterPresets: [],
                corkboardPositions: {},
                seriesId: 'series-1',
                seriesUuid: 'series-uuid',
                bookId: 'book-uuid',
            };
            expect(project.seriesId).toBe('series-1');
            expect(project.seriesUuid).toBe('series-uuid');
        });
    });

    describe('SeriesMetadata backward compatibility', () => {
        it('accepts series without new optional fields', () => {
            const series: SeriesMetadata = {
                name: 'My Series',
                bookOrder: [],
                created: '2024-01-01T00:00:00Z',
            };
            expect(series.name).toBe('My Series');
        });

        it('accepts series with universeId', () => {
            const series: SeriesMetadata = {
                name: 'My Series',
                bookOrder: [],
                created: '2024-01-01T00:00:00Z',
                universeId: 'universe-uuid',
            };
            expect(series.universeId).toBe('universe-uuid');
        });
    });

    describe('Character backward compatibility', () => {
        it('accepts character without new optional fields', () => {
            const char: Character = {
                filePath: 'Codex/Characters/Alice.md',
                type: 'character',
                name: 'Alice',
            };
            expect(char.filePath).toBe('Codex/Characters/Alice.md');
        });

        it('accepts character with new optional fields', () => {
            const char: Character = {
                filePath: 'Codex/Characters/Alice.md',
                type: 'character',
                name: 'Alice',
                id: 'char-uuid',
                ownerId: 'universe-uuid',
                introducedIn: 'book-uuid',
            };
            expect(char.id).toBe('char-uuid');
            expect(char.ownerId).toBe('universe-uuid');
        });

        it('preserves existing books and booksById fields', () => {
            const char: Character = {
                filePath: 'Codex/Characters/Alice.md',
                type: 'character',
                name: 'Alice',
                books: ['Book 1', 'Book 2'],
                booksById: ['book-uuid-1', 'book-uuid-2'],
            };
            expect(char.books).toHaveLength(2);
            expect(char.booksById).toHaveLength(2);
        });
    });

    describe('Location backward compatibility', () => {
        it('accepts location without new optional fields', () => {
            const loc: StoryLocation = {
                filePath: 'Codex/Locations/Castle.md',
                type: 'location',
                name: 'Castle',
            };
            expect(loc.filePath).toBe('Codex/Locations/Castle.md');
        });

        it('accepts location with new optional fields', () => {
            const loc: StoryLocation = {
                filePath: 'Codex/Locations/Castle.md',
                type: 'location',
                name: 'Castle',
                id: 'loc-uuid',
                ownerId: 'series-uuid',
                introducedIn: 'book-uuid',
            };
            expect(loc.id).toBe('loc-uuid');
        });
    });

    describe('CodexEntry backward compatibility', () => {
        it('accepts codex entry without new optional fields', () => {
            const entry: CodexEntry = {
                filePath: 'Codex/General/Magic.md',
                type: 'item',
                name: 'Magic System',
            };
            expect(entry.filePath).toBe('Codex/General/Magic.md');
        });

        it('accepts codex entry with new optional fields', () => {
            const entry: CodexEntry = {
                filePath: 'Codex/General/Magic.md',
                type: 'item',
                name: 'Magic System',
                id: 'codex-uuid',
                ownerId: 'universe-uuid',
                introducedIn: 'book-uuid',
            };
            expect(entry.id).toBe('codex-uuid');
        });
    });
});
