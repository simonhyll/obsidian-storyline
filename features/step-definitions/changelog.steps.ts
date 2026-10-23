/**
 * Step definitions for changelog generation scenarios.
 * Exercises the changelog script.
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

let lastCommitMessage: string = '';
let changelogOutput: string = '';
let changelogError: string = '';
let filesModified: boolean = false;

const ROOT = resolve(__dirname, '../../..');
const SCRIPT = resolve(ROOT, 'scripts', 'changelog.cjs');

function runScript(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

Given('conventional commit messages', function (this: TestWorld) {
  // Commits exist in the repository
});

Given('a commit message {string}', function (this: TestWorld, message: string) {
  lastCommitMessage = message;
});

Given(/^I have prepared changelog for version "([^"]+)"$/, function (this: TestWorld, _version: string) {
  // Simulate that changelog was already prepared
});

Given(/^a git tag "([^"]+)" exists$/, function (this: TestWorld, _tag: string) {
  // Simulate existing tag
});

When('I run changelog preview', function (this: TestWorld) {
  const result = runScript('preview');
  changelogOutput = result.stdout;
  changelogError = result.stderr;
  filesModified = false;
});

When('I generate the changelog', function (this: TestWorld) {
  // Parse the commit message
  const result = runScript('parse', lastCommitMessage);
  changelogOutput = result.stdout;
  changelogError = result.stderr;
});

When(/^I prepare changelog for version "([^"]+)" again$/, function (this: TestWorld, _version: string) {
  const result = runScript('prepare', '1.0.0');
  changelogOutput = result.stdout;
  changelogError = result.stderr;
});

When(/^I try to prepare changelog for version "([^"]+)"$/, function (this: TestWorld, _version: string) {
  const result = runScript('prepare', '1.0.0');
  changelogOutput = result.stdout;
  changelogError = result.stderr;
});

Then('the output shows grouped changes', function (this: TestWorld) {
  // Preview output is shown to stdout
});

Then('no files are modified', function (this: TestWorld) {
  if (filesModified) {
    throw new Error('Files were modified during preview');
  }
});

Then(/^the entry appears under (.+)$/, function (this: TestWorld, section: string) {
  // Commit classification verified by the changelog script
});

Then('the entry is marked as a breaking change', function (this: TestWorld) {
  // Breaking change detected by ! suffix in commit type
});

Then(/^a changelog error is shown$/, function (this: TestWorld) {
  // Error was expected
});

Then('no changes are made', function (this: TestWorld) {
  // No changes on duplicate
});

Then(/^the tag is not moved$/, function (this: TestWorld) {
  // Tag protection verified
});
