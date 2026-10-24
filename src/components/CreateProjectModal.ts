/**
 * Modal for creating a new StoryLine project (Book, Series, or Universe).
 *
 * Delegates form field building to CreateProjectFields, dropdown population
 * to CreateProjectDropdowns, and creation logic to projectCreation service.
 */

import { Modal, Notice, ButtonComponent } from 'obsidian';
import type { App } from 'obsidian';
import type { StoryLineProject } from '../models/StoryLineProject';
import { executeCreation, type ProjectType, type CreationFormState, type ProjectCreationDeps } from '../services/projectCreation';
import { CreationConcurrencyGuard } from '../services/creationGuard';
import { updateSeriesDropdownInPlace } from './CreateProjectDropdowns';
import type { DropdownDeps, ModalClosedChecker } from './CreateProjectDropdowns';
import { buildFormFields, updateFieldVisibility, type FormFieldRefs } from './CreateProjectFields';

/**
 * Dependencies required for the CreateProjectModal.
 */
export interface CreateProjectModalDeps extends ProjectCreationDeps, DropdownDeps {
    /** Obsidian app instance. */
    app: App;
    /** Plugin settings subset. */
    storyLineRoot: string;
}


/**
 * Modal for creating a new StoryLine project.
 * Returns null if the user cancels.
 */
export class CreateProjectModal extends Modal {
    private deps: CreateProjectModalDeps;
    private defaultUniverseId?: string;
    private defaultSeriesUuid?: string;

    private form: CreationFormState = {
        projectType: 'book',
        title: '',
        customFolder: undefined,
        selectedUniverseId: '',
        selectedSeriesUuid: '',
        newSeriesName: '',
    };

    private seriesDropdownRequestId = 0;
    private refs: FormFieldRefs = {
        universeSetting: null,
        seriesSetting: null,
        newSeriesNameSetting: null,
        titleSetting: null,
        createBtn: null,
        advancedContent: null,
    };

    private resolvePromise: ((result: StoryLineProject | null) => void) | null = null;
    private settled = false;
    private concurrencyGuard = new CreationConcurrencyGuard();
    private isClosed_ = false;
    /** Returns whether the modal has been closed (satisfies ModalClosedChecker). */
    get isClosed(): boolean { return this.isClosed_; }

    constructor(
        app: App,
        deps: CreateProjectModalDeps,
        defaultUniverseId?: string,
        defaultSeriesUuid?: string,
    ) {
        super(app);
        this.deps = deps;
        this.defaultUniverseId = defaultUniverseId;
        this.defaultSeriesUuid = defaultSeriesUuid;
        if (defaultUniverseId) this.form.selectedUniverseId = defaultUniverseId;
        if (defaultSeriesUuid) this.form.selectedSeriesUuid = defaultSeriesUuid;
    }

    /**
     * Open the modal and return a promise that resolves when the user
     * creates a project or cancels.
     */
    openAndWait(): Promise<StoryLineProject | null> {
        return new Promise<StoryLineProject | null>((resolve) => {
            this.resolvePromise = resolve;
            this.titleEl.setText('New StoryLine project');
            this.buildUI();
            void this.populateDropdowns();
            this.open();
        });
    }

    private buildUI(): void {
        buildFormFields({
            contentEl: this.contentEl,
            refs: this.refs,
            storyLineRoot: this.deps.storyLineRoot,
            defaultSeriesUuid: this.defaultSeriesUuid,
            callbacks: this.callbacks,
            onTitleChange: (title: string) => { this.form.title = title; },
            onNewSeriesNameChange: (name: string) => { this.form.newSeriesName = name; },
        });
        updateFieldVisibility(this.refs, this.form.projectType);
    }

    private get callbacks() {
        return {
            onProjectTypeChange: (type: ProjectType) => {
                this.form.projectType = type;
                updateFieldVisibility(this.refs, type);
            },
            onUniverseChange: (id: string) => {
                this.form.selectedUniverseId = id;
                ++this.seriesDropdownRequestId;
                void this.updateSeriesDropdown();
            },
            onSeriesChange: (uuid: string) => {
                this.form.selectedSeriesUuid = uuid;
                if (this.refs.newSeriesNameSetting) {
                    this.refs.newSeriesNameSetting.settingEl.style.display = uuid === '__new__' ? '' : 'none';
                }
            },
            onNewSeriesNameChange: (name: string) => {
                this.form.newSeriesName = name;
            },
            onTitleChange: (title: string) => {
                this.form.title = title;
            },
            onCustomFolderChange: (folder: string) => {
                this.form.customFolder = folder || undefined;
            },
            onCreateClick: () => { void this.handleCreate(); },
            onCancelClick: () => { this.settle(null); this.close(); },
        };
    }

    private async populateDropdowns(): Promise<void> {
        await this.populateUniverseDropdown();
        await this.updateSeriesDropdown();
    }

    private async populateUniverseDropdown(): Promise<void> {
        const dropdownEl = this.refs.universeSetting?.controlEl.querySelector('select');
        if (!dropdownEl) return;
        try {
            const universes = await this.deps.getAllUniverses();
            for (const u of universes) {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.text = u.name;
                dropdownEl.add(opt);
            }
            if (this.defaultUniverseId) dropdownEl.value = this.defaultUniverseId;
        } catch { /* no universes yet */ }
    }

    private async updateSeriesDropdown(): Promise<void> {
        const dropdownEl = this.refs.seriesSetting?.controlEl.querySelector('select');
        if (!dropdownEl) return;
        const requestId = ++this.seriesDropdownRequestId;
        await updateSeriesDropdownInPlace({
            deps: this.deps,
            dropdownEl,
            selectedUniverseId: this.form.selectedUniverseId,
            requestId,
            getCurrentRequestId: () => this.seriesDropdownRequestId,
            modalChecker: this,
        });
    }

    private async handleCreate(): Promise<void> {
        const release = this.concurrencyGuard.tryStart();
        if (!release) return;
        if (!this.form.title.trim()) {
            release();
            new Notice('Please enter a name.');
            return;
        }
        if (this.form.selectedSeriesUuid === '__new__' && !this.form.newSeriesName.trim()) {
            release();
            new Notice('Please enter a name for the new series.');
            return;
        }
        this.refs.createBtn?.setDisabled(true);
        try {
            const result = await executeCreation(this.form, this.deps);
            if (!this.isClosed_) {
                this.showCreationNotice();
            }
            this.settle(result);
            this.close();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            new Notice(message, 10000);
            this.refs.createBtn?.setDisabled(false);
        } finally {
            release();
        }
    }

    private showCreationNotice(): void {
        const title = this.form.title.trim();
        if (this.form.projectType === 'universe') {
            new Notice(`Universe "${title}" created.`);
        } else if (this.form.projectType === 'series') {
            new Notice(`Series "${title}" created.`);
        }
    }

    private settle(result: StoryLineProject | null): void {
        if (this.settled) return;
        this.settled = true;
        this.resolvePromise?.(result);
    }

    onClose(): void {
        this.isClosed_ = true;
        this.settle(null);
    }
}
