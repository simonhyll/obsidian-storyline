/**
 * Discovers and restores StoryLine projects on plugin startup.
 *
 * Handles the case where Obsidian's vault metadata cache has not finished
 * indexing, which is common on mobile and after laptop wake. Retries project
 * scanning with exponential backoff before prompting for a new project.
 *
 * On mobile platforms, auto-opening the New Project modal is suppressed to
 * prevent duplicate project creation when sync is still running.
 */

import type { SceneManager } from './SceneManager';
import type { Platform } from 'obsidian';
import type { StoryLineProject } from '../models/StoryLineProject';

/**
 * Narrow interface for the plugin settings required during project discovery.
 */
interface DiscoverySettings {
    /** Previously saved active project file path, or empty string. */
    activeProjectFile: string;
}

/**
 * Narrow interface for the vault adapter required during project discovery.
 */
interface DiscoveryVault {
    /** Low-level file adapter for existence checks. */
    adapter: {
        /** Check if a path exists in the vault. */
        exists: (path: string) => Promise<boolean>;
    };
}

/**
 * Narrow interface for platform detection.
 */
interface DiscoveryPlatform {
    /** True when running on iOS, iPadOS, or Android. */
    isMobile: boolean;
}

/**
 * Narrow interface for showing notices to the user.
 */
interface DiscoveryNotice {
    /** Show a notice message. */
    (message: string, timeout?: number): void;
}

/**
 * Dependencies required for project discovery.
 */
interface ProjectDiscoveryDeps {
    /** Scene manager for scanning projects. */
    sceneManager: SceneManager;
    /** Plugin settings subset. */
    settings: DiscoverySettings;
    /** Vault adapter for existence checks. */
    vault: DiscoveryVault;
    /** Platform detection. */
    platform: DiscoveryPlatform;
    /** Notice helper. */
    notice: DiscoveryNotice;
}

/**
 * Scan for existing StoryLine projects, retrying if the metadata cache
 * appears not to have finished indexing.
 *
 * When {@link settings.activeProjectFile} is set but no projects are found,
 * the function retries up to 3 times with increasing delays (1s, 2s, 3s).
 * If the expected project file exists on disk but scanProjects still returns
 * nothing, a final 5-second delay retry is performed.
 *
 * @param deps - Dependencies for project discovery.
 * @returns Array of discovered projects, possibly empty.
 */
export async function discoverProjects(deps: ProjectDiscoveryDeps): Promise<StoryLineProject[]> {
    let projects = await deps.sceneManager.scanProjects();

    // If nothing found but we expect a project, retry after short delays
    // to let the vault / metadata cache finish indexing.
    if (projects.length === 0 && deps.settings.activeProjectFile) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            await delay(attempt * 1000);
            projects = await deps.sceneManager.scanProjects();
            if (projects.length > 0) break;
        }
    }

    if (projects.length === 0 && deps.settings.activeProjectFile) {
        // The file exists but wasn't found by scanProjects — retry once more
        // with a longer delay to give the metadata cache time to catch up.
        const exists = await deps.vault.adapter.exists(deps.settings.activeProjectFile);
        if (exists) {
            await delay(5000);
            projects = await deps.sceneManager.scanProjects();
            if (projects.length > 0) return projects;
        }
    }

    return projects;
}

/**
 * Determine whether to suppress the New Project modal on startup.
 *
 * On mobile platforms, the vault file system can take a long time to populate,
 * especially with cloud sync. Auto-opening the modal risks duplicate creation.
 *
 * @param platform - Platform detection interface.
 * @returns True if the modal should be suppressed.
 */
export function shouldSuppressNewProjectModal(platform: DiscoveryPlatform): boolean {
    return platform.isMobile;
}

/**
 * Show a mobile notice explaining that no projects were found yet.
 *
 * @param notice - Notice helper interface.
 */
export function showMobileProjectNotice(notice: DiscoveryNotice): void {
    notice(
        'StoryLine: no projects found yet. If sync is still running, give it a moment. ' +
        'Otherwise use the command palette → "StoryLine: Create new project".',
        8000,
    );
}

/**
 * Delay execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to delay.
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}
