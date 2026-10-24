#!/usr/bin/env node

/**
 * Architecture regression gate for StoryLine.
 *
 * Compares the current ESLint architecture rule violations against a stored
 * baseline (scripts/baselines/architecture-baseline.json) and fails if:
 *
 * 1. A newly created file has any architecture violations.
 * 2. An existing file's violation count increases.
 * 3. The total violation count increases.
 *
 * Usage:
 *   node scripts/architecture-gate.mjs [--baseline <path>] [--update]
 *
 * --baseline <path>  Path to the baseline JSON file (default: scripts/baselines/architecture-baseline.json)
 * --update           Update the baseline file with current violations (use carefully)
 */

const { execSync, spawnSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve, dirname } = require("path");

const SCRIPT_DIR = dirname(__filename);
const ROOT = resolve(SCRIPT_DIR, "..");

// Architecture rules tracked by the baseline
const ARCH_RULES = new Set([
  "max-lines",
  "max-lines-per-function",
  "complexity",
  "max-depth",
  "max-statements",
  "max-params",
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const baseline = args.includes("--baseline")
    ? resolve(ROOT, args[args.indexOf("--baseline") + 1])
    : resolve(ROOT, "scripts", "baselines", "architecture-baseline.json");
  const update = args.includes("--update");
  return { baseline, update };
}

/**
 * Run ESLint and return the JSON report.
 * Uses pnpm lint which has the correct manifest path configured.
 * Writes to a temp file to avoid buffer overflow with large reports.
 */
function getLintReport() {
  // Structural budgets only depend on syntax, not TypeScript type information.
  // The ESLint config's architecture mode keeps the exact same six rules and
  // avoids loading an expensive full-project type graph for every commit.
  const cli = resolve(ROOT, "node_modules", "eslint", "bin", "eslint.js");
  const result = spawnSync(process.execPath, [
    "--max-old-space-size=1536", cli, "**/*.ts", "--format", "json",
  ], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, STORYLINE_ARCH_ONLY: "1" },
  });

  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("ESLint architecture worker failed: " +
      (result.stderr || result.error?.message || `exit ${result.status}`));
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("Architecture ESLint did not produce valid JSON: " +
      (result.stderr || result.stdout?.slice(0, 500)));
  }
  if (!Array.isArray(report) || report.some(file =>
    file.fatalErrorCount > 0 || file.messages?.some(message => message.fatal))) {
    throw new Error("Architecture ESLint encountered fatal parsing/config errors.");
  }
  return report;
}

/**
 * Extract architecture violations from the ESLint report.
 * Returns { files: { [relativePath]: { violations: [{rule, line}] } }, summary: {...} }
 */
function extractViolations(report) {
  const files = {};

  for (const result of report) {
    const fullPath = result.filePath || "";
    // Skip generated files
    if (fullPath.includes("/dist/") || fullPath.includes("/node_modules/")) {
      continue;
    }

    // Convert to relative path from repo root
    const relativePath = fullPath.replace(ROOT + "/", "").replace(ROOT, "");

    const violations = [];
    for (const msg of result.messages || []) {
      if (ARCH_RULES.has(msg.ruleId)) {
        violations.push({
          rule: msg.ruleId,
          line: msg.line || 0,
        });
      }
    }

    if (violations.length > 0) {
      files[relativePath] = { violations };
    }
  }

  // Build summary
  let totalViolations = 0;
  const byRule = {};
  for (const file of Object.values(files)) {
    totalViolations += file.violations.length;
    for (const v of file.violations) {
      byRule[v.rule] = (byRule[v.rule] || 0) + 1;
    }
  }

  return {
    files,
    summary: {
      totalFilesWithViolations: Object.keys(files).length,
      totalViolations,
      byRule,
    },
  };
}

/**
 * Load the baseline file.
 */
function loadBaseline(path) {
  if (!existsSync(path)) {
    return null;
  }
  const content = readFileSync(path, "utf8");
  return JSON.parse(content);
}

/**
 * Get list of tracked files from git.
 */
function getTrackedFiles() {
  try {
    const output = execSync("git ls-files", {
      cwd: ROOT,
      encoding: "utf8",
    });
    return new Set(output.split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * Compare current violations against the baseline.
 * Returns { ok: boolean, messages: string[], newBaseline?: object }
 */
function compare(current, baseline, trackedFiles) {
  const messages = [];
  let ok = true;

  const baselineFiles = baseline ? baseline.files : {};
  const currentFileSet = new Set(Object.keys(current.files));
  const baselineFileSet = new Set(Object.keys(baselineFiles));

  // Check for new files with violations
  const newFiles = [];
  for (const file of currentFileSet) {
    if (!baselineFileSet.has(file)) {
      // Is it a newly created file (not in git)?
      if (!trackedFiles.has(file)) {
        newFiles.push(file);
      }
      // If it's tracked but not in baseline, it's a newly violated file
      // This is OK for existing files that were previously clean
    }
  }

  if (newFiles.length > 0) {
    ok = false;
    messages.push(
      `❌ ${newFiles.length} newly created file(s) have architecture violations:`
    );
    for (const file of newFiles.slice(0, 10)) {
      const count = current.files[file].violations.length;
      messages.push(`   - ${file} (${count} violations)`);
    }
    if (newFiles.length > 10) {
      messages.push(`   ... and ${newFiles.length - 10} more`);
    }
  }

  // Check for increased violations in existing files
  const increasedFiles = [];
  for (const file of currentFileSet) {
    if (baselineFileSet.has(file)) {
      const currentCount = current.files[file].violations.length;
      const baselineCount = baselineFiles[file].violations.length;
      if (currentCount > baselineCount) {
        increasedFiles.push({ file, currentCount, baselineCount, delta: currentCount - baselineCount });
      }
    }
  }

  if (increasedFiles.length > 0) {
    ok = false;
    messages.push(
      `❌ ${increasedFiles.length} existing file(s) have increased violations:`
    );
    for (const { file, currentCount, baselineCount, delta } of increasedFiles.slice(0, 10)) {
      messages.push(
        `   - ${file}: ${baselineCount} → ${currentCount} (+${delta})`
      );
    }
    if (increasedFiles.length > 10) {
      messages.push(`   ... and ${increasedFiles.length - 10} more`);
    }
  }

  // Check for decreased violations (good!)
  const decreasedFiles = [];
  for (const file of currentFileSet) {
    if (baselineFileSet.has(file)) {
      const currentCount = current.files[file].violations.length;
      const baselineCount = baselineFiles[file].violations.length;
      if (currentCount < baselineCount) {
        decreasedFiles.push({ file, currentCount, baselineCount, delta: baselineCount - currentCount });
      }
    }
  }

  // Check for files removed from violations (refactored clean!)
  const cleanedFiles = [];
  for (const file of baselineFileSet) {
    if (!currentFileSet.has(file)) {
      const baselineCount = baselineFiles[file].violations.length;
      cleanedFiles.push({ file, baselineCount });
    }
  }

  // Total violation count check
  const currentTotal = current.summary.totalViolations;
  const baselineTotal = baseline ? baseline.summary.totalViolations : 0;
  const totalDelta = currentTotal - baselineTotal;

  if (totalDelta > 0 && !increasedFiles.length && !newFiles.length) {
    // This shouldn't happen normally, but catch it anyway
    ok = false;
    messages.push(
      `❌ Total violations increased: ${baselineTotal} → ${currentTotal} (+${totalDelta})`
    );
  }

  // Positive messages
  if (decreasedFiles.length > 0) {
    messages.push(
      `✅ ${decreasedFiles.length} file(s) have reduced violations`
    );
  }

  if (cleanedFiles.length > 0) {
    messages.push(
      `✅ ${cleanedFiles.length} file(s) are now violation-free`
    );
  }

  if (totalDelta < 0) {
    messages.push(
      `✅ Total violations decreased: ${baselineTotal} → ${currentTotal} (${totalDelta})`
    );
  } else if (totalDelta === 0 && baseline) {
    messages.push(`✅ Total violations unchanged: ${currentTotal}`);
  }

  // Summary
  messages.push("");
  messages.push(`Files with violations: ${current.summary.totalFilesWithViolations}`);
  messages.push(`Total violations: ${current.summary.totalViolations}`);
  if (baseline) {
    messages.push(`Baseline violations: ${baselineTotal}`);
    messages.push(`Delta: ${totalDelta > 0 ? "+" : ""}${totalDelta}`);
  }

  return { ok, messages, newBaseline: current };
}

function main() {
  const { baseline: baselinePath, update } = parseArgs();

  console.log("=== StoryLine Architecture Regression Gate ===\n");

  // Get current violations
  console.log("Running ESLint...");
  const report = getLintReport();
  const current = extractViolations(report);

  // Load baseline
  const baseline = loadBaseline(baselinePath);

  if (!baseline) {
    console.log(`No baseline found at ${baselinePath}.`);
    console.log("Creating initial baseline...\n");
    const baselineData = {
      version: "1.0",
      description: "Architecture debt baseline for StoryLine Step 6A",
      generatedAt: new Date().toISOString(),
      ...current,
    };
    writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2), "utf8");
    console.log(`Baseline written to ${baselinePath}`);
    console.log(`Total violations recorded: ${current.summary.totalViolations}`);
    return;
  }

  // Get tracked files
  const trackedFiles = getTrackedFiles();

  // Compare
  const result = compare(current, baseline, trackedFiles);

  for (const msg of result.messages) {
    console.log(msg);
  }

  if (update) {
    console.log(`\nUpdating baseline at ${baselinePath}...`);
    const baselineData = {
      version: "1.0",
      description: "Architecture debt baseline for StoryLine Step 6A",
      generatedAt: new Date().toISOString(),
      ...current,
    };
    writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2), "utf8");
    console.log("Baseline updated.");
  }

  // Exit code
  if (!result.ok) {
    console.log("\n❌ Architecture regression gate FAILED.");
    console.log("New or increased violations detected. Fix them or update the baseline with --update.");
    process.exit(1);
  } else {
    console.log("\n✅ Architecture regression gate PASSED.");
    process.exit(0);
  }
}

main();
