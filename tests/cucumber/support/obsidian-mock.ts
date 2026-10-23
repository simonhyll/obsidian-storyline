/**
 * Minimal Obsidian module mock for Node.js test environment.
 *
 * The real "obsidian" package is types-only (main: ""). This mock provides
 * the runtime values that production code imports from 'obsidian':
 * - TFile class (for instanceof checks)
 * - parseYaml / stringifyYaml (for frontmatter parsing)
 *
 * Used only in Cucumber tests via tsx module resolution.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- js-yaml is a test-only dep
const yaml = require('js-yaml');

/**
 * Minimal TFile mock that passes instanceof TFile checks.
 * Production EventManager uses `file instanceof TFile` to distinguish
 * files from folders before reading/modifying content.
 */
export class TFile {
    public path: string;
    public name: string;

    constructor(path: string) {
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
    }
}

/** Parse YAML string to object (matches Obsidian's parseYaml). */
export function parseYaml(text: string): unknown {
    return yaml.load(text);
}

/** Serialize object to YAML string (matches Obsidian's stringifyYaml). */
export function stringifyYaml(obj: unknown): string {
    return yaml.dump(obj);
}

/** Normalize a file path (matches Obsidian's normalizePath). */
export function normalizePath(path: string): string {
    // Simple normalization: remove leading/trailing slashes, collapse double slashes
    return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

/** Minimal Notice mock for test environment. */
export class Notice {
    constructor(_message: string) {
        // No-op in test environment
    }
}

/** Minimal Modal mock for headless cancellation tests. */
export class Modal {
    public contentEl: HTMLElement;
    public titleEl: HTMLElement;
    private _onCloseCallbacks: Array<() => void> = [];
    private _isOpen = false;

    constructor(_app: unknown) {
        // Use jsdom for contentEl when available, otherwise a minimal mock
        const doc = typeof document !== 'undefined' ? document : null;
        this.contentEl = doc ? doc.createElement('div') : { empty: () => {} } as unknown as HTMLElement;
        this.titleEl = doc ? doc.createElement('div') : { setText: () => {} } as unknown as HTMLElement;
    }

    open(): void {
        this._isOpen = true;
    }

    close(): void {
        this._isOpen = false;
        for (const cb of this._onCloseCallbacks) cb();
        this.onClose();
    }

    onOpen(): void {
        // Override in subclasses
    }

    onClose(): void {
        // Override in subclasses
    }
}

/** Minimal Setting mock for headless modal tests. */
export class Setting {
    public settingEl: HTMLElement;
    public controlEl: HTMLElement;

    constructor(container: HTMLElement) {
        const doc = typeof document !== 'undefined' ? document : null;
        this.settingEl = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        this.controlEl = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        if (doc) container.appendChild(this.settingEl);
    }

    setName(_name: string): this { return this; }
    setDesc(_desc: string): this { return this; }
    addText(_cb: (text: { setPlaceholder: () => unknown; setValue: () => unknown; onChange: (fn: (v: string) => void) => void; inputEl: HTMLElement }) => void): this {
        const mockInput = { value: '' } as unknown as HTMLElement;
        const mockText = {
            setPlaceholder: () => mockText,
            setValue: () => mockText,
            onChange: (_fn: (v: string) => void) => {},
            inputEl: mockInput,
        };
        _cb(mockText);
        return this;
    }
    addTextArea(_cb: (text: { setPlaceholder: () => unknown; setValue: () => unknown; onChange: (fn: (v: string) => void) => void; inputEl: any }) => void): this {
        const mockInput = { value: '', rows: 3, style: {} } as any;
        const mockText = {
            setPlaceholder: () => mockText,
            setValue: () => mockText,
            onChange: (_fn: (v: string) => void) => {},
            inputEl: mockInput,
        };
        _cb(mockText);
        return this;
    }
    addDropdown(_cb: (dd: { addOption: () => unknown; setValue: () => unknown; onChange: (fn: (v: string) => void) => void }) => void): this {
        const mockDd = {
            addOption: () => mockDd,
            setValue: () => mockDd,
            onChange: (_fn: (v: string) => void) => {},
        };
        _cb(mockDd);
        return this;
    }
}
