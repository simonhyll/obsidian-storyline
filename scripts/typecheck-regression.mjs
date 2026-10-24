#!/usr/bin/env node
// TypeScript regression gate: compares current diagnostics against an accepted
// baseline. Existing historical errors are visible but do not block commits.
// Any newly introduced diagnostic fails the gate immediately.
//
// Baseline format (scripts/ts-baseline.json):
//   {
//     "version": 1,
//     "totalErrors": 951,
//     "diagnostics": [
//       { "file": "src/foo.ts", "code": "TS18048", "message": "...", "count": 5 }
//     ]
//   }
//
// Fingerprint = file + error_code + normalized_message (line numbers excluded).
// This survives line insertions/deletions while still detecting new error types.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const baselinePath = join(__dirname, 'ts-baseline.json');

/**
 * Run the TypeScript compiler and return raw stderr/stdout output.
 */
function runTypeScript() {
    let output;
    try {
        output = execSync(
            'npx tsc --noEmit --pretty false 2>&1',
            { cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
    } catch (err) {
        // tsc exits nonzero on errors — that's expected.
        output = err.stdout || err.stderr || '';
    }
    return output;
}

/**
 * Parse TypeScript compiler output into structured diagnostics.
 * Each primary error line matches: file(line,col): error TScode: message
 * Continuation lines (indented) are attached to the previous error.
 */
function parseDiagnostics(rawOutput) {
    const lines = rawOutput.split('\n');
    const diagnostics = [];
    const errorLineRegex = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;

    for (const line of lines) {
        if (!line.trim()) continue;

        // Continuation line (starts with whitespace) — skip for fingerprinting.
        if (/^\s+/.test(line)) continue;

        const match = line.match(errorLineRegex);
        if (match) {
            const [, file, , , code, message] = match;
            diagnostics.push({ file, code, message: message.trim() });
        }
    }

    return diagnostics;
}

/**
 * Build a fingerprint map from diagnostics.
 * Uses a delimiter that cannot appear in file paths or error messages.
 * Key = "file\x00code\x00message", value = count of occurrences.
 */
const FP_DELIM = '\x00';

function buildFingerprintMap(diagnostics) {
    const map = new Map();
    for (const diag of diagnostics) {
        const key = `${diag.file}${FP_DELIM}${diag.code}${FP_DELIM}${diag.message}`;
        map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
}

/**
 * Load the accepted baseline from disk.
 */
function loadBaseline() {
    if (!existsSync(baselinePath)) {
        console.error(`ERROR: TypeScript baseline not found at ${baselinePath}`);
        console.error('Run with --generate to create one.');
        process.exit(2);
    }
    const raw = readFileSync(baselinePath, 'utf-8');
    const baseline = JSON.parse(raw);
    if (!baseline.diagnostics || !Array.isArray(baseline.diagnostics)) {
        console.error('ERROR: Invalid baseline format — missing diagnostics array.');
        process.exit(2);
    }
    return baseline;
}

/**
 * Build a fingerprint map from the baseline JSON.
 */
function buildBaselineMap(baseline) {
    const map = new Map();
    for (const entry of baseline.diagnostics) {
        const key = `${entry.file}${FP_DELIM}${entry.code}${FP_DELIM}${entry.message}`;
        map.set(key, entry.count);
    }
    return map;
}

/**
 * Compare current fingerprints against baseline.
 * Returns { newErrors, removedErrors, countIncreases, countDecreases, totalCurrent, totalBaseline }.
 */
function compare(currentMap, baselineMap) {
    const newErrors = [];
    const removedErrors = [];
    const countIncreases = [];
    const countDecreases = [];

    // Check for new errors or increased counts.
    for (const [key, count] of currentMap) {
        const baselineCount = baselineMap.get(key);
        if (baselineCount === undefined) {
            newErrors.push({ key, count });
        } else if (count > baselineCount) {
            countIncreases.push({ key, expected: baselineCount, actual: count, delta: count - baselineCount });
        } else if (count < baselineCount) {
            countDecreases.push({ key, expected: baselineCount, actual: count, delta: baselineCount - count });
        }
    }

    // Check for removed errors (good — diagnostic was fixed).
    for (const [key, count] of baselineMap) {
        if (!currentMap.has(key)) {
            removedErrors.push({ key, count });
        }
    }

    return {
        newErrors,
        removedErrors,
        countIncreases,
        countDecreases,
        totalCurrent: currentMap.size,
        totalBaseline: baselineMap.size,
    };
}

/**
 * Generate a fresh baseline from current diagnostics.
 */
function generateBaseline(diagnostics) {
    const fpMap = buildFingerprintMap(diagnostics);
    const entries = [];
    let total = 0;
    for (const [key, count] of fpMap) {
        const [file, code, message] = key.split(FP_DELIM, 3);
        entries.push({ file, code, message, count });
        total += count;
    }
    // Sort for deterministic output.
    entries.sort((a, b) => {
        const fileCmp = a.file.localeCompare(b.file);
        if (fileCmp !== 0) return fileCmp;
        const codeCmp = a.code.localeCompare(b.code);
        if (codeCmp !== 0) return codeCmp;
        return a.message.localeCompare(b.message);
    });

    const baseline = {
        version: 1,
        generatedAt: new Date().toISOString(),
        totalErrors: total,
        diagnostics: entries,
    };

    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
    console.log(`Generated baseline: ${total} errors across ${entries.length} unique fingerprints.`);
    return baseline;
}

/**
 * Pretty-print a fingerprint key back into readable form.
 */
function decodeKey(key) {
    const [file, code, message] = key.split(FP_DELIM, 3);
    return { file, code, message };
}

function main() {
    const args = process.argv.slice(2);
    const isGenerate = args.includes('--generate');

    console.log('Running TypeScript compiler (strict mode)...');
    const raw = runTypeScript();

    if (!raw.trim()) {
        console.log('SUCCESS: Zero TypeScript diagnostics. The codebase is fully type-safe.');
        if (existsSync(baselinePath)) {
            console.log('Note: Baseline file exists but is no longer needed. Consider removing it.');
        }
        process.exit(0);
    }

    const diagnostics = parseDiagnostics(raw);
    const totalErrors = diagnostics.length;

    if (isGenerate) {
        generateBaseline(diagnostics);
        process.exit(0);
    }

    const baseline = loadBaseline();
    const currentMap = buildFingerprintMap(diagnostics);
    const baselineMap = buildBaselineMap(baseline);
    const { newErrors, removedErrors, countIncreases, countDecreases } = compare(currentMap, baselineMap);

    console.log(`\nTypeScript Regression Gate`);
    console.log(`========================`);
    console.log(`Baseline errors:  ${baseline.totalErrors} (${baselineMap.size} unique fingerprints)`);
    console.log(`Current errors:   ${totalErrors} (${currentMap.size} unique fingerprints)`);

    let exitCode = 0;

    // Report removed errors (diagnostics fixed — good news).
    if (removedErrors.length > 0) {
        console.log(`\n✅ ${removedErrors.length} diagnostic(s) fixed since baseline:`);
        for (const { key, count } of removedErrors.slice(0, 10)) {
            const { file, code, message } = decodeKey(key);
            console.log(`  - ${file}: ${code} (${message.slice(0, 80)}) [was ${count}x]`);
        }
        if (removedErrors.length > 10) {
            console.log(`  ... and ${removedErrors.length - 10} more`);
        }
        console.log(`  → Consider regenerating the baseline to tighten the gate.`);
    }

    // Report count decreases (partial fixes).
    if (countDecreases.length > 0) {
        console.log(`\n📉 ${countDecreases.length} diagnostic(s) reduced in count:`);
        for (const { key, expected, actual, delta } of countDecreases.slice(0, 10)) {
            const { file, code } = decodeKey(key);
            console.log(`  - ${file}: ${code} (${expected} → ${actual}, -${delta})`);
        }
    }

    // Report new errors — these are regressions.
    if (newErrors.length > 0) {
        exitCode = 1;
        console.log(`\n❌ REGRESSION: ${newErrors.length} new diagnostic(s) introduced:`);
        for (const { key, count } of newErrors.slice(0, 20)) {
            const { file, code, message } = decodeKey(key);
            console.log(`  ✗ ${file}: ${code}`);
            console.log(`    ${message.slice(0, 100)}${count > 1 ? ` [${count}x]` : ''}`);
        }
        if (newErrors.length > 20) {
            console.log(`  ... and ${newErrors.length - 20} more`);
        }
    }

    // Report count increases — unexpected growth in existing error types.
    if (countIncreases.length > 0) {
        exitCode = 1;
        console.log(`\n❌ REGRESSION: ${countIncreases.length} existing diagnostic(s) increased:`);
        for (const { key, expected, actual, delta } of countIncreases.slice(0, 20)) {
            const { file, code, message } = decodeKey(key);
            console.log(`  ✗ ${file}: ${code} (${expected} → ${actual}, +${delta})`);
            console.log(`    ${message.slice(0, 100)}`);
        }
        if (countIncreases.length > 20) {
            console.log(`  ... and ${countIncreases.length - 20} more`);
        }
    }

    console.log(`\nSummary:`);
    console.log(`  Historical diagnostics: ${baseline.totalErrors}`);
    console.log(`  Current diagnostics:    ${totalErrors}`);
    if (removedErrors.length > 0) {
        console.log(`  Fixed since baseline:   ${removedErrors.length} fingerprints`);
    }
    if (newErrors.length > 0) {
        console.log(`  New regressions:        ${newErrors.length} fingerprints`);
    }
    if (countIncreases.length > 0) {
        console.log(`  Count increases:        ${countIncreases.length} fingerprints`);
    }

    if (exitCode === 0) {
        console.log(`\n✅ No new TypeScript regressions detected.`);
        console.log(`   (Existing ${baseline.totalErrors} historical diagnostics remain visible.)`);
    } else {
        console.log(`\n❌ TypeScript regression gate FAILED.`);
        console.log(`   Fix the new errors or run with --generate to update the baseline (requires review).`);
    }

    process.exit(exitCode);
}

main();
