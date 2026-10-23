/**
 * Production-owned concurrency guard for project creation.
 *
 * Prevents duplicate creation operations when the user triggers creation
 * multiple times rapidly (e.g., double-clicking the create button).
 *
 * This module has no Obsidian dependencies so it can be tested directly.
 * CreateProjectModal delegates to this coordinator.
 */

/**
 * Concurrency guard that ensures only one creation operation runs at a time.
 */
export class CreationConcurrencyGuard {
    private isCreating = false;

    /**
     * Attempt to start a creation operation.
     * Returns a release function if successful, or null if already creating.
     */
    tryStart(): (() => void) | null {
        if (this.isCreating) return null;
        this.isCreating = true;
        return () => { this.isCreating = false; };
    }

    /** Returns true if a creation is currently in progress. */
    get pending(): boolean { return this.isCreating; }
}
