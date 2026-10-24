/**
 * Changelog tag protection integration test.
 *
 * Creates a temporary Git repository, adds a tag, and runs the production
 * changelog CLI to verify that it refuses to prepare a version that already
 * has a tag. Cleans up the temporary repository afterward.
 *
 * This file runs at test bootstrap via BeforeAll hook and does not
 * contribute to Cucumber scenario counts.
 */

import { spawnSync, execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition: boolean, msg: string) {
	if (!condition) {
		throw new Error(`Changelog tag test failed: ${msg}`);
	}
}

/** Set up a temporary Git repo with a tagged commit and changelog. */
function setupTempRepo(): string {
	const tempDir = join(tmpdir(), `changelog-tag-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
	execSync('git init', { cwd: tempDir, stdio: 'pipe' });
	execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
	execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
	const changelogContent = '# StoryLine Changelog\n\n## Version 0.1.0\n\n- initial\n';
	writeFileSync(join(tempDir, 'CHANGELOG.md'), changelogContent, 'utf8');
	copyScriptsToTemp(tempDir);
	execSync('git add -A', { cwd: tempDir, stdio: 'pipe' });
	execSync('git commit -m "initial commit"', { cwd: tempDir, stdio: 'pipe' });
	execSync('git tag 1.0.0', { cwd: tempDir, stdio: 'pipe' });
	return tempDir;
}

/** Copy changelog CLI scripts into the temp repo. */
function copyScriptsToTemp(tempDir: string): void {
	const scriptsDir = join(tempDir, 'scripts');
	mkdirSync(scriptsDir, { recursive: true });
	const origScriptsDir = resolve(__dirname, '../../../scripts');
	copyFileSync(join(origScriptsDir, 'changelog.cjs'), join(scriptsDir, 'changelog.cjs'));
	copyFileSync(join(origScriptsDir, 'changelog-lib.cjs'), join(scriptsDir, 'changelog-lib.cjs'));
}

/** Verify the CLI rejected the existing tag and preserved all data. */
function verifyTagProtection(tempDir: string): void {
	const originalChangelog = readFileSync(join(tempDir, 'CHANGELOG.md'), 'utf8');
	const tagShaBefore = execSync('git rev-list -n 1 1.0.0', { cwd: tempDir, encoding: 'utf8' }).trim();
	const result = spawnSync('node', ['scripts/changelog.cjs', 'prepare', '1.0.0'], {
		cwd: tempDir, encoding: 'utf8', timeout: 10000,
	});
	assert(result.status !== 0, `Expected nonzero exit status, got ${result.status}`);
	const output = (result.stderr || result.stdout || '').toLowerCase();
	assert(output.includes('already exists') || output.includes('tag'),
		`Expected tag-existence error, got: ${result.stderr || result.stdout}`);
	assertTagUnchanged(tempDir, tagShaBefore);
	assertChangelogUnchanged(tempDir, originalChangelog);
	assertNoNewTags(tempDir);
}

function assertTagUnchanged(tempDir: string, shaBefore: string): void {
	const shaAfter = execSync('git rev-list -n 1 1.0.0', { cwd: tempDir, encoding: 'utf8' }).trim();
	assert(shaBefore === shaAfter, 'Tag SHA changed after failed prepare');
}

function assertChangelogUnchanged(tempDir: string, original: string): void {
	const after = readFileSync(join(tempDir, 'CHANGELOG.md'), 'utf8');
	assert(after === original, 'CHANGELOG.md was modified despite tag protection');
}

function assertNoNewTags(tempDir: string): void {
	const tags = execSync('git tag -l', { cwd: tempDir, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
	assert(tags.length === 1, `Expected 1 tag, found ${tags.length}`);
	assert(tags[0] === '1.0.0', `Expected tag 1.0.0, found ${tags[0]}`);
}

/**
 * Run the changelog tag protection test in an isolated temporary Git repo.
 */
export function testChangelogTagProtection() {
	const tempDir = setupTempRepo();
	try {
		verifyTagProtection(tempDir);
	} finally {
		try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
	}
}
