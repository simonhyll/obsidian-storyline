/** Minimal plugin boundary for SavedViewService acceptance scenarios. */
import type { TestVault } from './in-memory-vault';

export interface SavedViewPluginFixture {
    app: { vault: TestVault };
    getProjectSystemFolder: () => string;
}

/** Isolates persistence under the disposable test Book, never a real vault. */
export function createSavedViewPluginMock(vault: TestVault): SavedViewPluginFixture {
    return {
        app: { vault },
        getProjectSystemFolder: () => 'StoryLine/My Book/System',
    };
}
