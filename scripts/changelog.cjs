#!/usr/bin/env node

/**
 * Changelog generation script for StoryLine.
 *
 * Reads Git commit messages since a baseline tag (or since the beginning of
 * history when no tag exists), parses them using Conventional Commits, and
 * produces a Markdown release-notes section.
 *
 * Commands:
 *   node scripts/changelog.cjs preview [--from <tag>]
 *     Prints the proposed changelog section to stdout without modifying files.
 *
 *   node scripts/changelog.cjs prepare <version> [--from <tag>]
 *     Generates the changelog section for the given version and inserts it
 *     into CHANGELOG.md. Refuses to proceed if a Git tag for <version>
 *     already exists.
 *
 *   node scripts/changelog.cjs parse <commit-sha>
 *     Parses a single commit and prints the classified JSON to stdout.
 *     Used by tests.
 */

const { spawnSync } = require("child_process");
const { readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");
const {
	generateEntries,
	generateMarkdown,
	insertVersionSection,
	hasVersionSection,
	parseGitLogLine,
} = require("./changelog-lib.cjs");

// ---------------------------------------------------------------------------
// Git helpers (spawnSync — no shell required)
// ---------------------------------------------------------------------------

function root() {
  return resolve(__dirname, "..");
}

/**
 * Run a git command and return stdout as a trimmed string.
 * Uses portable 'git' command (no hardcoded path).
 */
function git(...args) {
  const result = spawnSync("git", args, {
    cwd: root(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024, // 10 MB
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `git ${args.join(" ")} failed [status=${result.status}, error=${result.error?.message ?? "none"}]: ${result.stderr?.trim() ?? result.stdout?.trim() ?? "no output"}`
    );
  }
  return (result.stdout ?? "").trim();
}

/**
 * Return the list of raw commit records since `fromRef`.
 * Each record is `<hash>|<subject>\n<body>`.
 */
function getCommits(fromRef) {
  const args = [
    "log",
    `--format=%h|%s%n%b---COMMIT_SEPARATOR---`,
  ];
  if (fromRef) {
    args.push(`${fromRef}..HEAD`);
  }
  const raw = git(...args);
  if (!raw) return [];

  // Split by separator, filter empty
  const blocks = raw
    .split("---COMMIT_SEPARATOR---")
    .map((s) => s.trim())
    .filter(Boolean);

  return blocks;
}

/**
 * Check whether a Git tag already exists.
 */
function tagExists(tag) {
  try {
    const output = git("tag", "-l", tag);
    return output.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CHANGELOG.md manipulation
// ---------------------------------------------------------------------------

const CHANGELOG_PATH = resolve(root(), "CHANGELOG.md");

/**
 * Insert a new version section into CHANGELOG.md.
 *
 * The new section is placed after the Support StoryLine section (if present)
 * and before the oldest existing version section.
 */
function insertIntoChangelog(version, markdown) {
  const content = readFileSync(CHANGELOG_PATH, "utf8");

  // Check for duplicate version
  if (hasVersionSection(content, version)) {
    console.error(
      `Error: CHANGELOG.md already contains a section for ${version}. Remove it manually or use a different version.`
    );
    process.exit(1);
  }

  const newContent = insertVersionSection(content, version, markdown);
  writeFileSync(CHANGELOG_PATH, newContent, "utf8");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage:
  node scripts/changelog.cjs preview [--from <tag>]
    Preview the generated changelog section without modifying files.

  node scripts/changelog.cjs prepare <version> [--from <tag>]
    Generate and insert the changelog section for the given version.
    Refuses if a Git tag for <version> already exists.

  node scripts/changelog.cjs parse <commit-sha>
    Parse a single commit and print classified JSON.`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  if (command === "preview") {
    const fromIdx = args.indexOf("--from");
    const fromRef = fromIdx >= 0 ? args[fromIdx + 1] : null;

    const blocks = getCommits(fromRef);
    const entries = generateEntries(blocks);
    const markdown = generateMarkdown("unreleased", entries);
    console.log(markdown);
    return;
  }

  if (command === "prepare") {
    const version = args[1];
    if (!version) {
      console.error("Error: version is required (e.g., 1.11.1)");
      process.exit(1);
    }

    // Validate semver-like format
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      console.error(`Error: invalid version format: ${version}`);
      process.exit(1);
    }

    // Refuse if tag already exists
    if (tagExists(version)) {
      console.error(
        `Error: Git tag '${version}' already exists. Will not overwrite an existing release tag.`
      );
      process.exit(1);
    }

    const fromIdx = args.indexOf("--from");
    const fromRef = fromIdx >= 0 ? args[fromIdx + 1] : null;

    const blocks = getCommits(fromRef);
    if (blocks.length === 0) {
      console.error("Error: no commits found since baseline. Nothing to generate.");
      process.exit(1);
    }

    const entries = generateEntries(blocks);
    const markdown = generateMarkdown(version, entries);

    // Preview first
    console.log("--- Proposed changelog section ---");
    console.log(markdown);
    console.log("--- End preview ---\n");

    insertIntoChangelog(version, markdown);
    console.log(`Changelog section for ${version} inserted into CHANGELOG.md`);
    return;
  }

  if (command === "parse") {
    const sha = args[1];
    if (!sha) {
      console.error("Error: commit SHA is required");
      process.exit(1);
    }

    const raw = git("log", "-1", sha, `--format=%h|%s%n%b`);
    const classified = parseGitLogLine(raw);
    console.log(JSON.stringify(classified, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main();
