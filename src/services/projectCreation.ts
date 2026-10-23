/**
 * Business logic for creating new StoryLine projects (Book, Series, Universe).
 *
 * Separated from the UI modal to keep the modal under the 200-line limit
 * and to make the creation flows testable without DOM dependencies.
 *
 * This module handles:
 * - Creating a standalone Universe
 * - Creating a Series, optionally inside a Universe
 * - Creating a Book with various hierarchy options:
 *   - Inside an existing Series
 *   - With a new Series inside an existing Universe
 *   - Directly inside a Universe (no Series)
 */

import type { StoryLineProject, SeriesMetadata } from '../models/StoryLineProject';
import type { UniverseMetadata } from '../models/Universe';

/**
 * The type of project being created.
 */
export type ProjectType = 'book' | 'series' | 'universe';

/**
 * Form state passed from the UI to the creation service.
 */
export interface CreationFormState {
    projectType: ProjectType;
    title: string;
    customFolder?: string;
    selectedUniverseId: string;
    selectedSeriesUuid: string;
    newSeriesName: string;
}

/**
 * Dependencies for project creation operations.
 */
export interface ProjectCreationDeps {
    createUniverse: (name: string) => Promise<UniverseMetadata>;
    createSeries: (name: string, basePath?: string) => Promise<SeriesMetadata>;
    addSeriesToUniverse: (universeId: string, seriesFolder: string) => Promise<void>;
    getSeriesByUuid: (seriesUuid: string) => Promise<{ folder: string; meta: SeriesMetadata } | null>;
    createProject: (title: string, description: string, customBasePath?: string) => Promise<StoryLineProject>;
    addBookToSeries: (seriesUuid: string, project: StoryLineProject) => Promise<void>;
    saveProjectFrontmatter: (project: StoryLineProject) => Promise<void>;
    setActiveProject: (project: StoryLineProject) => Promise<void>;
    refreshOpenViews: () => void;
    openNavigator: () => void;
    activateView: (viewType: string) => Promise<void>;
    autoOpenNavigator: boolean;
}

/**
 * Create a new Universe.
 *
 * @param form - The form state containing the universe name.
 * @param deps - Creation dependencies.
 * @returns Null (Universes do not produce a StoryLineProject).
 */
export async function createUniverse(
    form: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<StoryLineProject | null> {
    await deps.createUniverse(form.title);
    deps.refreshOpenViews();
    return null;
}

/**
 * Create a new Series, optionally inside an existing Universe.
 *
 * @param form - The form state containing the series name and optional universe.
 * @param deps - Creation dependencies.
 * @returns Null (Series do not produce a StoryLineProject directly).
 */
export async function createSeries(
    form: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<StoryLineProject | null> {
    const meta = await deps.createSeries(form.title, form.customFolder);
    await addSeriesToUniverseIfSelected(form, meta, deps);
    deps.refreshOpenViews();
    return null;
}

/**
 * Create a new Book with various hierarchy options.
 *
 * @param form - The form state containing the book name and hierarchy selections.
 * @param deps - Creation dependencies.
 * @returns The created StoryLineProject.
 */
export async function createBook(
    form: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<StoryLineProject> {
    const project = await deps.createProject(form.title, '', form.customFolder);
    await placeBookInHierarchy(form, project, deps);
    await deps.setActiveProject(project);
    deps.refreshOpenViews();
    if (deps.autoOpenNavigator) deps.openNavigator();
    try {
        await deps.activateView('storyline-board');
    } catch {
        /* non-critical: user can navigate manually */
    }
    return project;
}

/**
 * Execute the creation flow based on the current form state.
 *
 * @param form - The validated form state.
 * @param deps - Creation dependencies.
 * @returns The created project (null for Universe/Series creation).
 */
export async function executeCreation(
    form: CreationFormState,
    deps: ProjectCreationDeps,
): Promise<StoryLineProject | null> {
    if (form.projectType === 'universe') {
        return await createUniverse(form, deps);
    }
    if (form.projectType === 'series') {
        return await createSeries(form, deps);
    }
    return await createBook(form, deps);
}

// ── Private helpers ──────────────────────────────────────

/**
 * Add the newly created series to the selected universe, if applicable.
 */
async function addSeriesToUniverseIfSelected(
    form: CreationFormState,
    meta: SeriesMetadata,
    deps: ProjectCreationDeps,
): Promise<void> {
    if (!form.selectedUniverseId || !meta.seriesUuid) return;
    const found = await deps.getSeriesByUuid(meta.seriesUuid);
    if (found) {
        await deps.addSeriesToUniverse(form.selectedUniverseId, found.folder);
    }
}

/**
 * Place the newly created book into the selected hierarchy.
 */
async function placeBookInHierarchy(
    form: CreationFormState,
    project: StoryLineProject,
    deps: ProjectCreationDeps,
): Promise<void> {
    if (form.selectedSeriesUuid && form.selectedSeriesUuid !== '__new__') {
        await addBookToExistingSeries(form, project, deps);
    } else if (form.selectedSeriesUuid === '__new__') {
        await createSeriesAndAddBook(form, project, deps);
    } else if (form.selectedUniverseId && !form.selectedSeriesUuid) {
        await addBookDirectlyToUniverse(form, project, deps);
    }
}

/**
 * Add the book to an existing series.
 */
async function addBookToExistingSeries(
    form: CreationFormState,
    project: StoryLineProject,
    deps: ProjectCreationDeps,
): Promise<void> {
    const seriesMeta = await deps.getSeriesByUuid(form.selectedSeriesUuid);
    if (seriesMeta) {
        await deps.addBookToSeries(form.selectedSeriesUuid, project);
    }
}

/**
 * Create a new series and add the book to it.
 */
async function createSeriesAndAddBook(
    form: CreationFormState,
    project: StoryLineProject,
    deps: ProjectCreationDeps,
): Promise<void> {
    const meta = await deps.createSeries(form.newSeriesName, form.customFolder);
    if (meta.seriesUuid) {
        await deps.addBookToSeries(meta.seriesUuid, project);
    }
    await addSeriesToUniverseIfSelected(form, meta, deps);
}

/**
 * Add the book directly to a universe (no series).
 */
async function addBookDirectlyToUniverse(
    form: CreationFormState,
    project: StoryLineProject,
    deps: ProjectCreationDeps,
): Promise<void> {
    project.universeId = form.selectedUniverseId;
    await deps.saveProjectFrontmatter(project);
}
