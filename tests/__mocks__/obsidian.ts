/**
 * Mock of the Obsidian API for unit tests.
 * Provides stubs for the most commonly used symbols.
 */

// Core types
export class App {
    vault: any = null;
    workspace: any = null;
    commands: any = null;
    scope: any = null;
    plugins: any = null;
    customRibbon = false;
    manifest: any = null;
    metadataCache: any = null;
    resourceManager: any = null;
    isMobileEditor = false;
    isMobile = false;
    isSafari = false;
    isMac = false;
    isWindows = false;
    isLinux = false;
}

export class Vault {
    adapter: any = null;
    getMarkdownFiles() { return []; }
    getAllFiles() { return []; }
    getFileByPath() { return null; }
    getFolderByPath() { return null; }
}

export class WorkspaceLeaf {
    view: any = null;
}

export class ItemView {
    constructor(leaf: any) {}
    getViewType() { return ''; }
    getDisplayText() { return ''; }
    getIcon() { return ''; }
    containerEl: any = null;
    async onOpen() {}
    async onClose() {}
}

export class Modal {
    app: any = null;
    contentEl: any = null;
    titleEl: any = null;
    open() {}
    close() {}
    constructor() {
        this.contentEl = {
            createDiv: () => this.contentEl,
            createSpan: () => this.contentEl,
            createEl: () => this.contentEl,
        };
        this.titleEl = {
            setText: () => {},
        };
    }
}

export class Setting {
    constructor(_container: any) {}
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addButton() { return this; }
    addDropdown() { return this; }
    addTextArea() { return this; }
    addMomentFormat() { return this; }
    addSlider() { return this; }
    addToggle() { return this; }
    addSearch() { return this; }
    addCheckbox() { return this; }
    setClass() { return this; }
    setHeading() { return this; }
    addExtraButton() { return this; }
}

export class TextComponent {
    setPlaceholder() { return this; }
    onChange() { return this; }
    inputEl: any = null;
    setValue() { return this; }
    getValue() { return ''; }
}

export class ButtonComponent {
    setButtonText() { return this; }
    setCta() { return this; }
    setWarning() { return this; }
    onClick() { return this; }
    setClass() { return this; }
}

export class DropdownComponent {
    addOption() { return this; }
    onChange() { return this; }
    setValue() { return this; }
    getValue() { return ''; }
    selectEl: any = { empty: () => {} };
}

export class Notice {
    constructor(_message: string, _timeout?: number) {}
}

export class Menu {
    addItem() { return this; }
    showAtPosition() {}
    showAtMouseEvent() {}
    open() {}
    close() {}
}

// Utilities
export function normalizePath(path: string): string {
    if (!path) return '';
    let result = path.replace(/\\/g, '/');
    while (result.startsWith('./')) result = result.substring(2);
    if (result !== '.' && result.endsWith('/')) result = result.slice(0, -1);
    return result;
}

export function setIcon(el: any, icon: string): void {
    // No-op
}

export function addIcon(_id: string, _svg: string): void {
    // No-op
}

// Adapter interface
export interface Adapter {
    path: string;
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, data: string): Promise<void>;
    remove(path: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    rmdir(path: string, empty: boolean): Promise<void>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    copy(src: string, dest: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    getResourcePath(path: string): string | undefined;
}

// TFolder
export class TFolder {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || path;
    }
}

// TFile
export class TFile {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || path;
    }
}

export default {};
