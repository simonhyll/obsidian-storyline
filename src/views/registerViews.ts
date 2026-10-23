/**
 * Registers all StoryLine Obsidian view types with the plugin.
 *
 * Extracted from {@link SceneCardsPlugin.onload} to keep the composition
 * root small. Each view is registered with a factory that receives the
 * workspace leaf and returns a configured view instance.
 *
 * Preserves existing view IDs and constructor dependencies.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import {
    BOARD_VIEW_TYPE,
    TIMELINE_VIEW_TYPE,
    STORYLINE_VIEW_TYPE,
    CHARACTER_VIEW_TYPE,
    STATS_VIEW_TYPE,
    PLOTGRID_VIEW_TYPE,
    LOCATION_VIEW_TYPE,
    HELP_VIEW_TYPE,
    NAVIGATOR_VIEW_TYPE,
    CODEX_VIEW_TYPE,
    SCENE_INSPECTOR_VIEW_TYPE,
    MANUSCRIPT_VIEW_TYPE,
    RESEARCH_VIEW_TYPE,
    NOTES_VIEW_TYPE,
    SYNOPSIS_VIEW_TYPE,
    DETAILS_VIEW_TYPE,
    UNIVERSE_VIEW_TYPE,
} from '../constants';
import { BoardView } from './BoardView';
import { TimelineView } from './TimelineView';
import { StorylineView } from './StorylineView';
import { CharacterView } from './CharacterView';
import { StatsView } from './StatsView';
import { LocationView } from './LocationView';
import { HelpView } from './HelpView';
import { NavigatorView } from './NavigatorView';
import { CodexView } from './CodexView';
import { SceneInspectorView } from './SceneInspectorView';
import { NotesView } from './NotesView';
import { SynopsisView } from './SynopsisView';
import { DetailsView } from './DetailsView';
import { ManuscriptView } from './ManuscriptView';
import { PlotgridView } from './PlotgridView';
import { ResearchView } from './ResearchView';
import { UniverseView } from './UniverseView';

/**
 * Minimal interface for registering Obsidian view types.
 *
 * This avoids importing the full {@link SceneCardsPlugin} class,
 * preventing circular dependencies with view modules.
 */
interface ViewRegistrationTarget {
    /**
     * Register a view type with Obsidian's workspace.
     * @param viewType - Unique identifier for the view type.
     * @param createView - Factory that constructs the view for a given leaf.
     */
    registerView(viewType: string, createView: (leaf: WorkspaceLeaf) => ItemView): void;
}

/**
 * Dependency bag passed to {@link registerViews}.
 *
 * Contains the services required by view constructors. Views that need
 * the full plugin will receive it through this bag; views that only need
 * a manager receive the manager directly.
 */
interface ViewDependencies {
    /** The concrete plugin instance for view construction. */
    plugin: import('../main').default;
    /** Scene manager for board, timeline, and related views. */
    sceneManager: import('../services/SceneManager').SceneManager;
    /** Research manager for the research view. */
    researchManager: import('../services/ResearchManager').ResearchManager;
}

/**
 * Registers all StoryLine view types on the plugin instance.
 *
 * Must be called once during {@link SceneCardsPlugin.onload} after
 * all services are initialized but before layout is ready.
 *
 * @param target - The plugin instance for registerView calls.
 * @param deps - Services required by view constructors.
 */
export function registerViews(
    target: ViewRegistrationTarget,
    deps: ViewDependencies,
): void {
    const { plugin, sceneManager, researchManager } = deps;

    // Views requiring both plugin and scene manager
    target.registerView(BOARD_VIEW_TYPE, (leaf) =>
        new BoardView(leaf, plugin, sceneManager));
    target.registerView(TIMELINE_VIEW_TYPE, (leaf) =>
        new TimelineView(leaf, plugin, sceneManager));
    target.registerView(STORYLINE_VIEW_TYPE, (leaf) =>
        new StorylineView(leaf, plugin, sceneManager));
    target.registerView(CHARACTER_VIEW_TYPE, (leaf) =>
        new CharacterView(leaf, plugin, sceneManager));
    target.registerView(STATS_VIEW_TYPE, (leaf) =>
        new StatsView(leaf, plugin, sceneManager));
    target.registerView(LOCATION_VIEW_TYPE, (leaf) =>
        new LocationView(leaf, plugin, sceneManager));
    target.registerView(NAVIGATOR_VIEW_TYPE, (leaf) =>
        new NavigatorView(leaf, plugin, sceneManager));
    target.registerView(CODEX_VIEW_TYPE, (leaf) =>
        new CodexView(leaf, plugin, sceneManager));
    target.registerView(SCENE_INSPECTOR_VIEW_TYPE, (leaf) =>
        new SceneInspectorView(leaf, plugin, sceneManager));
    target.registerView(NOTES_VIEW_TYPE, (leaf) =>
        new NotesView(leaf, plugin, sceneManager));
    target.registerView(SYNOPSIS_VIEW_TYPE, (leaf) =>
        new SynopsisView(leaf, plugin, sceneManager));
    target.registerView(DETAILS_VIEW_TYPE, (leaf) =>
        new DetailsView(leaf, plugin, sceneManager));
    target.registerView(MANUSCRIPT_VIEW_TYPE, (leaf) =>
        new ManuscriptView(leaf, plugin, sceneManager));

    // PlotGrid only needs the plugin
    target.registerView(PLOTGRID_VIEW_TYPE, (leaf) =>
        new PlotgridView(leaf, plugin));

    // Research view needs the plugin and research manager
    target.registerView(RESEARCH_VIEW_TYPE, (leaf) =>
        new ResearchView(leaf, plugin, researchManager));

    // Help and Universe views only need the plugin
    target.registerView(HELP_VIEW_TYPE, (leaf) =>
        new HelpView(leaf, plugin));
    target.registerView(UNIVERSE_VIEW_TYPE, (leaf) =>
        new UniverseView(leaf, plugin));
}
