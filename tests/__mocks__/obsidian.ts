/**
 * Mock of the Obsidian API for unit tests.
 * Provides stubs for the most commonly used symbols.
 */

// Core types
export class App {
    vault: any = null;
    workspace: any = null;
    commands: any = null;
    scope: any = null;
    plugins: any = null;
    customRibbon = false;
    manifest: any = null;
    metadataCache: any = null;
    resourceManager: any = null;
    isMobileEditor = false;
    isMobile = false;
    isSafari = false;
    isMac = false;
    isWindows = false;
    isLinux = false;
}

export class Vault {
    adapter: any = null;
    getMarkdownFiles() { return []; }
    getAllFiles() { return []; }
    getFileByPath() { return null; }
    getFolderByPath() { return null; }
}

export class WorkspaceLeaf {
    view: any = null;
}

export class ItemView {
    constructor(leaf: any) {}
    getViewType() { return ''; }
    getDisplayText() { return ''; }
    getIcon() { return ''; }
    containerEl: any = null;
    async onOpen() {}
    async onClose() {}
}

export class Modal {
    app: any = null;
    contentEl: any = null;
    titleEl: any = null;
    open() {}
    close() {}
    constructor() {
        this.contentEl = {
            createDiv: () => this.contentEl,
            createSpan: () => this.contentEl,
            createEl: () => this.contentEl,
        };
        this.titleEl = {
            setText: () => {},
        };
    }
}

export class Setting {
    constructor(_container: any) {}
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addButton() { return this; }
    addDropdown() { return this; }
    addTextArea() { return this; }
    addMomentFormat() { return this; }
    addSlider() { return this; }
    addToggle() { return this; }
    addSearch() { return this; }
    addCheckbox() { return this; }
    setClass() { return this; }
    setHeading() { return this; }
    addExtraButton() { return this; }
}

export class TextComponent {
    setPlaceholder() { return this; }
    onChange() { return this; }
    inputEl: any = null;
    setValue() { return this; }
    getValue() { return ''; }
}

export class ButtonComponent {
    setButtonText() { return this; }
    setCta() { return this; }
    setWarning() { return this; }
    onClick() { return this; }
    setClass() { return this; }
}

export class DropdownComponent {
    addOption() { return this; }
    onChange() { return this; }
    setValue() { return this; }
    getValue() { return ''; }
    selectEl: any = { empty: () => {} };
}

export class Notice {
    constructor(_message: string, _timeout?: number) {}
}

export class Menu {
    addItem() { return this; }
    showAtPosition() {}
    showAtMouseEvent() {}
    open() {}
    close() {}
}

// Utilities
/**
 * Minimal YAML parser for frontmatter — handles key: value pairs,
 * nested objects (indented, recursive), arrays, booleans, and numbers.
 */
export function parseYaml(text: string): Record<string, unknown> {
    const lines = text.split('\n');
    return parseYamlBlock(lines, 0, 0)[0] as Record<string, unknown>;
}

/**
 * Parse a block of YAML lines starting at the given index and minimum indent.
 * Returns [result, nextIndex].
 */
function parseYamlBlock(lines: string[], startIndex: number, minIndent: number): [Record<string, unknown>, number] {
    const result: Record<string, unknown> = {};
    let i = startIndex;

    while (i < lines.length) {
        const line = lines[i];
        // Skip empty lines and comments
        if (!line.trim() || line.trim().startsWith('#')) {
            i++;
            continue;
        }

        const indent = line.search(/\S/);
        if (indent < minIndent) {
            // We've exited this block
            break;
        }
        if (indent > minIndent) {
            // Skip lines that are deeper than expected
            i++;
            continue;
        }

        const match = line.match(/^\s*(\S+):\s*(.*)$/);
        if (match) {
            const [, key, value] = match;
            const cleaned = value.trim();

            if (cleaned === '') {
                // Nested object or array — find the actual child indent first
                let childStart = i + 1;
                while (childStart < lines.length && (!lines[childStart].trim() || lines[childStart].trim().startsWith('#'))) {
                    childStart++;
                }
                if (childStart < lines.length) {
                    const childIndent = lines[childStart].search(/\S/);
                    if (childIndent > indent) {
                        // Check if it's an array (starts with -)
                        if (lines[childStart].trim().startsWith('- ')) {
                            const [arr, nextI] = parseYamlArray(lines, childStart, childIndent);
                            result[key] = arr;
                            i = nextI;
                        } else {
                            const [nested, nextI] = parseYamlBlock(lines, childStart, childIndent);
                            result[key] = nested;
                            i = nextI;
                        }
                    } else {
                        result[key] = {};
                        i++;
                    }
                } else {
                    result[key] = {};
                    i++;
                }
            } else {
                result[key] = parseScalar(cleaned);
                i++;
            }
        } else {
            i++;
        }
    }

    return [result, i];
}

/**
 * Parse a YAML array block.
 */
function parseYamlArray(lines: string[], startIndex: number, minIndent: number): [unknown[], number] {
    const result: unknown[] = [];
    let i = startIndex;

    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || line.trim().startsWith('#')) {
            i++;
            continue;
        }

        const indent = line.search(/\S/);
        if (indent < minIndent) break;
        if (indent > minIndent) {
            i++;
            continue;
        }

        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            const value = trimmed.slice(2).trim();
            result.push(parseScalar(value));
            i++;
        } else {
            break;
        }
    }

    return [result, i];
}

/** Parse a scalar YAML value */
function parseScalar(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;

    // Handle arrays: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1);
        if (!inner.trim()) return [];
        return inner
            .split(',')
            .map(s => parseScalar(s.trim()))
            .filter(Boolean);
    }

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }

    // Handle numbers
    if (!isNaN(Number(value))) return Number(value);

    return value;
}

/**
 * Minimal YAML stringifier — handles nested objects, arrays, booleans, and numbers.
 */
export function stringifyYaml(obj: Record<string, unknown>, indent = 0): string {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
            // Nested object
            lines.push(`${prefix}${key}:`);
            const nested = stringifyYaml(value as Record<string, unknown>, indent + 1);
            if (nested) lines.push(nested);
        } else if (Array.isArray(value)) {
            // Array
            if (value.length === 0) {
                lines.push(`${prefix}${key}: []`);
            } else {
                lines.push(`${prefix}${key}:`);
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        lines.push(`${prefix}- ${JSON.stringify(item)}`);
                    } else {
                        lines.push(`${prefix}- ${formatScalar(item)}`);
                    }
                }
            }
        } else {
            lines.push(`${prefix}${key}: ${formatScalar(value)}`);
        }
    }
    return lines.join('\n');
}

/** Format a scalar value for YAML output */
function formatScalar(value: unknown): string {
    if (value === undefined || value === null) return 'null';
    if (typeof value === 'string') {
        // Quote strings that contain special characters
        if (value.includes(':') || value.includes('#') || value.includes("'") ||
            value.includes('"') || value.includes('\n') || value.startsWith('[') ||
            value.startsWith('{') || value === 'true' || value === 'false' ||
            value === 'null' || value === '~' || !isNaN(Number(value))) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    return String(value);
}

export function normalizePath(path: string): string {
    if (!path) return '';
    let result = path.replace(/\\/g, '/');
    while (result.startsWith('./')) result = result.substring(2);
    if (result !== '.' && result.endsWith('/')) result = result.slice(0, -1);
    return result;
}

export function setIcon(el: any, icon: string): void {
    // No-op
}

export function addIcon(_id: string, _svg: string): void {
    // No-op
}

// Adapter interface
export interface Adapter {
    path: string;
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    remove(path: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    rmdir(path: string, empty: boolean): Promise<void>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    copy(src: string, dest: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    getResourcePath(path: string): string | undefined;
}

// TFolder
export class TFolder {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || path;
    }
}

// TFile — mock accepts optional path for test convenience;
// the real Obsidian TFile has no constructor parameters.
export class TFile {
    path: string;
    name: string;
    vault: any;
    parent: any;
    constructor(p?: string) {
        this.path = p || '';
        this.name = this.path.split('/').pop() || this.path;
        this.vault = null;
        this.parent = null;
    }
}

export default {};
