/**
 * Regression tests for the in-memory vault harness.
 *
 * Verifies that the harness correctly implements Obsidian vault semantics:
 * file collision rejection, adapter consistency, exists() correctness,
 * file removal, and immediate-children-only listing.
 */
import { createInMemoryVault } from './in-memory-vault';

async function expectReject(fn: () => Promise<unknown>, msg: string): Promise<void> {
  let rejected = false;
  try {
    await fn();
  } catch (err) {
    rejected = true;
    if (!(err instanceof Error)) {
      throw new Error(`Vault harness test failed: expected Error, got ${typeof err}`);
    }
    if (!err.message.includes(msg)) {
      throw new Error(
        `Vault harness test failed: expected "${msg}", got "${err.message}"`,
      );
    }
  }
  if (!rejected) {
    throw new Error(`Vault harness test failed: expected rejection with "${msg}", but operation succeeded`);
  }
}

async function testCollisionRejection(vault: ReturnType<typeof createInMemoryVault>) {
  await vault.create('StoryLine/test/file.md', 'original content');
  await expectReject(
    () => vault.create('StoryLine/test/file.md', 'duplicate'),
    'File already exists',
  );
  const stored = vault.files.get('StoryLine/test/file.md');
  if (stored?.content !== 'original content') {
    throw new Error('Vault harness test failed: original file was modified');
  }
}

async function testAdapterConsistency(vault: ReturnType<typeof createInMemoryVault>) {
  await vault.adapter.write('StoryLine/test/adapter.md', 'adapter content');
  const abstract = vault.getAbstractFileByPath('StoryLine/test/adapter.md');
  if (!abstract) throw new Error('Vault harness test failed: adapter.write did not create file');
  const readContent = await vault.read(abstract);
  if (readContent !== 'adapter content') {
    throw new Error('Vault harness test failed: adapter.write/vault.read inconsistency');
  }
}

async function testExistsCorrectness(vault: ReturnType<typeof createInMemoryVault>) {
  await vault.createFolder('StoryLine/exists-test');
  const exists = await vault.adapter.exists('StoryLine/exists-test/nonexistent.md');
  if (exists) {
    throw new Error('Vault harness test failed: exists() returned true for nonexistent child');
  }
}

async function testFileRemoval(vault: ReturnType<typeof createInMemoryVault>) {
  await vault.create('StoryLine/test/removable.md', 'to be removed');
  await vault.adapter.remove('StoryLine/test/removable.md');
  const removed = vault.getAbstractFileByPath('StoryLine/test/removable.md');
  if (removed !== null) {
    throw new Error('Vault harness test failed: file still exists after removal');
  }
}

async function testListImmediateChildren(vault: ReturnType<typeof createInMemoryVault>) {
  await vault.createFolder('StoryLine/list-test');
  await vault.create('StoryLine/list-test/a.md', 'a');
  await vault.create('StoryLine/list-test/b.md', 'b');
  await vault.createFolder('StoryLine/list-test/sub');
  await vault.create('StoryLine/list-test/sub/c.md', 'c');
  const listed = await vault.adapter.list('StoryLine/list-test');
  if (listed.files.length !== 2) {
    throw new Error(`Vault harness: list returned ${listed.files.length} files, expected 2`);
  }
  if (listed.folders.length !== 1 || listed.folders[0] !== 'StoryLine/list-test/sub') {
    throw new Error('Vault harness: list returned incorrect folders');
  }
}

/**
 * Verify expectReject helper correctly rejects a successful operation.
 * This is a meta-test: the helper must fail when the operation succeeds.
 */
async function testExpectRejectMeta(vault: ReturnType<typeof createInMemoryVault>) {
  // expectReject should fail when the operation succeeds
  let caughtError = false;
  try {
    // This operation succeeds, so expectReject should throw
    await expectReject(
      () => vault.create('StoryLine/meta-test/success.md', 'content'),
      'File already exists',
    );
  } catch (err) {
    caughtError = true;
    if (!(err instanceof Error)) {
      throw new Error('expectReject meta-test: expected Error type');
    }
    if (!err.message.includes('but operation succeeded')) {
      throw new Error(
        `expectReject meta-test: expected "but operation succeeded", got "${err.message}"`,
      );
    }
  }
  if (!caughtError) {
    throw new Error('expectReject meta-test: helper did not reject successful operation');
  }
}

/**
 * Run focused regression tests on the in-memory vault harness.
 * Call this during test bootstrap to verify harness correctness.
 */
export async function runVaultHarnessTests(): Promise<void> {
  const vault = createInMemoryVault();
  await testExpectRejectMeta(vault);
  await testCollisionRejection(vault);
  await testAdapterConsistency(vault);
  await testExistsCorrectness(vault);
  await testFileRemoval(vault);
  await testListImmediateChildren(vault);
}
