#!/usr/bin/env node
// CSS regression check: compare compiled SCSS output against the baseline legacy.css.
// Uses css-tree to parse both files and compare selectors and declarations.
// Ignores harmless differences like whitespace, property order within a rule, and @charset.

import { parse, walk, generate } from 'css-tree';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const baseline = readFileSync(resolve(root, 'tests/css-baseline.css'), 'utf8');
const compiled = readFileSync(resolve(root, 'dist/styles.css'), 'utf8');

// Parse both CSS files
let baselineTree, compiledTree;
try {
  baselineTree = parse(baseline, { positions: true });
} catch (e) {
  console.error('Failed to parse baseline CSS:', e.message);
  process.exit(1);
}
try {
  compiledTree = parse(compiled, { positions: true });
} catch (e) {
  console.error('Failed to parse compiled CSS:', e.message);
  process.exit(1);
}

// Normalize selectors for comparison: Sass may strip quotes from attribute values
// e.g., [data-type^="story-line-"] -> [data-type^=story-line-]
function normalizeSelector(sel) {
  return sel
    .replace(/\[([^\]]*)\]/g, (match, inner) => {
      // Normalize quotes in attribute selectors
      return '[' + inner.replace(/(["'])((?:(?!\1)[^[]|\\.)*)\1/g, '$2') + ']';
    })
    .trim();
}

// Use css-tree walk API for reliable traversal
function collectInfo(tree) {
  const selectors = new Set();
  const atRules = new Set();
  let declCount = 0;
  
  walk(tree, function(node) {
    if (node.type === 'Rule') {
      const selector = normalizeSelector(generate(node.prelude));
      if (selector) selectors.add(selector);
    }
    if (node.type === 'Atrule') {
      const prelude = node.prelude ? normalizeSelector(generate(node.prelude)) : '';
      atRules.add(`@${node.name}${prelude}`);
    }
    if (node.type === 'Declaration') {
      declCount++;
    }
    return this;
  });
  
  return { selectors, atRules, declCount };
}

const baselineInfo = collectInfo(baselineTree);
const compiledInfo = collectInfo(compiledTree);

const { selectors: baselineSelectors, atRules: baselineAtRules, declCount: baselineDeclCount } = baselineInfo;
const { selectors: compiledSelectors, atRules: compiledAtRules, declCount: compiledDeclCount } = compiledInfo;

let errors = 0;

// Check for missing selectors
const missingSelectors = [...baselineSelectors].filter(s => !compiledSelectors.has(s));
if (missingSelectors.length > 0) {
  console.error(`\n❌ ${missingSelectors.length} selectors missing from compiled output:`);
  for (const s of missingSelectors.slice(0, 20)) {
    console.error(`  - ${s}`);
  }
  if (missingSelectors.length > 20) {
    console.error(`  ... and ${missingSelectors.length - 20} more`);
  }
  errors++;
}

// Check for extra selectors (may be expected if Sass generates new ones)
const extraSelectors = [...compiledSelectors].filter(s => !baselineSelectors.has(s));
if (extraSelectors.length > 0) {
  console.log(`\n⚠️  ${extraSelectors.length} extra selectors in compiled output (may be expected)`);
}

// Check for missing at-rules
const missingAtRules = [...baselineAtRules].filter(a => !compiledAtRules.has(a));
if (missingAtRules.length > 0) {
  console.error(`\n❌ ${missingAtRules.length} at-rules missing from compiled output:`);
  for (const a of missingAtRules.slice(0, 20)) {
    console.error(`  - ${a}`);
  }
  if (missingAtRules.length > 20) {
    console.error(`  ... and ${missingAtRules.length - 20} more`);
  }
  errors++;
}

// Check declaration count (should be roughly the same)
const declDiff = Math.abs(baselineDeclCount - compiledDeclCount);
const declPercent = baselineDeclCount > 0 ? ((declDiff / baselineDeclCount) * 100).toFixed(1) : '0.0';
if (parseFloat(declPercent) > 5) {
  console.error(`\n❌ Declaration count differs by ${declPercent}% (${baselineDeclCount} vs ${compiledDeclCount})`);
  errors++;
} else {
  console.log(`\n✓ Declaration count: ${baselineDeclCount} baseline vs ${compiledDeclCount} compiled (${declPercent}% diff)`);
}

// Check for key CSS custom properties
const keyProperties = [
  '--sl-status-idea',
  '--sl-emotion-tense',
  '--sl-act-1',
  '--sl-palette-1',
  '--sl-grid-border',
  '--sl-shadow-sm',
];

const compiledText = compiled.toLowerCase();
const missingProps = keyProperties.filter(p => !compiledText.includes(p.toLowerCase()));
if (missingProps.length > 0) {
  console.error(`\n❌ Key CSS custom properties missing:`);
  for (const p of missingProps) {
    console.error(`  - ${p}`);
  }
  errors++;
} else {
  console.log(`✓ All key CSS custom properties present`);
}

// Check for key selectors
const keySelectors = [
  '.sl-timeline',
  '.sl-board',
  '.sl-inspector',
  '.sl-character',
  '.sl-location',
  '.sl-statistics',
  '.sl-plotgrid',
  '.sl-manuscript',
  '.sl-codex',
  '.sl-filters',
];

const baselineText = baseline.toLowerCase();
const missingKeySelectors = keySelectors.filter(s => {
  // Check if selector exists in baseline
  if (!baselineText.includes(s.toLowerCase())) {
    return false; // Not in baseline, skip
  }
  // Check if it's in compiled output
  return !compiledText.includes(s.toLowerCase());
});

if (missingKeySelectors.length > 0) {
  console.error(`\n❌ Key selectors missing from compiled output:`);
  for (const s of missingKeySelectors) {
    console.error(`  - ${s}`);
  }
  errors++;
} else {
  console.log(`✓ All key selectors present`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Selectors: ${baselineSelectors.size} baseline, ${compiledSelectors.size} compiled`);
console.log(`At-rules: ${baselineAtRules.size} baseline, ${compiledAtRules.size} compiled`);
console.log(`Declarations: ${baselineDeclCount} baseline, ${compiledDeclCount} compiled`);

if (errors === 0) {
  console.log('\n✅ CSS regression check passed!');
  process.exit(0);
} else {
  console.error(`\n❌ CSS regression check failed with ${errors} error(s)`);
  process.exit(1);
}
