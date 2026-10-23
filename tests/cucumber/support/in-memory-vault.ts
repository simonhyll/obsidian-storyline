/**
 * In-memory Obsidian vault harness for testing production services.
 *
 * Provides a minimal mock of the Obsidian Vault API that supports:
 * - File creation, reading, modification, deletion
 * - Folder existence and creation
 * - File lookup by path
 * - Markdown file enumeration
 * - Frontmatter parsing
 *
 * Used by EventManager and SceneManager tests to exercise real production
 * code without requiring the actual Obsidian application.
 */

// Use js-yaml directly — obsidian's parseYaml/stringifyYaml are not available
// in the Node.js test environment.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- js-yaml is a test-only CJS dep
const yaml = require('js-yaml');

/** Parse YAML string to object (matches Obsidian's parseYaml). */
function parseYaml(text: string): unknown {
  return yaml.load(text);
}

/** Serialize object to YAML string (matches Obsidian's stringifyYaml). */
function stringifyYaml(obj: unknown): string {
  return yaml.dump(obj);
}

/** A single in-memory file. */
export interface InMemoryFile {
  path: string;
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
  read(path: string): Promise<string>;
  modify(path: string, content: string): Promise<void>;
  getAbstractFileByPath(path: string): InMemoryFile | null;
  getMarkdownFiles(): InMemoryFile[];
  /** All stored files (for test assertions). */
  files: Map<string, InMemoryFile>;
  /** All folders that have been created. */
  folders: Set<string>;
}

/**
 * Create a new in-memory vault instance.
 */
export function createInMemoryVault(): TestVault {
  const files = new Map<string, InMemoryFile>();
  const folders = new Set<string>();

  function ensureParentFolders(path: string): void {
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    if (!parentDir) return;
    folders.add(parentDir);
    let parent = parentDir;
    while ((parent = parent.substring(0, parent.lastIndexOf('/')))) {
      folders.add(parent);
    }
  }

  const adapter: VaultAdapter = buildAdapter(files, folders, ensureParentFolders);
  return buildVault(files, folders, adapter, ensureParentFolders);
}

function buildAdapter(
  files: Map<string, InMemoryFile>,
  folders: Set<string>,
  ensureParents: (p: string) => void,
): VaultAdapter {
  return {
    exists: async (path: string): Promise<boolean> => {
      if (files.has(path)) return true;
      if (folders.has(path)) return true;
      for (const folder of folders) {
        if (path.startsWith(folder + '/')) return true;
      }
      return false;
    },
    mkdir: async (path: string): Promise<void> => {
      folders.add(path);
      ensureParents(path);
    },
    remove: async (path: string): Promise<void> => {
      files.delete(path);
    },
  };
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
      const now = Date.now();
      const file: InMemoryFile = { path, content, createdAt: now, modifiedAt: now };
      files.set(path, file);
      ensureParents(path);
      return file;
    },
    read: async (path: string): Promise<string> => {
      const file = files.get(path);
      if (!file) throw new Error(`File not found: ${path}`);
      return file.content;
    },
    modify: async (path: string, content: string): Promise<void> => {
      const file = files.get(path);
      if (!file) throw new Error(`File not found: ${path}`);
      file.content = content;
      file.modifiedAt = Date.now();
    },
    getAbstractFileByPath: (path: string): InMemoryFile | null => {
      return files.get(path) || null;
    },
    getMarkdownFiles: (): InMemoryFile[] => {
      return Array.from(files.values()).filter(f => f.path.endsWith('.md'));
    },
  };
}

/**
 * Parse frontmatter from a Markdown file content string.
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
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
  body: string = ''
): string {
  const yaml = stringifyYaml(frontmatter).replace(/\n+$/, '');
  return `---\n${yaml}\n---\n${body}`;
}

/**
 * Create a minimal App mock that wraps a test vault.
 */
export function createAppMock(vault: TestVault): { vault: TestVault } {
  return { vault };
}
