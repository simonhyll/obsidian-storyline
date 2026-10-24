/**
 * Scrivener import dialog flow, isolated from the main command registration
 * to keep module sizes under the architectural limits.
 */

import { App, Notice } from 'obsidian';
import type { PluginTarget } from './plugin-target';

/**
 * Performs a Scrivener import dialog flow.
 * Dynamically imports the ScrivenerImporter to avoid loading on mobile.
 */
export async function importScrivener(p: PluginTarget): Promise<void> {
    // Load the importer only when requested (desktop-only Node dependency).
    // isAvailable() is synchronous; do not wrap it in an async Proxy.
    const { ScrivenerImporter } = await import('../services/ScrivenerImporter');
    if (!ScrivenerImporter.isAvailable()) {
        new Notice('Scrivener import is only available on desktop.');
        return;
    }
    const remote = await acquireElectronRemote();
    if (!remote) {
        new Notice('File dialog not available.');
        return;
    }

    const scrivPath = await selectScrivenerFolder(remote);
    if (!scrivPath) return;

    const destination = await selectDestination(p.app);
    if (!destination) return;

    new Notice('Importing Scrivener project…');
    try {
        const importer = new ScrivenerImporter(p.app, p as unknown as import('../main').default);
        const r = await importer.import(scrivPath, destination);
        const parts = [
            `${r.scenesImported} scenes`,
            `${r.charactersImported} characters`,
            `${r.locationsImported} locations`,
        ];
        if (r.filesImported > 0) parts.push(`${r.filesImported} files`);
        new Notice(`Imported "${r.projectTitle}": ${parts.join(', ')}`, 8000);
    } catch (err: unknown) {
        new Notice('Import failed: ' + (err instanceof Error ? err.message : String(err)));
    }
}

/** Acquires the Electron remote module for file dialogs. */
type ElectronRemote = {
    dialog: { showOpenDialog: (opts: unknown) => Promise<{ canceled: boolean; filePaths?: string[] }> };
};

async function acquireElectronRemote(): Promise<ElectronRemote | undefined> {
    const win = window as unknown as { require?: (m: string) => unknown };
    try {
        return win.require?.('@electron/remote') as ElectronRemote;
    } catch {
        try {
            return (win.require?.('electron') as { remote?: unknown })?.remote as ElectronRemote;
        } catch {
            return undefined;
        }
    }
}

/** Shows a folder picker and returns the selected .scriv path, or undefined. */
async function selectScrivenerFolder(remote: {
    dialog: { showOpenDialog: (opts: unknown) => Promise<{ canceled: boolean; filePaths?: string[] }> };
}): Promise<string | undefined> {
    const result = await remote.dialog.showOpenDialog({
        title: 'Select Scrivener Project folder (.scriv)',
        message: 'Select the .scriv project folder. A second dialog will ask for an import destination inside the active vault.',
        properties: ['openDirectory'],
        filters: [{ name: 'Scrivener Project', extensions: ['scriv'] }],
    });
    if (result.canceled || !result.filePaths?.length) return undefined;
    const scrivPath = result.filePaths[0];
    if (!scrivPath.toLowerCase().endsWith('.scriv')) {
        new Notice('Please select a .scriv folder.');
        return undefined;
    }
    return scrivPath;
}

/** Shows a destination picker and returns the chosen path, or undefined. */
async function selectDestination(app: App): Promise<string | undefined> {
    try {
        const { pickScrivenerDestination } = await import('../services/ScrivenerImporter');
        const r = await pickScrivenerDestination(app);
        return r ?? undefined;
    } catch (err: unknown) {
        new Notice('Import cancelled: ' + (err instanceof Error ? err.message : String(err)));
        return undefined;
    }
}

