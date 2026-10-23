/**
 * Pure changelog parsing and formatting logic.
 *
 * Extracted from scripts/changelog.cjs so that both the CLI script and
 * tests can exercise the same production implementation.
 *
 * This module contains no I/O — all functions are pure and deterministic.
 */

/**
 * Map of Conventional Commit types to changelog section names.
 */
export const CHANGELOG_TYPES: Record<string, string> = {
    feat: 'features',
    fix: 'bugFixes',
    perf: 'performance',
    refactor: 'refactor',
    docs: 'docs',
    style: 'style',
    test: 'test',
    build: 'build',
    ci: 'ci',
    chore: 'chore',
};

/**
 * Sections that are omitted from release notes (internal maintenance noise).
 */
export const OMITTED_SECTIONS = new Set(['style', 'build', 'ci', 'chore', 'test']);

/**
 * Conventional Commits header regex.
 * Groups: 1=type, 2=full scope group, 3=scope content, 4=breaking bang, 5=subject
 */
const HEADER_RE =
    /^(feat|fix|perf|refactor|docs|style|test|build|ci|chore)(\(([\w$/.-]*)\))?(!)?\s?:\s*(.*)$/;

/**
 * A classified commit entry.
 */
export interface ClassifiedCommit {
    /** The section this commit belongs to (e.g. "features", "bugFixes"). */
    section: string;
    /** The Conventional Commit type (e.g. "feat", "fix"). */
    type: string;
    /** The optional scope (e.g. "timeline"). */
    scope: string | null;
    /** The commit subject message. */
    subject: string;
    /** Whether this is a breaking change. */
    breaking: boolean;
    /** The short git hash (only when parsed from git log format). */
    hash?: string;
}

/**
 * A non-conforming commit that doesn't match Conventional Commits.
 */
export interface NonConformingCommit {
    /** The short git hash. */
    hash: string;
    /** The raw subject line. */
    subject: string;
}

/**
 * Grouped changelog entries.
 */
export interface ChangelogEntries {
    features: ClassifiedCommit[];
    bugFixes: ClassifiedCommit[];
    performance: ClassifiedCommit[];
    refactor: ClassifiedCommit[];
    docs: ClassifiedCommit[];
    breakingChanges: ClassifiedCommit[];
    other: ClassifiedCommit[];
    nonconforming: NonConformingCommit[];
}

/**
 * Parse a single commit subject line into a classified commit.
 *
 * This is the core parsing function — it accepts a plain subject line
 * (without hash prefix) and returns the classification, or null if the
 * commit doesn't conform to Conventional Commits.
 *
 * @param subjectLine - The commit subject line (e.g. "feat(timeline): add navigation")
 * @param body - Optional commit body (checked for BREAKING CHANGE: notes)
 * @returns Classified commit or null if non-conforming
 */
export function parseCommitMessage(
    subjectLine: string,
    body?: string,
): ClassifiedCommit | null {
    const match = subjectLine.match(HEADER_RE);
    if (!match) return null;

    const [, type, , scope, breakingBang, subject] = match;

    // Check body for BREAKING CHANGE: note
    const hasBreakingNote = body ? /^\s*BREAKING CHANGE\s*:/im.test(body) : false;
    const breaking = breakingBang === '!' || hasBreakingNote;

    const section = CHANGELOG_TYPES[type] ?? 'other';

    return {
        section,
        type,
        scope: scope ?? null,
        subject: subject ?? '',
        breaking,
    };
}

/**
 * Parse a raw Git log line in the format used by the changelog CLI script.
 *
 * Format: `<hash>|<subject>\n<body>`
 *
 * @param line - Raw git log output block
 * @returns Classified commit with hash, or null if non-conforming
 */
export function parseGitLogLine(line: string): ClassifiedCommit | NonConformingCommit | null {
    const firstNewline = line.indexOf('\n');
    const header = firstNewline >= 0 ? line.slice(0, firstNewline) : line;
    const body = firstNewline >= 0 ? line.slice(firstNewline + 1) : '';

    const pipeIdx = header.indexOf('|');
    if (pipeIdx < 0) return null;

    const hash = header.slice(0, pipeIdx);
    const subjectLine = header.slice(pipeIdx + 1);

    const classified = parseCommitMessage(subjectLine, body);
    if (!classified) {
        // Non-conforming commit
        return { hash, subject: subjectLine };
    }

    return { ...classified, hash };
}

/**
 * Categorize a single classified commit into the appropriate entry group.
 */
function categorizeCommit(
    classified: ClassifiedCommit,
    entries: ChangelogEntries,
): void {
    const item = classified;
    if (classified.breaking) {
        entries.breakingChanges.push(item);
    }
    switch (classified.section) {
        case 'features':
            entries.features.push(item);
            break;
        case 'bugFixes':
            entries.bugFixes.push(item);
            break;
        case 'performance':
            entries.performance.push(item);
            break;
        case 'refactor':
            entries.refactor.push(item);
            break;
        case 'docs':
            entries.docs.push(item);
            break;
        default:
            if (!OMITTED_SECTIONS.has(classified.section)) {
                entries.other.push(item);
            }
            break;
    }
}

/**
 * Generate grouped changelog entries from a list of raw git log blocks.
 *
 * @param commitBlocks - Raw git log output blocks
 * @returns Grouped entries
 */
export function generateEntries(commitBlocks: string[]): ChangelogEntries {
    const entries: ChangelogEntries = {
        features: [],
        bugFixes: [],
        performance: [],
        refactor: [],
        docs: [],
        breakingChanges: [],
        other: [],
        nonconforming: [],
    };

    for (const block of commitBlocks) {
        const parsed = parseGitLogLine(block);
        if (!parsed) continue;
        if (!('section' in parsed)) {
            entries.nonconforming.push(parsed);
            continue;
        }
        categorizeCommit(parsed, entries);
    }

    return entries;
}

/**
 * Format a single entry as a Markdown bullet point.
 */
export function formatEntry(item: { scope: string | null; subject: string; hash?: string }): string {
    const scope = item.scope ? `**${item.scope}** ` : '';
    const hashRef = item.hash ? ` (\`${item.hash}\`)` : '';
    return `- ${scope}${item.subject}${hashRef}`;
}

/**
 * Section definition for changelog markdown generation.
 */
interface SectionDef {
    /** Section header text */
    header: string;
    /** Whether entries are ClassifiedCommit or NonConformingCommit */
    type: 'classified' | 'nonconforming';
}

/**
 * Section definitions in display order.
 */
const SECTIONS: Array<{ key: keyof ChangelogEntries; def: SectionDef }> = [
    { key: 'breakingChanges', def: { header: '### ⚠️ Breaking Changes', type: 'classified' } },
    { key: 'features', def: { header: '### Features', type: 'classified' } },
    { key: 'bugFixes', def: { header: '### Bug Fixes', type: 'classified' } },
    { key: 'performance', def: { header: '### Performance', type: 'classified' } },
    { key: 'refactor', def: { header: '### Refactoring', type: 'classified' } },
    { key: 'docs', def: { header: '### Documentation', type: 'classified' } },
    { key: 'other', def: { header: '### Other Changes', type: 'classified' } },
    { key: 'nonconforming', def: { header: '### Non-conforming Commits', type: 'nonconforming' } },
];

/**
 * Append a single section's entries to the lines array.
 */
function appendSection(
    lines: string[],
    entries: ClassifiedCommit[] | NonConformingCommit[],
    def: SectionDef,
): void {
    if (entries.length === 0) return;
    lines.push(def.header);
    lines.push('');
    for (const item of entries) {
        if (def.type === 'classified') {
            lines.push(formatEntry(item as ClassifiedCommit));
        } else {
            const nc = item as NonConformingCommit;
            const hashRef = nc.hash ? ` (\`${nc.hash}\`)` : '';
            lines.push(`- ${nc.subject}${hashRef}`);
        }
    }
    lines.push('');
}

/**
 * Generate the full Markdown changelog section for a version.
 *
 * @param version - Version string (e.g. "1.0.0" or "unreleased")
 * @param entries - Grouped changelog entries
 * @returns Markdown string
 */
export function generateMarkdown(version: string, entries: ChangelogEntries): string {
    const lines = [`## Version ${version}`, ''];
    for (const { key, def } of SECTIONS) {
        appendSection(lines, entries[key], def);
    }
    return lines.join('\n');
}

/**
 * Check if a changelog content already contains a section for the given version.
 *
 * @param content - Current CHANGELOG.md content
 * @param version - Version to check
 * @returns true if the version section already exists
 */
export function hasVersionSection(content: string, version: string): boolean {
    return content.includes(`## Version ${version}`);
}

/**
 * Insert a new version section into CHANGELOG.md content.
 *
 * The new section is placed after the Support StoryLine section (if present)
 * and before the oldest existing version section.
 *
 * @param content - Current CHANGELOG.md content
 * @param version - Version string
 * @param markdown - Generated markdown section
 * @returns The updated content string
 * @throws Error if the version section already exists
 */
export function insertVersionSection(
    content: string,
    version: string,
    markdown: string,
): string {
    // Check for duplicate version
    if (hasVersionSection(content, version)) {
        throw new Error(
            `CHANGELOG.md already contains a section for ${version}. Remove it manually or use a different version.`,
        );
    }

    // Find the position after the Support section
    const supportEnd = content.indexOf('[![Donate');
    if (supportEnd >= 0) {
        const lineEnd = content.indexOf('\n', supportEnd);
        if (lineEnd >= 0) {
            const before = content.slice(0, lineEnd);
            const after = content.slice(lineEnd);
            return `${before}\n\n${markdown}${after}`;
        }
    }

    // Fallback: insert after the first line (title)
    const firstNewline = content.indexOf('\n');
    if (firstNewline >= 0) {
        const before = content.slice(0, firstNewline);
        const after = content.slice(firstNewline);
        return `${before}\n\n${markdown}${after}`;
    }

    // Last resort: prepend
    return `${markdown}\n${content}`;
}
