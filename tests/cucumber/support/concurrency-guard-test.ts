/**
 * Production concurrency-guard regression coverage for project creation.
 *
 * Verify simultaneous submissions, retry after completion and retry after
 * failure through the actual CreationConcurrencyGuard and executeCreation().
 */
import { executeCreation } from '../../../src/services/projectCreation';
import { CreationConcurrencyGuard } from '../../../src/services/creationGuard';
import type { CreationFormState, ProjectCreationDeps } from '../../../src/services/projectCreation';
import type { TestWorld } from '../support/world';

type Release = () => void;

function makeSlowCreation(deps: ProjectCreationDeps) {
    const originalCreateProject = deps.createProject;
    let createCallCount = 0;
    let finishSlowCreate: Release = () => {
        throw new Error('Slow creation was not initialized');
    };
    const slowPromise = new Promise<void>(resolve => { finishSlowCreate = resolve; });
    deps.createProject = async (title, description, customBasePath) => {
        createCallCount++;
        await slowPromise;
        return originalCreateProject(title, description, customBasePath);
    };
    return { finishSlowCreate: () => finishSlowCreate(), count: () => createCallCount };
}

async function runFirstCreation(
    release: Release,
    world: TestWorld,
    formState: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<void> {
    try {
        const project = await executeCreation(formState, deps);
        world.createdProject = project ?? undefined;
        if (project) {
            world.activeBook = project;
            world.books.push(project);
        }
    } finally {
        release();
    }
}

async function verifyDoubleClick(
    guard: CreationConcurrencyGuard,
    world: TestWorld,
    formState: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<number> {
    const slow = makeSlowCreation(deps);
    const firstRelease = guard.tryStart();
    const secondRelease = guard.tryStart();
    if (secondRelease) secondRelease();
    if (!firstRelease || secondRelease !== null) {
        firstRelease?.();
        throw new Error('Second creation was not blocked by the production guard');
    }

    const pendingCreation = runFirstCreation(firstRelease, world, formState, deps);
    slow.finishSlowCreate();
    await pendingCreation;
    if (slow.count() !== 1) {
        throw new Error(`Expected one createProject call, got ${slow.count()}`);
    }
    await verifyRetryAfterCompletion(guard, formState, deps);
    if (slow.count() !== 2) {
        throw new Error(`Expected two createProject calls after retry, got ${slow.count()}`);
    }
    return slow.count();
}

async function verifyRetryAfterCompletion(
    guard: CreationConcurrencyGuard,
    formState: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<void> {
    const release = guard.tryStart();
    if (!release) throw new Error('Guard was not released after successful creation');
    try {
        await executeCreation(formState, deps);
    } finally {
        release();
    }
}

async function verifyFailedAttempt(
    guard: CreationConcurrencyGuard,
    formState: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<void> {
    const release = guard.tryStart();
    if (!release) throw new Error('Guard was not released after a failed creation');
    let failed = false;
    try {
        await executeCreation(formState, deps);
    } catch {
        failed = true;
    } finally {
        release();
    }
    if (!failed) throw new Error('Injected creation failure was not observed');
}

async function verifyRetryAfterFailures(
    guard: CreationConcurrencyGuard,
    formState: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<void> {
    let attempts = 0;
    deps.createProject = async () => {
        attempts++;
        throw new Error('Simulated failure');
    };
    await verifyFailedAttempt(guard, formState, deps);
    await verifyFailedAttempt(guard, formState, deps);
    if (attempts !== 2) {
        throw new Error(`Expected two failed createProject attempts, got ${attempts}`);
    }
}

/** Test real concurrent project creation and failure recovery. */
export async function runConcurrencyGuardTest(
    world: TestWorld,
    formState: CreationFormState,
    makeDepsFactory: (w: TestWorld) => ProjectCreationDeps,
): Promise<{ createCallCount: number; secondCallBlocked: boolean }> {
    const guard = new CreationConcurrencyGuard();
    const deps = makeDepsFactory(world);
    const createCallCount = await verifyDoubleClick(guard, world, formState, deps);
    await verifyRetryAfterFailures(guard, formState, deps);
    if (guard.pending) throw new Error('Guard remained pending after operations completed');
    return { createCallCount, secondCallBlocked: true };
}
