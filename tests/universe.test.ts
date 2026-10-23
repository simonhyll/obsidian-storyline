import { describe, it, expect } from 'vitest';
import {
    UniverseMetadata,
    ContainerEntity,
    HierarchyPath,
    InheritedCollectionResult,
    UNIVERSE_JSON,
    UNIVERSE_CODEX_FOLDER,
    UNIVERSE_EVENTS_FOLDER,
    isProjectInUniverse,
    isSeriesInUniverse,
    buildHierarchyPath,
    getEffectiveOwnerId,
    deriveUniverseFolderFromSeries,
    deriveSeriesFolderFromBook,
} from '../src/models/Universe';
import type { SeriesMetadata, StoryLineProject } from '../src/models/StoryLineProject';

describe('Universe Model', () => {
    describe('Constants', () => {
        it('has correct universe.json filename', () => {
            expect(UNIVERSE_JSON).toBe('universe.json');
        });

        it('has correct codex folder name', () => {
            expect(UNIVERSE_CODEX_FOLDER).toBe('Codex');
        });

        it('has correct events folder name', () => {
            expect(UNIVERSE_EVENTS_FOLDER).toBe('Events');
        });
    });

    describe('isProjectInUniverse', () => {
        it('returns true when project has universeId', () => {
            const project = { universeId: 'abc-123' } as StoryLineProject;
            expect(isProjectInUniverse(project)).toBe(true);
        });

        it('returns false when project has no universeId', () => {
            const project = {} as StoryLineProject;
            expect(isProjectInUniverse(project)).toBe(false);
        });

        it('returns false when universeId is empty string', () => {
            const project = { universeId: '' } as StoryLineProject;
            expect(isProjectInUniverse(project)).toBe(false);
        });
    });

    describe('isSeriesInUniverse', () => {
        it('returns true when series has universeId', () => {
            const series = { universeId: 'abc-123' } as SeriesMetadata;
            expect(isSeriesInUniverse(series)).toBe(true);
        });

        it('returns false when series has no universeId', () => {
            const series = {} as SeriesMetadata;
            expect(isSeriesInUniverse(series)).toBe(false);
        });
    });

    describe('buildHierarchyPath', () => {
        it('builds path with all three levels', () => {
            const book = { filePath: 'StoryLine/Universe/Series/Book/Book.md' } as StoryLineProject;
            const series = { name: 'My Series', seriesUuid: 'series-123' } as SeriesMetadata;
            const universe = { id: 'universe-123', name: 'My Universe' } as UniverseMetadata;

            const path = buildHierarchyPath(book, series, universe);

            expect(path.universe).toBe(universe);
            expect(path.series).toBe(series);
            expect(path.book).toBe(book);
        });

        it('builds path with only book', () => {
            const book = { filePath: 'StoryLine/Book/Book.md' } as StoryLineProject;
            const path = buildHierarchyPath(book, null, null);

            expect(path.universe).toBeUndefined();
            expect(path.series).toBeUndefined();
            expect(path.book).toBe(book);
        });

        it('builds path with book and series only', () => {
            const book = { filePath: 'StoryLine/Series/Book/Book.md' } as StoryLineProject;
            const series = { name: 'My Series' } as SeriesMetadata;
            const path = buildHierarchyPath(book, series, null);

            expect(path.universe).toBeUndefined();
            expect(path.series).toBe(series);
            expect(path.book).toBe(book);
        });
    });

    describe('getEffectiveOwnerId', () => {
        it('returns universeId when present', () => {
            const project = {
                universeId: 'universe-123',
                seriesUuid: 'series-456',
                bookId: 'book-789',
            } as StoryLineProject;
            expect(getEffectiveOwnerId(project)).toBe('universe-123');
        });

        it('returns seriesUuid when no universeId', () => {
            const project = {
                seriesUuid: 'series-456',
                bookId: 'book-789',
            } as StoryLineProject;
            expect(getEffectiveOwnerId(project)).toBe('series-456');
        });

        it('returns bookId when no universe or series', () => {
            const project = {
                bookId: 'book-789',
            } as StoryLineProject;
            expect(getEffectiveOwnerId(project)).toBe('book-789');
        });

        it('returns undefined when no IDs at all', () => {
            const project = {} as StoryLineProject;
            expect(getEffectiveOwnerId(project)).toBeUndefined();
        });
    });

    describe('deriveUniverseFolderFromSeries', () => {
        it('derives parent folder from series path', () => {
            expect(deriveUniverseFolderFromSeries('StoryLine/My Universe/My Series'))
                .toBe('StoryLine/My Universe');
        });

        it('returns null for root-level series', () => {
            expect(deriveUniverseFolderFromSeries('My Series')).toBeNull();
        });
    });

    describe('deriveSeriesFolderFromBook', () => {
        it('derives series folder from book file path', () => {
            expect(deriveSeriesFolderFromBook('StoryLine/My Universe/My Series/Book1/Book1.md'))
                .toBe('StoryLine/My Universe/My Series');
        });

        it('returns null for root-level book', () => {
            expect(deriveSeriesFolderFromBook('Book.md')).toBeNull();
        });

        it('returns null for book with no series parent', () => {
            expect(deriveSeriesFolderFromBook('StoryLine/Book/Book.md'))
                .toBe('StoryLine');
        });
    });

    describe('ContainerEntity type', () => {
        it('supports universe type', () => {
            const entity: ContainerEntity = {
                id: 'universe-123',
                type: 'universe',
                name: 'My Universe',
                folderPath: 'StoryLine/My Universe',
                created: '2024-01-01',
            };
            expect(entity.type).toBe('universe');
        });

        it('supports series type with parentId', () => {
            const entity: ContainerEntity = {
                id: 'series-456',
                type: 'series',
                name: 'My Series',
                parentId: 'universe-123',
                folderPath: 'StoryLine/My Universe/My Series',
                created: '2024-01-01',
            };
            expect(entity.type).toBe('series');
            expect(entity.parentId).toBe('universe-123');
        });
    });

    describe('InheritedCollectionResult', () => {
        it('tracks entities from all three scopes', () => {
            const result: InheritedCollectionResult = {
                collectionType: 'Characters',
                bookId: 'book-123',
                universeEntities: ['Universe/Codex/Characters/Alice.md'],
                seriesEntities: ['Series/Codex/Characters/Bob.md'],
                bookEntities: ['Book/Codex/Characters/Charlie.md'],
                allEntities: [
                    'Universe/Codex/Characters/Alice.md',
                    'Series/Codex/Characters/Bob.md',
                    'Book/Codex/Characters/Charlie.md',
                ],
            };

            expect(result.allEntities.length).toBe(3);
            expect(result.universeEntities.length).toBe(1);
            expect(result.seriesEntities.length).toBe(1);
            expect(result.bookEntities.length).toBe(1);
        });

        it('deduplicates entities appearing in multiple scopes', () => {
            const shared = 'Universe/Codex/Characters/Alice.md';
            const result: InheritedCollectionResult = {
                collectionType: 'Characters',
                bookId: 'book-123',
                universeEntities: [shared],
                seriesEntities: [shared],
                bookEntities: [],
                allEntities: [shared], // deduplicated
            };

            expect(result.allEntities.length).toBe(1);
        });
    });

    describe('UniverseMetadata', () => {
        it('has all required fields', () => {
            const meta: UniverseMetadata = {
                id: 'universe-123',
                name: 'My Universe',
                seriesIds: ['series-1', 'series-2'],
                created: '2024-01-01',
            };

            expect(meta.id).toBe('universe-123');
            expect(meta.name).toBe('My Universe');
            expect(meta.seriesIds).toHaveLength(2);
        });

        it('supports optional fields', () => {
            const meta: UniverseMetadata = {
                id: 'universe-123',
                name: 'My Universe',
                seriesIds: [],
                created: '2024-01-01',
                description: 'A test universe',
                modified: '2024-01-02',
                coverImage: 'covers/universe.jpg',
            };

            expect(meta.description).toBe('A test universe');
            expect(meta.modified).toBe('2024-01-02');
            expect(meta.coverImage).toBe('covers/universe.jpg');
        });
    });
});

describe('Universe Backward Compatibility', () => {
    it('project without universeId works as standalone', () => {
        const project = {
            filePath: 'StoryLine/My Book/My Book.md',
            title: 'My Book',
            bookId: 'book-123',
        } as StoryLineProject;

        expect(isProjectInUniverse(project)).toBe(false);
        expect(getEffectiveOwnerId(project)).toBe('book-123');
    });

    it('series without universeId works as standalone', () => {
        const series = {
            name: 'My Series',
            seriesUuid: 'series-123',
            bookOrder: ['Book1'],
            created: '2024-01-01',
        } as SeriesMetadata;

        expect(isSeriesInUniverse(series)).toBe(false);
    });

    it('hierarchy path works with partial data', () => {
        const project = {
            filePath: 'StoryLine/Series/Book/Book.md',
            seriesUuid: 'series-123',
        } as StoryLineProject;

        const path = buildHierarchyPath(project, null, null);
        expect(path.book).toBe(project);
        expect(path.series).toBeUndefined();
        expect(path.universe).toBeUndefined();
    });
});
