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
