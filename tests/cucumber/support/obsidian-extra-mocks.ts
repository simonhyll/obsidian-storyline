/** Additional Obsidian mocks extracted from obsidian-mock.ts. */

/** Minimal App mock for services that import it from obsidian. */
export class App {
    vault: { adapter: { read: () => Promise<string>; write: () => Promise<void>; exists: () => Promise<boolean>; list: () => Promise<{ files: string[]; folders: string[] }> } };
    constructor(vault?: typeof this.vault) {
        this.vault = vault ?? {} as typeof this.vault;
    }
}

/** Mock moment for TimeSpanPicker and other components. */
export const moment = (date?: string | Date) => {
    const d = date ? new Date(date) : new Date();
    return {
        format: (_fmt?: string) => d.toISOString(),
        isValid: () => !isNaN(d.getTime()),
        valueOf: () => d.getTime(),
    };
};
