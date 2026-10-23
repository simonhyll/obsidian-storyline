#!/usr/bin/env node
/**
 * Incremental ESLint gate.
 *
 * Compare diagnostics from HEAD with the same file at the Git base commit,
 * using the CURRENT lint configuration for both revisions.
 * Existing historical lint findings do not make every touched file fail.
 *
 * Usage:
 *   pnpm lint:changed                    # HEAD~1 fallback
 *   pnpm lint:changed --base <sha-or-ref>
 *
 * For CI: set LINT_BASE to the PR base SHA or push's event.before.
 * This checks commits, not uncommitted working tree changes.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';

const args = process.argv.slice(2);
const baseArg = args.indexOf('--base');
if (baseArg !== -1 && !args[baseArg + 1]) {
    throw new Error('Expected a Git revision after --base');
}
const requested = baseArg === -1 ? process.env.LINT_BASE || 'HEAD~1' : args[baseArg + 1];

function git(...cmd) {
    return execFileSync('git', cmd, { encoding: 'utf8' }).trim();
}

function isCommit(ref) {
    try {
        git('rev-parse', '--verify', `${ref}^{commit}`);
        return true;
    } catch {
        return false;
    }
}

let base = requested;
if (!isCommit(base) || /^0+$/.test(base)) {
    console.warn(`[lint:changed] Cannot find base "${base}"; falling back to HEAD~1.`);
    base = 'HEAD~1';
}
if (!isCommit(base)) {
    throw new Error('No valid base commit for incremental ESLint comparison.');
}
const commonAncestor = git('merge-base', base, 'HEAD');
const paths = execFileSync(
    'git', ['diff', '--name-only', '-z', '--diff-filter=ACMR', commonAncestor, 'HEAD', '--', '*.ts'],
    { encoding: 'buffer' },
).toString('utf8').split('\0').filter(Boolean);

if (paths.length === 0) {
    console.log('[lint:changed] No changed TypeScript files.');
    process.exit(0);
}

const eslint = new ESLint();
let oldErrors = 0;
let currentErrors = 0;
let newErrors = 0;

function fingerprint(message, lines) {
    const sourceLine = lines[message.line - 1]?.trim() ?? '';
    return JSON.stringify([message.ruleId, message.severity, message.message, sourceLine]);
}

async function diagnostics(content, filename) {
    const result = await eslint.lintText(content, { filePath: filename });
    return result[0]?.messages.filter(m => m.severity === 2) ?? [];
}

for (const filename of paths) {
    const currentContent = readFileSync(filename, 'utf8');
    let previousContent = '';
    try {
        previousContent = execFileSync('git', ['show', `${commonAncestor}:${filename}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        // New file (or rename): all lint issues count as new.
    }
    const previous = previousContent ? await diagnostics(previousContent, filename) : [];
    const current = await diagnostics(currentContent, filename);

    oldErrors += previous.length;
    currentErrors += current.length;

    const previousCounts = new Map();
    for (const msg of previous) {
        const key = fingerprint(msg, previousContent.split(/\r?\n/));
        previousCounts.set(key, (previousCounts.get(key) ?? 0) + 1);
    }

    const currentLines = currentContent.split(/\r?\n/);
    for (const msg of current) {
        const key = fingerprint(msg, currentLines);
        const remaining = previousCounts.get(key) ?? 0;
        if (remaining > 0) {
            previousCounts.set(key, remaining - 1);
        } else {
            newErrors++;
            console.error(`${filename}:${msg.line}:${msg.column}: ${msg.ruleId ?? 'ESLint'}: ${msg.message}`);
        }
    }
}

console.log(`[lint:changed] ${paths.length} changed TS files; ${oldErrors} historical errors, ${currentErrors} current errors, ${newErrors} new errors.`);
if (newErrors > 0) process.exitCode = 1;
