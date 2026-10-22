/**
 * TimeSpanPicker — UI for selecting TimeSpan values.
 *
 * Supports selecting instants, intervals, uncertain ranges, and unknown dates.
 * Uses the TimeSpanService for parsing and formatting.
 */

import { Setting, moment } from 'obsidian';
import type { TimeSpan, Timestamp } from '../models/TimeSpan';
import type { TimeSpanService } from '../services/TimeSpanService';

/**
 * UI component for selecting TimeSpan values.
 */
export class TimeSpanPicker {
    private container: HTMLElement;
    private service: TimeSpanService;
    private onChange: (timeSpan: TimeSpan) => void;

    private kindSelect: HTMLSelectElement | null = null;
    private instantInput: HTMLInputElement | null = null;
    private startInput: HTMLInputElement | null = null;
    private endInput: HTMLInputElement | null = null;
    private confidenceInput: HTMLInputElement | null = null;
    private relativeToInput: HTMLInputElement | null = null;
    private offsetAmountInput: HTMLInputElement | null = null;
    private offsetUnitSelect: HTMLSelectElement | null = null;
    private offsetDirectionSelect: HTMLSelectElement | null = null;
    private displayInput: HTMLInputElement | null = null;

    constructor(
        container: HTMLElement,
        service: TimeSpanService,
        onChange: (timeSpan: TimeSpan) => void
    ) {
        this.container = container;
        this.service = service;
        this.onChange = onChange;
    }

    /**
     * Render the picker UI.
     */
    render(): void {
        this.container.empty();
        this.container.addClass('storyline-timespan-picker');

        // Kind selector
        const kindSetting = new Setting(this.container)
            .setName('Time type')
            .addDropdown(dd => {
                dd.addOptions({
                    'instant': 'Exact date',
                    'interval': 'Date range',
                    'open-ended': 'Open-ended range',
                    'uncertain': 'Uncertain date',
                    'unknown': 'Unknown date',
                    'relative': 'Relative to event',
                });
                dd.onChange(async (value: string) => {
                    this.kind = value as TimeSpan['kind'];
                    this.renderFields();
                });
                this.kindSelect = dd.selectEl;
            });

        this.renderFields();

        // Display label
        new Setting(this.container)
            .setName('Display label')
            .addText(text => {
                text.setPlaceholder('Optional display label');
                text.onChange(async (value) => {
                    const ts = this.getCurrentTimeSpan();
                    if (ts) {
                        ts.display = value || undefined;
                        this.onChange(ts);
                    }
                });
                this.displayInput = text.inputEl;
            });
    }

    private kind: TimeSpan['kind'] = 'instant';

    /**
     * Render fields based on the selected kind.
     */
    private renderFields(): void {
        // Remove old fields but keep kind selector and display
        const oldFields = this.container.querySelectorAll('.timespan-fields');
        oldFields.forEach(el => el.remove());

        const fieldsContainer = this.container.createDiv('timespan-fields');

        switch (this.kind) {
            case 'instant':
                this.renderInstantField(fieldsContainer);
                break;
            case 'interval':
                this.renderIntervalFields(fieldsContainer);
                break;
            case 'open-ended':
                this.renderOpenEndedField(fieldsContainer);
                break;
            case 'uncertain':
                this.renderUncertainFields(fieldsContainer);
                break;
            case 'unknown':
                // No fields needed for unknown
                break;
            case 'relative':
                this.renderRelativeFields(fieldsContainer);
                break;
        }
    }

    private renderInstantField(container: HTMLElement): void {
        new Setting(container)
            .setName('Date')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        this.onChange(ts);
                    }
                });
                this.instantInput = text.inputEl;
            });
    }

    private renderIntervalFields(container: HTMLElement): void {
        new Setting(container)
            .setName('Start date')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        const current = this.getCurrentTimeSpan();
                        if (current && current.kind === 'interval') {
                            current.start = ts.instant;
                            this.onChange(current);
                        }
                    }
                });
                this.startInput = text.inputEl;
            });

        new Setting(container)
            .setName('End date')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        const current = this.getCurrentTimeSpan();
                        if (current && current.kind === 'interval') {
                            current.end = ts.instant;
                            this.onChange(current);
                        }
                    }
                });
                this.endInput = text.inputEl;
            });
    }

    private renderOpenEndedField(container: HTMLElement): void {
        new Setting(container)
            .setName('Start date')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        const open: TimeSpan = {
                            kind: 'open-ended',
                            start: ts.instant,
                        };
                        this.onChange(open);
                    }
                });
                this.startInput = text.inputEl;
            });
    }

    private renderUncertainFields(container: HTMLElement): void {
        new Setting(container)
            .setName('Start of range')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        const current = this.getCurrentTimeSpan();
                        if (current && current.kind === 'uncertain') {
                            current.range.start = ts.instant;
                            this.onChange(current);
                        }
                    }
                });
                this.startInput = text.inputEl;
            });

        new Setting(container)
            .setName('End of range')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD');
                text.onChange(async (value) => {
                    const ts = this.service.parse(value);
                    if (ts && ts.kind === 'instant') {
                        const current = this.getCurrentTimeSpan();
                        if (current && current.kind === 'uncertain') {
                            current.range.end = ts.instant;
                            this.onChange(current);
                        }
                    }
                });
                this.endInput = text.inputEl;
            });

        new Setting(container)
            .setName('Confidence')
            .addText(text => {
                text.setPlaceholder('0.0 - 1.0');
                text.inputEl.type = 'number';
                text.inputEl.step = '0.1';
                text.inputEl.min = '0';
                text.inputEl.max = '1';
                text.onChange(async (value) => {
                    const current = this.getCurrentTimeSpan();
                    if (current && current.kind === 'uncertain') {
                        current.confidence = parseFloat(value) || 0.5;
                        this.onChange(current);
                    }
                });
                this.confidenceInput = text.inputEl;
            });
    }

    private renderRelativeFields(container: HTMLElement): void {
        new Setting(container)
            .setName('Reference ID')
            .addText(text => {
                text.setPlaceholder('Event or Scene UUID');
                text.onChange(async (value) => {
                    const current = this.getCurrentTimeSpan();
                    if (current && current.kind === 'relative') {
                        current.relativeTo = value;
                        this.onChange(current);
                    }
                });
                this.relativeToInput = text.inputEl;
            });

        new Setting(container)
            .setName('Offset amount')
            .addText(text => {
                text.setPlaceholder('3');
                text.inputEl.type = 'number';
                text.onChange(async (value) => {
                    const current = this.getCurrentTimeSpan();
                    if (current && current.kind === 'relative') {
                        current.offset.amount = parseInt(value, 10) || 0;
                        this.onChange(current);
                    }
                });
                this.offsetAmountInput = text.inputEl;
            });

        new Setting(container)
            .setName('Offset unit')
            .addDropdown(dd => {
                dd.addOptions({
                    'day': 'Days',
                    'week': 'Weeks',
                    'month': 'Months',
                    'year': 'Years',
                    'season': 'Seasons',
                });
                dd.onChange(async (value: string) => {
                    const current = this.getCurrentTimeSpan();
                    if (current && current.kind === 'relative') {
                        current.offset.unit = value as any;
                        this.onChange(current);
                    }
                });
                this.offsetUnitSelect = dd.selectEl;
            });

        new Setting(container)
            .setName('Direction')
            .addDropdown(dd => {
                dd.addOptions({
                    'before': 'Before',
                    'after': 'After',
                });
                dd.onChange(async (value: string) => {
                    const current = this.getCurrentTimeSpan();
                    if (current && current.kind === 'relative') {
                        current.offset.direction = value as 'before' | 'after';
                        this.onChange(current);
                    }
                });
                this.offsetDirectionSelect = dd.selectEl;
            });
    }

    /**
     * Set the current TimeSpan value.
     */
    setValue(timeSpan: TimeSpan | null): void {
        if (!timeSpan) {
            this.kind = 'unknown';
            if (this.kindSelect) this.kindSelect.value = 'unknown';
            this.renderFields();
            return;
        }

        this.kind = timeSpan.kind;
        if (this.kindSelect) this.kindSelect.value = timeSpan.kind;

        if (this.displayInput) {
            this.displayInput.value = timeSpan.display || '';
        }

        this.renderFields();

        // Populate fields based on kind
        switch (timeSpan.kind) {
            case 'instant':
                if (this.instantInput) {
                    this.instantInput.value = this.service.format(timeSpan);
                }
                break;
            case 'interval':
                if (this.startInput) {
                    this.startInput.value = this.service.formatTimestamp(timeSpan.start);
                }
                if (this.endInput) {
                    this.endInput.value = this.service.formatTimestamp(timeSpan.end);
                }
                break;
            case 'open-ended':
                if (this.startInput) {
                    this.startInput.value = this.service.formatTimestamp(timeSpan.start);
                }
                break;
            case 'uncertain':
                if (this.startInput) {
                    this.startInput.value = this.service.formatTimestamp(timeSpan.range.start);
                }
                if (this.endInput) {
                    this.endInput.value = this.service.formatTimestamp(timeSpan.range.end);
                }
                if (this.confidenceInput) {
                    this.confidenceInput.value = String(timeSpan.confidence ?? 0.5);
                }
                break;
            case 'relative':
                if (this.relativeToInput) {
                    this.relativeToInput.value = timeSpan.relativeTo;
                }
                if (this.offsetAmountInput) {
                    this.offsetAmountInput.value = String(timeSpan.offset.amount);
                }
                if (this.offsetUnitSelect) {
                    this.offsetUnitSelect.value = timeSpan.offset.unit;
                }
                if (this.offsetDirectionSelect) {
                    this.offsetDirectionSelect.value = timeSpan.offset.direction;
                }
                break;
        }
    }

    /**
     * Get the current TimeSpan value.
     */
    getValue(): TimeSpan | null {
        return this.getCurrentTimeSpan();
    }

    /**
     * Get the current TimeSpan based on the selected kind.
     */
    private getCurrentTimeSpan(): TimeSpan | null {
        switch (this.kind) {
            case 'instant': {
                const value = this.instantInput?.value || '';
                return this.service.parse(value) ?? { kind: 'unknown' };
            }
            case 'interval': {
                const start = this.startInput?.value || '';
                const end = this.endInput?.value || '';
                const startTs = this.service.parse(start);
                const endTs = this.service.parse(end);
                if (startTs && startTs.kind === 'instant' && endTs && endTs.kind === 'instant') {
                    return { kind: 'interval', start: startTs.instant, end: endTs.instant };
                }
                return { kind: 'unknown' };
            }
            case 'open-ended': {
                const start = this.startInput?.value || '';
                const startTs = this.service.parse(start);
                if (startTs && startTs.kind === 'instant') {
                    return { kind: 'open-ended', start: startTs.instant };
                }
                return { kind: 'unknown' };
            }
            case 'uncertain': {
                const start = this.startInput?.value || '';
                const end = this.endInput?.value || '';
                const confidence = parseFloat(this.confidenceInput?.value || '0.5');
                const startTs = this.service.parse(start);
                const endTs = this.service.parse(end);
                if (startTs && startTs.kind === 'instant' && endTs && endTs.kind === 'instant') {
                    return {
                        kind: 'uncertain',
                        range: { start: startTs.instant, end: endTs.instant },
                        confidence: isNaN(confidence) ? 0.5 : confidence,
                    };
                }
                return { kind: 'unknown' };
            }
            case 'unknown':
                return { kind: 'unknown' };
            case 'relative': {
                const relativeTo = this.relativeToInput?.value || '';
                const amount = parseInt(this.offsetAmountInput?.value || '0', 10);
                const unit = (this.offsetUnitSelect?.value || 'day') as any;
                const direction = (this.offsetDirectionSelect?.value || 'before') as 'before' | 'after';
                if (relativeTo) {
                    return {
                        kind: 'relative',
                        relativeTo,
                        offset: { amount, unit, direction },
                    };
                }
                return { kind: 'unknown' };
            }
        }
    }
}
