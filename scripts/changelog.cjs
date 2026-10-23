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
const { resolve, dirname } = require("path");

// ---------------------------------------------------------------------------
// Conventional Commits parsing (pure regex, no external dependency)
// ---------------------------------------------------------------------------

const TYPES = {
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

/**
 * Conventional Commits header regex.
 * Groups: 1=type, 2=scope, 3=breaking bang, 4=subject
 */
const HEADER_RE =
  /^(feat|fix|perf|refactor|docs|style|test|build|ci|chore)(\(([\w$/.-]*)\))?(!)?\s?:\s*(.*)$/;

/**
 * Parse a raw Git log line (format: %h|%s%n%b) into a classified commit.
 * Returns { section, type, scope, subject, hash, breaking } or null.
 */
function parseLine(line) {
  // Format: <hash>|<subject>\n<body>
  const firstNewline = line.indexOf("\n");
  const header = firstNewline >= 0 ? line.slice(0, firstNewline) : line;
  const body = firstNewline >= 0 ? line.slice(firstNewline + 1) : "";

  const pipeIdx = header.indexOf("|");
  if (pipeIdx < 0) return null;

  const hash = header.slice(0, pipeIdx);
  const subjectLine = header.slice(pipeIdx + 1);

  const match = subjectLine.match(HEADER_RE);
  if (!match) return null;

  const [, type, , scope, breakingBang, subject] = match;

  // Check body for BREAKING CHANGE: note
  const hasBreakingNote = /^\s*BREAKING CHANGE\s*:/im.test(body);
  const breaking = breakingBang === "!" || hasBreakingNote;

  const section = TYPES[type] ?? "other";

  return {
    section,
    type,
    scope: scope ?? null,
    subject: subject ?? "",
    hash,
    breaking,
  };
}

// ---------------------------------------------------------------------------
// Git helpers (spawnSync — no shell required)
// ---------------------------------------------------------------------------

function root() {
  return resolve(__dirname, "..");
}

/**
 * Run a git command and return stdout as a trimmed string.
 */
function git(...args) {
  const result = spawnSync("/usr/bin/git", args, {
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
// Changelog generation
// ---------------------------------------------------------------------------

/**
 * Omitted sections — internal maintenance noise that is not useful in
 * release notes.
 */
const OMITTED_SECTIONS = new Set(["style", "build", "ci", "chore", "test"]);

/**
 * Generate changelog entries from a list of raw commit blocks.
 * Returns { features, bugFixes, performance, refactor, docs, breakingChanges, other, nonconforming }
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
    const classified = parseLine(block);

    if (!classified) {
      // Non-conforming commit — extract hash and subject for reference
      const firstNewline = block.indexOf("\n");
      const header = firstNewline >= 0 ? block.slice(0, firstNewline) : block;
      const pipeIdx = header.indexOf("|");
      if (pipeIdx >= 0) {
        const hash = header.slice(0, pipeIdx);
        const subject = header.slice(pipeIdx + 1);
        entries.nonconforming.push({ hash, subject });
      }
      continue;
    }

    const item = {
      scope: classified.scope,
      subject: classified.subject,
      hash: classified.hash,
    };

    if (classified.breaking) {
      entries.breakingChanges.push(item);
    }

    switch (classified.section) {
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
        if (!OMITTED_SECTIONS.has(classified.section)) {
          entries.other.push(item);
        }
        break;
    }
  }

  return entries;
}

/**
 * Format a single entry as a Markdown bullet.
 */
function formatEntry(item) {
  const scope = item.scope ? `**${item.scope}** ` : "";
  return `- ${scope}${item.subject} (\`${item.hash}\`)`;
}

/**
 * Generate the full Markdown changelog section for a version.
 */
function generateMarkdown(version, entries) {
  const lines = [`## Version ${version}`, ""];

  if (entries.breakingChanges.length > 0) {
    lines.push("### ⚠️ Breaking Changes");
    lines.push("");
    for (const item of entries.breakingChanges) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.features.length > 0) {
    lines.push("### Features");
    lines.push("");
    for (const item of entries.features) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.bugFixes.length > 0) {
    lines.push("### Bug Fixes");
    lines.push("");
    for (const item of entries.bugFixes) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.performance.length > 0) {
    lines.push("### Performance");
    lines.push("");
    for (const item of entries.performance) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.refactor.length > 0) {
    lines.push("### Refactoring");
    lines.push("");
    for (const item of entries.refactor) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.docs.length > 0) {
    lines.push("### Documentation");
    lines.push("");
    for (const item of entries.docs) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.other.length > 0) {
    lines.push("### Other Changes");
    lines.push("");
    for (const item of entries.other) {
      lines.push(formatEntry(item));
    }
    lines.push("");
  }

  if (entries.nonconforming.length > 0) {
    lines.push("### Non-conforming Commits");
    lines.push("");
    for (const item of entries.nonconforming) {
      lines.push(`- ${item.subject} (\`${item.hash}\`)`);
    }
    lines.push("");
  }

  return lines.join("\n");
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
  const versionHeader = `## Version ${version}`;
  if (content.includes(versionHeader)) {
    console.error(
      `Error: CHANGELOG.md already contains a section for ${version}. Remove it manually or use a different version.`
    );
    process.exit(1);
  }

  // Find the position after the Support section
  // The support section ends with the PayPal link line
  const supportEnd = content.indexOf("[![Donate");
  if (supportEnd >= 0) {
    // Find the end of the PayPal link line
    const lineEnd = content.indexOf("\n", supportEnd);
    if (lineEnd >= 0) {
      const before = content.slice(0, lineEnd);
      const after = content.slice(lineEnd);
      const newContent = `${before}\n\n${markdown}${after}`;
      writeFileSync(CHANGELOG_PATH, newContent, "utf8");
      return;
    }
  }

  // Fallback: insert after the first line (title)
  const firstNewline = content.indexOf("\n");
  if (firstNewline >= 0) {
    const before = content.slice(0, firstNewline);
    const after = content.slice(firstNewline);
    const newContent = `${before}\n\n${markdown}${after}`;
    writeFileSync(CHANGELOG_PATH, newContent, "utf8");
    return;
  }

  // Last resort: prepend
  const newContent = `${markdown}\n${content}`;
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
    const classified = parseLine(raw);
    console.log(JSON.stringify(classified, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main();
