/**
 * Builds the form fields for the CreateProjectModal.
 *
 * Separated from the modal to keep it under the 200-line architectural limit.
 */

import { Setting, TextComponent, DropdownComponent, ButtonComponent } from 'obsidian';
import type { ProjectType } from '../services/projectCreation';

/**
 * Form field references held by the modal.
 */
export interface FormFieldRefs {
    universeSetting: Setting | null;
    seriesSetting: Setting | null;
    newSeriesNameSetting: Setting | null;
    titleSetting: Setting | null;
    createBtn: ButtonComponent | null;
    advancedContent: HTMLElement | null;
}

/**
 * Configuration for building form fields.
 */
export interface BuildFormFieldsConfig {
    /** The modal content element. */
    contentEl: HTMLElement;
    /** Object to populate with field references. */
    refs: FormFieldRefs;
    /** The default StoryLine root folder. */
    storyLineRoot: string;
    /** Optional pre-selected series UUID. */
    defaultSeriesUuid?: string;
    /** Callbacks for field changes. */
    callbacks: FormFieldCallbacks;
}

/**
 * Build all form fields for the create project modal.
 *
 * @param config - Configuration object containing all build parameters.
 */
export function buildFormFields(config: BuildFormFieldsConfig): void {
    buildTypeSelector(config.contentEl, config.callbacks);
    buildUniverseDropdown(config.contentEl, config.refs, config.callbacks);
    buildSeriesDropdown(config.contentEl, config.refs, config.defaultSeriesUuid, config.callbacks);
    buildNewSeriesNameField(config.contentEl, config.refs);
    buildTitleField(config.contentEl, config.refs);
    buildAdvancedSection(config.contentEl, config.refs, config.storyLineRoot, config.callbacks);
    buildButtons(config.contentEl, config.refs, config.callbacks);
}

/**
 * Update field visibility and labels based on the selected project type.
 *
 * @param refs - The form field references.
 * @param projectType - The currently selected project type.
 */
export function updateFieldVisibility(
    refs: FormFieldRefs,
    projectType: ProjectType,
): void {
    if (!refs.universeSetting || !refs.seriesSetting
        || !refs.newSeriesNameSetting || !refs.titleSetting) {
        return;
    }
    refs.universeSetting.settingEl.setCssStyles({ display: projectType === 'universe' ? 'none' : '' });
    refs.seriesSetting.settingEl.setCssStyles({ display: projectType === 'book' ? '' : 'none' });
    refs.newSeriesNameSetting.settingEl.setCssStyles({ display: 'none' });
    refs.titleSetting.settingEl.setCssStyles({ display: '' });
    updateTitleFieldLabels(refs.titleSetting, projectType);
}

/**
 * Callbacks from form field interactions.
 */
interface FormFieldCallbacks {
    onProjectTypeChange: (type: ProjectType) => void;
    onUniverseChange: (id: string) => void;
    onSeriesChange: (uuid: string) => void;
    onNewSeriesNameChange: (name: string) => void;
    onTitleChange: (title: string) => void;
    onCustomFolderChange: (folder: string) => void;
    onCreateClick: () => void;
    onCancelClick: () => void;
}

// ── Field Builders ────────────────────────────────────────

function buildTypeSelector(
    contentEl: HTMLElement,
    callbacks: FormFieldCallbacks,
): void {
    new Setting(contentEl)
        .setName('Project type')
        .setDesc('What are you creating?')
        .addDropdown((dropdown: DropdownComponent) => {
            dropdown
                .addOption('book', 'Book')
                .addOption('series', 'Series')
                .addOption('universe', 'Universe')
                .setValue('book')
                .onChange((v: ProjectType) => callbacks.onProjectTypeChange(v));
        });
}

function buildUniverseDropdown(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
    callbacks: FormFieldCallbacks,
): void {
    refs.universeSetting = new Setting(contentEl)
        .setName('Universe')
        .setDesc('Optional: place this inside an existing universe.')
        .addDropdown((dropdown: DropdownComponent) => {
            dropdown.addOption('', '— none —');
            dropdown.onChange((v: string) => callbacks.onUniverseChange(v));
        });
}

function buildSeriesDropdown(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
    defaultSeriesUuid: string | undefined,
    callbacks: FormFieldCallbacks,
): void {
    refs.seriesSetting = new Setting(contentEl)
        .setName('Series')
        .setDesc('Optional: place this book inside an existing series.')
        .addDropdown((dropdown: DropdownComponent) => {
            dropdown.addOption('', '— none —');
            dropdown.addOption('__new__', '+ create new series…');
            if (defaultSeriesUuid) dropdown.setValue(defaultSeriesUuid);
            dropdown.onChange((v: string) => callbacks.onSeriesChange(v));
        });
}

function buildNewSeriesNameField(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
): void {
    refs.newSeriesNameSetting = new Setting(contentEl)
        .setName('New series name')
        .setDesc('Name for the new series within the selected universe.')
        .addText((text: TextComponent) => {
            text.setPlaceholder('My new series');
            text.onChange((v: string) => {
                // Callback will be set by the modal
            });
        });
    refs.newSeriesNameSetting.settingEl.setCssStyles({ display: 'none' });
}

function buildTitleField(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
): void {
    refs.titleSetting = new Setting(contentEl)
        .setName('Book title')
        .setDesc('The title of this book.')
        .addText((text: TextComponent) => {
            text.setPlaceholder('My novel');
            text.onChange((v: string) => {
                // Callback will be set by the modal
            });
        });
}

function buildAdvancedSection(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
    storyLineRoot: string,
    callbacks: FormFieldCallbacks,
): void {
    const advancedContainer = contentEl.createDiv({ cls: 'project-modal-advanced' });
    const advancedHeader = advancedContainer.createDiv({ cls: 'project-modal-advanced-header' });
    advancedHeader.createSpan({ text: '⚙ Advanced' });
    refs.advancedContent = advancedContainer.createDiv({ cls: 'project-modal-advanced-content' });
    refs.advancedContent.setCssStyles({ display: 'none' });

    let advancedOpen = false;
    advancedHeader.addEventListener('click', () => {
        advancedOpen = !advancedOpen;
        if (refs.advancedContent) {
            refs.advancedContent.setCssStyles({ display: advancedOpen ? '' : 'none' });
        }
    });

    new Setting(refs.advancedContent)
        .setName('Location')
        .setDesc(`Leave empty to use default (${storyLineRoot}). Or enter a vault folder path like "Writing/Novels".`)
        .addText((text: TextComponent) => {
            text.setPlaceholder(storyLineRoot);
            text.onChange((v: string) => callbacks.onCustomFolderChange(v.trim()));
        });
}

function buildButtons(
    contentEl: HTMLElement,
    refs: FormFieldRefs,
    callbacks: FormFieldCallbacks,
): void {
    new Setting(contentEl)
        .addButton((btn: ButtonComponent) => {
            refs.createBtn = btn;
            btn.setButtonText('Create').setCta().onClick(() => callbacks.onCreateClick());
        })
        .addButton((btn: ButtonComponent) => {
            btn.setButtonText('Cancel').onClick(() => callbacks.onCancelClick());
        });
}

/** Update the title field labels based on project type. */
function updateTitleFieldLabels(
    titleSetting: Setting,
    projectType: ProjectType,
): void {
    const input = titleSetting.controlEl.querySelector('input');
    if (projectType === 'book') {
        titleSetting.nameEl.setText('Book title');
        titleSetting.descEl.setText('The title of this book. Each book gets its own scenes folder.');
        if (input) input.setAttribute('placeholder', 'My novel');
    } else if (projectType === 'series') {
        titleSetting.nameEl.setText('Series name');
        titleSetting.descEl.setText('Name for the new series.');
        if (input) input.setAttribute('placeholder', 'My trilogy');
    } else {
        titleSetting.nameEl.setText('Universe name');
        titleSetting.descEl.setText('Name for the new universe.');
        if (input) input.setAttribute('placeholder', 'My fictional universe');
    }
}
