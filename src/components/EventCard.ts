/**
 * EventCard — Rendering component for Events.
 *
 * Displays event name, time, participants, and location in a compact card format.
 * Used in TimelineView and other views that display events.
 */

import type { Event } from '../models/Event';
import type { TimeSpanService } from '../services/TimeSpanService';

/**
 * Render an Event as a card element.
 */
export class EventCard {
    private container: HTMLElement;
    private event: Event;
    private timeSpanService: TimeSpanService;
    private onClick?: (event: Event) => void;

    constructor(
        container: HTMLElement,
        event: Event,
        timeSpanService: TimeSpanService,
        onClick?: (event: Event) => void
    ) {
        this.container = container;
        this.event = event;
        this.timeSpanService = timeSpanService;
        this.onClick = onClick;
    }

    /**
     * Render the event card.
     */
    render(): void {
        this.container.empty();
        this.container.addClass('storyline-event-card');

        if (this.onClick) {
            this.container.onClickEvent(() => this.onClick?.(this.event));
        }

        // Header: event name
        const header = this.container.createDiv('event-card-header');
        header.createEl('h4', { text: this.event.name });

        // Time
        if (this.event.timeSpan) {
            const timeEl = this.container.createDiv('event-card-time');
            timeEl.setText(this.timeSpanService.format(this.event.timeSpan));
        }

        // Location
        if (this.event.location) {
            const locEl = this.container.createDiv('event-card-location');
            locEl.setText('📍 ' + this.event.location);
        }

        // Participants
        if (this.event.participants && this.event.participants.length > 0) {
            const partEl = this.container.createDiv('event-card-participants');
            partEl.setText('👤 ' + this.event.participants.join(', '));
        }

        // Description preview
        if (this.event.description) {
            const descEl = this.container.createDiv('event-card-description');
            const preview = this.event.description.length > 100
                ? this.event.description.substring(0, 100) + '...'
                : this.event.description;
            descEl.setText(preview);
        }

        // Tags
        if (this.event.tags && this.event.tags.length > 0) {
            const tagsEl = this.container.createDiv('event-card-tags');
            for (const tag of this.event.tags) {
                const tagEl = tagsEl.createSpan('event-card-tag');
                tagEl.setText(tag);
            }
        }
    }

    /**
     * Update the event data.
     */
    setEvent(event: Event): void {
        this.event = event;
        this.render();
    }
}
