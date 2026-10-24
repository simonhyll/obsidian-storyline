/**
 * Minimal Obsidian module mock for Node.js test environment.
 *
 * The real "obsidian" package is types-only (main: ""). This mock provides
 * the runtime values that production code imports from 'obsidian':
 * - TFile class (for instanceof checks)
 * - parseYaml / stringifyYaml (for frontmatter parsing)
 *
 * Used only in Cucumber tests via tsx module resolution.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- js-yaml is a test-only dep
const yaml = require('js-yaml');

/**
 * Minimal TFile mock that passes instanceof TFile checks.
 * Production EventManager uses `file instanceof TFile` to distinguish
 * files from folders before reading/modifying content.
 */
export class TFile {
    public path: string;
    public name: string;

    constructor(path: string) {
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
    }
}

/** Parse YAML string to object (matches Obsidian's parseYaml). */
export function parseYaml(text: string): unknown {
    return yaml.load(text);
}

/** Serialize object to YAML string (matches Obsidian's stringifyYaml). */
export function stringifyYaml(obj: unknown): string {
    return yaml.dump(obj);
}

/** Normalize a file path (matches Obsidian's normalizePath). */
export function normalizePath(path: string): string {
    // Simple normalization: remove leading/trailing slashes, collapse double slashes
    return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

/** Minimal Notice mock for test environment. */
export class Notice {
    constructor(_message: string) {
        // No-op in test environment
    }
}

/**
 * Patch a jsdom HTMLElement with Obsidian DOM helper methods.
 * Production code uses these methods on contentEl, settingEl, etc.
 */
function patchObsidianElement(el: HTMLElement): void {
    if (typeof (el as any).createEl !== 'undefined') return; // already patched

    const doc = el.ownerDocument;
    if (!doc) return;

    (el as any).createEl = (tag: string, opts?: { text?: string; cls?: string; attr?: Record<string, string> }): HTMLElement => {
        const child = doc.createElement(tag);
        if (opts?.text) child.textContent = opts.text;
        if (opts?.cls) child.className = opts.cls;
        if (opts?.attr) Object.entries(opts.attr).forEach(([k, v]) => child.setAttribute(k, v));
        el.appendChild(child);
        patchObsidianElement(child);
        return child;
    };

    (el as any).createDiv = (opts?: { cls?: string }): HTMLElement => {
        const div = doc.createElement('div');
        if (opts?.cls) div.className = opts.cls;
        el.appendChild(div);
        patchObsidianElement(div);
        return div;
    };

    (el as any).createSpan = (opts?: { text?: string; cls?: string }): HTMLElement => {
        const span = doc.createElement('span');
        if (opts?.text) span.textContent = opts.text;
        if (opts?.cls) span.className = opts.cls;
        el.appendChild(span);
        patchObsidianElement(span);
        return span;
    };

    (el as any).addClass = (cls: string) => { el.classList.add(cls); };
    (el as any).empty = () => { el.innerHTML = ''; };
    (el as any).setText = (text: string) => { el.textContent = text; };
    (el as any).setCssStyles = (styles: Record<string, string>) => {
        Object.assign(el.style, styles);
    };
    (el as any).onClickEvent = (fn: (e: Event) => void) => {
        el.addEventListener('click', fn);
        return el;
    };
}

/** Minimal Modal mock for headless cancellation tests. */
export class Modal {
    public contentEl: HTMLElement;
    public titleEl: HTMLElement;
    private _onCloseCallbacks: Array<() => void> = [];
    private _isOpen = false;

    constructor(_app: unknown) {
        // Use jsdom for contentEl when available, otherwise a minimal mock
        const doc = typeof document !== 'undefined' ? document : null;
        const contentDiv = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(contentDiv);
        this.contentEl = contentDiv;
        const titleDiv = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        if (doc) {
            patchObsidianElement(titleDiv);
            (titleDiv as any).setText = (text: string) => { titleDiv.textContent = text; };
        }
        this.titleEl = titleDiv;
    }

    open(): void {
        this._isOpen = true;
        // Invoke subclass onOpen() so production subclasses register their UI callbacks
        this.onOpen();
    }

    close(): void {
        this._isOpen = false;
        for (const cb of this._onCloseCallbacks) cb();
        this.onClose();
    }

    onOpen(): void {
        // Override in subclasses
    }

    onClose(): void {
        // Override in subclasses
    }
}

/** Minimal TextComponent mock. */
export class TextComponent {
    public inputEl: HTMLElement;
    private _onChange?: (value: string) => void;

    constructor() {
        const doc = typeof document !== 'undefined' ? document : null;
        this.inputEl = doc ? doc.createElement('input') : {} as unknown as HTMLElement;
    }

    setPlaceholder(_placeholder: string): this { return this; }
    setValue(_value: string): this { return this; }
    onChange(fn: (value: string) => void): this {
        this._onChange = fn;
        return this;
    }
}

/** Minimal DropdownComponent mock. */
export class DropdownComponent {
    public selectEl: HTMLElement;
    private _onChange?: (value: string) => void;
    private _options: Record<string, string> = {};

    constructor() {
        const doc = typeof document !== 'undefined' ? document : null;
        this.selectEl = doc ? doc.createElement('select') : {} as unknown as HTMLElement;
    }

    addOption(value: string, label: string): this {
        this._options[value] = label;
        return this;
    }
    addOptions(options: Record<string, string>): this {
        Object.assign(this._options, options);
        return this;
    }
    setValue(_value: string): this { return this; }
    onChange(fn: (value: string) => void): this {
        this._onChange = fn;
        return this;
    }
}

/** Minimal ButtonComponent mock. */
export class ButtonComponent {
    private _onClick?: () => void;
    private _disabled = false;

    setButtonText(_text: string): this { return this; }
    setCta(): this { return this; }
    setDisabled(disabled: boolean): this {
        this._disabled = disabled;
        return this;
    }
    onClick(fn: () => void): this {
        this._onClick = fn;
        return this;
    }
    /** Simulate clicking the button. */
    click(): void {
        if (!this._disabled && this._onClick) {
            this._onClick();
        }
    }
}

/** Minimal Setting mock for headless modal tests. */
export class Setting {
    public settingEl: HTMLElement;
    public controlEl: HTMLElement;
    public nameEl: HTMLElement;
    public descEl: HTMLElement;

    constructor(container: HTMLElement) {
        const doc = typeof document !== 'undefined' ? document : null;
        const settingDiv = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(settingDiv);
        this.settingEl = settingDiv;
        const controlDiv = doc ? doc.createElement('div') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(controlDiv);
        this.controlEl = controlDiv;
        const nameSpan = doc ? doc.createElement('span') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(nameSpan);
        this.nameEl = nameSpan;
        const descSpan = doc ? doc.createElement('span') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(descSpan);
        this.descEl = descSpan;
        if (doc) {
            container.appendChild(this.settingEl);
            this.settingEl.appendChild(this.controlEl);
        }
    }

    setName(_name: string): this { return this; }
    setDesc(_desc: string): this { return this; }
    addText(cb: (text: TextComponent) => void): this {
        const text = new TextComponent();
        cb(text);
        return this;
    }
    addTextArea(_cb: (text: { setPlaceholder: () => unknown; setValue: () => unknown; onChange: (fn: (v: string) => void) => void; inputEl: any }) => void): this {
        const mockInput = { value: '', rows: 3, style: {} } as any;
        const mockText = {
            setPlaceholder: () => mockText,
            setValue: () => mockText,
            onChange: (_fn: (v: string) => void) => {},
            inputEl: mockInput,
        };
        _cb(mockText);
        return this;
    }
    addDropdown(cb: (dd: DropdownComponent) => void): this {
        const dd = new DropdownComponent();
        cb(dd);
        return this;
    }
    addButton(cb: (btn: ButtonComponent) => void): this {
        const btn = new ButtonComponent();
        cb(btn);
        return this;
    }
}
