import * as yaml from 'js-yaml';
export { App, moment } from './obsidian-extra-mocks';

export class TFile {
    public path: string;
    public name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
    }
}

export class TFolder {
    public path: string;
    public name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
    }
}

export class TAbstractFile {
    public path: string;
    public name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
    }
}

export function parseYaml(text: string): unknown { return yaml.load(text); }
export function stringifyYaml(obj: unknown): string { return yaml.dump(obj); }
export function normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

export class Notice {
    constructor(_message: string) {}
}

/** Mock requestUrl so DocxConverter can be imported in Node.js. */
export async function requestUrl(_url: string): Promise<never> {
    throw new Error('requestUrl is not available in headless tests');
}

/** Controllable Platform mock for testing mobile/desktop command gating. */
export const Platform = {
    _isMobile: false,
    get isMobile(): boolean { return (Platform as any)._isMobile; },
    set isMobile(value: boolean) { (Platform as any)._isMobile = value; },
};

function patchObsidianElement(el: HTMLElement): void {
    if (typeof (el as any).createEl !== 'undefined') return;
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
    (el as any).setCssStyles = (styles: Record<string, string>) => { Object.assign(el.style, styles); };
    (el as any).onClickEvent = (fn: (e: Event) => void) => { el.addEventListener('click', fn); return el; };
}

export class Modal {
    public contentEl: HTMLElement;
    public titleEl: HTMLElement;
    private _onCloseCallbacks: Array<() => void> = [];
    private _isOpen = false;

    constructor(_app: unknown) {
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

    open(): void { this._isOpen = true; this.onOpen(); }
    close(): void { this._isOpen = false; for (const cb of this._onCloseCallbacks) cb(); this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
}

export class TextComponent {
    public inputEl: HTMLElement;
    private _onChange?: (value: string) => void;
    constructor() {
        const doc = typeof document !== 'undefined' ? document : null;
        this.inputEl = doc ? doc.createElement('input') : {} as unknown as HTMLElement;
        if (doc) patchObsidianElement(this.inputEl);
    }
    setPlaceholder(_placeholder: string): this { return this; }
    setValue(_value: string): this { return this; }
    onChange(fn: (value: string) => void): this { this._onChange = fn; return this; }
}

export class DropdownComponent {
    public selectEl: HTMLElement;
    private _onChange?: (value: string) => void;
    private _options: Record<string, string> = {};
    constructor() {
        const doc = typeof document !== 'undefined' ? document : null;
        this.selectEl = doc ? doc.createElement('select') : {} as unknown as HTMLElement;
    }
    addOption(value: string, label: string): this { this._options[value] = label; return this; }
    addOptions(options: Record<string, string>): this { Object.assign(this._options, options); return this; }
    setValue(_value: string): this { return this; }
    onChange(fn: (value: string) => void): this { this._onChange = fn; return this; }
}

export class ButtonComponent {
    public buttonEl: HTMLElement;
    private _onClick?: () => void;
    private _disabled = false;
    constructor() {
        const doc = typeof document !== 'undefined' ? document : null;
        this.buttonEl = doc ? doc.createElement('button') : {} as unknown as HTMLElement;
    }
    setButtonText(text: string): this { this.buttonEl.textContent = text; return this; }
    setCta(): this { return this; }
    setDisabled(disabled: boolean): this { this._disabled = disabled; return this; }
    onClick(fn: () => void): this {
        this._onClick = fn;
        this.buttonEl.addEventListener('click', () => {
            if (!this._disabled) fn();
        });
        return this;
    }
    click(): void { this.buttonEl.dispatchEvent(new Event('click')); }
}

function createMockElement(tag: string): HTMLElement {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return {} as unknown as HTMLElement;
    const el = doc.createElement(tag);
    patchObsidianElement(el);
    return el;
}

/** Minimal Setting mock for headless modal tests. */
export class Setting {
    public settingEl: HTMLElement;
    public controlEl: HTMLElement;
    public nameEl: HTMLElement;
    public descEl: HTMLElement;

    constructor(container: HTMLElement) {
        const doc = typeof document !== 'undefined' ? document : null;
        this.settingEl = createMockElement('div');
        this.controlEl = createMockElement('div');
        this.nameEl = createMockElement('span');
        this.descEl = createMockElement('span');
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
        if (btn.buttonEl && typeof document !== 'undefined') {
            this.controlEl.appendChild(btn.buttonEl);
        }
        return this;
    }
}
