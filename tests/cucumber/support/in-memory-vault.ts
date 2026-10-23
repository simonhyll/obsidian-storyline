/**
 * In-memory Obsidian vault harness for testing production services.
 *
 * Provides a minimal mock of the Obsidian Vault API that supports:
 * - File creation, reading, modification, deletion
 * - Folder existence and creation
 * - File lookup by path (returns TFile instances for instanceof checks)
 * - Markdown file enumeration
 * - Frontmatter parsing
 *
 * Used by EventManager and SceneManager tests to exercise real production
 * code without requiring the actual Obsidian application.
 *
 * Key design decisions:
 * - Returns TFile instances from getAbstractFileByPath so that production
 *   `instanceof TFile` checks pass correctly.
 * - adapter.exists() only returns true for actual files and folders,
 *   not for arbitrary child paths under existing folders.
 * - Uses js-yaml for YAML parsing (Obsidian's parseYaml is types-only).
 */

import { TFile } from './obsidian-mock';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- js-yaml is a test-only dep
const yaml = require('js-yaml');

/** Parse YAML string to object (matches Obsidian's parseYaml). */
export function parseYaml(text: string): unknown {
  return yaml.load(text);
}

/** Serialize object to YAML string (matches Obsidian's stringifyYaml). */
export function stringifyYaml(obj: unknown): string {
  return yaml.dump(obj);
}

/** A single in-memory file with TFile wrapper. */
export interface InMemoryFile extends TFile {
  content: string;
  createdAt: number;
  modifiedAt: number;
}

/** Minimal adapter mock for vault operations. */
export interface VaultAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Minimal vault mock for testing. */
export interface TestVault {
  adapter: VaultAdapter;
  create(path: string, content: string): Promise<InMemoryFile>;
  read(file: InMemoryFile): Promise<string>;
  modify(file: InMemoryFile, content: string): Promise<void>;
  getAbstractFileByPath(path: string): InMemoryFile | null;
  getMarkdownFiles(): InMemoryFile[];
  /** All stored files (for test assertions). */
  files: Map<string, InMemoryFile>;
  /** All folders that have been created. */
  folders: Set<string>;
}

/**
 * Create a new isolated in-memory vault instance.
 */
export function createInMemoryVault(): TestVault {
  const files = new Map<string, InMemoryFile>();
  const folders = new Set<string>();

  function ensureParentFolders(path: string): void {
    const parts = path.split('/');
    if (parts.length <= 1) return;
    // Remove the file name, keep directory parts
    parts.pop();
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    }
  }

  const adapter = buildAdapter(files, folders);
  return buildVault(files, folders, adapter, ensureParentFolders);
}

function buildAdapter(
  files: Map<string, InMemoryFile>,
  folders: Set<string>,
): VaultAdapter {
  return {
    /**
     * Check if a specific file or folder exists.
     * Only returns true for exact file or folder paths,
     * NOT for arbitrary child paths under existing folders.
     */
    exists: async (path: string): Promise<boolean> => {
      if (files.has(path)) return true;
      if (folders.has(path)) return true;
      return false;
    },
    mkdir: async (path: string): Promise<void> => {
      folders.add(path);
    },
    remove: async (path: string): Promise<void> => {
      files.delete(path);
    },
  };
}

function createInMemoryFile(path: string, content: string): InMemoryFile {
  const now = Date.now();
  // Create a TFile-compatible object with content tracking
  const tfile = new TFile(path);
  const file: InMemoryFile = {
    path,
    name: tfile.name,
    content,
    createdAt: now,
    modifiedAt: now,
  };
  // Make it pass instanceof TFile checks
  Object.setPrototypeOf(file, TFile.prototype);
  return file;
}

function buildVault(
  files: Map<string, InMemoryFile>,
  folders: Set<string>,
  adapter: VaultAdapter,
  ensureParents: (p: string) => void,
): TestVault {
  return {
    adapter,
    files,
    folders,
    create: async (path: string, content: string): Promise<InMemoryFile> => {
      const file = createInMemoryFile(path, content);
      files.set(path, file);
      ensureParents(path);
      return file;
    },
    read: async (file: InMemoryFile): Promise<string> => {
      const stored = files.get(file.path);
      if (!stored) throw new Error(`File not found: ${file.path}`);
      return stored.content;
    },
    modify: async (file: InMemoryFile, content: string): Promise<void> => {
      const stored = files.get(file.path);
      if (!stored) throw new Error(`File not found: ${file.path}`);
      stored.content = content;
      stored.modifiedAt = Date.now();
    },
    getAbstractFileByPath: (path: string): InMemoryFile | null => {
      return files.get(path) ?? null;
    },
    getMarkdownFiles: (): InMemoryFile[] => {
      return Array.from(files.values()).filter(f => f.path.endsWith('.md'));
    },
  };
}

/**
 * Parse frontmatter from a Markdown file content string.
 */
export function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: content.trim() };

  let fm: Record<string, unknown>;
  try {
    fm = parseYaml(match[1]) as Record<string, unknown>;
  } catch {
    fm = {};
  }

  const body = content.slice(match[0].length).trim();
  return { frontmatter: fm || {}, body };
}

/**
 * Build Markdown content with YAML frontmatter.
 */
export function buildMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string = '',
): string {
  const yamlStr = stringifyYaml(frontmatter).replace(/\n+$/, '');
  return `---\n${yamlStr}\n---\n${body}`;
}

/**
 * Create a minimal App mock that wraps a test vault.
 * Used to construct EventManager/SceneManager instances.
 */
export type AppMock = { vault: TestVault };

export function createAppMock(vault: TestVault): AppMock {
  return { vault };
}
