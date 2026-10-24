/**
 * Recording mock dependencies for project creation tests.
 *
 * Every call is logged so that step definitions can assert the exact
 * sequence of operations performed by executeCreation.
 */
import type { ProjectCreationDeps } from '../../../src/services/projectCreation';
import type { UniverseMetadata } from '../../../src/models/Universe';
import type { TestWorld } from '../support/world';
import { createBook } from '../support/vault-fixture';

function slug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-');
}

/** Build the file-system and logging portion of the mock deps. */
function buildFsDeps(world: TestWorld): Pick<
    ProjectCreationDeps,
    'createUniverse' | 'createSeries' | 'createProject' | 'saveProjectFrontmatter'
> {
    return {
        createUniverse: async (name: string): Promise<UniverseMetadata> => {
            world.mockDepsLog!.push({ action: 'createUniverse', args: [name] });
            world.createdFiles.set(
                `StoryLine/Universes/${name}.md`,
                `---\ntype: universe\nname: ${name}\n---`,
            );
            return {
                id: `universe-${slug(name)}`,
                name,
                seriesIds: [],
                created: new Date().toISOString(),
            };
        },
        createSeries: async (name: string) => {
            world.mockDepsLog!.push({ action: 'createSeries', args: [name] });
            world.createdFiles.set(
                `StoryLine/Series/${name}.md`,
                `---\ntype: series\nname: ${name}\n---`,
            );
            return {
                seriesUuid: `series-${slug(name)}`,
                name,
                bookOrder: [],
                created: '',
            };
        },
        createProject: async (title: string, _desc: string, customBasePath?: string) => {
            world.mockDepsLog!.push({ action: 'createProject', args: [title, _desc, customBasePath] });
            const bookId = `book-${slug(title)}`;
            const book = createBook(title, bookId, world.universeId || 'universe-test');
            world.createdFiles.set(book.filePath, `---\ntype: book\nid: ${book.bookId}\n---`);
            return book;
        },
        saveProjectFrontmatter: async (project) => {
            world.mockDepsLog!.push({ action: 'saveProjectFrontmatter', args: [project.bookId] });
            world.createdFiles.set(project.filePath, `---\ntype: book\nid: ${project.bookId}\n---`);
        },
    };
}

/** Build the coordination portion of the mock deps. */
function buildCoordDeps(world: TestWorld): Pick<
    ProjectCreationDeps,
    'addSeriesToUniverse' | 'getSeriesByUuid' | 'addBookToSeries' |
    'setActiveProject' | 'refreshOpenViews' | 'openNavigator' | 'activateView'
> {
    return {
        addSeriesToUniverse: async (universeId: string, seriesFolder: string) => {
            world.mockDepsLog!.push({ action: 'addSeriesToUniverse', args: [universeId, seriesFolder] });
        },
        getSeriesByUuid: async (uuid: string) => {
            world.mockDepsLog!.push({ action: 'getSeriesByUuid', args: [uuid] });
            const meta = { seriesUuid: uuid, name: 'Series', bookOrder: [], created: '' };
            return { folder: 'StoryLine/Series', meta };
        },
        addBookToSeries: async (seriesUuid: string, project) => {
            world.mockDepsLog!.push({ action: 'addBookToSeries', args: [seriesUuid, project.bookId] });
        },
        setActiveProject: async (project) => {
            world.mockDepsLog!.push({ action: 'setActiveProject', args: [project.bookId] });
            world.activeBook = project;
        },
        refreshOpenViews: () => {
            world.mockDepsLog!.push({ action: 'refreshOpenViews' });
        },
        openNavigator: () => {
            world.mockDepsLog!.push({ action: 'openNavigator' });
        },
        activateView: async (viewType: string) => {
            world.mockDepsLog!.push({ action: 'activateView', args: [viewType] });
        },
    };
}

/**
 * Build a ProjectCreationDeps mock that records all operations for assertion.
 */
export function makeRecordingDeps(world: TestWorld): ProjectCreationDeps {
    world.mockDepsLog = [];
    return {
        ...buildFsDeps(world),
        ...buildCoordDeps(world),
        autoOpenNavigator: false,
    };
}
