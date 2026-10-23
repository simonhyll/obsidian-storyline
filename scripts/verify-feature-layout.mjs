#!/usr/bin/env node

/**
 * Verify that the features/ directory contains only .feature files.
 *
 * This is a permanent architectural invariant: features/ holds human-readable
 * Gherkin specifications only. All executable test infrastructure belongs
 * under tests/cucumber/.
 *
 * Usage:
 *   node scripts/verify-feature-layout.mjs
 *
 * Exits 0 if the layout is correct, 1 otherwise.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const featuresDir = join(root, 'features');

function walk(dir, base) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full, base));
    } else if (stat.isFile()) {
      results.push(relative(base, full));
    }
  }
  return results;
}

const files = walk(featuresDir, featuresDir);
const violations = files.filter((f) => !f.endsWith('.feature'));

if (violations.length > 0) {
  console.error('❌ features/ directory contains non-.feature files:');
  for (const v of violations) {
    console.error(`   - ${v}`);
  }
  console.error('');
  console.error('The features/ directory must contain ONLY .feature specification files.');
  console.error('Executable test infrastructure belongs under tests/cucumber/.');
  process.exit(1);
}

console.log(`✅ features/ layout verified: ${files.length} .feature file(s), 0 violations.`);
process.exit(0);
