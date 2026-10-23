/**
 * Pure changelog parsing and formatting logic.
 *
 * Shared between scripts/changelog.cjs (CLI) and tests/cucumber/steps/changelog.steps.ts.
 * This is repository tooling, not Obsidian plugin logic — it lives under scripts/
 * so it does not need to be bundled into dist/main.js.
 *
 * All functions are pure and deterministic — no I/O.
 */

"use strict";

const CHANGELOG_TYPES = {
	feat: "features",
	fix: "bugFixes",
	perf: "performance",
	refactor: "refactor",
	docs: "docs",
	style: "style",
	test: "test",
	build: "build",
	ci: "ci",
	chore: "chore",
};

const OMITTED_SECTIONS = new Set(["style", "build", "ci", "chore", "test"]);

/**
 * Conventional Commits header regex.
 * Groups: 1=type, 2=full scope group, 3=scope content, 4=breaking bang, 5=subject
 */
const HEADER_RE =
	/^(feat|fix|perf|refactor|docs|style|test|build|ci|chore)(\(([\w$/.-]*)\))?(!)?\s?:\s*(.*)$/;

/**
 * Parse a single commit subject line into a classified commit.
 *
 * @param {string} subjectLine - The commit subject line (e.g. "feat(timeline): add navigation")
 * @param {string} [body] - Optional commit body (checked for BREAKING CHANGE: notes)
 * @returns {{section: string, type: string, scope: string|null, subject: string, breaking: boolean}|null}
 */
function parseCommitMessage(subjectLine, body) {
	const match = subjectLine.match(HEADER_RE);
	if (!match) return null;

	const [, type, , scope, breakingBang, subject] = match;

	// Check body for BREAKING CHANGE: note
	const hasBreakingNote = body ? /^\s*BREAKING CHANGE\s*:/im.test(body) : false;
	const breaking = breakingBang === "!" || hasBreakingNote;

	const section = CHANGELOG_TYPES[type] ?? "other";

	return {
		section,
		type,
		scope: scope ?? null,
		subject: subject ?? "",
		breaking,
	};
}

/**
 * Parse a raw Git log line in the format used by the changelog CLI script.
 *
 * Format: `<hash>|<subject>\n<body>`
 *
 * @param {string} line - Raw git log output block
 * @returns {{section: string, type: string, scope: string|null, subject: string, breaking: boolean, hash: string}|{hash: string, subject: string}|null}
 */
function parseGitLogLine(line) {
	const firstNewline = line.indexOf("\n");
	const header = firstNewline >= 0 ? line.slice(0, firstNewline) : line;
	const body = firstNewline >= 0 ? line.slice(firstNewline + 1) : "";

	const pipeIdx = header.indexOf("|");
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
 * Generate grouped changelog entries from a list of raw git log blocks.
 *
 * @param {string[]} commitBlocks - Raw git log output blocks
 * @returns {{features: Array, bugFixes: Array, performance: Array, refactor: Array, docs: Array, breakingChanges: Array, other: Array, nonconforming: Array}}
 */
function generateEntries(commitBlocks) {
	const entries = {
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
		if (!("section" in parsed)) {
			entries.nonconforming.push(parsed);
			continue;
		}
		// Classified commit
		const item = parsed;
		if (parsed.breaking) {
			entries.breakingChanges.push(item);
		}
		switch (parsed.section) {
			case "features":
				entries.features.push(item);
				break;
			case "bugFixes":
				entries.bugFixes.push(item);
				break;
			case "performance":
				entries.performance.push(item);
				break;
			case "refactor":
				entries.refactor.push(item);
				break;
			case "docs":
				entries.docs.push(item);
				break;
			default:
				if (!OMITTED_SECTIONS.has(parsed.section)) {
					entries.other.push(item);
				}
				break;
		}
	}

	return entries;
}

/**
 * Format a single entry as a Markdown bullet point.
 *
 * @param {{scope: string|null, subject: string, hash?: string}} item
 * @returns {string}
 */
function formatEntry(item) {
	const scope = item.scope ? `**${item.scope}** ` : "";
	const hashRef = item.hash ? ` (\`${item.hash}\`)` : "";
	return `- ${scope}${item.subject}${hashRef}`;
}

/**
 * Section definitions in display order.
 */
const SECTIONS = [
	{ key: "breakingChanges", header: "### ⚠️ Breaking Changes", type: "classified" },
	{ key: "features", header: "### Features", type: "classified" },
	{ key: "bugFixes", header: "### Bug Fixes", type: "classified" },
	{ key: "performance", header: "### Performance", type: "classified" },
	{ key: "refactor", header: "### Refactoring", type: "classified" },
	{ key: "docs", header: "### Documentation", type: "classified" },
	{ key: "other", header: "### Other Changes", type: "classified" },
	{ key: "nonconforming", header: "### Non-conforming Commits", type: "nonconforming" },
];

/**
 * Generate the full Markdown changelog section for a version.
 *
 * @param {string} version - Version string (e.g. "1.0.0" or "unreleased")
 * @param {{features: Array, bugFixes: Array, performance: Array, refactor: Array, docs: Array, breakingChanges: Array, other: Array, nonconforming: Array}} entries
 * @returns {string} Markdown string
 */
function generateMarkdown(version, entries) {
	const lines = [`## Version ${version}`, ""];

	for (const { key, header, type } of SECTIONS) {
		const items = entries[key];
		if (items.length === 0) continue;
		lines.push(header);
		lines.push("");
		for (const item of items) {
			if (type === "classified") {
				lines.push(formatEntry(item));
			} else {
				const hashRef = item.hash ? ` (\`${item.hash}\`)` : "";
				lines.push(`- ${item.subject}${hashRef}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Check if a changelog content already contains a section for the given version.
 *
 * @param {string} content - Current CHANGELOG.md content
 * @param {string} version - Version to check
 * @returns {boolean}
 */
function hasVersionSection(content, version) {
	return content.includes(`## Version ${version}`);
}

/**
 * Insert a new version section into CHANGELOG.md content.
 *
 * The new section is placed after the Support StoryLine section (if present)
 * and before the oldest existing version section.
 *
 * @param {string} content - Current CHANGELOG.md content
 * @param {string} version - Version string
 * @param {string} markdown - Generated markdown section
 * @returns {string} The updated content string
 * @throws {Error} If the version section already exists
 */
function insertVersionSection(content, version, markdown) {
	// Check for duplicate version
	if (hasVersionSection(content, version)) {
		throw new Error(
			`CHANGELOG.md already contains a section for ${version}. Remove it manually or use a different version.`
		);
	}

	// Find the position after the Support section
	const supportEnd = content.indexOf("[![Donate");
	if (supportEnd >= 0) {
		const lineEnd = content.indexOf("\n", supportEnd);
		if (lineEnd >= 0) {
			const before = content.slice(0, lineEnd);
			const after = content.slice(lineEnd);
			return `${before}\n\n${markdown}${after}`;
		}
	}

	// Fallback: insert after the first line (title)
	const firstNewline = content.indexOf("\n");
	if (firstNewline >= 0) {
		const before = content.slice(0, firstNewline);
		const after = content.slice(firstNewline);
		return `${before}\n\n${markdown}${after}`;
	}

	// Last resort: prepend
	return `${markdown}\n${content}`;
}

module.exports = {
	parseCommitMessage,
	parseGitLogLine,
	generateEntries,
	generateMarkdown,
	hasVersionSection,
	insertVersionSection,
	formatEntry,
	CHANGELOG_TYPES,
	OMITTED_SECTIONS,
};
