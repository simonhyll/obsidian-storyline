/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unnecessary-type-assertion -- Obsidian's API surface and several untyped third-party libraries force dynamic dispatch; floating promises are intentional in DOM/event handlers; matching enable at end of file */
import { addIcon, App, ButtonComponent, DropdownComponent, ItemView, Modal, Notice, Platform, Plugin, Setting, TFile, TextComponent, ToggleComponent, WorkspaceLeaf, normalizePath, parseYaml, setIcon } from 'obsidian';
import { SceneCardsSettings, SceneCardsSettingTab, DEFAULT_SETTINGS, migrateSectionStateKeys } from './settings';
import { asRecord, isRecord } from './utils/narrow';
import type { FilterPreset } from './models/Scene';
import { SceneManager } from './services/SceneManager';
import { registerCustomStatuses } from './models/Scene';
import { MetadataParser, setWriteSceneFieldsAsWikilinks, setWordcountExclusions, setWordcountLocale } from './services/MetadataParser';
import { normalizeStoryLineLocale, tokenizeWords } from './utils/locale';
import { setActiveTemplatesProvider, setTopLevelMirrorEnabled, mirrorUniversalFieldsToTopLevel, hydrateUniversalFieldsFromTopLevel, isReservedTopLevelKey, type FieldTemplateChange } from './services/FieldTemplateService';
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
} from './constants';
import type { PlotGridData } from './models/PlotGridData';
import type { SeriesMetadata, StoryLineProject } from './models/StoryLineProject';
import { CharacterView } from './views/CharacterView';
import { LocationView } from './views/LocationView';
import { CodexView } from './views/CodexView';
import type { ResearchManager } from './services/ResearchManager';
import type { LocationManager } from './services/LocationManager';
import type { CharacterManager } from './services/CharacterManager';
import type { CodexManager } from './services/CodexManager';
import { makeCustomCodexCategory } from './models/Codex';
import { QuickAddModal } from './components/QuickAddModal';
import { WritingTracker } from './services/WritingTracker';
import type { SnapshotManager } from './services/SnapshotManager';
import type { ViewSnapshotService } from './services/ViewSnapshotService';
import type { SavedViewService } from './services/SavedViewService';
import type { LinkScanner } from './services/LinkScanner';
import type { CascadeRenameService } from './services/CascadeRenameService';
import type { FieldTemplateService } from './services/FieldTemplateService';
import type { SeriesManager } from './services/SeriesManager';
import type { UniverseManager } from './services/UniverseManager';
import type { TimeSpanService } from './services/TimeSpanService';
import type { EventManager } from './services/EventManager';
import type { TimelineNavigationService } from './services/TimelineNavigationService';
import { buildFormattingToolbar } from './components/FormattingToolbar';
import { setupMobileKeyboardHandling } from './components/MobileAdapter';
import { EditorView } from '@codemirror/view';
import { getQuotePair } from './utils/locale';
import { createFocusTextExtension } from './services/FocusTextExtension';
import { registerCommands } from './commands/registerCommands';
import { registerEvents } from './commands/registerEvents';
import { registerLeafChange } from './commands/registerLeafChange';
import { registerViews } from './views/registerViews';
import { createServices, wireServiceCallbacks } from './services/initServices';
import { runStartupSequence } from './services/startup';
import { discoverProjects, shouldSuppressNewProjectModal, showMobileProjectNotice } from './services/projectDiscovery';
import { CreateProjectModal } from './components/CreateProjectModal';
import {
	migrateProjectField,
	removeMigratedEntries,
	migrateFilterPresets,
	removeObsoleteLegacyKeys,
	PROJECT_DATA_KEYS,
	hasProjectDataKeys,
	stripSpecificProjectDataKeys,
	KEY_TO_SYSTEM_FILE,
	mergePlotgridData,
	mergePlotlineData,
	mergeCharacterData,
	mergeStatsData,
	mergeCustomSectionsData,
	deriveSystemFolder,
	deriveSystemFolderFromProjectFile,
	buildSettingsPayload,
} from './services/legacyMigration';

/**
 * StoryLine Plugin for Obsidian
 *
 * Transforms your vault into a powerful book planning tool.
 */
export default class SceneCardsPlugin extends Plugin {
    settings: SceneCardsSettings = DEFAULT_SETTINGS;
    private automaticQuoteReplacement = true;
    sceneManager!: SceneManager;
    /** Set to true once System/ migration is confirmed — guards saveSettings stripping */
    private _systemMigrationDone = false;
    /** Keys that were successfully migrated to System/ files — only these are stripped */
    private _migratedKeys = new Set<string>();
    /** Snapshot of colour settings from data.json (global defaults) */
    private _globalColorDefaults: Partial<SceneCardsSettings> = {};
    locationManager!: LocationManager;
    characterManager!: CharacterManager;
    codexManager!: CodexManager;
    writingTracker: WritingTracker = new WritingTracker();
    snapshotManager!: SnapshotManager;
    viewSnapshotService!: ViewSnapshotService;
    savedViewService!: SavedViewService;
    linkScanner!: LinkScanner;
    cascadeRename!: CascadeRenameService;
    fieldTemplates!: FieldTemplateService;
    seriesManager!: SeriesManager;
    universeManager!: UniverseManager;
    timeSpanService!: TimeSpanService;
    eventManager!: EventManager;
    timelineNavigationService!: TimelineNavigationService;
    researchManager!: ResearchManager;
    /** The leaf currently hosting a StoryLine view */
    storyLeaf: WorkspaceLeaf | null = null;
    /** Removes native browser tooltips (`title`) inside StoryLine UI */
    private nativeTooltipObserver: MutationObserver | null = null;
    /** Disables native spell-check inside StoryLine UI inputs (issue #189) */
    private spellcheckObserver: MutationObserver | null = null;
    /** Issue #238 — debounced writing-stats flush+save (60s) */
    private writingStatsSaveTimer: number | null = null;
    /** Issue #238 — periodic autosave interval id (5 min) */
    private writingStatsIntervalId: number | null = null;
    /** Prevent asynchronous startup from scheduling timers after plugin unload. */
    private pluginUnloading = false;
    private pendingWritingChanges = new Map<string, { before: string; after: string; timer: number }>();
    /** Invalidates overlapping view refresh pipelines during project switches. */
    private openViewsRefreshGeneration = 0;
    /** Single-flight refresh queue; prevents overlapping disk/index pipelines. */
    private openViewsRefreshPromise: Promise<void> | null = null;
    private queuedOpenViewsRefreshRequested = false;
    private queuedOpenViewsRefreshReloadScenes = false;
    private queuedOpenViewsRefreshPaths = new Set<string>();

    isAutomaticQuoteReplacementEnabled(): boolean {
        return this.automaticQuoteReplacement;
    }

    setAutomaticQuoteReplacementEnabled(enabled: boolean): void {
        this.automaticQuoteReplacement = enabled;
        this.settings.automaticQuoteReplacement = enabled;
        void this.saveSettings();
    }

    async onload(): Promise<void> {
        await this.loadSettings();
        this.automaticQuoteReplacement = this.settings.automaticQuoteReplacement !== false;
        registerCustomStatuses(this.settings.customStatuses || []);
        this.applyImageSizingVariables();

        // Convert only newly typed ASCII double quotes in Obsidian's editor.
        // Paste and existing text use their original characters.
        this.registerEditorExtension(EditorView.domEventHandlers({
            beforeinput: (event, view) => {
                if (!this.automaticQuoteReplacement || event.inputType !== 'insertText' || event.data !== '"') return false;
                const position = view.state.selection.main.head;
                const line = view.state.doc.lineAt(position);
                const previous = position > line.from ? view.state.sliceDoc(position - 1, position) : '';
                const openingContext = position === line.from || !previous || /[\s([\]{}—–-]/.test(previous);
                const [open, close] = getQuotePair(this.settings.quoteStyle);
                const selection = view.state.selection.main;
                const replacement = selection.from !== selection.to
                    ? `${open}${view.state.sliceDoc(selection.from, selection.to)}${close}`
                    : (open === close || openingContext ? open : close);
                view.dispatch(view.state.replaceSelection(replacement));
                event.preventDefault();
                return true;
            },
        }));
        this.registerEditorExtension(EditorView.updateListener.of(update => {
            if (!update.docChanged || !update.view.hasFocus) return;
            const activeFile = this.app.workspace.getActiveFile();
            const embeddedPath = update.view.dom.closest<HTMLElement>('.sl-manuscript-editor-wrap')?.dataset.scenePath;
            const scenePath = embeddedPath || activeFile?.path;
            if (!scenePath || !this.sceneManager?.getScene(scenePath)) return;
            const userChange = update.transactions.some(transaction =>
                transaction.isUserEvent('input')
                || transaction.isUserEvent('delete')
                || transaction.isUserEvent('undo')
                || transaction.isUserEvent('redo'));
            if (!userChange) return;

            this.queueWritingChange(scenePath, update.startState.doc.toString(), update.state.doc.toString());
        }));
        this.registerEditorExtension(createFocusTextExtension());
        // Issue #189 — disable native spell-check in all StoryLine UI inputs,
        // textareas and contenteditables. Obsidian's "Disable spell check" only
        // applies to its own editor; plugin-rendered form fields inherit the
        // browser default (spellcheck on), causing red underlines for users
        // writing in languages like Vietnamese. A scoped MutationObserver
        // catches fields added dynamically (Inspector, modals, toolbar, etc.).
        this.disableSpellCheckInPluginUI();

        // Issue #190 — on mobile the soft keyboard can cover the focused
        // field in the Codex, Inspector, Corkboard note editor, etc. Install
        // a global focus/visual-viewport listener that scrolls the field
        // into the visible (above-keyboard) region. No-op on desktop.
        this.register(setupMobileKeyboardHandling());

        // Initialize all services and wire their dependencies
        const services = createServices(this);
        this.sceneManager = services.sceneManager;
        this.locationManager = services.locationManager;
        this.characterManager = services.characterManager;
        this.codexManager = services.codexManager;
        this.snapshotManager = services.snapshotManager;
        this.viewSnapshotService = services.viewSnapshotService;
        this.savedViewService = services.savedViewService;
        this.linkScanner = services.linkScanner;
        this.cascadeRename = services.cascadeRename;
        this.fieldTemplates = services.fieldTemplates;
        this.seriesManager = services.seriesManager;
        this.universeManager = services.universeManager;
        this.timeSpanService = services.timeSpanService;
        this.eventManager = services.eventManager;
        this.timelineNavigationService = services.timelineNavigationService;
        this.researchManager = services.researchManager;

        // Wire post-construction callbacks
        wireServiceCallbacks(this.sceneManager, () => this.refreshOpenViews());

        // Best-effort: register file extensions so exported files are visible in the Vault.
        // We check several possible locations for an existing registration and safely
        // call a registration API if available. This uses `any` casts because the
        // API surface varies between Obsidian versions.
        for (const ext of ['json', 'docx']) {
            try {
                const pluginAny = this as unknown as Record<string, unknown>;
                let alreadyRegistered = false;

                const regOnPlugin = pluginAny.registeredExtensions;
                const regOnVault = (this.app.vault as unknown as Record<string, unknown>)?.registeredExtensions;
                if (Array.isArray(regOnPlugin)) alreadyRegistered = regOnPlugin.includes(ext);
                if (!alreadyRegistered && Array.isArray(regOnVault)) alreadyRegistered = regOnVault.includes(ext);

                if (!alreadyRegistered) {
                    if (typeof pluginAny.registerExtensions === 'function') {
                        (pluginAny.registerExtensions as (e: string[]) => void)([ext]);
                    } else {
                        const appReg = (this.app as unknown as Record<string, unknown>).registerExtensions;
                        if (typeof appReg === 'function') {
                            (appReg as (e: string[]) => void)([ext]);
                        }
                    }
                }
            } catch (e) {
                // non-fatal: extension registration may fail if already registered by another plugin
                void e;
            }
        }

        // Register all StoryLine view types
        registerViews(this, {
            plugin: this,
            sceneManager: this.sceneManager,
            researchManager: this.researchManager,
        });


        // Wait for the workspace layout to be ready, then bootstrap projects
        this.app.workspace.onLayoutReady(async () => {
            const initialized = await runStartupSequence(this);
            // Startup can finish after the plugin is unloaded. Only schedule
            // periodic persistence for a fully initialized, still-live plugin.
            if (!initialized || this.pluginUnloading) return;
            // Issue #238 — safety-net flush+persist every five minutes.
            this.writingStatsIntervalId = window.setInterval(
                () => this.scheduleWritingStatsSave(true),
                5 * 60_000,
            );
        });

        // Register the supplied StoryLine mark in Obsidian's icon registry.
        addIcon('storyline-logo', `
            <path d="M10.4 8.3h29.2a2.1 2.1 0 0 1 2.1 2.1v29.2a2.1 2.1 0 0 1-2.1 2.1H10.4a2.1 2.1 0 0 1-2.1-2.1V10.4a2.1 2.1 0 0 1 2.1-2.1Z" fill="none" stroke="currentColor" stroke-width="7.5"/>
            <path d="M60.4 8.3h29.2a2.1 2.1 0 0 1 2.1 2.1v29.2a2.1 2.1 0 0 1-2.1 2.1H60.4a2.1 2.1 0 0 1-2.1-2.1V10.4a2.1 2.1 0 0 1 2.1-2.1Z" fill="currentColor" stroke="currentColor" stroke-width="7.5"/>
            <path d="M60.4 58.3h29.2a2.1 2.1 0 0 1 2.1 2.1v29.2a2.1 2.1 0 0 1-2.1 2.1H60.4a2.1 2.1 0 0 1-2.1-2.1V60.4a2.1 2.1 0 0 1 2.1-2.1Z" fill="currentColor" stroke="currentColor" stroke-width="7.5"/>
            <path d="M10.4 58.3h29.2a2.1 2.1 0 0 1 2.1 2.1v29.2a2.1 2.1 0 0 1-2.1 2.1H10.4a2.1 2.1 0 0 1-2.1-2.1V60.4a2.1 2.1 0 0 1 2.1-2.1Z" fill="currentColor" stroke="currentColor" stroke-width="7.5"/>
        `);

        // Ribbon icon — open Project Library (Universe → Series → Book hierarchy)
        this.addRibbonIcon('storyline-logo', 'StoryLine Project Library', async () => {
            try {
                await this.activateView(UNIVERSE_VIEW_TYPE);
            } catch {
                // Fallback: open the modal if the view can't be activated
                const modal = new ProjectSelectModal(this.app, this);
                modal.open();
            }
        });


        // Settings tab
        this.addSettingTab(new SceneCardsSettingTab(this.app, this));

        // Suppress native (browser) title tooltips inside StoryLine UI.
        this.enableNativeTooltipSuppression();

        // Register all command-palette entries, vault/workspace events,
        // and leaf-change handlers in dedicated modules.
        registerCommands(this as unknown as import('./commands/plugin-target').PluginTarget);
        registerEvents(this as unknown as import('./commands/plugin-target').PluginTarget);
        registerLeafChange(this as unknown as import('./commands/plugin-target').PluginTarget);
    }

    /**
     * Issue #104 — Apply the "Hide frontmatter" preference by toggling a CSS
     * class on individual markdown leaves whose file lives inside the StoryLine
     * root folder, instead of overriding Obsidian's global
     * "Properties in document" editor setting. This keeps the user's global
     * Obsidian preference intact across vaults.
     */
    /** Cached state to skip redundant DOM work (issue #215 — WebKit scroll jumps). */
    private _lastFrontmatterHide: boolean | null = null;
    private _lastManuscriptFrontmatterHide: boolean | null = null;
    private _lastFrontmatterFileSet: string = '';

    public updateFrontmatterVisibility(): void {
        const hide = !!this.settings.hideFrontmatter;
        const hideInManuscript = !!this.settings.hideFrontmatterInManuscript;
        const root = this.settings.storyLineRoot.replace(/\\/g, '/').replace(/\/$/, '') + '/';

        // Issue #215 — skip all DOM work if nothing changed since the last run.
        // On iPad/iPhone, even class toggles on scroll containers can trigger
        // WebKit scroll resets. Build a cheap fingerprint of the current state
        // and bail out if it matches the last-applied state.
        const leaves: WorkspaceLeaf[] = [];
        this.app.workspace.iterateAllLeaves(l => { leaves.push(l); });
        let fileSet = '';
        for (const leaf of leaves) {
            const view = leaf.view as unknown as { getViewType?: () => string; file?: TFile | null };
            const filePath = view?.file?.path;
            if (filePath) fileSet += filePath + '|';
        }
        const fingerprint = `${hide}|${hideInManuscript}|${fileSet}`;
        if (fingerprint === this._lastFrontmatterFileSet
            && hide === this._lastFrontmatterHide
            && hideInManuscript === this._lastManuscriptFrontmatterHide) {
            return;
        }
        this._lastFrontmatterFileSet = fingerprint;
        this._lastFrontmatterHide = hide;
        this._lastManuscriptFrontmatterHide = hideInManuscript;

        const body = activeDocument.body;
        if (body) {
            if (hide) body.classList.add('sl-hide-frontmatter-global');
            else body.classList.remove('sl-hide-frontmatter-global');
            if (hideInManuscript) body.classList.add('sl-hide-manuscript-frontmatter');
            else body.classList.remove('sl-hide-manuscript-frontmatter');
        }

        for (const leaf of leaves) {
            const view = leaf.view as unknown as { getViewType?: () => string; file?: TFile | null };
            const filePath = view?.file?.path;
            const inStoryLine = !!filePath && (filePath === root.slice(0, -1) || filePath.startsWith(root));
            // Issue #232 / #230 — only hide frontmatter inside markdown editor
            // leaves. Obsidian's core "Properties" sidebar pane (view type
            // 'properties') also exposes `view.file` (the active file), so the
            // previous check tagged it with `sl-hide-frontmatter` whenever a
            // StoryLine scene was open, making the whole Properties pane blank.
            // Restrict the per-leaf class to markdown views only; the body-level
            // `sl-hide-frontmatter-global` class + the `[data-type^="story-line-"]`
            // CSS rule still cover StoryLine's own custom views.
            const viewType = view?.getViewType?.();
            const isMarkdownView = viewType === 'markdown';
            const container = (leaf as unknown as { containerEl?: HTMLElement }).containerEl;
            const target = container?.querySelector('.view-content') as HTMLElement | null;
            if (!target) continue;
            if (hide && inStoryLine && isMarkdownView) {
                target.classList.add('sl-hide-frontmatter');
            } else {
                target.classList.remove('sl-hide-frontmatter');
            }
        }
    }

    /**
     * Apply the toolbar-related settings (v1.10.17):
     *   - `hideToolbarTitle`   → toggle `sl-hide-toolbar-title` on body
     *   - `autoHideViewLabels` → toggle `sl-auto-hide-tab-labels` on body
     *
     * Both are pure CSS toggles — no DOM re-render is needed since every
     * StoryLine view's toolbar uses the shared `.story-line-title-row`
     * and `.view-tab-label` classes.
     */
    public updateToolbarVisibility(): void {
        const body = activeDocument.body;
        if (!body) return;
        if (this.settings.hideToolbarTitle) {
            body.classList.add('sl-hide-toolbar-title');
        } else {
            body.classList.remove('sl-hide-toolbar-title');
        }
        // Default true; only opt out if explicitly false.
        if (this.settings.autoHideViewLabels === false) {
            body.classList.remove('sl-auto-hide-tab-labels');
        } else {
            body.classList.add('sl-auto-hide-tab-labels');
        }
    }

    /**
     * Issue #189 — disable native spell-check in all StoryLine UI inputs,
     * textareas and contenteditable elements. Obsidian's "Disable spell
     * check" setting only applies to its own editor; plugin-rendered form
     * fields inherit the browser default (spellcheck on), causing red
     * underlines for users writing in languages like Vietnamese.
     *
     * A scoped MutationObserver catches fields added dynamically (Inspector,
     * modals, toolbar, corkboard note editor, etc.) without touching the
     * user's manuscript editor (CM6 / `.cm-editor` / `.markdown-view`).
     */
    private disableSpellCheckInPluginUI(): void {
        // Any element whose class contains the plugin's prefix is considered
        // StoryLine-owned UI. We deliberately exclude the CodeMirror / markdown
        // editor so the user's manuscript keeps Obsidian's spell-check setting.
        const STORYLINE_SELECTOR = '[class*="story-line-"], [class*="storyline-"]';
        const EXCLUDE_SELECTOR = '.cm-editor, .markdown-view, .cm-content';
        const SPELL_FIELDS = 'input, textarea, [contenteditable="true"], [contenteditable=""]';

        const disableIn = (root: ParentNode): void => {
            // Fields directly inside a StoryLine container…
            root.querySelectorAll(STORYLINE_SELECTOR).forEach(container => {
                container.querySelectorAll(SPELL_FIELDS).forEach(field => {
                    // Skip fields that live inside the manuscript editor.
                    if (field.closest(EXCLUDE_SELECTOR)) return;
                    const el = field as HTMLElement;
                    if (el.getAttribute('spellcheck') !== 'false') {
                        el.setAttribute('spellcheck', 'false');
                    }
                });
            });
            // …and a StoryLine container that is itself a spellable field.
            root.querySelectorAll(SPELL_FIELDS).forEach(field => {
                if (field.closest(EXCLUDE_SELECTOR)) return;
                if (field.closest(STORYLINE_SELECTOR)) {
                    const el = field as HTMLElement;
                    if (el.getAttribute('spellcheck') !== 'false') {
                        el.setAttribute('spellcheck', 'false');
                    }
                }
            });
        };

        const body = activeDocument.body;
        if (!body) return;

        // Initial pass for views/modals already rendered at load.
        disableIn(body);

        this.spellcheckObserver = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type !== 'childList' || m.addedNodes.length === 0) continue;
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const el = node as HTMLElement;
                    disableIn(el);
                });
            }
        });
        this.spellcheckObserver.observe(body, {
            childList: true,
            subtree: true,
        });
    }

    onunload(): void {
        this.pluginUnloading = true;
        // Issue #238 — clear the periodic autosave interval and any pending
        // debounced save, then do a final immediate flush+persist.
        if (this.writingStatsIntervalId) {
            window.clearInterval(this.writingStatsIntervalId);
            this.writingStatsIntervalId = null;
        }
        if (this.writingStatsSaveTimer) {
            window.clearTimeout(this.writingStatsSaveTimer);
            this.writingStatsSaveTimer = null;
        }
        this.flushPendingWritingChanges();
        // Flush writing session into daily history and persist to System/stats.json
        try {
            const stats = this.sceneManager.queryService.getStatistics();
            // Stop any active sprint so it gets recorded
            if (this.writingTracker.isSprintRunning()) {
                this.writingTracker.stopSprint(stats.totalWords);
            }
            this.writingTracker.flushSession(stats.totalWords);
            void this.saveProjectSystemData();
        } catch (e) {
            console.warn('[StoryLine] final writing-stats flush failed', e);
        }

        if (this.nativeTooltipObserver) {
            this.nativeTooltipObserver.disconnect();
            this.nativeTooltipObserver = null;
        }
        if (this.spellcheckObserver) {
            this.spellcheckObserver.disconnect();
            this.spellcheckObserver = null;
        }

        // Clean up any floating lightbox windows left on activeDocument.body
        activeDocument.querySelectorAll('.gallery-lightbox-window').forEach(el => el.remove());
    }

    /**
     * Inject the StoryLine formatting toolbar into a standard MarkdownView
     * editor tab when: (1) the setting is enabled, (2) Editing Toolbar
     * plugin is not installed, and (3) the file belongs to the active project.
     */
    private injectFormattingToolbar(leaf: WorkspaceLeaf | null): void {
        // Helper: remove all injected toolbars everywhere (used when no leaf is eligible).
        const removeAll = () =>
            activeDocument.querySelectorAll('.sl-injected-fmt-toolbar').forEach(el => el.remove());

        if (!leaf || !this.settings.showFormattingToolbar) { removeAll(); return; }

        // Skip if Editing Toolbar plugin is installed
        const plugins = (this.app as unknown as { plugins?: { getPlugin?: (id: string) => unknown } }).plugins;
        if (plugins?.getPlugin?.('editing-toolbar')) { removeAll(); return; }

        // Only inject into markdown views in source/live-preview mode
        const view = leaf.view as unknown as {
            getViewType?: () => string;
            file?: TFile | null;
            editor?: { cm?: import('@codemirror/view').EditorView | null };
        };
        if (view?.getViewType?.() !== 'markdown') {
            // The active leaf is not a markdown editor (e.g. settings, a
            // sidebar, or another plugin's view). Do NOT tear down toolbars
            // that are already attached to other markdown leaves — removing
            // and re-inserting them when the user returns triggers a WebKit
            // scroll/cursor reset on iPad/iPhone (issue #215 follow-up:
            // switching tabs or opening/closing settings still jumped).
            return;
        }

        // Only inject for files that belong to the active project
        const file = view.file ?? null;
        const sf = this.sceneManager?.activeProject?.sceneFolder;
        const projectRoot = sf ? sf.replace(/\/Scenes$/, '') : undefined;
        if (!file || !projectRoot || !file.path.startsWith(projectRoot)) { removeAll(); return; }

        // Get the CM6 EditorView
        const cm: import('@codemirror/view').EditorView | null = view.editor?.cm ?? null;
        if (!cm) { removeAll(); return; }

        // Find the view-content container to insert the toolbar
        const viewContent = (leaf as unknown as { containerEl?: HTMLElement }).containerEl?.querySelector('.view-content');
        if (!viewContent) { removeAll(); return; }

        // This leaf is eligible. Remove toolbars from OTHER leaves only — avoids DOM
        // mutations inside the current editor that cause WebKit (iPad/iPhone) to jump
        // the scroll position to the top on every active-leaf-change (issue #215).
        activeDocument.querySelectorAll('.sl-injected-fmt-toolbar').forEach(el => {
            if (!viewContent.contains(el)) el.remove();
        });

        // Skip re-injection if the toolbar is already present in this viewContent.
        // Re-inserting on every focus event is what triggered the iPad scroll jump.
        if (viewContent.querySelector('.sl-injected-fmt-toolbar')) return;

        // Create and inject the toolbar at the top of view-content.
        // createDiv appends at the end; move it to the front with insertBefore.
        const toolbar = viewContent.createDiv({ cls: 'sl-fmt-toolbar sl-injected-fmt-toolbar' });
        buildFormattingToolbar(toolbar, () => cm);
        viewContent.insertBefore(toolbar, viewContent.firstChild);
    }

    private enableNativeTooltipSuppression(): void {
        const isInStoryLineUi = (el: HTMLElement): boolean => {
            let node: HTMLElement | null = el;
            while (node) {
                for (const cls of Array.from(node.classList)) {
                    if (cls.startsWith('story-line-')) return true;
                }
                node = node.parentElement;
            }
            return false;
        };

        const stripTitles = (root: ParentNode): void => {
            const rootNode = root as unknown as Node;
            if (!(rootNode.instanceOf(HTMLElement) || rootNode.instanceOf(Document) || rootNode.instanceOf(DocumentFragment))) return;
            const candidates = (root as ParentNode).querySelectorAll?.('[title]') || [];
            for (const node of Array.from(candidates)) {
                if (!node.instanceOf(HTMLElement)) continue;
                if (isInStoryLineUi(node)) {
                    node.removeAttribute('title');
                }
            }
            if (rootNode.instanceOf(HTMLElement) && (root as HTMLElement).hasAttribute('title') && isInStoryLineUi(root as HTMLElement)) {
                (root as HTMLElement).removeAttribute('title');
            }
        };

        stripTitles(activeDocument.body);

        this.nativeTooltipObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (target.instanceOf(HTMLElement) && target.hasAttribute('title') && isInStoryLineUi(target)) {
                        target.removeAttribute('title');
                    }
                    continue;
                }
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node.instanceOf(HTMLElement)) stripTitles(node);
                }
            }
        });

        this.nativeTooltipObserver.observe(activeDocument.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['title'],
        });
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        const sectionStateKeysMigrated = migrateSectionStateKeys(this.settings);
        if (sectionStateKeysMigrated) await this.saveSettings();
        // Issue #73 — propagate the wikilink-writer toggle to MetadataParser
        setWriteSceneFieldsAsWikilinks(this.settings.writeFieldsAsWikilinks !== false);
        // Issue #78 — propagate wordcount-exclusion toggles to MetadataParser
        setWordcountExclusions({
            comments: this.settings.excludeCommentsFromWordcount !== false,
            checklists: this.settings.excludeChecklistFromWordcount === true,
        });
        setWordcountLocale(normalizeStoryLineLocale(this.settings.defaultProjectLanguage));
        // Migrate any absolute OS paths in extraFolders to vault-relative
        // paths so the vault adapter can find them. Cross-platform safe.
        if (Array.isArray(this.settings.extraFolders) && this.settings.extraFolders.length > 0) {
            const migrated = this.settings.extraFolders.map(f => this.toVaultRelativePath(f)).filter(Boolean);
            if (migrated.join('|') !== this.settings.extraFolders.join('|')) {
                this.settings.extraFolders = migrated;
                await this.saveSettings();
            }
        }
        // Snapshot the global colour settings so we can restore them when
        // switching to a project that has no per-project overrides.
        this._globalColorDefaults = {
            colorScheme: this.settings.colorScheme,
            plotlineHue: this.settings.plotlineHue,
            plotlineSaturation: this.settings.plotlineSaturation,
            plotlineLightness: this.settings.plotlineLightness,
            stickyNoteTheme: this.settings.stickyNoteTheme,
            stickyNoteHue: this.settings.stickyNoteHue,
            stickyNoteSaturation: this.settings.stickyNoteSaturation,
            stickyNoteLightness: this.settings.stickyNoteLightness,
            stickyNoteOverrides: { ...(this.settings.stickyNoteOverrides || {}) },
            stickyNoteFontColorLight: this.settings.stickyNoteFontColorLight,
            stickyNoteFontColorDark: this.settings.stickyNoteFontColorDark,
        };
    }

    /** Per-project field keys that live in System/ files, not data.json */
    private static readonly PROJECT_DATA_KEYS: string[] = [
        'tagColors', 'tagTypeOverrides', 'characterAliases', 'ignoredCharacters',
        'writingTrackerData', 'useProjectColors', 'plotlineDescriptions',
        // Legacy plotgrid data stored directly in data.json (before file-based storage)
        'rows', 'columns', 'cells', 'zoom', 'stickyHeaders', 'labelColumnWidth', 'collapsedSections',
        // Legacy / per-project keys that don't belong in global settings
        'filterPresets',
        // Issue #236 — custom sections, codex categories, and location types
        // are now per-project (stored in System/custom-sections.json) so they
        // don't leak across unrelated writing projects.
        'characterCustomSections',
        'locationCustomSections',
        'codexCategoryCustomSections',
        'codexVisualGroups',
        'customLocationTypes',
        'codexCustomCategories',
        'codexEnabledCategories',
    ];

    async saveSettings(): Promise<void> {
        this.applyImageSizingVariables();
        registerCustomStatuses(this.settings.customStatuses || []);
        setWriteSceneFieldsAsWikilinks(this.settings.writeFieldsAsWikilinks !== false);
        setTopLevelMirrorEnabled(this.settings.universalFieldsMirrorTopLevel !== false);
        setWordcountExclusions({
            comments: this.settings.excludeCommentsFromWordcount !== false,
            checklists: this.settings.excludeChecklistFromWordcount === true,
        });
        setWordcountLocale(normalizeStoryLineLocale(this.sceneManager?.getEffectiveLocale() ?? this.settings.defaultProjectLanguage));

        const persisted = await this.loadData();
        // Use production-owned selective merge: normal settings come from
        // this.settings, but unresolved legacy migration keys are preserved
        // from the persisted data.json snapshot.
        const toSave: Record<string, unknown> = buildSettingsPayload(
            this.settings as unknown as Record<string, unknown>,
            persisted && typeof persisted === 'object' ? persisted : null,
            this._migratedKeys,
        );

        if (this._systemMigrationDone) {
            this.applyMigrationStripping(toSave);
            this.applyColorSettings(toSave);
        }
        await this.saveData(toSave);
        if (this._systemMigrationDone) {
            await this.saveProjectSystemData();
        }
    }

    /** Strip only successfully migrated keys from the settings payload. */
    private applyMigrationStripping(toSave: Record<string, unknown>): void {
        for (const key of this._migratedKeys) {
            delete toSave[key];
        }
    }

    /** Apply per-project color settings to the settings payload. */
    private applyColorSettings(toSave: Record<string, unknown>): void {
        if (this.settings.useProjectColors && Object.keys(this._globalColorDefaults).length > 0) {
            this.restoreGlobalColorDefaults(toSave);
        } else {
            this.captureGlobalColorSnapshot();
        }
    }

    /** Restore global color defaults into data.json when per-project colors are active. */
    private restoreGlobalColorDefaults(toSave: Record<string, unknown>): void {
        const g = this._globalColorDefaults;
        toSave.colorScheme = g.colorScheme;
        toSave.plotlineHue = g.plotlineHue;
        toSave.plotlineSaturation = g.plotlineSaturation;
        toSave.plotlineLightness = g.plotlineLightness;
        toSave.stickyNoteTheme = g.stickyNoteTheme;
        toSave.stickyNoteHue = g.stickyNoteHue;
        toSave.stickyNoteSaturation = g.stickyNoteSaturation;
        toSave.stickyNoteLightness = g.stickyNoteLightness;
        toSave.stickyNoteOverrides = g.stickyNoteOverrides ?? {};
        toSave.stickyNoteFontColorLight = g.stickyNoteFontColorLight;
        toSave.stickyNoteFontColorDark = g.stickyNoteFontColorDark;
    }

    /** Capture current global color settings for later restoration. */
    private captureGlobalColorSnapshot(): void {
        this._globalColorDefaults = {
            colorScheme: this.settings.colorScheme,
            plotlineHue: this.settings.plotlineHue,
            plotlineSaturation: this.settings.plotlineSaturation,
            plotlineLightness: this.settings.plotlineLightness,
            stickyNoteTheme: this.settings.stickyNoteTheme,
            stickyNoteHue: this.settings.stickyNoteHue,
            stickyNoteSaturation: this.settings.stickyNoteSaturation,
            stickyNoteLightness: this.settings.stickyNoteLightness,
            stickyNoteOverrides: { ...(this.settings.stickyNoteOverrides || {}) },
            stickyNoteFontColorLight: this.settings.stickyNoteFontColorLight,
            stickyNoteFontColorDark: this.settings.stickyNoteFontColorDark,
        };
    }

    private applyImageSizingVariables(): void {
        const root = activeDocument.documentElement;
        root.style.setProperty('--sl-character-card-portrait-size', `${this.settings.characterCardPortraitSize}px`);
        root.style.setProperty('--sl-character-detail-portrait-size', `${this.settings.characterDetailPortraitSize}px`);
        root.style.setProperty('--sl-location-tree-thumb-size', `${this.settings.locationTreeThumbSize}px`);
        root.style.setProperty('--sl-location-detail-portrait-width', `${this.settings.locationDetailPortraitWidth}px`);
        root.style.setProperty('--sl-location-detail-portrait-height', `${this.settings.locationDetailPortraitHeight}px`);
    }

    /**
     * Scan all plotgrid cells for character, location, and tag mentions.
     * Returns a map of canonical-character-name → set of row labels where
     * that character is mentioned, plus similar maps for locations and tags.
     *
     * Used by CharacterView to augment per-character scene counts with
     * plotgrid references.
     */
    async scanPlotGridCells(): Promise<{
        characters: Map<string, Set<string>>;
        locations: Map<string, Set<string>>;
        tags: Map<string, Set<string>>;
    }> {
        const characters = new Map<string, Set<string>>();
        const locations = new Map<string, Set<string>>();
        const tags = new Map<string, Set<string>>();

        const data = await this.loadPlotGrid();
        if (!data || !data.cells) return { characters, locations, tags };

        this.linkScanner.rebuildLookups(this.settings.characterAliases);

        // Build alias map for dedup
        const aliasMap = this.characterManager.buildAliasMap(this.settings.characterAliases);

        for (const [key, cell] of Object.entries(data.cells)) {
            if (!cell?.content?.trim()) continue;

            // Determine row label for context
            const rowId = key.split('-').slice(0, 2).join('-'); // row id is first part of key
            const row = data.rows.find(r => key.startsWith(r.id + '-'));
            const rowLabel = row?.label || rowId;

            const result = this.linkScanner.scanText(cell.content);

            // Characters (deduplicated via alias map)
            for (const name of result.characters) {
                const canonical = aliasMap.get(name.toLowerCase()) || name;
                const cKey = canonical.toLowerCase();
                if (!characters.has(cKey)) characters.set(cKey, new Set());
                characters.get(cKey)!.add(rowLabel);
            }

            // Locations (deduplicated)
            for (const name of result.locations) {
                const lKey = name.toLowerCase();
                if (!locations.has(lKey)) locations.set(lKey, new Set());
                locations.get(lKey)!.add(rowLabel);
            }

            // Tags
            for (const tag of result.tags) {
                const tKey = tag.toLowerCase();
                if (!tags.has(tKey)) tags.set(tKey, new Set());
                tags.get(tKey)!.add(rowLabel);
            }
        }

        return { characters, locations, tags };
    }

    // ────────────────────────────────────
    //  Codex change detection
    // ────────────────────────────────────

    /**
     * Load stored codex content digests from System/codex-digests.json.
     */
    async loadCodexDigests(): Promise<Record<string, string>> {
        const data = await this.readSystemJson('codex-digests.json');
        return (data.digests || {}) as Record<string, string>;
    }

    /**
     * Save codex content digests to System/codex-digests.json.
     */
    async saveCodexDigests(digests: Record<string, string>): Promise<void> {
        await this.writeSystemJson('codex-digests.json', { digests });
    }

    /**
     * Ensure new codex entries get a baseline digest and deleted entries are
     * pruned. Does NOT overwrite existing digests (so changes are detectable).
     */
    async refreshCodexDigests(): Promise<void> {
        const stored = await this.loadCodexDigests();
        const current = this.linkScanner.computeCodexDigests();
        let changed = false;

        // Add digests for entries not yet tracked
        for (const [fp, digest] of Object.entries(current)) {
            if (!(fp in stored)) {
                stored[fp] = digest;
                changed = true;
            }
        }

        // Remove digests for deleted entries
        for (const fp of Object.keys(stored)) {
            if (!(fp in current)) {
                delete stored[fp];
                changed = true;
            }
        }

        if (changed) await this.saveCodexDigests(stored);
    }

    /**
     * Return codex entries whose content has changed since the last review,
     * along with the scenes that reference them.
     */
    async getStaleCodexEntries(): Promise<{ entry: import('./models/Codex').CodexEntry; affectedScenes: import('./services/LinkScanner').EntityReference[] }[]> {
        const stored = await this.loadCodexDigests();
        const current = this.linkScanner.computeCodexDigests();

        const stale: { entry: import('./models/Codex').CodexEntry; affectedScenes: import('./services/LinkScanner').EntityReference[] }[] = [];
        const index = this.linkScanner.buildEntityIndex();

        for (const [fp, digest] of Object.entries(current)) {
            if (fp in stored && stored[fp] !== digest) {
                const entry = this.codexManager.getAllEntries().find(e => e.filePath === fp);
                if (entry) {
                    const refs = index.get(entry.name.toLowerCase()) || [];
                    const sceneRefs = refs.filter(r => r.type === 'scene');
                    if (sceneRefs.length > 0) {
                        stale.push({ entry, affectedScenes: sceneRefs });
                    }
                }
            }
        }

        return stale;
    }

    /**
     * Mark a codex entry as reviewed — updates its stored digest to the
     * current content so it's no longer flagged as stale.
     */
    async markCodexEntryReviewed(filePath: string): Promise<void> {
        const stored = await this.loadCodexDigests();
        const current = this.linkScanner.computeCodexDigests();
        if (current[filePath]) {
            stored[filePath] = current[filePath];
        }
        await this.saveCodexDigests(stored);
    }

    // ────────────────────────────────────
    //  Project System folder helpers
    // ────────────────────────────────────

    /**
     * Return the base folder for the active project (parent of /Scenes).
     * Falls back to the configured StoryLine root when no project is active.
     */
    getProjectBaseFolder(): string {
        const project = this.sceneManager?.activeProject ?? null;
        if (project) {
            return project.sceneFolder.replace(/\\/g, '/').replace(/\/Scenes\/?$/, '');
        }
        return this.settings.storyLineRoot.replace(/\\/g, '/');
    }

    /**
     * Return the System/ subfolder path for the active project.
     */
    getProjectSystemFolder(): string {
        return `${this.getProjectBaseFolder()}/System`;
    }

    // ────────────────────────────────────
    //  Issue #71 follow-up — universal-field migrations
    // ────────────────────────────────────

    /**
     * Re-mirror universal-field values to top-level YAML for every existing
     * entity (characters, codex entries, locations, scenes) after a template
     * change. This means users adding `topLevelKey` to a previously-saved
     * field — or turning the global mirror toggle on — instantly see their
     * existing data flow into Properties / Bases / Dataview without having
     * to re-edit each note. Folder-sourced selections are wrapped as
     * `[[wikilinks]]` automatically by the mirror function.
     *
     * Pass `change` from the FieldTemplateService to also clean up a renamed
     * topLevelKey or a deleted template's stale top-level YAML key. Pass
     * nothing to do a full re-mirror sweep (used when the global toggle
     * flips on).
     */
    async migrateUniversalFieldMirror(change?: FieldTemplateChange): Promise<void> {
        const oldKey = change?.oldTopLevelKey && change.topLevelKeyChanged ? change.oldTopLevelKey : undefined;
        const removedTpl = change?.type === 'remove';

        // Only run when something user-visible would actually change.
        // For add/update, skip if neither topLevelKey nor folderSource changed.
        if (change && change.type !== 'remove') {
            if (!change.topLevelKeyChanged && !change.folderSourceChanged) return;
        }
        // Mirror writes only happen when the global toggle is on; if it's off
        // we still want to clean up old top-level keys (rename / removal),
        // but skip the full re-mirror sweep otherwise.
        const mirrorOn = this.settings.universalFieldsMirrorTopLevel !== false;
        if (!mirrorOn && !oldKey && !removedTpl) return;

        const files = this.collectEntityFiles();
        let touched = 0;
        for (const file of files) {
            try {
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                    let didChange = false;
                    // Strip a renamed / removed top-level key.
                    if (oldKey && !isReservedTopLevelKey(oldKey) && fm[oldKey] !== undefined) {
                        delete fm[oldKey];
                        didChange = true;
                    }
                    if (removedTpl && change?.oldTopLevelKey && !isReservedTopLevelKey(change.oldTopLevelKey)) {
                        if (fm[change.oldTopLevelKey] !== undefined) {
                            delete fm[change.oldTopLevelKey];
                            didChange = true;
                        }
                    }
                    if (mirrorOn) {
                        const before = JSON.stringify(fm);
                        // Hydrate first so values that only live in top-level
                        // YAML get a universalFields counterpart, then mirror
                        // back to apply the (possibly new) wikilink wrapping.
                        const hydrated = hydrateUniversalFieldsFromTopLevel(fm, fm.universalFields);
                        if (hydrated !== fm.universalFields) fm.universalFields = hydrated;
                        mirrorUniversalFieldsToTopLevel(fm, fm.universalFields);
                        if (JSON.stringify(fm) !== before) didChange = true;
                    }
                    if (didChange) touched++;
                });
            } catch (e) {
                void e;
            }
        }
        if (touched > 0) {
            new Notice(`StoryLine: synced custom-field YAML in ${touched} file${touched === 1 ? '' : 's'}.`);
        }
    }

    /**
     * Collect every TFile that may carry `universalFields`: characters,
     * codex entries, locations, and scenes (across all loaded projects).
     */
    private collectEntityFiles(): TFile[] {
        const files: TFile[] = [];
        const seen = new Set<string>();
        const push = (p: string | undefined | null) => {
            if (!p || seen.has(p)) return;
            const af = this.app.vault.getAbstractFileByPath(p);
            if (af instanceof TFile && af.extension === 'md') {
                seen.add(p);
                files.push(af);
            }
        };
        try { for (const c of this.characterManager?.getAllCharacters() ?? []) push(c.filePath); } catch { /* noop */ }
        try { for (const e of this.codexManager?.getAllEntries() ?? []) push(e.filePath); } catch { /* noop */ }
        try { for (const l of this.locationManager?.getAllLocations() ?? []) push(l.filePath); } catch { /* noop */ }
        try { for (const s of this.sceneManager?.getAllScenes() ?? []) push(s.filePath); } catch { /* noop */ }
        return files;
    }

    /**
     * Read a JSON file from the current project's System/ folder.
     * Returns an empty object if the file doesn't exist or is invalid.
     */
    private async readSystemJson(
        filename: string,
        systemFolder = this.getProjectSystemFolder(),
    ): Promise<Record<string, unknown>> {
        try {
            const adapter = this.app.vault.adapter;
            const filePath = `${systemFolder}/${filename}`;
            if (!await adapter.exists(filePath)) return {};
            const txt = await adapter.read(filePath);
            return JSON.parse(txt);
        } catch {
            return {};
        }
    }

    /**
     * Write a JSON object to a file in the current project's System/ folder.
     * Creates the System/ folder if it doesn't exist.
     */
    private async writeSystemJson(
        filename: string,
        data: Record<string, unknown>,
        systemFolder = this.getProjectSystemFolder(),
    ): Promise<void> {
        try {
            const adapter = this.app.vault.adapter;
            if (!await adapter.exists(systemFolder)) {
                await this.app.vault.createFolder(systemFolder);
            }
            const filePath = `${systemFolder}/${filename}`;
            const serialized = JSON.stringify(data, null, 2);
            // Issue #242 — skip the write when the serialized content is
            // identical to what's already on disk. The 5-minute safety-net
            // interval calls saveProjectSystemData() unconditionally, so
            // without this guard every cycle rewrites all four System JSON
            // files and emits modify events even when nothing changed.
            if (await adapter.exists(filePath)) {
                try {
                    const existing = await adapter.read(filePath);
                    if (existing === serialized) return;
                } catch {
                    /* fall through to write */
                }
            }
            await adapter.write(filePath, serialized);
        } catch (e) {
            void e;
        }
    }

    /**
     * Load per-project data from System/ files into the in-memory settings.
     * Called after a project is loaded or switched.
     */
    async loadProjectSystemData(): Promise<void> {
        const plotlines = await this.readSystemJson('plotlines.json');
        const characters = await this.readSystemJson('characters.json');
        const stats = await this.readSystemJson('stats.json');
        const seriesFolder = this.sceneManager.getSeriesFolder();
        const seriesSystemFolder = seriesFolder ? `${seriesFolder}/System` : null;
        const seriesCodexCategories = seriesSystemFolder
            ? await this.readSystemJson('codex-categories.json', seriesSystemFolder)
            : {};
        const hasSeriesCodexCategories = seriesSystemFolder
            ? await this.app.vault.adapter.exists(`${seriesSystemFolder}/codex-categories.json`)
            : false;

        // Overlay per-project data onto settings (used as working copy)
        this.settings.tagColors = isRecord(plotlines.tagColors)
            ? (plotlines.tagColors as Record<string, string>)
            : {};
        this.settings.tagTypeOverrides = isRecord(plotlines.tagTypeOverrides)
            ? (plotlines.tagTypeOverrides as Record<string, string>)
            : {};
        // Issue #238 feedback — per-project plotline descriptions/notes
        this.settings.plotlineDescriptions = isRecord(plotlines.plotlineDescriptions)
            ? (plotlines.plotlineDescriptions as Record<string, string>)
            : {};

        // Per-project colour overrides (if the project has them stored)
        if (isRecord(plotlines.projectColors)) {
            const pc = asRecord(plotlines.projectColors);
            // Flag this project as having per-project colours
            this.settings.useProjectColors = true;
            if (pc.colorScheme) this.settings.colorScheme = pc.colorScheme as typeof this.settings.colorScheme;
            if (typeof pc.plotlineHue === 'number') this.settings.plotlineHue = pc.plotlineHue;
            if (typeof pc.plotlineSaturation === 'number') this.settings.plotlineSaturation = pc.plotlineSaturation;
            if (typeof pc.plotlineLightness === 'number') this.settings.plotlineLightness = pc.plotlineLightness;
            if (pc.stickyNoteTheme) this.settings.stickyNoteTheme = pc.stickyNoteTheme as typeof this.settings.stickyNoteTheme;
            if (typeof pc.stickyNoteHue === 'number') this.settings.stickyNoteHue = pc.stickyNoteHue;
            if (typeof pc.stickyNoteSaturation === 'number') this.settings.stickyNoteSaturation = pc.stickyNoteSaturation;
            if (typeof pc.stickyNoteLightness === 'number') this.settings.stickyNoteLightness = pc.stickyNoteLightness;
            if (isRecord(pc.stickyNoteOverrides)) {
                this.settings.stickyNoteOverrides = pc.stickyNoteOverrides as Record<number, string>;
            }
            if (typeof pc.stickyNoteFontColorLight === 'string') this.settings.stickyNoteFontColorLight = pc.stickyNoteFontColorLight;
            if (typeof pc.stickyNoteFontColorDark === 'string') this.settings.stickyNoteFontColorDark = pc.stickyNoteFontColorDark;
        } else {
            // No per-project overrides — restore the global colour defaults
            this.settings.useProjectColors = false;
            const g = this._globalColorDefaults;
            if (g && Object.keys(g).length > 0) {
                if (g.colorScheme !== undefined) this.settings.colorScheme = g.colorScheme;
                if (g.plotlineHue !== undefined) this.settings.plotlineHue = g.plotlineHue;
                if (g.plotlineSaturation !== undefined) this.settings.plotlineSaturation = g.plotlineSaturation;
                if (g.plotlineLightness !== undefined) this.settings.plotlineLightness = g.plotlineLightness;
                if (g.stickyNoteTheme !== undefined) this.settings.stickyNoteTheme = g.stickyNoteTheme;
                if (g.stickyNoteHue !== undefined) this.settings.stickyNoteHue = g.stickyNoteHue;
                if (g.stickyNoteSaturation !== undefined) this.settings.stickyNoteSaturation = g.stickyNoteSaturation;
                if (g.stickyNoteLightness !== undefined) this.settings.stickyNoteLightness = g.stickyNoteLightness;
                this.settings.stickyNoteOverrides = { ...(g.stickyNoteOverrides || {}) };
                if (g.stickyNoteFontColorLight !== undefined) this.settings.stickyNoteFontColorLight = g.stickyNoteFontColorLight;
                if (g.stickyNoteFontColorDark !== undefined) this.settings.stickyNoteFontColorDark = g.stickyNoteFontColorDark;
            }
        }

        this.settings.characterAliases = isRecord(characters.characterAliases)
            ? (characters.characterAliases as Record<string, string>)
            : {};
        if (Array.isArray(characters.ignoredCharacters)) {
            this.settings.ignoredCharacters = characters.ignoredCharacters as string[];
        } else {
            this.settings.ignoredCharacters = [];
        }

        // Writing tracker data
        if (isRecord(stats.writingTrackerData)) {
            this.writingTracker.importData(stats.writingTrackerData as unknown as Parameters<typeof this.writingTracker.importData>[0]);
        }

        // Issue #236 — load per-project custom sections, codex categories,
        // and location types from System/custom-sections.json. If the file
        // doesn't exist yet, reset to empty defaults so the previous
        // project's custom sections don't leak into this one.
        //
        // Migration: on the very first load after upgrading to this version,
        // data.json still contains the legacy global values. We detect this
        // by checking whether _systemMigrationDone is already true (it's set
        // at the end of this method). On the first call it's false, so we
        // keep the data.json values and they get written to the System file
        // on the next save. On subsequent calls (project switches), the
        // in-memory values are from the previous project and must NOT be
        // kept — we reset to empty defaults for the new project.
        const customSections = await this.readSystemJson('custom-sections.json');
        const hasCustomSectionsFile = await this.app.vault.adapter.exists(
            `${this.getProjectSystemFolder()}/custom-sections.json`
        );
        if (hasCustomSectionsFile || hasSeriesCodexCategories) {
            this.settings.characterCustomSections = Array.isArray(customSections.characterCustomSections)
                ? (customSections.characterCustomSections as typeof this.settings.characterCustomSections)
                : [];
            this.settings.locationCustomSections = Array.isArray(customSections.locationCustomSections)
                ? (customSections.locationCustomSections as typeof this.settings.locationCustomSections)
                : [];
            this.settings.codexCategoryCustomSections = isRecord(customSections.codexCategoryCustomSections)
                ? (customSections.codexCategoryCustomSections as typeof this.settings.codexCategoryCustomSections)
                : {};
            this.settings.codexVisualGroups = isRecord(customSections.codexVisualGroups)
                ? (customSections.codexVisualGroups as typeof this.settings.codexVisualGroups)
                : {};
            this.settings.customLocationTypes = Array.isArray(customSections.customLocationTypes)
                ? (customSections.customLocationTypes as string[])
                : [];
            const projectCustomCategories = Array.isArray(customSections.codexCustomCategories)
                ? customSections.codexCustomCategories as typeof this.settings.codexCustomCategories
                : [];
            const projectEnabledCategories = Array.isArray(customSections.codexEnabledCategories)
                ? customSections.codexEnabledCategories as string[]
                : [];
            if (hasSeriesCodexCategories) {
                const seriesCustomCategories = Array.isArray(seriesCodexCategories.codexCustomCategories)
                    ? seriesCodexCategories.codexCustomCategories as typeof this.settings.codexCustomCategories
                    : [];
                const mergedCategories = new Map(
                    seriesCustomCategories.map(category => [category.id, category]),
                );
                for (const category of projectCustomCategories) {
                    if (!mergedCategories.has(category.id)) mergedCategories.set(category.id, category);
                }
                this.settings.codexCustomCategories = Array.from(mergedCategories.values());
                const seriesEnabledCategories = Array.isArray(seriesCodexCategories.codexEnabledCategories)
                    ? seriesCodexCategories.codexEnabledCategories as string[]
                    : [];
                this.settings.codexEnabledCategories = Array.from(new Set([
                    ...seriesEnabledCategories,
                    ...projectEnabledCategories,
                ]));
            } else {
                this.settings.codexCustomCategories = projectCustomCategories;
                this.settings.codexEnabledCategories = projectEnabledCategories;
            }
        } else if (this._systemMigrationDone) {
            // Subsequent project switch with no System file — this is a new
            // project (or one that has never had custom sections). Reset to
            // empty defaults so the previous project's values don't leak.
            this.settings.characterCustomSections = [];
            this.settings.locationCustomSections = [];
            this.settings.codexCategoryCustomSections = {};
            this.settings.codexVisualGroups = {};
            this.settings.customLocationTypes = [];
            this.settings.codexCustomCategories = [];
            this.settings.codexEnabledCategories = [];
        }
        // else: first-ever load — keep the data.json values (migration).
        // They will be written to System/custom-sections.json on the next
        // saveSettings() call and stripped from data.json thereafter.

        // System files are now the source of truth.
        // Populate _migratedKeys: any PROJECT_DATA_KEY that is NOT in
        // the persisted data.json was already migrated, so it's safe to strip.
        // Keys still present in data.json are unresolved — don't strip them.
        this._systemMigrationDone = true;
        const persisted = await this.loadData();
        if (persisted && typeof persisted === 'object') {
            for (const key of PROJECT_DATA_KEYS) {
                if (!(key in persisted)) {
                    // Key not in data.json — it was already migrated.
                    this._migratedKeys.add(key);
                }
            }
        }
    }

    /**
     * Issue #238 — flush the writing session into daily history and persist
     * System/stats.json. Debounced by default (60s after the last change) so
     * rapid edits don't hammer the filesystem; pass `true` to flush
     * immediately (used by the 5-minute safety-net interval and on unload).
     */
    scheduleWritingStatsSave(immediate = false): void {
        if (this.writingStatsSaveTimer) {
            window.clearTimeout(this.writingStatsSaveTimer);
            this.writingStatsSaveTimer = null;
        }

        const flush = () => {
            try {
                if (!this.sceneManager?.activeProject) return;
                const stats = this.sceneManager.queryService.getStatistics();
                this.writingTracker.flushSession(stats.totalWords);
                void this.saveProjectSystemData();
            } catch (e) {
                console.warn('[StoryLine] writing-stats autosave failed', e);
            }
        };
        if (immediate) {
            flush();
        } else {
            this.writingStatsSaveTimer = window.setTimeout(flush, 60_000);
        }
    }

    private queueWritingChange(scenePath: string, before: string, after: string): void {
        const pending = this.pendingWritingChanges.get(scenePath);
        if (pending) window.clearTimeout(pending.timer);
        const entry = {
            before: pending?.before ?? before,
            after,
            timer: window.setTimeout(() => this.flushWritingChange(scenePath), 750),
        };
        this.pendingWritingChanges.set(scenePath, entry);
    }

    private flushWritingChange(scenePath: string): void {
        const pending = this.pendingWritingChanges.get(scenePath);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        this.pendingWritingChanges.delete(scenePath);

        const locale = this.sceneManager?.getEffectiveLocale();
        const oldTokens = tokenizeWords(MetadataParser.extractBody(pending.before), locale)
            .map(token => token.toLocaleLowerCase(locale));
        const newTokens = tokenizeWords(MetadataParser.extractBody(pending.after), locale)
            .map(token => token.toLocaleLowerCase(locale));
        const counts = (tokens: string[]): Map<string, number> => {
            const result = new Map<string, number>();
            for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
            return result;
        };
        const oldCounts = counts(oldTokens);
        const newCounts = counts(newTokens);
        let added = 0;
        let deleted = 0;
        for (const token of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
            const difference = (newCounts.get(token) ?? 0) - (oldCounts.get(token) ?? 0);
            if (difference > 0) added += difference;
            if (difference < 0) deleted -= difference;
        }
        this.writingTracker.recordChange(added, deleted);
        this.scheduleWritingStatsSave();
    }

    flushPendingWritingChanges(): void {
        for (const scenePath of [...this.pendingWritingChanges.keys()]) {
            this.flushWritingChange(scenePath);
        }
    }

    /**
     * Save per-project data from in-memory settings to System/ files.
     * Called when settings are saved or before switching projects.
     */
    async saveProjectSystemData(): Promise<void> {
        if (!this.sceneManager?.activeProject) return;

        const plotlinesPayload: Record<string, unknown> = {
            tagColors: this.settings.tagColors || {},
            tagTypeOverrides: this.settings.tagTypeOverrides || {},
            plotlineDescriptions: this.settings.plotlineDescriptions || {},
        };

        if (this.settings.useProjectColors) {
            plotlinesPayload.projectColors = {
                colorScheme: this.settings.colorScheme,
                plotlineHue: this.settings.plotlineHue,
                plotlineSaturation: this.settings.plotlineSaturation,
                plotlineLightness: this.settings.plotlineLightness,
                stickyNoteTheme: this.settings.stickyNoteTheme,
                stickyNoteHue: this.settings.stickyNoteHue,
                stickyNoteSaturation: this.settings.stickyNoteSaturation,
                stickyNoteLightness: this.settings.stickyNoteLightness,
                stickyNoteOverrides: this.settings.stickyNoteOverrides || {},
                stickyNoteFontColorLight: this.settings.stickyNoteFontColorLight ?? '',
                stickyNoteFontColorDark: this.settings.stickyNoteFontColorDark ?? '',
            };
        }

        await this.writeSystemJson('plotlines.json', plotlinesPayload);

        await this.writeSystemJson('characters.json', {
            characterAliases: this.settings.characterAliases || {},
            ignoredCharacters: this.settings.ignoredCharacters || [],
        });

        // Save writing tracker data
        await this.writeSystemJson('stats.json', {
            writingTrackerData: this.writingTracker.exportData(),
        });

        // Issue #236 — save per-project custom sections, codex categories,
        // and location types so they don't leak across unrelated projects.
        await this.writeSystemJson('custom-sections.json', {
            characterCustomSections: this.settings.characterCustomSections || [],
            locationCustomSections: this.settings.locationCustomSections || [],
            codexCategoryCustomSections: this.settings.codexCategoryCustomSections || {},
            codexVisualGroups: this.settings.codexVisualGroups || {},
            customLocationTypes: this.settings.customLocationTypes || [],
            codexCustomCategories: this.settings.codexCustomCategories || [],
            codexEnabledCategories: this.settings.codexEnabledCategories || [],
        });

        const seriesFolder = this.sceneManager.getSeriesFolder();
        if (seriesFolder) {
            await this.writeSystemJson('codex-categories.json', {
                codexCustomCategories: this.settings.codexCustomCategories || [],
                codexEnabledCategories: this.settings.codexEnabledCategories || [],
            }, `${seriesFolder}/System`);
        }
    }

    /**
     * Save the plot grid data to the System/ folder under the active project.
     * This centralizes persistence and avoids views overwriting settings.
     */
    async savePlotGrid(data: PlotGridData, expectedProjectKey?: string): Promise<void> {
        try {
            if (expectedProjectKey && this.sceneManager.activeProject?.filePath !== expectedProjectKey) return;
            const folder = this.getProjectSystemFolder();
            const filePath = `${folder}/plotgrid.json`;
            const adapter = this.app.vault.adapter;

            // Guard: never overwrite a file that has content with empty data
            const isEmpty = !data.rows || data.rows.length === 0;
            if (isEmpty && await adapter.exists(filePath)) {
                try {
                    const existing = await adapter.read(filePath);
                    const parsed = JSON.parse(existing);
                    if (parsed.rows && parsed.rows.length > 0) {
                        // Blocked: refusing to overwrite non-empty plotgrid with empty data
                        return;
                    }
                } catch { /* file unreadable or invalid JSON — allow overwrite */ }
            }

            const contents = JSON.stringify(data, null, 2);

            // ensure folder exists
            if (!await adapter.exists(folder)) {
                await this.app.vault.createFolder(folder);
            }
            if (expectedProjectKey && this.sceneManager.activeProject?.filePath !== expectedProjectKey) return;

            await adapter.write(filePath, contents);
        } catch (e) {
            new Notice('StoryLine: failed to save PlotGrid to vault: ' + String(e));
        }
    }

    /**
     * Load the plot grid data from the System/ folder.
     */
    async loadPlotGrid(): Promise<PlotGridData | null> {
        try {
            const folder = this.getProjectSystemFolder();
            const adapter = this.app.vault.adapter;

            // ── Import-file mechanism ──────────────────────────────────
            // If a plotgrid-import.json exists in the project root, adopt it:
            // persist as the real plotgrid.json in System/ and delete the import file.
            // This lets external scripts (gen_plotgrid.ps1) write data without
            // Obsidian overwriting it before the plugin can load it.
            const baseFolder = this.getProjectBaseFolder();
            const importPath = `${baseFolder}/plotgrid-import.json`;
            if (await adapter.exists(importPath)) {
                try {
                    let importTxt = await adapter.read(importPath);
                    // Strip BOM if present (PowerShell 5.1 writes UTF-8 with BOM)
                    if (importTxt.charCodeAt(0) === 0xFEFF) importTxt = importTxt.slice(1);
                    const imported = JSON.parse(importTxt) as PlotGridData;
                    // Persist to System/plotgrid.json
                    if (!await adapter.exists(folder)) {
                        await this.app.vault.createFolder(folder);
                    }
                    await adapter.write(`${folder}/plotgrid.json`, JSON.stringify(imported, null, 2));
                    // Remove the import file so it isn't re-imported next time
                    await adapter.remove(importPath);
                    // Imported data from plotgrid-import.json successfully
                    return imported;
                } catch (importErr) {
                    // Failed to import plotgrid-import.json — fall through to normal load
                    void importErr;
                }
            }

            const filePath = `${folder}/plotgrid.json`;
            if (!await adapter.exists(filePath)) return null;
            const txt = await adapter.read(filePath);
            return JSON.parse(txt) as PlotGridData;
        } catch {
            return null;
        }
    }

    /**
     * Activate a view type in the workspace.
     * For StoryLine working views (Board, Timeline, Plotgrid, etc.), prefers
     * reusing an already-open leaf to avoid creating duplicate tabs.
     * The Project Library (UniverseView) is treated as a navigational view,
     * separate from working views.
     */
    async activateView(viewType: string): Promise<void> {
        const { workspace } = this.app;

        // Project Library is navigational — always reuse or create a single instance
        // in the main editor area, not the right sidebar.
        if (viewType === UNIVERSE_VIEW_TYPE) {
            const leaves = workspace.getLeavesOfType(UNIVERSE_VIEW_TYPE);
            if (leaves.length > 0) {
                // Check if the existing leaf is in the right sidebar — if so,
                // relocate it to the main editor area instead of reusing it there.
                const existingLeaf = leaves[0];
                const isRightSidebar = existingLeaf.getRoot() === workspace.rightSplit;
                if (isRightSidebar) {
                    // Create a new leaf in the main area and close the sidebar one
                    const newLeaf = workspace.getLeaf(false);
                    if (newLeaf) {
                        await newLeaf.setViewState({ type: UNIVERSE_VIEW_TYPE, active: true });
                        workspace.revealLeaf(newLeaf);
                        // Close the old sidebar instance
                        existingLeaf.detach();
                    }
                    return;
                }
                // Already in the main area, just focus it
                workspace.revealLeaf(existingLeaf);
                return;
            }
            const leaf = workspace.getLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: UNIVERSE_VIEW_TYPE, active: true });
                workspace.revealLeaf(leaf);
            }
            return;
        }

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(viewType);

        if (leaves.length > 0) {
            // View already open, focus the first instance
            leaf = leaves[0];
        } else {
            // Create new leaf
            leaf = workspace.getLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: viewType, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Navigate to a book by activating the project and opening a StoryLine
     * working view. Reuses an existing working leaf for that book rather than
     * creating a duplicate tab.
     *
     * The active project is global, so we cannot have independent per-leaf
     * book contexts. This helper ensures we don't create redundant tabs when
     * the user clicks a book card in the Project Library.
     */
    async navigateToBook(book: StoryLineProject): Promise<void> {
        // Set the active project
        await this.sceneManager.setActiveProject(book);

        // Refresh scenes and inherited entities
        await this.refreshOpenViews(true);

        // Check if there's already a StoryLine working view open
        const workingViewTypes = [
            BOARD_VIEW_TYPE,
            TIMELINE_VIEW_TYPE,
            STORYLINE_VIEW_TYPE,
            PLOTGRID_VIEW_TYPE,
            MANUSCRIPT_VIEW_TYPE,
            CHARACTER_VIEW_TYPE,
            LOCATION_VIEW_TYPE,
            CODEX_VIEW_TYPE,
            STATS_VIEW_TYPE,
        ];

        for (const viewType of workingViewTypes) {
            const leaves = this.app.workspace.getLeavesOfType(viewType);
            if (leaves.length > 0) {
                // Found an existing working view — reuse it
                this.app.workspace.revealLeaf(leaves[0]);
                return;
            }
        }

        // No working view open — default to BoardView
        try {
            await this.activateView(BOARD_VIEW_TYPE);
        } catch {
            // Non-critical fallback
        }
    }

    /**
     * Determine what kind of StoryLine entity a file belongs to.
     * Returns 'character' | 'location' | 'codex' | null.
     */
    resolveEntityType(filePath: string): 'character' | 'location' | 'codex' | null {
        const p = normalizePath(filePath);
        const charFolder = normalizePath(this.sceneManager.getCharacterFolder());
        if (p.startsWith(charFolder + '/') || p === charFolder) return 'character';
        const locFolder = normalizePath(this.sceneManager.getLocationFolder());
        if (p.startsWith(locFolder + '/') || p === locFolder) return 'location';
        const codexFolder = normalizePath(this.sceneManager.getCodexFolder());
        if (p.startsWith(codexFolder + '/') || p === codexFolder) return 'codex';
        return null;
    }

    /**
     * Open the appropriate StoryLine view and navigate to the entity's detail panel.
     */
    async showEntityDetails(filePath: string): Promise<void> {
        const kind = this.resolveEntityType(filePath);
        switch (kind) {
            case 'character': {
                await this.activateView(CHARACTER_VIEW_TYPE);
                const leaves = this.app.workspace.getLeavesOfType(CHARACTER_VIEW_TYPE);
                if (leaves.length > 0) {
                    await (leaves[0].view as CharacterView).navigateToCharacter(filePath);
                }
                break;
            }
            case 'location': {
                await this.activateView(LOCATION_VIEW_TYPE);
                const leaves = this.app.workspace.getLeavesOfType(LOCATION_VIEW_TYPE);
                if (leaves.length > 0) {
                    await (leaves[0].view as LocationView).navigateToItem(filePath);
                }
                break;
            }
            case 'codex': {
                await this.activateView(CODEX_VIEW_TYPE);
                const leaves = this.app.workspace.getLeavesOfType(CODEX_VIEW_TYPE);
                if (leaves.length > 0) {
                    await (leaves[0].view as CodexView).navigateToEntry(filePath);
                }
                break;
            }
        }
    }

    /**
     * Open the Help pane in the right split.
     * If already open, just reveal it.
     */
    async openHelp(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(HELP_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: HELP_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Open the Story Navigator in the left sidebar.
     * If already open, just reveal it.
     */
    async openNavigator(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(NAVIGATOR_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getLeftLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: NAVIGATOR_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Open the Scene Details inspector in the right sidebar.
     * If already open, just reveal it.
     */
    async openSceneInspector(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(SCENE_INSPECTOR_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: SCENE_INSPECTOR_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Open (or reveal) the standalone Notes sidebar view.
     */
    async openNotesView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(NOTES_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: NOTES_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Open (or reveal) the standalone Synopsis sidebar view. The leaf can be
     * dragged to dock above/below/beside any other pane.
     */
    async openSynopsisView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(SYNOPSIS_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: SYNOPSIS_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Open (or reveal) the standalone Scene Details view (the full inspector
     * inside its own dockable leaf).
     */
    async openSceneDetailsLeaf(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(DETAILS_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: DETAILS_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /** Returns true when the Scene Inspector sidebar is open and visible. */
    isSceneInspectorOpen(): boolean {
        const leaves = this.app.workspace.getLeavesOfType(SCENE_INSPECTOR_VIEW_TYPE);
        if (leaves.length === 0) return false;
        const leaf = leaves[0];
        // Check the sidebar containing this leaf is not collapsed
        const root = leaf.getRoot();
        if ((root as unknown as Record<string, unknown>).collapsed) return false;
        // Check this leaf is the active tab in its parent (not hidden behind another tab)
        const parent = ((leaf as unknown as Record<string, unknown>).parentSplit
            ?? (leaf as unknown as Record<string, unknown>).parent) as { children?: unknown[]; currentTab?: unknown; activeTab?: unknown } | undefined;
        if (parent && typeof parent.children !== 'undefined') {
            const activeChild = parent.currentTab ?? parent.activeTab;
            if (activeChild !== undefined && activeChild !== leaf) {
                // parent tracks a numeric index — compare by index
                const idx = (parent.children as unknown[]).indexOf(leaf);
                if (typeof activeChild === 'number' ? activeChild !== idx : true) return false;
            }
        }
        return true;
    }

    async openResearch(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(RESEARCH_VIEW_TYPE);
        if (existing.length > 0) {
            workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: RESEARCH_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Switch the current StoryLine leaf in-place to a different view type.
     * Kept as a utility; the ViewSwitcher now uses the leaf reference directly.
     */
    async activateViewInPlace(viewType: string): Promise<void> {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({ type: viewType, active: true, state: {} });
        this.app.workspace.revealLeaf(leaf);
    }

    /**
     * Open the Quick Add modal
     */
    openQuickAdd(): void {
        const modal = new QuickAddModal(
            this.app,
            this,
            this.sceneManager,
            async (sceneData, openAfter) => {
                const file = await this.sceneManager.createScene(sceneData);
                this.refreshOpenViews();

                if (openAfter) {
                    await this.app.workspace.getLeaf('tab').openFile(file, { state: { mode: 'source', source: false } });
                }
            }
        );
        modal.open();
    }

    /**
     * Load characters and locations for the active project.
     *
     * When the project belongs to a series, `getCharacterFolder()` /
     * `getLocationFolder()` already redirect to the shared series-level
     * Codex folder. After loading from there we additionally scan the
     * per-project `Codex/Characters/` and `Codex/Locations/` folders so
     * book-only characters and locations can coexist with series-shared
     * ones. The series scan wins on file-path collisions because
     * `addFile()` skips paths that are already loaded.
     */
    /**
     * Reload all entity managers from the project folders AND re-apply
     * Additional Source Folders. This is the single entry point views
     * should call on open/refresh so that externally-scanned entries
     * (characters/locations/codex stored outside the project Codex)
     * survive view reloads.
     *
     * `loadActiveProjectEntities()` clears each manager and reloads from
     * the project folders; `scanExtraFolders()` then re-adds entries from
     * user-configured external folders. Inherited Codex from Universe and
     * Series scopes is restored after `loadAll()` clears the manager.
     * Calling both keeps the two in sync.
     */
    async reloadEntities(): Promise<void> {
        await this.loadActiveProjectEntities();
        await this.scanExtraFolders();
        // Re-load codex entries from the project Codex folder, then re-apply
        // external folders so codex-type entries are included.
        const codexFolder = this.sceneManager.getCodexFolder();
        if (codexFolder) {
            const customDefs = (this.settings.codexCustomCategories || []).map(
                (cc: { id: string; label: string; icon: string }) => makeCustomCodexCategory(cc.id, cc.label, cc.icon)
            );
            this.codexManager.initCategories(this.settings.codexEnabledCategories || [], customDefs);
            await this.codexManager.loadAll(codexFolder);
            // Restore inherited codex from Universe and Series scopes after
            // loadAll() cleared the manager. This ensures CodexView.onOpen(),
            // CharacterView.onOpen(), LocationView.onOpen(), and file-change
            // listeners all get the full inherited codex.
            try {
                const inheritedFolders = await this.universeManager.getInheritedCodexFolders(
                    this.sceneManager.activeProject!
                );
                if (inheritedFolders.length > 0) {
                    await this.codexManager.loadInheritedFolders(inheritedFolders);
                }
            } catch { /* Universe inheritance is optional; ignore errors */ }
            await this.scanExtraFolders();
        }
        // Restore inherited events from Universe and Series scopes
        try {
            await this.loadActiveProjectEvents();
        } catch { /* project may not be set yet */ }
    }

    /**
     * Load Events for the active project, including inherited Events from
     * Universe and Series scopes.
     *
     * Loads each scope independently to avoid scanning the same folder twice:
     * 1. Book-level Events (via loadAll — clears and loads)
     * 2. Series-level Events (via loadInheritedFolders)
     * 3. Universe-level Events (via loadInheritedFolders)
     */
    async loadActiveProjectEvents(): Promise<void> {
        const project = this.sceneManager.activeProject;
        if (!project) return;

        // Load book-level events first (takes precedence)
        const bookEventsFolder = this.sceneManager.getBookEventsFolder();
        if (bookEventsFolder) {
            await this.eventManager.loadAll(bookEventsFolder);
        }

        // Load inherited events from Universe and Series scopes
        try {
            const inheritedFolders = await this.universeManager.getInheritedEventFolders(project);
            if (inheritedFolders.length > 0) {
                await this.eventManager.loadInheritedFolders(inheritedFolders);
            }
        } catch { /* Universe inheritance is optional; ignore errors */ }
    }

    /**
     * Reload characters and locations from the active project's Codex
     * folders, then scan series-local Codex folders if applicable. Used by
     * `reloadEntities()` and the bootstrap path.
     *
     * `loadCharacters`/`loadAll` clear the manager first, so callers that
     * also want external Additional Source Folder entries must run
     * `scanExtraFolders()` afterwards.
     */
    async loadActiveProjectEntities(): Promise<void> {
        const adapter = this.app.vault.adapter;
        this.characterManager.setManualAliases(this.settings.characterAliases);

        const locFolder = this.sceneManager.getLocationFolder();
        if (locFolder) await this.locationManager.loadAll(locFolder);
        const charFolder = this.sceneManager.getCharacterFolder();
        if (charFolder) await this.characterManager.loadCharacters(charFolder, this.settings.characterAliases);

        // Series mode: also scan the per-project Codex folder for book-only
        // characters and locations.
        if (!this.sceneManager.getSeriesFolder()) return;

        const localCharFolder = this.sceneManager.getProjectLocalCharacterFolder();
        if (localCharFolder && localCharFolder !== charFolder && await adapter.exists(localCharFolder)) {
            const listing = await adapter.list(localCharFolder);
            for (const f of listing.files) {
                if (!f.endsWith('.md')) continue;
                try {
                    const fp = normalizePath(f);
                    const content = await adapter.read(fp);
                    this.characterManager.addFile(content, fp);
                } catch { /* skip unreadable */ }
            }
            await this.characterManager.reconcileAliasFiles([localCharFolder], this.settings.characterAliases);
        }

        const localLocFolder = this.sceneManager.getProjectLocalLocationFolder();
        if (localLocFolder && localLocFolder !== locFolder && await adapter.exists(localLocFolder)) {
            const scanLoc = async (folder: string): Promise<void> => {
                if (!await adapter.exists(folder)) return;
                const listing = await adapter.list(folder);
                for (const f of listing.files) {
                    if (!f.endsWith('.md')) continue;
                    try {
                        const fp = normalizePath(f);
                        const content = await adapter.read(fp);
                        this.locationManager.addFile(content, fp);
                    } catch { /* skip unreadable */ }
                }
                for (const sub of listing.folders) {
                    await scanLoc(normalizePath(sub));
                }
            };
            await scanLoc(localLocFolder);
        }
    }

    /**
     * Recursively scan user-configured extra folders and route each .md
     * file to the appropriate manager based on its frontmatter type: field.
     */
    async scanExtraFolders(): Promise<void> {
        const folders = this.settings.extraFolders;
        if (!folders || folders.length === 0) return;

        const adapter = this.app.vault.adapter;
        // Resolve the vault root once so we can convert absolute OS paths
        // (e.g. "C:/Users/.../MyFolder" on Windows or "/Users/.../MyFolder"
        // on macOS/Linux) into vault-relative paths that the adapter
        // understands. On mobile the adapter basePath may be empty, in
        // which case we fall back to using the path as-is.
        let vaultRoot = '';
        try {
            if (typeof (adapter as unknown as { getBasePath?: () => string }).getBasePath === 'function') {
                vaultRoot = (adapter as unknown as { getBasePath: () => string }).getBasePath();
            }
        } catch { /* mobile / unsupported — leave vaultRoot empty */ }

        const toVaultRelative = (p: string): string => {
            if (!vaultRoot) return normalizePath(p);
            // Normalise separators so the comparison works cross-platform.
            const normRoot = vaultRoot.replace(/\\/g, '/').replace(/\/+$/, '');
            const normPath = p.replace(/\\/g, '/').replace(/^\/+/, '');
            if (normPath.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
                return normalizePath(normPath.slice(normRoot.length + 1));
            }
            if (normPath.toLowerCase() === normRoot.toLowerCase()) {
                return '';
            }
            // Already vault-relative (or an unknown absolute path) — normalise
            // and let adapter.exists decide.
            return normalizePath(p);
        };

        const visitedFolders = new Set<string>();
        const scan = async (folderPath: string): Promise<void> => {
            // Convert absolute OS paths to vault-relative, then normalise
            // (strips leading/trailing slashes, converts backslashes) so
            // adapter.exists() doesn't silently fail.
            const normalized = toVaultRelative(folderPath);
            if (!normalized || !await adapter.exists(normalized)) return;
            if (visitedFolders.has(normalized)) return;
            visitedFolders.add(normalized);
            const listing = await adapter.list(normalized);
            for (const f of listing.files) {
                if (!f.endsWith('.md')) continue;
                try {
                    const fp = normalizePath(f);
                    const content = await adapter.read(fp);
                    const type = this.extractFrontmatterType(content);
                    if (!type) continue;
                    switch (type) {
                        case 'scene':
                            {
                                const sceneFolder = normalizePath(this.sceneManager.getSceneFolder()).replace(/\/$/, '');
                                if (fp === sceneFolder || fp.startsWith(`${sceneFolder}/`)) {
                                    this.sceneManager.addFile(content, fp);
                                }
                            }
                            break;
                        case 'character':
                            this.characterManager.addFile(content, fp);
                            break;
                        case 'location':
                        case 'world':
                            this.locationManager.addFile(content, fp);
                            break;
                        default:
                            // Try codex categories (items, creatures, custom, etc.)
                            this.codexManager.addFile(content, fp);
                            break;
                    }
                } catch { /* skip unreadable */ }
            }
            for (const sub of listing.folders) {
                await scan(normalizePath(sub));
            }
        };

        for (const folder of folders) {
            if (folder) await scan(folder);
        }
    }

    /**
     * Convert an absolute OS filesystem path to a vault-relative path that
     * Obsidian's vault adapter understands. Works cross-platform (Windows,
     * macOS, Linux). If the path is already vault-relative (or the vault
     * root cannot be determined, e.g. on mobile), the path is normalised
     * and returned as-is.
     */
    toVaultRelativePath(p: string): string {
        const adapter = this.app.vault.adapter;
        let vaultRoot = '';
        try {
            if (typeof (adapter as unknown as { getBasePath?: () => string }).getBasePath === 'function') {
                vaultRoot = (adapter as unknown as { getBasePath: () => string }).getBasePath();
            }
        } catch { /* mobile / unsupported */ }
        if (!vaultRoot) return normalizePath(p);
        const normRoot = vaultRoot.replace(/\\/g, '/').replace(/\/+$/, '');
        const normPath = p.replace(/\\/g, '/').replace(/^\/+/, '');
        if (normPath.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
            return normalizePath(normPath.slice(normRoot.length + 1));
        }
        if (normPath.toLowerCase() === normRoot.toLowerCase()) {
            return '';
        }
        return normalizePath(p);
    }

    /**
     * Quick extraction of the type: field from frontmatter.
     */
    private extractFrontmatterType(content: string): string | null {
        const clean = content.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');
        const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return null;
        try {
            const fm = parseYaml(match[1]);
            return fm?.type ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Force all open Board views to reload corkboard positions from SceneManager
     * on their next refresh. Call this after programmatically updating board.json
     * (e.g. snapshot restore) so the local map picks up the new data.
     */
    invalidateCorkboardCache(): void {
        const leaves = this.app.workspace.getLeavesOfType(BOARD_VIEW_TYPE);
        for (const leaf of leaves) {
            const view = leaf.view as unknown as unknown as Record<string, unknown>;
            if (typeof view?.invalidateCorkboardLayout === 'function') {
                (view as unknown as { invalidateCorkboardLayout(): void }).invalidateCorkboardLayout();
            }
        }
    }

    /**
     * Flush any pending corkboard position writes so SceneManager has the
     * latest positions. Call before capturing a snapshot.
     */
    async flushCorkboardPositions(): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(BOARD_VIEW_TYPE);
        for (const leaf of leaves) {
            const view = leaf.view as unknown as unknown as Record<string, unknown>;
            if (typeof view?.flushPendingCorkboardPersist === 'function') {
                await (view as unknown as { flushPendingCorkboardPersist(): Promise<void> }).flushPendingCorkboardPersist();
            }
        }
    }

    /**
     * Issue #271 fix: Invalidate LinkScanner cache and re-scan all scenes.
     * Called when the active project changes to ensure link discovery is fresh.
     */
    async invalidateAndReScanLinks(): Promise<void> {
        try {
            this.linkScanner.invalidateAll();
            this.linkScanner.rebuildLookups(this.settings.characterAliases);
            await this.linkScanner.scanAllAsync(this.sceneManager.getAllScenes());
        } catch (e) {
            console.error('[StoryLine] Failed to re-scan links:', e);
        }
    }

    /**
     * Refresh all open Scene Cards views
     */
    async refreshOpenViews(reloadScenes = false, changedPaths: string[] = []): Promise<void> {
        this.queuedOpenViewsRefreshRequested = true;
        this.queuedOpenViewsRefreshReloadScenes ||= reloadScenes;
        for (const path of changedPaths) this.queuedOpenViewsRefreshPaths.add(normalizePath(path));

        if (this.openViewsRefreshPromise) return this.openViewsRefreshPromise;

        const refreshPromise = (async () => {
            while (this.queuedOpenViewsRefreshRequested) {
                this.queuedOpenViewsRefreshRequested = false;
                const nextReloadScenes = this.queuedOpenViewsRefreshReloadScenes;
                this.queuedOpenViewsRefreshReloadScenes = false;
                const nextChangedPaths = Array.from(this.queuedOpenViewsRefreshPaths);
                this.queuedOpenViewsRefreshPaths.clear();
                await this.performRefreshOpenViews(nextReloadScenes, nextChangedPaths);
            }
        })();
        this.openViewsRefreshPromise = refreshPromise;
        try {
            await refreshPromise;
        } finally {
            if (this.openViewsRefreshPromise === refreshPromise) this.openViewsRefreshPromise = null;
        }
    }

    private async performRefreshOpenViews(reloadScenes: boolean, changedPaths: string[]): Promise<void> {
        const refreshGeneration = ++this.openViewsRefreshGeneration;
        const projectKey = this.sceneManager?.activeProject?.filePath ?? null;
        const isCurrentRefresh = (): boolean =>
            refreshGeneration === this.openViewsRefreshGeneration
            && (this.sceneManager?.activeProject?.filePath ?? null) === projectKey;

        // Issue #279 — external sync tools can add, replace, or remove files
        // without leaving SceneManager's in-memory index in a usable state.
        // Rebuild it from the active project's folders before loading the
        // entity managers and rebuilding reverse references.
        if (reloadScenes) {
            try {
                await this.sceneManager.initialize(true);
            } catch (e) {
                console.error('[StoryLine] Failed to reload scenes from disk:', e);
            }
            if (!isCurrentRefresh()) return;
        }

        const entityChanges = changedPaths.some(path => this.isEntityRefreshPath(path));

        // Keep entity managers in sync only when an entity or a full sync changed.
        if (reloadScenes) {
            try {
                await this.loadActiveProjectEntities();
                await this.scanExtraFolders();
                const codexFolder = this.sceneManager.getCodexFolder();
                if (codexFolder) {
                    const customDefs = (this.settings.codexCustomCategories || []).map(
                        (cc: { id: string; label: string; icon: string }) => makeCustomCodexCategory(cc.id, cc.label, cc.icon)
                    );
                    this.codexManager.initCategories(this.settings.codexEnabledCategories || [], customDefs);
                    await this.codexManager.loadAll(codexFolder);
                    // Restore inherited codex from Universe and Series scopes
                    try {
                        const inheritedFolders = await this.universeManager.getInheritedCodexFolders(
                            this.sceneManager.activeProject!
                        );
                        if (inheritedFolders.length > 0) {
                            await this.codexManager.loadInheritedFolders(inheritedFolders);
                        }
                    } catch { /* Universe inheritance is optional; ignore errors */ }
                }
                // Restore inherited events from Universe and Series scopes
                try {
                    await this.loadActiveProjectEvents();
                } catch { /* project may not be set yet */ }
            } catch { /* project may not be set yet */ }
        } else if (entityChanges) {
            try {
                await this.updateEntityFiles(changedPaths);
            } catch { /* project may not be set yet */ }
        }
        if (!isCurrentRefresh()) return;

        // Re-scan only changed scenes for ordinary edits. Full refreshes rebuild
        // all links after entity lookups have been refreshed.
        if (reloadScenes || entityChanges) {
            this.linkScanner.invalidateAll();
            await this.linkScanner.scanAllAsync(this.sceneManager.getAllScenes());
        } else {
            const changedScenePaths = new Set<string>();
            for (const path of changedPaths) {
                this.linkScanner.invalidate(path);
                if (this.sceneManager.getScene(path)) changedScenePaths.add(path);
            }
            if (changedScenePaths.size > 0) {
                await this.linkScanner.scanAllAsync(
                    this.sceneManager.getAllScenes().filter(scene => changedScenePaths.has(scene.filePath)),
                );
            }
        }
        if (!isCurrentRefresh()) return;

        // Update codex digests (baseline new entries, prune deleted ones)
        void this.refreshCodexDigests();

        // Flush writing tracker so daily stats update in real-time
        try {
            const stats = this.sceneManager.queryService.getStatistics();
            this.writingTracker.flushSession(stats.totalWords);
        } catch { /* project may not be set yet */ }

        const viewTypes = [
            BOARD_VIEW_TYPE,
            PLOTGRID_VIEW_TYPE,
            TIMELINE_VIEW_TYPE,
            STORYLINE_VIEW_TYPE,
            CHARACTER_VIEW_TYPE,
            LOCATION_VIEW_TYPE,
            CODEX_VIEW_TYPE,
            STATS_VIEW_TYPE,
            NAVIGATOR_VIEW_TYPE,
            MANUSCRIPT_VIEW_TYPE,
            RESEARCH_VIEW_TYPE,
            UNIVERSE_VIEW_TYPE,
        ];

        for (const viewType of viewTypes) {
            const leaves = this.app.workspace.getLeavesOfType(viewType);
            for (const leaf of leaves) {
                const viewRoot = (leaf.view as unknown as { containerEl?: HTMLElement }).containerEl;
                // Plot Grid owns its scroll restoration because it rebuilds
                // its canvas asynchronously. Restoring it here as well lets
                // stale refresh callbacks move it back to an older position.
                const ownsScrollState = viewType !== PLOTGRID_VIEW_TYPE;
                const scrollState = ownsScrollState && viewRoot ? this.captureViewScrollState(viewRoot) : [];
                const view = leaf.view as unknown as { refresh?: () => void | Promise<void> };
                if (view && typeof view.refresh === 'function') {
                    await view.refresh();
                    if (!isCurrentRefresh()) return;
                    if (ownsScrollState) {
                        this.restoreViewScrollState(viewRoot, scrollState);
                        window.requestAnimationFrame(() => {
                            if (!isCurrentRefresh()) return;
                            this.restoreViewScrollState(viewRoot, scrollState);
                            window.setTimeout(() => {
                                if (isCurrentRefresh()) this.restoreViewScrollState(viewRoot, scrollState);
                            }, 120);
                        });
                    }
                }
                // Update the tab title so it reflects the new project name immediately
                (leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
            }
        }
    }

    private captureViewScrollState(root: HTMLElement): Array<{ path: number[]; top: number; left: number }> {
        const state: Array<{ path: number[]; top: number; left: number }> = [];
        const visit = (element: HTMLElement, path: number[]): void => {
            if (element.scrollTop !== 0 || element.scrollLeft !== 0) {
                state.push({ path, top: element.scrollTop, left: element.scrollLeft });
            }
            Array.from(element.children).forEach((child, index) => {
                if (child.instanceOf(HTMLElement)) visit(child, [...path, index]);
            });
        };
        visit(root, []);
        return state;
    }

    private restoreViewScrollState(root: HTMLElement | undefined, state: Array<{ path: number[]; top: number; left: number }>): void {
        if (!root || state.length === 0) return;
        for (const saved of state) {
            let element: HTMLElement = root;
            let valid = true;
            for (const index of saved.path) {
                const child = element.children[index];
                if (!child || !child.instanceOf(HTMLElement)) {
                    valid = false;
                    break;
                }
                element = child;
            }
            if (valid) {
                element.scrollTop = saved.top;
                element.scrollLeft = saved.left;
            }
        }
    }

    private isPathInside(filePath: string, folderPath: string): boolean {
        const file = normalizePath(filePath).replace(/\/$/, '');
        const folder = normalizePath(folderPath).replace(/\/$/, '');
        return Boolean(folder) && (file === folder || file.startsWith(`${folder}/`));
    }

    private getConfiguredExtraFolderPaths(): string[] {
        const paths = new Set<string>();
        for (const folder of this.settings.extraFolders || []) {
            if (!folder) continue;
            try {
                const relative = this.toVaultRelativePath(folder);
                if (relative) paths.add(normalizePath(relative));
            } catch { /* ignore invalid or unavailable source folders */ }
        }
        return Array.from(paths);
    }

    isRelevantStoryLineFile(filePath: string): boolean {
        const activeProject = this.sceneManager?.activeProject;
        if (!activeProject) return false;

        const normalized = normalizePath(filePath);
        const systemFolder = this.getProjectSystemFolder();
        if (this.isPathInside(normalized, systemFolder)) return false;

        try {
            if (normalized === normalizePath(activeProject.filePath)
                || this.isPathInside(normalized, this.getProjectBaseFolder())) {
                return true;
            }
        } catch { /* project folders may not be ready during startup */ }

        return this.getConfiguredExtraFolderPaths().some(folder => this.isPathInside(normalized, folder));
    }

    private isEntityRefreshPath(filePath: string): boolean {
        const normalized = normalizePath(filePath);
        const activeProject = this.sceneManager?.activeProject;
        if (!activeProject || !this.isRelevantStoryLineFile(normalized)) return false;
        if (normalized === normalizePath(activeProject.filePath)) return true;

        const entityFolders = [
            this.sceneManager.getCharacterFolder(),
            this.sceneManager.getLocationFolder(),
            this.sceneManager.getCodexFolder(),
        ].filter((folder): folder is string => Boolean(folder));
        if (entityFolders.some(folder => this.isPathInside(normalized, folder))) return true;

        return this.getConfiguredExtraFolderPaths().some(folder => this.isPathInside(normalized, folder));
    }

    private async updateEntityFiles(filePaths: string[]): Promise<void> {
        const adapter = this.app.vault.adapter;
        for (const filePath of filePaths) {
            const normalized = normalizePath(filePath);
            if (!normalized.endsWith('.md')) continue;

            this.characterManager.removeFile(normalized);
            this.locationManager.removeFile(normalized);
            this.codexManager.removeFile(normalized);

            if (!await adapter.exists(normalized)) continue;
            let content: string;
            try {
                content = await adapter.read(normalized);
            } catch {
                continue;
            }

            const type = this.extractFrontmatterType(content);
            const characterFolder = this.sceneManager.getCharacterFolder();
            const locationFolder = this.sceneManager.getLocationFolder();
            const codexFolder = this.sceneManager.getCodexFolder();
            if (characterFolder && this.isPathInside(normalized, characterFolder)) {
                this.characterManager.updateFile(content, normalized, true);
            } else if (locationFolder && this.isPathInside(normalized, locationFolder)) {
                this.locationManager.updateFile(content, normalized, true);
            } else if (codexFolder && this.isPathInside(normalized, codexFolder)) {
                this.codexManager.updateFile(content, normalized, true);
            } else if (type === 'character') {
                this.characterManager.updateFile(content, normalized);
            } else if (type === 'location' || type === 'world') {
                this.locationManager.updateFile(content, normalized);
            } else if (type) {
                this.codexManager.updateFile(content, normalized);
            }
        }
    }

    /**
     * Update any PlotGrid cell linkedSceneId references when a vault file is renamed.
     * Without this, cells that link to the old path become stale.
     */
    async updatePlotGridLinkedSceneIds(oldPath: string, newPath: string): Promise<void> {
        try {
            const projectKey = this.sceneManager.activeProject?.filePath;
            const projectBase = this.getProjectBaseFolder().replace(/\\/g, '/').replace(/\/$/, '');
            const normalizedOldPath = oldPath.replace(/\\/g, '/');
            if (!projectKey || !normalizedOldPath.startsWith(projectBase + '/')) return;

            const data = await this.loadPlotGrid();
            if (!data?.cells) return;
            if (this.sceneManager.activeProject?.filePath !== projectKey) return;

            let dirty = false;
            for (const key of Object.keys(data.cells)) {
                const cell = data.cells[key];
                if (cell.linkedSceneId === oldPath) {
                    cell.linkedSceneId = newPath;
                    dirty = true;
                }
            }

            if (dirty) {
                await this.savePlotGrid(data, projectKey);
            }
        } catch {
            // non-fatal — PlotGrid may not exist yet
        }
    }
    /**
     * Debounce utility
     */
    private debounce<T extends (...args: unknown[]) => unknown>(
        func: T,
        wait: number
    ): T {
        let timeout: number | null = null;
        return ((...args: unknown[]) => {
            if (timeout) window.clearTimeout(timeout);
            timeout = window.setTimeout(() => func(...args), wait);
        }) as unknown as T;
    }

    // ────────────────────────────────────
    //  Project bootstrap & modals
    // ────────────────────────────────────

    /**
     * Migrate legacy project-specific data from data.json into project frontmatter
     * and System/ files.
     *
     * Handles:
     *  - definedActs, definedChapters, filterPresets → project frontmatter
     *  - JSON files at project root → System/ subfolder
     *  - tagColors, tagTypeOverrides → System/plotlines.json
     *  - characterAliases, ignoredCharacters → System/characters.json
     *  - writingTrackerData → System/stats.json
     *
     * After successful migration the legacy keys are removed from data.json.
     * If a project cannot be discovered, its legacy data is preserved so the
     * next startup can retry — no author data is lost.
     */
    async migrateProjectDataFromSettings(): Promise<void> {
        const rawAny: unknown = await this.loadData();
        if (!rawAny || !isRecord(rawAny)) return;
        const raw = rawAny as Record<string, unknown> & {
            definedActs?: Record<string, unknown>;
            definedChapters?: Record<string, unknown>;
            filterPresets?: unknown[];
            activeProjectFile?: string;
            rows?: unknown[];
            columns?: unknown[];
            cells?: unknown[];
        };

        let dirty = false;
        const adapter = this.app.vault.adapter;
        const projects = this.sceneManager.getProjects();

        // ── Phase 1: legacy frontmatter migrations (definedActs, etc.) ──
        // Only delete legacy entries after successful persistence.
        // Conflicting and deferred entries are preserved so the next startup can retry.
        if (raw.definedActs && typeof raw.definedActs === 'object') {
            const results = migrateProjectField(
                raw.definedActs,
                projects,
                'definedActs',
            );
            // Persist only the projects whose entries were copied.
            // Track which ones actually succeeded.
            const persistedPaths = new Set<string>();
            for (const entry of results) {
                if (entry.outcome === 'copied') {
                    const project = projects.find(p => p.filePath === entry.path);
                    if (project) {
                        try {
                            await this.sceneManager.saveProjectFrontmatter(project);
                            persistedPaths.add(entry.path);
                        } catch {
                            // Persistence failed — do not remove the legacy entry.
                        }
                    }
                }
            }
            // Mark entries whose persistence failed as deferred so they are preserved.
            const adjustedResults = results.map(entry => {
                if (entry.outcome === 'copied' && !persistedPaths.has(entry.path)) {
                    return { path: entry.path, outcome: 'deferred' as const };
                }
                return entry;
            });
            if (removeMigratedEntries(raw, 'definedActs', adjustedResults)) {
                dirty = true;
            }
        }

        if (raw.definedChapters && typeof raw.definedChapters === 'object') {
            const results = migrateProjectField(
                raw.definedChapters,
                projects,
                'definedChapters',
            );
            const persistedPaths = new Set<string>();
            for (const entry of results) {
                if (entry.outcome === 'copied') {
                    const project = projects.find(p => p.filePath === entry.path);
                    if (project) {
                        try {
                            await this.sceneManager.saveProjectFrontmatter(project);
                            persistedPaths.add(entry.path);
                        } catch {
                            // Persistence failed — do not remove the legacy entry.
                        }
                    }
                }
            }
            const adjustedResults = results.map(entry => {
                if (entry.outcome === 'copied' && !persistedPaths.has(entry.path)) {
                    return { path: entry.path, outcome: 'deferred' as const };
                }
                return entry;
            });
            if (removeMigratedEntries(raw, 'definedChapters', adjustedResults)) {
                dirty = true;
            }
        }

        if (migrateFilterPresets(raw, this.sceneManager.activeProject ?? null)) {
            const activeProject = this.sceneManager.activeProject;
            if (activeProject) {
                await this.sceneManager.saveProjectFrontmatter(activeProject);
            }
            dirty = true;
        }

        if (removeObsoleteLegacyKeys(raw)) {
            dirty = true;
        }

        // ── Phase 2: move JSON files from project root → System/ ──
        try {
            await this.migrateJsonFilesToSystem();
        } catch (e) {
            void e;
        }

        // ── Phase 3: migrate per-project data from data.json → System/ files ──
        const phase3Result = await this.migrateSystemFiles(raw);
        if (phase3Result.dirty) {
            dirty = true;
        }
        for (const key of phase3Result.migratedKeys) {
            this._migratedKeys.add(key);
        }

        if (dirty) {
            await this.saveData(raw);
        }
    }

    /**
     * Migrate per-project data from data.json to System/ files.
     * Extracted to reduce nesting depth in migrateProjectDataFromSettings().
     */
    async migrateSystemFiles(raw: Record<string, unknown>): Promise<{
        dirty: boolean;
        migratedKeys: string[];
    }> {
        const migratedKeys: string[] = [];
        const adapter = this.app.vault.adapter;

        let sysFolder: string | null = null;
        const activeProject = this.sceneManager?.activeProject;
        if (activeProject) {
            sysFolder = deriveSystemFolder(activeProject.sceneFolder);
        } else if (typeof raw.activeProjectFile === 'string' && raw.activeProjectFile) {
            sysFolder = deriveSystemFolderFromProjectFile(raw.activeProjectFile);
        }
        if (!sysFolder || !hasProjectDataKeys(raw)) {
            return { dirty: false, migratedKeys };
        }

        try {
            if (!await adapter.exists(sysFolder)) {
                await this.app.vault.createFolder(sysFolder);
            }
        } catch { /* non-critical */ }

        const successful = new Set<string>();
        const files: Array<[string, (e: string | null) => Record<string, unknown> | null]> = [
            ['plotgrid.json', (e) => mergePlotgridData(raw, e)],
            ['plotlines.json', (e) => mergePlotlineData(raw, e, this.settings as unknown as Record<string, unknown>)],
            ['characters.json', (e) => mergeCharacterData(raw, e, this.settings as unknown as Record<string, unknown>)],
            ['stats.json', (e) => mergeStatsData(raw, e)],
            ['custom-sections.json', (e) => mergeCustomSectionsData(raw, e)],
        ];
        for (const [name, mergeFn] of files) {
            if (await this.writeSystemFile(sysFolder, adapter, name, mergeFn)) {
                successful.add(name);
            }
        }

        for (const key of PROJECT_DATA_KEYS) {
            if (key in raw) {
                const target = KEY_TO_SYSTEM_FILE[key];
                if (target && successful.has(target)) {
                    migratedKeys.push(key);
                }
            }
        }
        if (migratedKeys.length > 0) {
            stripSpecificProjectDataKeys(raw, migratedKeys);
        }
        return { dirty: migratedKeys.length > 0, migratedKeys };
    }

    /**
     * Helper: read existing content, merge, and write a System/ JSON file.
     * Returns true if the file was written successfully.
     */
    async writeSystemFile(
        sysFolder: string,
        adapter: typeof this.app.vault.adapter,
        filename: string,
        mergeFn: (existing: string | null) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>,
    ): Promise<boolean> {
        try {
            const path = `${sysFolder}/${filename}`;
            const existing = await adapter.exists(path)
                ? await adapter.read(path)
                : null;
            const merged = await mergeFn(existing);
            if (!merged) return false;
            await adapter.write(path, JSON.stringify(merged, null, 2));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Move legacy JSON files from each project's root folder into its System/ subfolder.
     * Runs once per project; harmless if System/ files already exist.
     */
    private async migrateJsonFilesToSystem(): Promise<void> {
        const adapter = this.app.vault.adapter;
        const jsonFiles = ['plotgrid.json', 'timeline.json', 'board.json', 'plotlines.json', 'stats.json'];

        for (const project of this.sceneManager.getProjects()) {
            const baseFolder = project.sceneFolder
                .replace(/\\/g, '/').replace(/\/Scenes\/?$/, '');
            const sysFolder = `${baseFolder}/System`;

            for (const filename of jsonFiles) {
                const oldPath = `${baseFolder}/${filename}`;
                const newPath = `${sysFolder}/${filename}`;
                await this.migrateOneJsonFile(adapter, filename, oldPath, newPath, sysFolder);
            }
        }
    }

    /** Migrate a single JSON file from project root to System/ folder. */
    private async migrateOneJsonFile(
        adapter: typeof this.app.vault.adapter,
        filename: string,
        oldPath: string,
        newPath: string,
        sysFolder: string,
    ): Promise<void> {
        try {
            if (!await adapter.exists(oldPath)) return;

            const oldContent = await adapter.read(oldPath);
            const oldHasData = this.hasUsableData(filename, oldContent);

            if (await adapter.exists(newPath)) {
                await this.handleExistingDestination(adapter, filename, oldPath, newPath, oldContent, oldHasData);
                return;
            }

            if (!await adapter.exists(sysFolder)) {
                await this.app.vault.createFolder(sysFolder);
            }
            await adapter.write(newPath, oldContent);

            // Verify the write succeeded before deleting the source
            const verifyContent = await adapter.read(newPath);
            if (verifyContent === oldContent) {
                await this.trashFileIfExists(oldPath);
            }
        } catch {
            // Migration failed for this file — continue with remaining files
        }
    }

    /** Handle the case where the destination System file already exists. */
    private async handleExistingDestination(
        adapter: typeof this.app.vault.adapter,
        filename: string,
        oldPath: string,
        newPath: string,
        oldContent: string,
        oldHasData: boolean,
    ): Promise<void> {
        const newContent = await adapter.read(newPath);
        const newHasData = this.hasUsableData(filename, newContent);
        const newIsMalformed = this.isMalformedJson(newContent);

        if (this.contentsEqual(oldContent, newContent)) {
            await this.trashFileIfExists(oldPath);
        } else if (newIsMalformed) {
            // Destination is malformed — do NOT overwrite.
        } else if (!newHasData && oldHasData) {
            await adapter.write(newPath, oldContent);
            const verifyContent = await adapter.read(newPath);
            if (verifyContent === oldContent) {
                await this.trashFileIfExists(oldPath);
            }
        }
    }

    /** Check if content is malformed JSON (nonempty but unparseable). */
    private isMalformedJson(content: string): boolean {
        if (!content || content.trim() === '') return false;
        try {
            JSON.parse(content);
            return false;
        } catch {
            return true;
        }
    }

    /** Check if a JSON file has usable data. */
    private hasUsableData(filename: string, content: string): boolean {
        try {
            const parsed: unknown = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
            const record = parsed as Record<string, unknown>;
            if (filename === 'board.json') {
                const positions = record.corkboardPositions;
                return !!positions && typeof positions === 'object' && Object.keys(positions as object).length > 0;
            }
            return Object.keys(record).length > 0;
        } catch {
            return false;
        }
    }

    /** Compare two JSON files for semantic equality. */
    private contentsEqual(a: string, b: string): boolean {
        try {
            const parsedA = JSON.parse(a);
            const parsedB = JSON.parse(b);
            return JSON.stringify(parsedA) === JSON.stringify(parsedB);
        } catch {
            return a === b;
        }
    }

    /** Trash a file if it exists in the vault. */
    private async trashFileIfExists(path: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) await this.app.fileManager.trashFile(file);
    }

    /**
     * Scan for existing StoryLine projects and restore the active book.
     * Delegates to {@link discoverProjects} for retry logic and mobile handling.
     */
    async bootstrapProjects(): Promise<void> {
        const projects = await discoverProjects({
            sceneManager: this.sceneManager,
            settings: { activeProjectFile: this.settings.activeProjectFile },
            vault: this.app.vault,
            platform: Platform,
            notice: (msg: string, timeout?: number) => new Notice(msg, timeout),
        });

        if (projects.length === 0) {
            if (shouldSuppressNewProjectModal(Platform)) {
                showMobileProjectNotice((msg: string, timeout?: number) => new Notice(msg, timeout));
                return;
            }
            const project = await this.openNewProjectModal();
            if (project) {
                try {
                    await this.activateView(BOARD_VIEW_TYPE);
                } catch { /* non-critical: user can navigate manually */ }
            }
        }
    }

    /** Guard against concurrent New Project modals */
    private _newProjectModalOpen = false;

    /**
     * Open a modal to create a new StoryLine project.
     * Hierarchy-aware: supports creating Books, Series, and Universes.
     * Safe against concurrent invocations — returns null if a modal is already open.
     *
     * @param defaultUniverseId - Pre-select this Universe when creating a Book/Series
     * @param defaultSeriesUuid - Pre-select this Series when creating a Book
     */
    async openNewProjectModal(
        defaultUniverseId?: string,
        defaultSeriesUuid?: string,
    ): Promise<StoryLineProject | null> {
        if (this._newProjectModalOpen) {
            return null;
        }
        this._newProjectModalOpen = true;
        try {
            const modal = new CreateProjectModal(this.app, {
                app: this.app,
                createUniverse: (name: string) => this.universeManager.createUniverse(name),
                createSeries: (name: string, basePath?: string) => this.seriesManager.createSeries(name, basePath),
                addSeriesToUniverse: (universeId: string, seriesFolder: string) =>
                    this.universeManager.addSeriesToUniverse(universeId, seriesFolder),
                getSeriesByUuid: (uuid: string) => this.seriesManager.getSeriesByUuid(uuid),
                discoverSeries: () => this.seriesManager.discoverSeries(),
                discoverHierarchy: () => this.universeManager.discoverHierarchy(),
                getAllUniverses: () => this.universeManager.getAllUniverses(),
                createProject: (title: string, desc: string, customBasePath?: string) =>
                    this.sceneManager.createProject(title, desc, customBasePath),
                addBookToSeries: (uuid: string, project: StoryLineProject) =>
                    this.seriesManager.addBookToSeries(uuid, project),
                saveProjectFrontmatter: (project: StoryLineProject) =>
                    this.sceneManager.saveProjectFrontmatter(project),
                setActiveProject: (project: StoryLineProject) => this.sceneManager.setActiveProject(project),
                refreshOpenViews: () => this.refreshOpenViews(),
                openNavigator: () => this.openNavigator(),
                activateView: (viewType: string) => this.activateView(viewType),
                autoOpenNavigator: this.settings.autoOpenNavigator,
                storyLineRoot: this.settings.storyLineRoot,
            }, defaultUniverseId, defaultSeriesUuid);
            return await modal.openAndWait();
        } finally {
            this._newProjectModalOpen = false;
        }
    }

    /**
     * Open a modal to fork the active project into a variant
     */
    openForkProjectModal(): void {
        const activeProject = this.sceneManager.activeProject;
        if (!activeProject) {
            new Notice('No active project to fork');
            return;
        }
        const modal = new Modal(this.app);
        modal.titleEl.setText(`Fork "${activeProject.title}"`);
        let newTitle = `${activeProject.title} - Variant`;

        new Setting(modal.contentEl)
            .setName('New project name')
            .setDesc('All scenes from the current project will be copied.')
            .addText((text: TextComponent) => {
                text.setValue(newTitle);
                text.onChange((v: string) => (newTitle = v));
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Fork').setCta().onClick(async () => {
                    if (!newTitle.trim()) return;
                    const forked = await this.sceneManager.forkProject(activeProject, newTitle.trim());
                    await this.sceneManager.setActiveProject(forked);
                    this.refreshOpenViews();
                    if (this.settings.autoOpenNavigator) this.openNavigator();
                    try { await this.activateView(BOARD_VIEW_TYPE); } catch { /* non-critical */ }
                    modal.close();
                });
            });
        modal.open();
    }

    /**
     * Open a confirmation modal to delete the active project.
     *
     * The project folder (and everything inside — scenes, codex, notes,
     * system data) is moved to the system trash / `.trash` according to
     * the user's "Deleted files" setting. If the project belongs to a
     * series it is also removed from `series.json`.
     */
    openDeleteProjectModal(): void {
        const activeProject = this.sceneManager.activeProject;
        if (!activeProject) {
            new Notice('No active project to delete');
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText(`Delete "${activeProject.title}"`);

        // Warning banner
        const warningEl = modal.contentEl.createDiv({ cls: 'sl-delete-warning' });
        warningEl.createEl('p', {
            text: '⚠️ this will permanently delete the project folder and everything inside it:',
        });
        const list = warningEl.createEl('ul');
        list.createEl('li', { text: 'All scenes' });
        list.createEl('li', { text: 'All characters, locations and codex entries' });
        list.createEl('li', { text: 'All notes, research and archive items' });
        list.createEl('li', { text: 'Project settings and view data' });
        if (activeProject.seriesId || activeProject.seriesUuid) {
            list.createEl('li', { text: 'The book will also be removed from its series.' });
        }
        warningEl.createEl('p', {
            text: 'This action cannot be undone. The folder will be moved to your system trash (or Obsidian\u2019s .trash folder, depending on your settings).',
            cls: 'sl-delete-warning-strong',
        });

        // Type-to-confirm: user must type the project title to enable Delete.
        const expected = activeProject.title;
        let typed = '';
        new Setting(modal.contentEl)
            .setName('Confirm by typing the project title')
            .setDesc(`Type "${expected}" to enable the Delete button.`)
            .addText((text: TextComponent) => {
                text.setPlaceholder(expected);
                text.onChange((v: string) => {
                    typed = v;
                    deleteBtn.setDisabled(v.trim() !== expected);
                });
                window.setTimeout(() => text.inputEl.focus(), 50);
            });

        let deleteBtn: ButtonComponent;
        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Cancel').onClick(() => modal.close());
            })
            .addButton((btn: ButtonComponent) => {
                deleteBtn = btn.setButtonText('Delete permanently').setClass('mod-warning').setDisabled(true);
                btn.onClick(async () => {
                    if (typed.trim() !== expected) return;
                    modal.close();
                    try {
                        const ok = await this.sceneManager.deleteProject(activeProject);
                        if (ok) {
                            this.refreshOpenViews();
                        }
                    } catch (e: unknown) {
                        new Notice('Failed to delete project: ' + (e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });
        modal.open();
    }

    // ────────────────────────────────────
    //  Series modals
    // ────────────────────────────────────

    openCreateSeriesModal(): void {
        const project = this.sceneManager.activeProject;
        if (!project) {
            new Notice('No active project');
            return;
        }
        if (project.seriesId || project.seriesUuid) {
            new Notice('This project is already part of a series.');
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText('Create new series');
        let seriesName = '';

        new Setting(modal.contentEl)
            .setName('Series name')
            .setDesc(`"${project.title}" will become the first book in this series. Its codex will be shared.`)
            .addText((text: TextComponent) => {
                text.setPlaceholder('My trilogy');
                text.onChange((v: string) => (seriesName = v));
                window.setTimeout(() => text.inputEl.focus(), 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Create series').setCta().onClick(async () => {
                    if (!seriesName.trim()) {
                        new Notice('Please enter a series name.');
                        return;
                    }
                    modal.close();
                    try {
                        await this.seriesManager.createSeriesFromProject(seriesName.trim());
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    async openAddToSeriesModal(): Promise<void> {
        const project = this.sceneManager.activeProject;
        if (!project) {
            new Notice('No active project');
            return;
        }
        if (project.seriesId || project.seriesUuid) {
            new Notice('This project is already part of a series.');
            return;
        }

        const seriesList = await this.seriesManager.discoverSeries();
        if (seriesList.length === 0) {
            new Notice('No series found. Create one first using "create new series from current project".');
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText('Add to existing series');
        let selectedFolder = seriesList[0].folder;

        new Setting(modal.contentEl)
            .setName('Series')
            .setDesc(`"${project.title}" will be added to the selected series. Its codex will be merged into the shared series codex.`)
            .addDropdown((dropdown: DropdownComponent) => {
                for (const s of seriesList) {
                    dropdown.addOption(s.folder, `${s.meta.name} (${s.meta.bookOrder.length} books)`);
                }
                dropdown.onChange((v: string) => (selectedFolder = v));
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Add to series').setCta().onClick(async () => {
                    modal.close();
                    try {
                        await this.seriesManager.addProjectToSeries(selectedFolder);
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    openRenameProjectModal(): void {
        const project = this.sceneManager.activeProject;
        if (!project) {
            new Notice('No active project to rename.');
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText('Rename project');
        let newTitle = project.title;

        new Setting(modal.contentEl)
            .setName('New title')
            .setDesc('The project file and folder will be renamed. All links are updated automatically.')
            .addText((text: TextComponent) => {
                text.setValue(project.title);
                text.onChange((v: string) => (newTitle = v));
                window.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Rename').setCta().onClick(async () => {
                    if (!newTitle.trim() || newTitle.trim() === project.title) {
                        modal.close();
                        return;
                    }
                    try {
                        this.seriesManager.checkLinkSettings();
                        await this.sceneManager.renameProject(project, newTitle.trim());
                        new Notice(`Project renamed to "${newTitle.trim()}"`);
                        modal.close();
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    // ── Universe modals ──────────────────────────────

    async openCreateUniverseModal(): Promise<void> {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Create new universe');
        let universeName = '';

        new Setting(modal.contentEl)
            .setName('Universe name')
            .setDesc('A universe groups multiple series. Existing series can be added later.')
            .addText((text: TextComponent) => {
                text.setPlaceholder('My universe')
                    .onChange((v: string) => (universeName = v));
                window.setTimeout(() => { text.inputEl.focus(); }, 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Create').setCta().onClick(async () => {
                    if (!universeName.trim()) {
                        new Notice('Please enter a universe name.');
                        return;
                    }
                    try {
                        await this.universeManager.createUniverse(universeName.trim());
                        modal.close();
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    async openAddSeriesToUniverseModal(): Promise<void> {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Add series to universe');

        const universes = await this.universeManager.getAllUniverses();
        if (universes.length === 0) {
            new Notice('No universes found. Create one first.');
            return;
        }

        const seriesList = await this.seriesManager.discoverSeries();
        if (seriesList.length === 0) {
            new Notice('No series found. Create one first.');
            return;
        }

        let selectedUniverse = universes[0].id;
        let selectedSeries = seriesList[0].folder;

        new Setting(modal.contentEl)
            .setName('Universe')
            .addDropdown((drop: DropdownComponent) => {
                for (const u of universes) {
                    drop.addOption(u.id, u.name);
                }
                drop.setValue(selectedUniverse)
                    .onChange((v: string) => (selectedUniverse = v));
            });

        new Setting(modal.contentEl)
            .setName('Series')
            .addDropdown((drop: DropdownComponent) => {
                for (const { folder, meta } of seriesList) {
                    drop.addOption(folder, meta.name);
                }
                drop.setValue(selectedSeries)
                    .onChange((v: string) => (selectedSeries = v));
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Add').setCta().onClick(async () => {
                    try {
                        await this.universeManager.addSeriesToUniverse(selectedUniverse, selectedSeries);
                        modal.close();
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    async openRemoveSeriesFromUniverseModal(): Promise<void> {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Remove series from universe');

        const universes = await this.universeManager.getAllUniverses();
        if (universes.length === 0) {
            new Notice('No universes found.');
            return;
        }

        // Map series UUIDs to names
        const seriesList = await this.seriesManager.discoverSeries();
        const seriesNameMap = new Map<string, string>();
        for (const { meta } of seriesList) {
            if (meta.seriesUuid) {
                seriesNameMap.set(meta.seriesUuid, meta.name);
            }
        }

        let selectedUniverse = universes[0].id;
        let selectedSeries: string | null = null;

        // Build series dropdown reference so we can refresh it
        let seriesDrop: DropdownComponent | null = null;

        const refreshSeriesDropdown = async (universeId: string) => {
            const seriesIds = await this.universeManager.getSeriesForUniverse(universeId);
            if (!seriesDrop) return;
            seriesDrop.selectEl.empty();
            if (seriesIds.length === 0) {
                seriesDrop.addOption('', '(no series)');
                selectedSeries = null;
                return;
            }
            for (const sid of seriesIds) {
                const name = seriesNameMap.get(sid) || sid.substring(0, 8) + '...';
                seriesDrop.addOption(sid, name);
            }
            selectedSeries = seriesIds[0];
            seriesDrop.setValue(selectedSeries);
        };

        new Setting(modal.contentEl)
            .setName('Universe')
            .addDropdown((drop: DropdownComponent) => {
                for (const u of universes) {
                    drop.addOption(u.id, u.name);
                }
                drop.setValue(selectedUniverse)
                    .onChange(async (v: string) => {
                        selectedUniverse = v;
                        await refreshSeriesDropdown(v);
                    });
            });

        new Setting(modal.contentEl)
            .setName('Series to remove')
            .addDropdown((drop: DropdownComponent) => {
                seriesDrop = drop;
                drop.onChange((v: string) => (selectedSeries = v || null));
            });

        // Initial series population
        await refreshSeriesDropdown(selectedUniverse);

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Remove').setCta().onClick(async () => {
                    if (!selectedSeries) {
                        new Notice('No series selected.');
                        return;
                    }
                    try {
                        await this.universeManager.removeSeriesFromUniverse(selectedUniverse, selectedSeries);
                        modal.close();
                        this.refreshOpenViews();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    async openDeleteUniverseModal(): Promise<void> {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Delete universe');

        const universes = await this.universeManager.getAllUniverses();
        if (universes.length === 0) {
            new Notice('No universes found.');
            return;
        }

        let selectedUniverse = universes[0].id;

        new Setting(modal.contentEl)
            .setName('Universe to delete')
            .setDesc('This removes universe.json and shared Codex. Series and books are preserved as standalone.')
            .addDropdown((drop: DropdownComponent) => {
                for (const u of universes) {
                    drop.addOption(u.id, u.name);
                }
                drop.setValue(selectedUniverse);
                drop.onChange((v: string) => (selectedUniverse = v));
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Delete').setCta().setWarning()
                    .onClick(async () => {
                        try {
                            await this.universeManager.deleteUniverse(selectedUniverse);
                            modal.close();
                            this.refreshOpenViews();
                        } catch (e: unknown) {
                            new Notice((e instanceof Error ? e.message : String(e)), 10000);
                        }
                    });
            });

        modal.open();
    }

    openSeriesManagementModal(): void {
        const modal = new SeriesManagementModal(this.app, this);
        modal.open();
    }

    // ── Event modals ──────────────────────────────────

    async openCreateEventModal(eventsFolder?: string, prefillTimestamp?: import('./models/TimeSpan').Timestamp): Promise<void> {
        const { EventModal } = await import('./components/EventModal');
        const project = this.sceneManager.activeProject;
        if (!project) return;

        // If no folder specified, default to book-level
        let folder: string | undefined = eventsFolder;
        if (!folder) {
            const bookFolder = this.sceneManager.getBookEventsFolder();
            if (!bookFolder) {
                new Notice('No events folder found for the active project.');
                return;
            }
            folder = bookFolder;
        }

        const modal = new EventModal(
            this.app,
            this,
            this.eventManager,
            this.timeSpanService,
            folder,
            undefined, // no existing event
            prefillTimestamp
        );
        const result = await modal.openAsync();
        if (result) {
            new Notice(`Event "${result.name}" created`);
            await this.loadActiveProjectEvents();
        }
    }

    async openEditEventModal(event: import('./models/Event').Event): Promise<void> {
        const { EventModal } = await import('./components/EventModal');
        const modal = new EventModal(
            this.app,
            this,
            this.eventManager,
            this.timeSpanService,
            '', // folder not needed for edit
            event
        );
        const result = await modal.openAsync();
        if (result) {
            new Notice(`Event "${result.name}" updated`);
            await this.loadActiveProjectEvents();
        }
    }

    async openEventBrowser(): Promise<void> {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Events');

        const events = this.eventManager.getAllEvents();

        // Create Event button with scope selection
        const actionsBar = modal.contentEl.createDiv('event-browser-actions');
        const createBtn = actionsBar.createEl('button', { cls: 'mod-cta', text: '+ New Event' });

        // Dropdown for scope selection
        const scopeSelect = actionsBar.createEl('select', {
            attr: { title: 'Where to create the event' },
        });
        scopeSelect.setCssStyles({
            marginLeft: '8px',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            border: '1px solid var(--background-modifier-border)',
            background: 'var(--background-secondary)',
            color: 'var(--text-normal)',
        });

        const project = this.sceneManager.activeProject;
        const bookFolder = this.sceneManager.getBookEventsFolder();

        // Book scope (always available)
        const bookOpt = scopeSelect.createEl('option', {
            text: 'Book',
            value: bookFolder || '',
        });
        if (bookFolder) bookOpt.selected = true;

        // Series scope
        if (project?.seriesUuid) {
            const seriesFolder = this.sceneManager.getSeriesFolder();
            if (seriesFolder) {
                const seriesMeta = await this.seriesManager.loadSeriesMetadata(seriesFolder);
                if (seriesMeta) {
                    const seriesEventsFolder = `${seriesFolder}/Events`;
                    scopeSelect.createEl('option', {
                        text: `Series (${project.seriesId || 'Series'})`,
                        value: seriesEventsFolder,
                    });
                }
            }
        }

        // Universe scope
        if (project?.universeId) {
            const hierarchy = await this.universeManager.resolveHierarchyPath(project);
            if (hierarchy.universe && hierarchy.series) {
                // Derive universe folder from series folder (parent directory)
                const seriesFolder = this.sceneManager.getSeriesFolder();
                if (seriesFolder) {
                    const universeFolder = seriesFolder.substring(0, seriesFolder.lastIndexOf('/'));
                    const universeEventsFolder = `${universeFolder}/Events`;
                    scopeSelect.createEl('option', {
                        text: `Universe (${hierarchy.universe.name})`,
                        value: universeEventsFolder,
                    });
                }
            }
        }

        createBtn.addEventListener('click', async () => {
            const folder = scopeSelect.value;
            if (!folder) {
                new Notice('No events folder available.');
                return;
            }
            modal.close();
            await this.openCreateEventModal(folder);
        });

        if (events.length === 0) {
            modal.contentEl.createEl('p', {
                text: 'No events yet. Create your first event to track canonical occurrences in your universe.',
                cls: 'event-browser-empty',
            }).setCssStyles({ padding: '12px', opacity: '0.7' });
        } else {
            const list = modal.contentEl.createDiv('event-browser-list');

            for (const event of events) {
                const row = list.createDiv('event-browser-row');
                const nameEl = row.createEl('strong', { text: event.name });
                if (event.timeSpan) {
                    nameEl.appendText(` — ${this.timeSpanService.format(event.timeSpan)}`);
                }
                if (event.description) {
                    const desc = row.createDiv('event-browser-desc');
                    const preview = event.description.length > 100
                        ? event.description.substring(0, 100) + '...'
                        : event.description;
                    desc.setText(preview);
                }

                // Determine ownership scope
                const scope = this.getEventScope(event);
                if (scope) {
                    const badge = row.createSpan('event-scope-badge');
                    badge.setText(scope);
                }

                row.onClickEvent(async () => {
                    modal.close();
                    await this.openEditEventModal(event);
                    // Refresh the browser if reopened
                });
            }
        }

        modal.open();
    }

    /** Determine the scope (Book/Series/Universe) of an event for display. */
    private getEventScope(event: import('./models/Event').Event): string | undefined {
        const project = this.sceneManager.activeProject;
        if (!project) return undefined;

        const bookEventsFolder = this.sceneManager.getBookEventsFolder();
        if (bookEventsFolder && event.filePath.startsWith(bookEventsFolder + '/')) {
            return 'Book';
        }

        // Check series/universe scope via owner ID
        if (event.ownerId) {
            if (event.ownerId === project.seriesUuid) return 'Series';
            if (event.ownerId === project.universeId) return 'Universe';
        }

        return undefined;
    }
}

/**
 * Modal to choose or create a StoryLine project from the StoryLine ribbon.
 */
class ProjectSelectModal extends Modal {
    plugin: SceneCardsPlugin;
    constructor(app: App, plugin: SceneCardsPlugin) {
        super(app);
        this.plugin = plugin;
        this.titleEl.setText('Open StoryLine project');
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        const info = contentEl.createDiv({ cls: 'project-select-info' });
        info.createEl('p', { text: 'Select a project to load, or create a new one.' });

        const list = contentEl.createDiv({ cls: 'project-list' });

        // Create a select dropdown and actions
        const select = list.createEl('select', { cls: 'project-select-dropdown' });
        select.addEventListener('keydown', (e: KeyboardEvent) => e.stopPropagation());

        const actions = contentEl.createDiv({ cls: 'project-actions' });
        const openBtn = actions.createEl('button', { text: 'Open', cls: 'mod-cta' });
        openBtn.setAttr('type', 'button');
        openBtn.addEventListener('click', async () => {
            const val = select.value;
            const projects = this.plugin.sceneManager.getProjects();
            const selected = projects.find((p: StoryLineProject) => p.filePath === val);
            if (!selected) {
                new Notice('No project selected');
                return;
            }
            try {
                await this.plugin.sceneManager.setActiveProject(selected);
                this.plugin.refreshOpenViews();
                if (this.plugin.settings.autoOpenNavigator) this.plugin.openNavigator();
                try { await this.plugin.activateView(BOARD_VIEW_TYPE); } catch { /* non-critical */ }
                this.close();
            } catch (err) {
                new Notice('Failed to open project: ' + String(err));
            }
        });

        const createBtn = actions.createEl('button', { text: 'Create new project', cls: 'mod-cta' });
        createBtn.setAttr('type', 'button');
        createBtn.addEventListener('click', async () => {
            // open project creation modal and refresh list if a new project was created
            const created = await this.plugin.openNewProjectModal();
            if (created) {
                this.close();
                return;
            }
            try {
                await this.plugin.sceneManager.scanProjects();
                const projects = this.plugin.sceneManager.getProjects();
                // repopulate select
                select.empty();
                for (const p of projects) {
                    const rootPath = this.plugin.settings.storyLineRoot;
                    const isCustom = !p.filePath.startsWith(rootPath + '/');
                    const parentDir = p.filePath.substring(0, p.filePath.lastIndexOf('/'));
                    const label = isCustom ? `${p.title}  (${parentDir})` : p.title;
                    const opt = select.createEl('option', { text: label });
                    opt.setAttr('value', p.filePath);
                }
                if (projects.length > 0) select.value = projects[0].filePath;
            } catch (err) {
                new Notice('Failed to refresh projects: ' + String(err));
            }
        });

        const cancel = actions.createEl('button', { text: 'Cancel', cls: 'mod-quiet' });
        cancel.setAttr('type', 'button');
        cancel.addEventListener('click', () => this.close());

        const seriesBtn = actions.createEl('button', { text: 'Manage series…' });
        seriesBtn.setAttr('type', 'button');
        seriesBtn.addEventListener('click', async () => {
            const seriesModal = new SeriesManagementModal(this.app, this.plugin);
            seriesModal.open();
        });

        // "Browse" button — manually pick a .md file as a StoryLine project
        const browseBtn = actions.createEl('button', { text: 'Browse for project…' });
        browseBtn.setAttr('type', 'button');
        browseBtn.addEventListener('click', async () => {
            // Build a list of all .md files in the vault for the user to pick from
            const browseModal = new Modal(this.app);
            browseModal.titleEl.setText('Select a StoryLine project file');
            const container = browseModal.contentEl.createDiv({ cls: 'project-browse-list' });
            const fileList = container.createDiv();
            fileList.setCssStyles({
                maxHeight: '300px',
                overflowY: 'auto',
            });
            fileList.createDiv({ text: 'Scanning…' });

            // Scan StoryLine root and one level deep, filtering to only
            // files with type: storyline frontmatter (actual project files).
            const rootPath = this.plugin.settings.storyLineRoot.replace(/\\/g, '/');
            const projectFiles: { path: string; title: string }[] = [];
            try {
                const adapter = this.app.vault.adapter;

                const checkFile = async (filePath: string) => {
                    if (!filePath.endsWith('.md')) return;
                    try {
                        const content = await adapter.read(filePath);
                        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                        if (!fmMatch) return;
                        if (!/^type:\s*storyline/m.test(fmMatch[1])) return;
                        // Extract title from frontmatter
                        const titleMatch = fmMatch[1].match(/^title:\s*(.+)/m);
                        const title = titleMatch ? titleMatch[1].trim() : filePath.split('/').pop()?.replace(/\.md$/i, '') ?? filePath;
                        projectFiles.push({ path: filePath, title });
                    } catch { /* unreadable */ }
                };

                // Recursively scan all subfolders for project .md files
                const scanFolder = async (folderPath: string) => {
                    try {
                        const listing = await adapter.list(folderPath);
                        for (const f of listing.files) {
                            await checkFile(f);
                        }
                        for (const sub of listing.folders) {
                            // Skip System, Scenes, Characters, Locations folders
                            const folderName = sub.split('/').pop() ?? '';
                            if (['System', 'Scenes', 'Characters', 'Locations'].includes(folderName)) continue;
                            await scanFolder(sub);
                        }
                    } catch { /* skip unreadable */ }
                };
                await scanFolder(rootPath);
            } catch { /* root folder may not exist */ }
            projectFiles.sort((a, b) => a.title.localeCompare(b.title));

            // Render the project list
            fileList.empty();
            if (projectFiles.length === 0) {
                fileList.createDiv({ text: 'No StoryLine projects found.' });
            }
            for (const pf of projectFiles) {
                const row = fileList.createDiv({ cls: 'project-browse-row' });
                row.setCssStyles({
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                });
                row.textContent = `${pf.title}  (${pf.path})`;
                row.addEventListener('mouseenter', () => { row.setCssStyles({ background: 'var(--background-modifier-hover)' }); });
                row.addEventListener('mouseleave', () => { row.setCssStyles({ background: '' }); });
                row.addEventListener('click', async () => {
                    try {
                        const adapter = this.app.vault.adapter;
                        const content = await adapter.read(pf.path);
                        // Re-scan and try to find / adopt this project
                        await this.plugin.sceneManager.scanProjects();
                        let project = this.plugin.sceneManager.getProjects().find((p: StoryLineProject) => p.filePath === pf.path);
                        if (!project) {
                            const sm = this.plugin.sceneManager as unknown as {
                                parseProjectContent: (content: string, path: string) => StoryLineProject | null;
                                projects: Map<string, StoryLineProject>;
                            };
                            const parsed = sm.parseProjectContent(content, pf.path);
                            if (parsed) {
                                sm.projects.set(pf.path, parsed);
                                project = parsed;
                            }
                        }
                        if (project) {
                            await this.plugin.sceneManager.setActiveProject(project);
                            this.plugin.refreshOpenViews();
                            if (this.plugin.settings.autoOpenNavigator) this.plugin.openNavigator();
                            try { await this.plugin.activateView(BOARD_VIEW_TYPE); } catch { /* */ }
                            browseModal.close();
                            this.close();
                        } else {
                            new Notice('Could not parse file as a StoryLine project');
                        }
                    } catch (err) {
                        new Notice('Failed to open project: ' + String(err));
                    }
                });
            }

            browseModal.open();
        });

        // initial population
        (async () => {
            try {
                await this.plugin.sceneManager.scanProjects();
                const projects = this.plugin.sceneManager.getProjects();
                if (projects.length === 0) {
                    select.createEl('option', { text: 'No projects found' }).setAttribute('disabled', 'true');
                }
                for (const p of projects) {
                    const rootPath = this.plugin.settings.storyLineRoot;
                    const isCustom = !p.filePath.startsWith(rootPath + '/');
                    const parentDir = p.filePath.substring(0, p.filePath.lastIndexOf('/'));
                    const label = isCustom ? `${p.title}  (${parentDir})` : p.title;
                    const opt = select.createEl('option', { text: label });
                    opt.setAttr('value', p.filePath);
                }
                if (projects.length > 0) {
                    const active = this.plugin.sceneManager.activeProject;
                    select.value = (active && projects.some((p: StoryLineProject) => p.filePath === active.filePath))
                        ? active.filePath
                        : projects[0].filePath;
                }
            } catch {
                select.createEl('option', { text: 'Error loading projects' }).setAttribute('disabled', 'true');
            }
        })();
    }
}

/**
 * Modal for managing series — view, rename, reorder books, add/remove books.
 */
class SeriesManagementModal extends Modal {
    plugin: SceneCardsPlugin;

    constructor(app: App, plugin: SceneCardsPlugin) {
        super(app);
        this.plugin = plugin;
        this.titleEl.setText('Manage series');
    }

    onOpen() {
        this.render();
    }

    private async render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('sl-series-modal');

        const seriesList = await this.plugin.seriesManager.discoverSeries();

        if (seriesList.length === 0) {
            contentEl.createEl('p', {
                text: 'No series found. Create a series from the new project modal or use the command palette.',
                cls: 'sl-series-empty',
            });
            return;
        }

        for (const { folder, meta } of seriesList) {
            const card = contentEl.createDiv({ cls: 'sl-series-card' });

            // ── Header row: series name + rename button ──
            const header = card.createDiv({ cls: 'sl-series-header' });
            header.createSpan({
                cls: 'sl-series-folder-hint',
                text: folder.split('/').pop() ?? folder,
            });

            const renameBtn = header.createEl('button', { cls: 'clickable-icon sl-series-action', attr: { 'aria-label': 'Rename series' } });
            setIcon(renameBtn, 'pencil');
            renameBtn.addEventListener('click', () => this.renameSeries(folder, meta));

            // ── Book list ──
            const bookList = card.createDiv({ cls: 'sl-series-book-list' });

            for (let i = 0; i < meta.bookOrder.length; i++) {
                const bookName = meta.bookOrder[i];
                const row = bookList.createDiv({ cls: 'sl-series-book-row' });


                const bookProject = this.plugin.sceneManager.getProjects().find(p => {
                    const fp = normalizePath(p.filePath);
                    return fp.startsWith(normalizePath(folder) + '/')
                        && (p.title === bookName || fp.split('/').slice(-2, -1)[0] === bookName);
                });
                row.createSpan({ cls: 'sl-series-book-name', text: bookProject?.title ?? bookName });

                const bookActions = row.createDiv({ cls: 'sl-series-book-actions' });

                // Rename book
                const renameBookBtn = bookActions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Rename book' } });
                setIcon(renameBookBtn, 'pencil');
                renameBookBtn.addEventListener('click', () => this.renameBook(folder, meta, bookName));

                // Move up
                if (i > 0) {
                    const upBtn = bookActions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Move up' } });
                    setIcon(upBtn, 'chevron-up');
                    upBtn.addEventListener('click', () => this.reorderBook(folder, meta, i, i - 1));
                }

                // Move down
                if (i < meta.bookOrder.length - 1) {
                    const downBtn = bookActions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Move down' } });
                    setIcon(downBtn, 'chevron-down');
                    downBtn.addEventListener('click', () => this.reorderBook(folder, meta, i, i + 1));
                }

                // Remove from series
                const removeBtn = bookActions.createEl('button', { cls: 'clickable-icon sl-series-remove', attr: { 'aria-label': 'Remove from series' } });
                setIcon(removeBtn, 'x');
                removeBtn.addEventListener('click', () => this.removeBook(folder, meta, bookName));

                // Delete book permanently
                const deleteBookBtn = bookActions.createEl('button', { cls: 'clickable-icon sl-series-delete', attr: { 'aria-label': 'Delete book permanently' } });
                setIcon(deleteBookBtn, 'trash');
                deleteBookBtn.addEventListener('click', () => this.deleteBook(folder, meta, bookName));
            }

            // ── Add book button ──
            const addRow = card.createDiv({ cls: 'sl-series-add-row' });
            const addBtn = addRow.createEl('button', { text: 'Add book to this series', cls: 'sl-series-add-btn' });
            setIcon(addBtn.createSpan({ prepend: true }), 'plus');
            addBtn.addEventListener('click', () => this.addBookToSeries(folder, meta));
        }
    }

    private async renameSeries(folder: string, meta: SeriesMetadata) {
        const modal = new Modal(this.app);
        modal.titleEl.setText('Rename series');
        let newName = meta.name;

        new Setting(modal.contentEl)
            .setName('Series name')
            .setDesc('Updates the series display name in series.json only. The folder identity stays unchanged.')
            .addText((text: TextComponent) => {
                text.setValue(meta.name);
                text.onChange((v: string) => (newName = v));
                window.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Rename').setCta().onClick(async () => {
                    if (!newName.trim() || newName.trim() === meta.name) {
                        modal.close();
                        return;
                    }
                    try {
                        await this.plugin.seriesManager.renameSeriesName(folder, newName.trim());

                        new Notice(`Series renamed to "${newName.trim()}"`);
                        modal.close();
                        this.plugin.refreshOpenViews();
                        this.render();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    private async reorderBook(folder: string, meta: SeriesMetadata, fromIndex: number, toIndex: number) {
        const [book] = meta.bookOrder.splice(fromIndex, 1);
        meta.bookOrder.splice(toIndex, 0, book);
        await this.plugin.seriesManager.saveSeriesMetadata(folder, meta);
        this.render();
    }

    private async removeBook(folder: string, meta: SeriesMetadata, bookName: string) {
        // Find the project for this book and activate it so removeProjectFromSeries works
        const projects = this.plugin.sceneManager.getProjects();
        const bookProject = projects.find(p => {
            const fp = normalizePath(p.filePath);
            return fp.startsWith(normalizePath(folder) + '/')
                && (p.title === bookName || fp.split('/').slice(-2, -1)[0] === bookName);
        });

        if (!bookProject) {
            new Notice(`Could not find project "${bookName}" — it may have been moved or deleted.`);
            return;
        }

        // Confirm
        const confirm = await new Promise<boolean>((resolve) => {
            const m = new Modal(this.app);
            m.titleEl.setText('Remove from series');
            m.contentEl.createEl('p', {
                text: `Remove "${bookName}" from "${meta.name}"? The shared codex will be copied into the book's local folder.`,
            });
            new Setting(m.contentEl)
                .addButton((btn: ButtonComponent) => btn.setButtonText('Remove').setClass('mod-warning').onClick(() => { m.close(); resolve(true); }))
                .addButton((btn: ButtonComponent) => btn.setButtonText('Cancel').onClick(() => { m.close(); resolve(false); }));
            m.open();
        });
        if (!confirm) return;

        const previousActive = this.plugin.sceneManager.activeProject;
        await this.plugin.sceneManager.setActiveProject(bookProject);
        try {
            await this.plugin.seriesManager.removeProjectFromSeries();
        } catch (e: unknown) {
            new Notice((e instanceof Error ? e.message : String(e)), 10000);
        }
        // Restore previous active project if it wasn't the removed one
        if (previousActive && previousActive.filePath !== bookProject.filePath) {
            const refreshed = this.plugin.sceneManager.getProjects().find(p => p.filePath === previousActive.filePath);
            if (refreshed) await this.plugin.sceneManager.setActiveProject(refreshed);
        }
        this.plugin.refreshOpenViews();
        this.render();
    }

    /**
     * Permanently delete a book from a series.
     *
     * Shows a type-to-confirm warning modal, then trashes the book's folder
     * (scenes, codex, notes, etc.) and removes it from `series.json`.
     */
    private async deleteBook(folder: string, meta: SeriesMetadata, bookName: string) {
        const projects = this.plugin.sceneManager.getProjects();
        const bookProject = projects.find(p => {
            const fp = normalizePath(p.filePath);
            return fp.startsWith(normalizePath(folder) + '/')
                && (p.title === bookName || fp.split('/').slice(-2, -1)[0] === bookName);
        });

        if (!bookProject) {
            new Notice(`Could not find project "${bookName}" — it may have been moved or deleted.`);
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText(`Delete "${bookName}"`);

        const warningEl = modal.contentEl.createDiv({ cls: 'sl-delete-warning' });
        warningEl.createEl('p', {
            text: `\u26a0\ufe0f This will permanently delete "${bookName}" and everything inside it:`,
        });
        const list = warningEl.createEl('ul');
        list.createEl('li', { text: 'All scenes' });
        list.createEl('li', { text: 'All characters, locations and codex entries' });
        list.createEl('li', { text: 'All notes, research and archive items' });
        list.createEl('li', { text: 'The book will be removed from the series "' + meta.name + '".' });
        warningEl.createEl('p', {
            text: 'This action cannot be undone. The folder will be moved to your system trash (or Obsidian\u2019s .trash folder, depending on your settings).',
            cls: 'sl-delete-warning-strong',
        });

        const expected = bookName;
        let typed = '';
        let deleteBtn: ButtonComponent;
        new Setting(modal.contentEl)
            .setName('Confirm by typing the book title')
            .setDesc(`Type "${expected}" to enable the Delete button.`)
            .addText((text: TextComponent) => {
                text.setPlaceholder(expected);
                text.onChange((v: string) => {
                    typed = v;
                    deleteBtn.setDisabled(v.trim() !== expected);
                });
                window.setTimeout(() => text.inputEl.focus(), 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Cancel').onClick(() => modal.close());
            })
            .addButton((btn: ButtonComponent) => {
                deleteBtn = btn.setButtonText('Delete permanently').setClass('mod-warning').setDisabled(true);
                btn.onClick(async () => {
                    if (typed.trim() !== expected) return;
                    modal.close();
                    try {
                        const ok = await this.plugin.sceneManager.deleteProject(bookProject);
                        if (ok) {
                            this.plugin.refreshOpenViews();
                            this.render();
                        }
                    } catch (e: unknown) {
                        new Notice('Failed to delete book: ' + (e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });
        modal.open();
    }

    private async renameBook(folder: string, _meta: SeriesMetadata, bookName: string) {
        const projects = this.plugin.sceneManager.getProjects();
        const bookProject = projects.find(p => {
            const fp = normalizePath(p.filePath);
            return fp.startsWith(normalizePath(folder) + '/')
                && (p.title === bookName || fp.split('/').slice(-2, -1)[0] === bookName);
        });

        if (!bookProject) {
            new Notice(`Could not find project "${bookName}".`);
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText('Rename book');
        let newTitle = bookProject.title;

        new Setting(modal.contentEl)
            .setName('New title')
            .setDesc('Updates the book display title only. The folder and file identity stay unchanged.')
            .addText((text: TextComponent) => {
                text.setValue(bookProject.title);
                text.onChange((v: string) => (newTitle = v));
                window.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 50);
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Rename').setCta().onClick(async () => {
                    if (!newTitle.trim() || newTitle.trim() === bookProject.title) {
                        modal.close();
                        return;
                    }
                    try {
                        await this.plugin.sceneManager.renameProject(bookProject, newTitle.trim());
                        new Notice(`Book renamed to "${newTitle.trim()}"`);
                        modal.close();
                        this.plugin.refreshOpenViews();
                        this.render();
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                    }
                });
            });

        modal.open();
    }

    private async addBookToSeries(folder: string, meta: SeriesMetadata) {
        // Show a dropdown of projects not already in any series
        const projects = this.plugin.sceneManager.getProjects().filter(p => !p.seriesId && !p.seriesUuid);

        if (projects.length === 0) {
            new Notice('No standalone projects found to add. Create a new project first.');
            return;
        }

        const modal = new Modal(this.app);
        modal.titleEl.setText(`Add book to "${meta.name}"`);
        let selectedPath = projects[0].filePath;

        new Setting(modal.contentEl)
            .setName('Project')
            .setDesc('Select a standalone project to add to this series.')
            .addDropdown((dropdown: DropdownComponent) => {
                for (const p of projects) {
                    dropdown.addOption(p.filePath, p.title);
                }
                dropdown.onChange((v: string) => (selectedPath = v));
            });

        new Setting(modal.contentEl)
            .addButton((btn: ButtonComponent) => {
                btn.setButtonText('Add to series').setCta().onClick(async () => {
                    const bookProject = projects.find(p => p.filePath === selectedPath);
                    if (!bookProject) return;
                    modal.close();

                    const previousActive = this.plugin.sceneManager.activeProject;
                    await this.plugin.sceneManager.setActiveProject(bookProject);
                    try {
                        await this.plugin.seriesManager.addProjectToSeries(folder);
                    } catch (e: unknown) {
                        new Notice((e instanceof Error ? e.message : String(e)), 10000);
                        return;
                    }
                    // Restore previous active project
                    if (previousActive && previousActive.filePath !== bookProject.filePath) {
                        await this.plugin.sceneManager.scanProjects();
                        const refreshed = this.plugin.sceneManager.getProjects().find(p => p.filePath === previousActive.filePath);
                        if (refreshed) await this.plugin.sceneManager.setActiveProject(refreshed);
                    }
                    this.plugin.refreshOpenViews();
                    this.render();
                });
            });

        modal.open();
    }
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unnecessary-type-assertion, no-useless-escape -- end of file-wide suppression block opened at line 1 */
