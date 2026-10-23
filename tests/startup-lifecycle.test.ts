import { expect, it, vi } from 'vitest';
import { runStartupSequence, type StartupTarget } from '../src/services/startup';

interface StartupControl {
    scan?: () => Promise<void>;
    failBootstrap?: boolean;
    failInheritance?: boolean;
}

/** Build minimal, ordered service stubs around the REAL startup orchestrator. */
function projectServices(hit: (name: string) => void, control: StartupControl) {
    return {
        sceneManager: {
            activeProject: { bookId: 'book-a' },
            initialize: async () => { hit('scenes'); },
            loadCorkboardPositions: async () => { hit('corkboard'); },
            getCodexFolder: () => 'Codex',
            getAllScenes: () => [],
            queryService: { getStatistics: () => ({ totalWords: 42 }) },
        },
        fieldTemplates: { load: async () => { hit('templates'); } },
        viewSnapshotService: { loadActiveState: async () => { hit('snapshot'); } },
        universeManager: {
            getInheritedCodexFolders: async () => {
                hit('inheritance');
                if (control.failInheritance) throw new Error('inherited vault missing');
                return [];
            },
        },
    };
}

/** Record resource-loading operations without duplicating their orchestration. */
function resourceServices(hit: (name: string) => void, control: StartupControl) {
    return {
        codexManager: {
            initCategories: () => { hit('codexCategories'); },
            loadAll: async () => { hit('codex'); },
            loadInheritedFolders: async () => { hit('inheritedCodex'); },
        },
        linkScanner: {
            invalidateAll: () => { hit('invalidate'); },
            rebuildLookups: () => { hit('lookups'); },
            scanAllAsync: async () => {
                hit('linkScan');
                await control.scan?.();
            },
        },
        writingTracker: { startSession: (words: number) => { hit('session:' + words); } },
    };
}

function makeTarget(calls: string[], control: StartupControl = {}): StartupTarget {
    const hit = (name: string): void => { calls.push(name); };
    return {
        ...projectServices(hit, control),
        ...resourceServices(hit, control),
        settings: { characterAliases: {}, codexCustomCategories: [] },
        updateFrontmatterVisibility: () => { hit('frontmatter'); },
        updateToolbarVisibility: () => { hit('toolbar'); },
        bootstrapProjects: async () => {
            hit('bootstrap');
            if (control.failBootstrap) throw new Error('project lookup failed');
        },
        migrateProjectDataFromSettings: async () => { hit('migration'); },
        loadProjectSystemData: async () => { hit('systemData'); },
        loadActiveProjectEntities: async () => { hit('entities'); },
        scanExtraFolders: async () => { hit('extraFolders'); },
        loadActiveProjectEvents: async () => { hit('events'); },
        scheduleWritingStatsSave: () => { hit('autosave'); },
        refreshOpenViews: () => { hit('refresh'); },
    } as unknown as StartupTarget;
}

it('runs all startup dependencies in the original sequential order', async () => {
    const calls: string[] = [];
    expect(await runStartupSequence(makeTarget(calls))).toBe(true);
    expect(calls).toEqual([
        'frontmatter', 'toolbar', 'bootstrap', 'scenes', 'migration',
        'systemData', 'templates', 'corkboard', 'snapshot',
        'entities', 'extraFolders', 'codexCategories', 'codex',
        'inheritance', 'events', 'invalidate', 'lookups',
        'linkScan', 'session:42', 'autosave', 'refresh',
    ]);
});

it('awaits asynchronous link indexing before starting tracking or refreshing views', async () => {
    const calls: string[] = [];
    let releaseScan: () => void = () => { throw new Error('scan was not entered'); };
    const heldScan = new Promise<void>(resolve => { releaseScan = resolve; });
    const target = makeTarget(calls, { scan: () => heldScan });
    const startup = runStartupSequence(target);
    await vi.waitFor(() => expect(calls).toContain('linkScan'));
    expect(calls).not.toContain('session:42');
    expect(calls).not.toContain('refresh');
    releaseScan();
    expect(await startup).toBe(true);
    expect(calls.slice(-3)).toEqual(['session:42', 'autosave', 'refresh']);
});

it('ignores optional inherited Codex failure while still loading events and indexing', async () => {
    const calls: string[] = [];
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
        expect(await runStartupSequence(makeTarget(calls, { failInheritance: true }))).toBe(true);
        expect(calls).toContain('events');
        expect(calls).toContain('linkScan');
        expect(calls).toContain('refresh');
        expect(warning).toHaveBeenCalledOnce();
    } finally {
        warning.mockRestore();
    }
});

it('reports failed required bootstrap without starting writing statistics', async () => {
    const calls: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
        expect(await runStartupSequence(makeTarget(calls, { failBootstrap: true }))).toBe(false);
        expect(calls).not.toContain('session:42');
        expect(calls).not.toContain('autosave');
        expect(calls).not.toContain('refresh');
        expect(error).toHaveBeenCalledOnce();
    } finally {
        error.mockRestore();
    }
});
