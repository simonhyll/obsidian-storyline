#!/usr/bin/env node
/**
 * Incremental ESLint gate (no new errors on changed TypeScript lines).
 *
 * ESLint's type-aware rules need the real TypeScript project to resolve types.
 * Do NOT lint historical file contents via ESLint.lintText(): an old source
 * revision combined with the current TS project produces false diagnostics.
 * Instead lint current files normally and intersect errors with Git diff hunks.
 *
 * Full historical lint cleanup is tracked separately in modernization Step 1B.
 *
 * Usage: pnpm lint:changed [--base <git-ref>]
 * CI: LINT_BASE is the push's before SHA or PR base SHA.
 */
import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { resolve } from 'node:path';

const QUALITY_BASELINE = 'd42b83c4d6952f9150fbbd1b81fde87a243a5ac7';
const args = process.argv.slice(2);
const staged = args.includes('--staged');
const baseIndex = args.indexOf('--base');
if (baseIndex >= 0 && !args[baseIndex + 1]) {
    throw new Error('Missing Git revision after --base');
}
const requestedBase = baseIndex >= 0 ? args[baseIndex + 1] : process.env.LINT_BASE || 'HEAD~1';

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
function validCommit(ref) {
    try { git('rev-parse', '--verify', `${ref}^{commit}`); return true; }
    catch { return false; }
}
function isAncestor(a, b) {
    try { git('merge-base', '--is-ancestor', a, b); return true; }
    catch { return false; }
}

let base = requestedBase;
if (!staged && (!validCommit(base) || /^0+$/.test(base))) {
    console.warn(`[lint:changed] Unknown base "${base}"; falling back to HEAD~1.`);
    base = 'HEAD~1';
}
if (!staged && !validCommit(base)) throw new Error('No valid Git baseline for lint comparison.');

if (!staged) base = git('merge-base', base, 'HEAD');
// Enabling the gate must not reclassify older errors as newly introduced if
// GitHub batches multiple feature-branch pushes into one comparison.
if (!staged && validCommit(QUALITY_BASELINE) &&
    isAncestor(base, QUALITY_BASELINE) && isAncestor(QUALITY_BASELINE, 'HEAD')) {
    base = QUALITY_BASELINE;
}

// Use -z so path names with spaces and renames work; Git also reports old/new
// paths for R/C entries, but lint only uses the CURRENT filename.
const tokens = execFileSync('git', [
    'diff', ...(staged ? ['--cached'] : []), '--name-status',
    '-z', '-M', '--diff-filter=ACMR',
    ...(staged ? ['HEAD'] : [base, 'HEAD']),
    '--', '*.ts', '*.js', '*.mjs', '*.cjs',
], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean);
const changes = [];
for (let i = 0; i < tokens.length;) {
    const status = tokens[i++];
    const oldPath = status.startsWith('R') || status.startsWith('C') ? tokens[i++] : null;
    const filename = tokens[i++];
    if (!filename) throw new Error('Invalid git diff --name-status output');
    changes.push({ filename, oldPath: oldPath ?? filename });
}
if (changes.length === 0) {
    console.log('[lint:changed] No changed source files.');
    process.exit(0);
}

// ESLint reads the working tree, not Git's index. Do not allow a partially
// staged source file to be validated against different working-tree bytes.
if (staged) {
    for (const { filename } of changes) {
        try {
            execFileSync('git', ['diff', '--quiet', '--', filename], { stdio: 'ignore' });
        } catch {
            console.error(`[lint:changed] ${filename} has unstaged edits; stage or discard them before committing.`);
            process.exit(1);
        }
    }
}

function changedLineNumbers(filename, oldPath) {
    const diff = git('diff', ...(staged ? ['--cached'] : []),
        '--no-ext-diff', '--no-color', '--unified=0', '-M',
        ...(staged ? ['HEAD'] : [base, 'HEAD']), '--', oldPath, filename);
    const lines = new Set();
    const re = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    for (const m of diff.matchAll(re)) {
        const first = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        for (let n = first; n < first + count; n++) lines.add(n);
    }
    return lines;
}

const changedLines = new Map(changes.map(({ filename, oldPath }) =>
    [resolve(filename), changedLineNumbers(filename, oldPath)]));
// Whole-file/function architecture budgets have their own baseline-aware gate.
// Only check other ESLint rules against changed lines, so a newly enabled
// structural rule cannot retroactively reject old files in a long-lived PR.
const ARCH_RULES = new Set(['max-lines', 'max-lines-per-function', 'complexity',
    'max-depth', 'max-statements', 'max-params']);
const eslint = new ESLint();
// lintFiles(), unlike lintText() on old revisions, retains valid TS project
// context and matches diagnostics from `pnpm lint`.
const existingFiles = changes
  .filter(({ filename }) => {
    try { require('node:fs').accessSync(filename); return true; }
    catch { return false; }
  })
  .map(({ filename }) => filename);
const results = await eslint.lintFiles(existingFiles);
let totalCurrent = 0;
let newErrors = 0;
for (const result of results) {
    const modified = changedLines.get(resolve(result.filePath));
    totalCurrent += result.errorCount;
    if (!modified) continue;
    for (const finding of result.messages) {
        if (finding.severity !== 2 || !modified.has(finding.line) || ARCH_RULES.has(finding.ruleId)) continue;
        newErrors++;
        console.error(`${result.filePath}:${finding.line}:${finding.column}: ${finding.ruleId ?? 'ESLint'}: ${finding.message}`);
    }
}
console.log(`[lint:changed] ${changes.length} changed source files (${staged ? 'staged' : 'committed'}); ${totalCurrent} existing/current errors in affected files; ${newErrors} errors on changed lines.`);
if (newErrors > 0) process.exitCode = 1;
