#!/usr/bin/env node
// Post-install fix: patch eslint-plugin-obsidianmd to read manifest from assets/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('node_modules/eslint-plugin-obsidianmd/dist/lib/manifest.js');
if (!existsSync(manifestPath)) {
  console.log('[postinstall] eslint-plugin-obsidianmd not found, skipping patch');
  process.exit(0);
}

let content = readFileSync(manifestPath, 'utf8');
if (content.includes('assets/manifest.json')) {
  console.log('[postinstall] manifest.js already patched');
  process.exit(0);
}

content = content.replace(
  'fs.readFileSync("manifest.json", "utf8")',
  'fs.readFileSync("assets/manifest.json", "utf8")'
);

writeFileSync(manifestPath, content);
console.log('[postinstall] patched eslint-plugin-obsidianmd manifest path');
