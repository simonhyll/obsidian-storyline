/**
 * EventModal — Create and edit Events.
 *
 * Provides a modal dialog for creating new Events and editing existing ones,
 * including TimeSpan selection via TimeSpanPicker, participant tags, location,
 * and description.
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type { Event } from '../models/Event';
import type { TimeSpan, Timestamp } from '../models/TimeSpan';
import type { TimeSpanService } from '../services/TimeSpanService';
import type { EventManager } from '../services/EventManager';
import type SceneCardsPlugin from '../main';
import { TimeSpanPicker } from './TimeSpanPicker';

/**
 * Modal for creating or editing an Event.
 */
export class EventModal extends Modal {
    private plugin: SceneCardsPlugin;
    private eventManager: EventManager;
    private timeSpanService: TimeSpanService;
    private eventsFolder: string;

    private existingEvent?: Event;

    private name = '';
    private description = '';
    private location = '';
    private participants = '';
    private tags = '';
    private timeSpan: TimeSpan | undefined;

    private resolved = false;
    private resolve?: (event: Event | null) => void;

    constructor(
        app: App,
        plugin: SceneCardsPlugin,
        eventManager: EventManager,
        timeSpanService: TimeSpanService,
        eventsFolder: string,
        existingEvent?: Event,
        prefillTimestamp?: Timestamp
    ) {
        super(app);
        this.plugin = plugin;
        this.eventManager = eventManager;
        this.timeSpanService = timeSpanService;
        this.eventsFolder = eventsFolder;
        this.existingEvent = existingEvent;

        if (existingEvent) {
            this.name = existingEvent.name;
            this.description = existingEvent.description || '';
            this.location = existingEvent.location || '';
            this.participants = existingEvent.participants?.join(', ') || '';
            this.tags = existingEvent.tags?.join(', ') || '';
            this.timeSpan = existingEvent.timeSpan;
        } else if (prefillTimestamp) {
            // Prefill TimeSpan from the temporal ruler click
            this.timeSpan = {
                kind: 'instant',
                instant: prefillTimestamp,
            };
        }
    }

    /**
     * Open the modal and return a promise that resolves with the saved Event or null.
     */
    openAsync(): Promise<Event | null> {
        return new Promise<Event | null>((resolve) => {
            this.resolve = resolve;
            super.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass('storyline-event-modal');

        const title = this.existingEvent ? 'Edit Event' : 'Create Event';
        contentEl.createEl('h2', { text: title });

        // Name
        new Setting(contentEl)
            .setName('Name')
            .setDesc('Event name')
            .addText(text => {
                text.setPlaceholder('Battle of Waterloo')
                    .setValue(this.name)
                    .onChange(value => this.name = value);
                text.inputEl.focus();
            });

        // Description
        new Setting(contentEl)
            .setName('Description')
            .setDesc('Canonical description of the event')
            .addTextArea(text => {
                text.setPlaceholder('Objective description of what happened...')
                    .setValue(this.description)
                    .onChange(value => this.description = value);
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // Time
        const timeContainer = contentEl.createDiv('event-time-section');
        timeContainer.createEl('h4', { text: 'Time' });
        const pickerContainer = timeContainer.createDiv('event-time-picker');
        const picker = new TimeSpanPicker(
            pickerContainer,
            this.timeSpanService,
            (ts: TimeSpan) => {
                this.timeSpan = ts;
            }
        );
        picker.render();
        if (this.timeSpan) {
            picker.setValue(this.timeSpan);
        }

        // Location
        new Setting(contentEl)
            .setName('Location')
            .setDesc('Wikilink to a Location')
            .addText(text => {
                text.setPlaceholder('[[Waterloo]]')
                    .setValue(this.location)
                    .onChange(value => this.location = value);
            });

        // Participants
        new Setting(contentEl)
            .setName('Participants')
            .setDesc('Character IDs, comma-separated')
            .addText(text => {
                text.setPlaceholder('char-uuid-1, char-uuid-2')
                    .setValue(this.participants)
                    .onChange(value => this.participants = value);
            });

        // Tags
        new Setting(contentEl)
            .setName('Tags')
            .setDesc('Tags, comma-separated')
            .addText(text => {
                text.setPlaceholder('battle, historical')
                    .setValue(this.tags)
                    .onChange(value => this.tags = value);
            });

        // Buttons
        const actions = contentEl.createDiv('event-modal-actions');

        const saveBtn = actions.createEl('button', { cls: 'mod-cta' });
        saveBtn.setText(this.existingEvent ? 'Save changes' : 'Create event');
        saveBtn.onClickEvent(async () => {
            if (!this.name.trim()) {
                new Notice('Event name is required');
                return;
            }
            try {
                const event = await this.saveEvent();
                this.resolved = true;
                this.resolve?.(event);
                this.close();
            } catch (e) {
                console.error('[StoryLine] Failed to save event:', e);
                new Notice('Failed to save event');
            }
        });

        const cancelBtn = actions.createEl('button');
        cancelBtn.setText('Cancel');
        cancelBtn.onClickEvent(() => {
            this.resolved = true;
            this.resolve?.(null);
            this.close();
        });

        // Delete button (edit mode only)
        if (this.existingEvent) {
            const deleteBtn = actions.createEl('button', { cls: 'mod-warning' });
            deleteBtn.setText('Delete');
            deleteBtn.onClickEvent(async () => {
                const confirm = await this.confirmDelete();
                if (confirm) {
                    try {
                        await this.eventManager.deleteEvent(this.existingEvent!);
                        new Notice(`Event "${this.existingEvent!.name}" deleted`);
                        this.resolved = true;
                        this.resolve?.(null);
                        this.close();
                    } catch (e) {
                        console.error('[StoryLine] Failed to delete event:', e);
                        new Notice('Failed to delete event');
                    }
                }
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
        // Handle Escape key / programmatic close: resolve with null so the pending promise doesn't hang
        if (!this.resolved) {
            this.resolved = true;
            this.resolve?.(null);
        }
    }

    async saveEvent(): Promise<Event> {
        const participants = this.participants
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        const tags = this.tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        if (this.existingEvent) {
            // Update existing event
            const event: Event = {
                ...this.existingEvent,
                name: this.name.trim(),
                description: this.description.trim() || undefined,
                location: this.location.trim() || undefined,
                participants: participants.length > 0 ? participants : undefined,
                tags: tags.length > 0 ? tags : undefined,
                timeSpan: this.timeSpan,
            };
            await this.eventManager.saveEvent(event);
            return event;
        } else {
            // Create new event
            const event = await this.eventManager.createEventFile(this.eventsFolder, this.name.trim(), {
                description: this.description.trim() || undefined,
                location: this.location.trim() || undefined,
                participants: participants.length > 0 ? participants : undefined,
                tags: tags.length > 0 ? tags : undefined,
                timeSpan: this.timeSpan,
            });
            return event;
        }
    }

    async confirmDelete(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('Delete Event');
            modal.contentEl.createEl('p', {
                text: `Are you sure you want to delete "${this.existingEvent?.name}"? This cannot be undone.`,
            });

            const actions = modal.contentEl.createDiv('modal-actions');
            const yesBtn = actions.createEl('button', { cls: 'mod-warning' });
            yesBtn.setText('Delete');
            yesBtn.onClickEvent(() => {
                modal.close();
                resolve(true);
            });

            const noBtn = actions.createEl('button');
            noBtn.setText('Cancel');
            noBtn.onClickEvent(() => {
                modal.close();
                resolve(false);
            });

            modal.open();
        });
    }
}

/**
 * Modal for selecting an Event from a list (used by Scene-Event linking).
 */
export class EventSelectorModal extends Modal {
    private eventManager: EventManager;
    private timeSpanService: TimeSpanService;
    private originalIds: string[];
    private selectedIds: string[];

    private resolved = false;
    private resolve?: (ids: string[] | null) => void;

    constructor(
        app: App,
        eventManager: EventManager,
        timeSpanService: TimeSpanService,
        selectedIds: string[] = []
    ) {
        super(app);
        this.eventManager = eventManager;
        this.timeSpanService = timeSpanService;
        this.originalIds = [...selectedIds];
        this.selectedIds = [...selectedIds];
    }

    /**
     * Open the modal and return a promise that resolves with the selected Event IDs,
     * or null if cancelled.
     */
    openAsync(): Promise<string[] | null> {
        return new Promise<string[] | null>((resolve) => {
            this.resolve = resolve;
            super.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass('storyline-event-selector');

        contentEl.createEl('h2', { text: 'Link Events' });
        contentEl.createEl('p', {
                text: 'Select Events to link to this Scene. A Scene may reference multiple Events.',
            });

        const events = this.eventManager.getAllEvents();
        if (events.length === 0) {
            contentEl.createEl('p', {
                text: 'No Events found. Create Events first.',
                cls: 'empty-state',
            });
        }

        for (const event of events) {
            const row = contentEl.createDiv('event-selector-row');
            const isChecked = this.selectedIds.includes(event.id);

            const checkbox = row.createEl('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isChecked;
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    if (!this.selectedIds.includes(event.id)) {
                        this.selectedIds.push(event.id);
                    }
                } else {
                    this.selectedIds = this.selectedIds.filter(id => id !== event.id);
                }
            };

            const label = row.createEl('label', 'event-selector-label');
            label.setText(event.name);
            if (event.timeSpan) {
                label.appendText(` (${this.timeSpanService.format(event.timeSpan)})`);
            }

            checkbox.onClickEvent(() => checkbox.dispatchEvent(new Event('change')));
        }

        // Buttons
        const actions = contentEl.createDiv('modal-actions');
        const saveBtn = actions.createEl('button', { cls: 'mod-cta' });
        saveBtn.setText('Save');
        saveBtn.onClickEvent(() => {
            this.resolved = true;
            this.resolve?.([...this.selectedIds]);
            this.close();
        });

        const cancelBtn = actions.createEl('button');
        cancelBtn.setText('Cancel');
        cancelBtn.onClickEvent(() => {
            this.resolved = true;
            this.resolve?.(null);
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
        // Handle Escape key / programmatic close: resolve with null so the pending promise doesn't hang
        if (!this.resolved) {
            this.resolved = true;
            this.resolve?.(null);
        }
    }
}
