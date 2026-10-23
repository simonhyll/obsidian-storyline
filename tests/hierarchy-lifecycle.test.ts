import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SeriesManager } from '../services/SeriesManager';
import { SceneManager } from '../services/SceneManager';
import { UniverseManager } from '../services/UniverseManager';
import { normalizePath, TFile } from 'obsidian';

describe('Hierarchy lifecycle', () => {
    let mockAdapter: any;
    let mockApp: any;
    let seriesManager: SeriesManager;
    let sceneManager: SceneManager;
    let plugin: any;

    function createMockAdapter() {
        const fs = new Map<string, string | { folder: true }>();
        return {
            fs,
            exists: async (path: string) => {
                const normalized = normalizePath(path);
                return fs.has(normalized) || Array.from(fs.keys()).some(k => k.startsWith(normalized + '/'));
            },
            read: async (path: string) => {
                const val = fs.get(normalizePath(path));
                if (val && typeof val === 'string') return val;
                throw new Error(`File not found: ${path}`);
            },
            write: async (path: string, data: string) => {
                fs.set(normalizePath(path), data);
            },
            remove: async (path: string) => {
                fs.delete(normalizePath(path));
            },
            mkdir: async (path: string) => {
                fs.set(normalizePath(path), { folder: true });
            },
            rmdir: async (path: string) => {
                fs.delete(normalizePath(path));
            },
            list: async (path: string) => {
                const normalized = normalizePath(path);
                const files: string[] = [];
                const folders: string[] = [];
                for (const key of fs.keys()) {
                    if (key === normalized) continue;
                    if (key.startsWith(normalized + '/')) {
                        const relative = key.slice(normalized.length + 1);
                        const parts = relative.split('/');
                        if (parts.length === 1) {
                            const val = fs.get(key);
                            if (val && typeof val === 'string') files.push(key);
                        } else {
                            const folderPath = normalized + '/' + parts[0];
                            if (!folders.includes(folderPath)) folders.push(folderPath);
                        }
                    }
                }
                return { files, folders };
            },
            copy: async (src: string, dest: string) => {
                const val = fs.get(normalizePath(src));
                if (val) fs.set(normalizePath(dest), val);
            },
            rename: async (oldPath: string, newPath: string) => {
                const val = fs.get(normalizePath(oldPath));
                if (val) {
                    fs.delete(normalizePath(oldPath));
                    fs.set(normalizePath(newPath), val);
                }
            },
            getResourcePath: () => undefined,
            path: '/vault',
        };
    }

    function setupManagers(adapter: any) {
        mockApp = {
            vault: {
                adapter,
                getAbstractFileByPath: (path: string) => {
                    const normalized = normalizePath(path);
                    if (adapter.fs.has(normalized)) return { path: normalized } as any;
                    for (const key of adapter.fs.keys()) {
                        if (key === normalized || key.startsWith(normalized + '/')) return { path: normalized } as any;
                    }
                    return null;
                },
                getMarkdownFiles: () => [],
                getAllFiles: () => [],
                getFileByPath: (path: string) => {
                    const normalized = normalizePath(path);
                    if (adapter.fs.has(normalized)) return { path: normalized } as any;
                    return null;
                },
                getFolderByPath: (path: string) => {
                    const normalized = normalizePath(path);
                    for (const key of adapter.fs.keys()) {
                        if (key === normalized || key.startsWith(normalized + '/')) return { path: normalized };
                    }
                    return null;
                },
                createFolder: async (path: string) => {
                    await adapter.mkdir(path);
                },
                modify: async (file: any, data: string) => {
                    await adapter.write(file.path, data);
                },
            },
            workspace: {
                getLeavesOfType: () => [],
                getLeaf: () => ({ setViewState: async () => {}, view: null }),
                rightSplit: null,
            },
            commands: { addCommand: () => {}, addRibbonIcon: () => {} },
            scope: {},
            plugins: {},
            fileManager: {
                renameFile: async (file: any, newName: string) => {
                    const oldPath = normalizePath(file.path);
                    const newPath = normalizePath(newName);
                    const val = adapter.fs.get(oldPath);
                    if (val) {
                        adapter.fs.delete(oldPath);
                        adapter.fs.set(newPath, val);
                    }
                },
                trashFile: async (file: any) => {
                    adapter.fs.delete(normalizePath(file.path));
                },
            },
            metadataCache: {},
            resourceManager: {},
            isMobileEditor: false,
            isMobile: false,
            isSafari: false,
            isMac: false,
            isWindows: false,
            isLinux: false,
        };

        plugin = {
            settings: {
                storyLineRoot: 'StoryLine',
                autoOpenNavigator: false,
                activeProjectFile: undefined,
            },
            sceneManager: null,
            seriesManager: null,
            universeManager: null,
            saveSettings: vi.fn(),
        };

        sceneManager = new SceneManager(mockApp, plugin as any);
        plugin.sceneManager = sceneManager;

        seriesManager = new SeriesManager(mockApp, plugin as any);
        plugin.seriesManager = seriesManager;

        plugin.universeManager = new UniverseManager(mockApp, plugin as any);
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updateProjectPath', () => {
        it('updates the projects Map key', () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const oldPath = 'StoryLine/Old Book/Old Book.md';
            const newPath = 'StoryLine/My Series/Old Book/Old Book.md';
            const project = {
                title: 'Old Book',
                filePath: newPath,
                sceneFolder: 'StoryLine/Old Book/Scenes',
                bookId: 'test-book-id',
                created: '2024-01-01',
            } as any;

            (sceneManager as any).projects.set(oldPath, project);
            expect((sceneManager as any).projects.has(oldPath)).toBe(true);
            expect((sceneManager as any).projects.has(newPath)).toBe(false);

            sceneManager.updateProjectPath(oldPath, newPath, project);

            expect((sceneManager as any).projects.has(oldPath)).toBe(false);
            expect((sceneManager as any).projects.has(newPath)).toBe(true);
            expect((sceneManager as any).projects.get(newPath)).toBe(project);
        });

        it('re-derives folder paths from new file path', () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const oldPath = 'StoryLine/Old Book/Old Book.md';
            const newPath = 'StoryLine/My Series/Old Book/Old Book.md';
            const project = {
                title: 'Old Book',
                filePath: newPath,
                sceneFolder: 'StoryLine/Old Book/Scenes',
                bookId: 'test-book-id',
                created: '2024-01-01',
            } as any;

            (sceneManager as any).projects.set(oldPath, project);
            sceneManager.updateProjectPath(oldPath, newPath, project);

            expect(project.sceneFolder).toBe('StoryLine/My Series/Old Book/Scenes');
            expect(project.characterFolder).toBe('StoryLine/My Series/Old Book/Codex/Characters');
            expect(project.locationFolder).toBe('StoryLine/My Series/Old Book/Codex/Locations');
        });
    });

    describe('addBookToSeries', () => {
        it('rejects destination collision', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: [],
                bookIds: [],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            // Existing book in series
            const existingBookFolder = `${seriesFolder}/Existing Book`;
            await adapter.mkdir(existingBookFolder);
            await adapter.mkdir(`${existingBookFolder}/Scenes`);

            // Standalone book with same name
            const standaloneBookFolder = 'StoryLine/Existing Book';
            await adapter.mkdir(standaloneBookFolder);
            await adapter.mkdir(`${standaloneBookFolder}/Scenes`);
            const project = {
                title: 'Existing Book',
                filePath: `${standaloneBookFolder}/Existing Book.md`,
                sceneFolder: `${standaloneBookFolder}/Scenes`,
                bookId: 'standalone-id',
                created: '2024-01-01',
            } as any;

            await expect(seriesManager.addBookToSeries(seriesUuid, project)).rejects.toThrow('already exists');
        });

        it('updates series.json bookIds and bookOrder', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: [],
                bookIds: [],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const oldBookFolder = 'StoryLine/Test Book';
            await adapter.mkdir(oldBookFolder);
            await adapter.mkdir(`${oldBookFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${oldBookFolder}/Test Book.md`,
                sceneFolder: `${oldBookFolder}/Scenes`,
                bookId: 'test-book-id',
                created: '2024-01-01',
            } as any;

            await seriesManager.addBookToSeries(seriesUuid, project);

            const savedMeta = JSON.parse(await adapter.read(`${seriesFolder}/series.json`));
            expect(savedMeta.bookIds).toContain('test-book-id');
            expect(savedMeta.bookOrder).toContain('Test Book');
        });

        it('sets seriesUuid and seriesId on project', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: [],
                bookIds: [],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const oldBookFolder = 'StoryLine/Test Book';
            await adapter.mkdir(oldBookFolder);
            await adapter.mkdir(`${oldBookFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${oldBookFolder}/Test Book.md`,
                sceneFolder: `${oldBookFolder}/Scenes`,
                bookId: 'test-book-id',
                created: '2024-01-01',
            } as any;

            await seriesManager.addBookToSeries(seriesUuid, project);

            expect(project.seriesUuid).toBe(seriesUuid);
            expect(project.seriesId).toBe('My Series');
        });

        it('updates project registry and activeProjectFile for active book', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: [],
                bookIds: [],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const oldBookFolder = 'StoryLine/Test Book';
            await adapter.mkdir(oldBookFolder);
            await adapter.mkdir(`${oldBookFolder}/Scenes`);
            const oldFilePath = `${oldBookFolder}/Test Book.md`;
            const project = {
                title: 'Test Book',
                filePath: oldFilePath,
                sceneFolder: `${oldBookFolder}/Scenes`,
                bookId: 'test-book-id',
                created: '2024-01-01',
            } as any;

            // Register project and set as active
            (sceneManager as any).projects.set(oldFilePath, project);
            (sceneManager as any)._activeProject = project;
            plugin.settings.activeProjectFile = oldFilePath;

            await seriesManager.addBookToSeries(seriesUuid, project);

            const newFilePath = `${seriesFolder}/Test Book/Test Book.md`;
            expect((sceneManager as any).projects.has(oldFilePath)).toBe(false);
            expect((sceneManager as any).projects.has(newFilePath)).toBe(true);
            expect(plugin.settings.activeProjectFile).toBe(newFilePath);
            expect(plugin.saveSettings).toHaveBeenCalled();
        });
    });

    describe('removeBookFromSeries', () => {
        it('does NOT copy shared Series Codex to detached book', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const charContent = '---\ntype: character\nname: Gandalf\nid: gandalf-uuid\n---\nWizard.';
            await adapter.write(`${seriesFolder}/Codex/Characters/Gandalf.md`, charContent);

            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: ['Test Book'],
                bookIds: ['book-123'],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const bookInSeriesFolder = `${seriesFolder}/Test Book`;
            await adapter.mkdir(bookInSeriesFolder);
            await adapter.mkdir(`${bookInSeriesFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${bookInSeriesFolder}/Test Book.md`,
                sceneFolder: `${bookInSeriesFolder}/Scenes`,
                bookId: 'book-123',
                created: '2024-01-01',
                seriesId: 'My Series',
                seriesUuid,
            } as any;

            await seriesManager.removeBookFromSeries(seriesUuid, project);

            const newBookFolder = 'StoryLine/Test Book';
            const codexPath = `${newBookFolder}/Codex/Characters/Gandalf.md`;
            const exists = await adapter.exists(codexPath);
            expect(exists).toBe(false);
        });

        it('removes book from series.json metadata', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: ['Test Book'],
                bookIds: ['book-123'],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const bookInSeriesFolder = `${seriesFolder}/Test Book`;
            await adapter.mkdir(bookInSeriesFolder);
            await adapter.mkdir(`${bookInSeriesFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${bookInSeriesFolder}/Test Book.md`,
                sceneFolder: `${bookInSeriesFolder}/Scenes`,
                bookId: 'book-123',
                created: '2024-01-01',
                seriesId: 'My Series',
                seriesUuid,
            } as any;

            await seriesManager.removeBookFromSeries(seriesUuid, project);

            const savedMeta = JSON.parse(await adapter.read(`${seriesFolder}/series.json`));
            expect(savedMeta.bookIds).not.toContain('book-123');
            expect(savedMeta.bookOrder).not.toContain('Test Book');
        });

        it('clears seriesUuid and seriesId on project', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: ['Test Book'],
                bookIds: ['book-123'],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const bookInSeriesFolder = `${seriesFolder}/Test Book`;
            await adapter.mkdir(bookInSeriesFolder);
            await adapter.mkdir(`${bookInSeriesFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${bookInSeriesFolder}/Test Book.md`,
                sceneFolder: `${bookInSeriesFolder}/Scenes`,
                bookId: 'book-123',
                created: '2024-01-01',
                seriesId: 'My Series',
                seriesUuid,
            } as any;

            await seriesManager.removeBookFromSeries(seriesUuid, project);

            expect(project.seriesUuid).toBeUndefined();
            expect(project.seriesId).toBeUndefined();
        });

        it('rejects destination collision before moving', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: ['Test Book'],
                bookIds: ['book-123'],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const bookInSeriesFolder = `${seriesFolder}/Test Book`;
            await adapter.mkdir(bookInSeriesFolder);
            await adapter.mkdir(`${bookInSeriesFolder}/Scenes`);

            // Create a collision at the destination
            const collisionFolder = 'StoryLine/Test Book';
            await adapter.mkdir(collisionFolder);
            await adapter.mkdir(`${collisionFolder}/Scenes`);

            const project = {
                title: 'Test Book',
                filePath: `${bookInSeriesFolder}/Test Book.md`,
                sceneFolder: `${bookInSeriesFolder}/Scenes`,
                bookId: 'book-123',
                created: '2024-01-01',
                seriesId: 'My Series',
                seriesUuid,
            } as any;

            await expect(seriesManager.removeBookFromSeries(seriesUuid, project)).rejects.toThrow('already exists');

            // Verify source data is untouched
            const savedMeta = JSON.parse(await adapter.read(`${seriesFolder}/series.json`));
            expect(savedMeta.bookIds).toContain('book-123');
            expect(savedMeta.bookOrder).toContain('Test Book');
        });

        it('updates project registry and activeProjectFile for active book', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: ['Test Book'],
                bookIds: ['book-123'],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const bookInSeriesFolder = `${seriesFolder}/Test Book`;
            await adapter.mkdir(bookInSeriesFolder);
            await adapter.mkdir(`${bookInSeriesFolder}/Scenes`);
            const project = {
                title: 'Test Book',
                filePath: `${bookInSeriesFolder}/Test Book.md`,
                sceneFolder: `${bookInSeriesFolder}/Scenes`,
                bookId: 'book-123',
                created: '2024-01-01',
                seriesId: 'My Series',
                seriesUuid,
            } as any;

            // Register project and set as active
            (sceneManager as any).projects.set(project.filePath, project);
            (sceneManager as any)._activeProject = project;
            plugin.settings.activeProjectFile = project.filePath;

            await seriesManager.removeBookFromSeries(seriesUuid, project);

            const newFilePath = 'StoryLine/Test Book/Test Book.md';
            expect((sceneManager as any).projects.has(bookInSeriesFolder + '/Test Book.md')).toBe(false);
            expect((sceneManager as any).projects.has(newFilePath)).toBe(true);
            expect(plugin.settings.activeProjectFile).toBe(newFilePath);
            expect(plugin.saveSettings).toHaveBeenCalled();
        });
    });

    describe('universeId persistence', () => {
        it('preserves universeId when adding to series', async () => {
            const adapter = createMockAdapter();
            setupManagers(adapter);

            const seriesFolder = 'StoryLine/My Series';
            await adapter.mkdir(seriesFolder);
            await adapter.mkdir(`${seriesFolder}/Codex`);
            await adapter.mkdir(`${seriesFolder}/Codex/Characters`);
            await adapter.mkdir(`${seriesFolder}/Codex/Locations`);
            const seriesUuid = crypto.randomUUID();
            const seriesMeta = {
                name: 'My Series',
                seriesUuid,
                bookOrder: [],
                bookIds: [],
                created: '2024-01-01',
            };
            await adapter.write(`${seriesFolder}/series.json`, JSON.stringify(seriesMeta));

            const oldBookFolder = 'StoryLine/Test Book';
            await adapter.mkdir(oldBookFolder);
            await adapter.mkdir(`${oldBookFolder}/Scenes`);
            const universeId = 'universe-123';
            const project = {
                title: 'Test Book',
                filePath: `${oldBookFolder}/Test Book.md`,
                sceneFolder: `${oldBookFolder}/Scenes`,
                bookId: 'test-book-id',
                created: '2024-01-01',
                universeId,
            } as any;

            await seriesManager.addBookToSeries(seriesUuid, project);

            expect(project.universeId).toBe(universeId);
        });
    });
});
