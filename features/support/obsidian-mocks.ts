/**
 * Mock of the Obsidian API for Cucumber tests.
 * Provides stubs for the most commonly used symbols.
 */

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
    this.titleEl = { setText: () => {} };
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

export class Menu {
  constructor(_container: any) {}
  addItem() { return this; }
  showAtPosition() {}
  showAtMouseEvent() {}
  openUrl() {}
  setIcon() { return this; }
  setTooltip() { return this; }
  setId() { return this; }
  setSection() { return this; }
}

export class Plugin {
  app: any = null;
  manifest: any = null;
  async onload() {}
  async onunload() {}
  saveData(_data: any) {}
  loadData() { return null; }
  registerEvent(_event: any) {}
  register(_event: any) {}
  registerInterval(_fn: () => void, _ms: number) { return 0; }
  registerDomEvent(_el: any, _type: string, _fn: () => void) {}
  deregisterDomEvent(_el: any, _type: string, _fn: () => void) {}
  registerHoverParent(_el: any) {}
  registerObserver(_type: string, _fn: () => void) { return { unload: () => {} }; }
  unregister(_type: string, _fn: () => void) {}
  addCommand(_command: any) {}
  addRibbonIcon(_icon: string, _tooltip: string, _callback: () => void) {}
  addSettingTab(_tab: any) {}
  getSetting(_key: string) { return undefined; }
  setSetting(_key: string, _value: any) {}
}

export class PluginSettingTab {
  app: any = null;
  plugin: any = null;
  containerEl: any = null;
  display() {}
  hide() {}
}

export class TFile {
  path: string;
  name: string;
  parent: any;
  stat: any;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.parent = null;
    this.stat = { mtime: Date.now(), ctime: Date.now() };
  }
}

export class TFolder {
  path: string;
  name: string;
  parent: any;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.parent = null;
  }
}

export class Component {
  destroy() {}
  load() {}
  onUnload(_fn: () => void) {}
}

export class Editor {
  getValue() { return ''; }
  setValue(_value: string) {}
  getCursor() { return { line: 0, ch: 0 }; }
  setCursor(_cursor: any) {}
  selection: any = null;
  mode: any = null;
}

export class Workspace {
  activeLeaf: any = null;
  getLeavesOfType(_type: string) { return []; }
  getLeaf(_type: string) { return null; }
  rightLeaf: any = null;
  on(_type: string, _fn: () => void) { return { unload: () => {} }; }
  off(_type: string, _fn: () => void) {}
}

export class RequestUrlResponse {
  status: number = 200;
  arrayBuffer: ArrayBuffer = new ArrayBuffer(0);
  text: string = '';
  binary: ArrayBuffer = new ArrayBuffer(0);
  headers: any = {};
}

export function setIcon(_el: any, _icon: string) {}
export function getIcon(_icon: string) { return null; }

export class MarkdownView {
  editor: Editor = new Editor();
  sourceMode: any = null;
  displayMode: any = null;
  getFile() { return null; }
}

export class MarkdownPreviewView {
  getFile() { return null; }
}

export class MarkdownRenderer {
  static async render(_app: any, _source: string, _container: any, _sourcePath: string, _component: any) {}
}

export class Moment {
  constructor(_date?: any) {}
  format() { return ''; }
  isSame() { return false; }
  isBefore() { return false; }
  isAfter() { return false; }
  isValid() { return true; }
  static parseAny(_format: string, _input: any) { return new Moment(); }
  static locale() { return 'en'; }
}

export function moment(_date?: any) { return new Moment(); }

export class EventRef {
  unload() {}
}

export class Scope {
  register(_event: string, _fn: () => void) { return { unload: () => {} }; }
  unregister(_event: string, _fn: () => void) {}
}

export class Platform {
  static isDesktop = true;
  static isMobile = false;
  static isSafari = false;
  static isMac = false;
  static isWindows = false;
  static isLinux = false;
  static isAndroid = false;
  static isIOS = false;
}

export class FuzzySuggestModal {
  constructor() {}
  setPlaceholder(_text: string) {}
  open() {}
  close() {}
  getItems() { return []; }
  getItemText() { return ''; }
  onChooseItem() {}
}

export class Keymap {
  static isModEvent(_e: any) { return false; }
  static isModClick(_e: any) { return false; }
}

export class AbstractInputSuggest {
  constructor(_containerEl: any) {}
  register() {}
  unregister() {}
  onInputChanged(_value: string) {}
  onChooseItem(_item: any) {}
}

export class TextAreaSuggest {
  constructor(_containerEl: any) {}
  register() {}
  unregister() {}
}

export class EditorSuggest {
  constructor(_app: any) {}
  register() {}
  unregister() {}
}

export class HoverPopover {
  constructor() {}
}

export class Icon {
  static setIcon(_el: any, _icon: string) {}
  static getIcon(_icon: string) { return null; }
}

export class FileView {
  getFile() { return null; }
}

export class SearchView {
  getFile() { return null; }
}

export class Backlink {
  source: any = null;
  page: any = null;
}

export class OutgoingLink {
  path: string = '';
  displayText: string = '';
}

export class FileStats {
  mtime: number = Date.now();
  ctime: number = Date.now();
  size: number = 0;
}

export class Adapter {
  async read(_path: string) { return ''; }
  async write(_path: string, _data: string) {}
  async stat(_path: string) { return null; }
  async list(_path: string) { return { files: [], folders: [] }; }
  async remove(_path: string) {}
  async rename(_path: string) {}
  async copy(_path: string, _dest: string) {}
  async copyDirectory(_path: string, _dest: string) {}
  async mkdir(_path: string) {}
  async exists(_path: string) { return false; }
  async readBinary(_path: string) { return new ArrayBuffer(0); }
  async writeBinary(_path: string, _data: ArrayBuffer) {}
}

export async function requestUrl(_url: any) {
  return new RequestUrlResponse();
}

export class Debouncer {
  constructor(_fn: () => void, _delay: number) {}
  debounce() {}
  cancel() {}
}

export class RateLimiter {
  constructor(_fn: () => void, _interval: number) {}
  call() {}
  cancel() {}
}

export class MarkdownPostProcessor {
  el: any = null;
  sourcePath: string = '';
  async doProcess(_el: any, _component: any) {}
}

export class Command {
  id: string = '';
  name: string = '';
  callback: () => void = () => {};
  checkCallback: () => void = () => {};
  icon: string = '';
  hotkeys: any[] = [];
  advanced: boolean = false;
}

export class Commands {
  addCommand(_command: any, _id?: string) {}
  executeCommandById(_id: string) { return false; }
  executeCommand(_command: Command) { return false; }
  listCommands() { return []; }
  removeCommand(_id: string) {}
}

export class EditorType {
  static SOURCE_MODE = 'source';
  static PREVIEW_MODE = 'preview';
  static READING_MODE = 'reading';
}

export class ViewType {
  static MARKDOWN = 'markdown';
  static PDF = 'pdf';
  static IMAGE = 'image';
  static AUDIO = 'audio';
  static VIDEO = 'video';
  static EMBEDDED = 'embed';
}

export class LayoutSize {
  static SMALL = 'small';
  static MEDIUM = 'medium';
  static LARGE = 'large';
}

export class ColorRef {
  constructor(_color: string) {}
  toCSS() { return ''; }
}

export class ColorManager {
  registerColor(_name: string, _color: string) {}
  unregisterColor(_name: string) {}
  getColor(_name: string) { return null; }
  getColors() { return {}; }
}

export class ThemeManager {
  on(_type: string, _fn: () => void) { return { unload: () => {} }; }
  off(_type: string, _fn: () => void) {}
  getCurrentTheme() { return ''; }
  getAvailableThemes() { return []; }
  setTheme(_theme: string) {}
}

export class PluginManifest {
  id: string = '';
  name: string = '';
  version: string = '';
  minAppVersion: string = '';
  description: string = '';
  author: string = '';
}

export class PluginManager {
  on(_type: string, _fn: () => void) { return { unload: () => {} }; }
  off(_type: string, _fn: () => void) {}
  getPlugin(_id: string) { return null; }
  isEnabled(_id: string) { return false; }
  isDisabled(_id: string) { return true; }
}

export class MetadataCache {
  on(_type: string, _fn: () => void) { return { unload: () => {} }; }
  off(_type: string, _fn: () => void) {}
  getFileCache(_file: any) { return null; }
  getFileCacheByPath(_path: string) { return null; }
  getFileByPath(_path: string) { return null; }
  getUnresolvedReferences(_cache: any) { return []; }
  getBacklinksForFile(_file: any) { return []; }
  getSuggestions(_prefix: string, _path: string, _component: any) { return []; }
}

export class NormalizedTask {
  constructor(_task: string) {}
}

export class Task {
  static fromLine(_line: string, _prefix: string, _sectionStart: number, _listIndent: number, _parent: any) { return null; }
}

export class CanvasView {
  getFile() { return null; }
}

export class CanvasData {
  constructor() {}
}

export class CanvasNode {
  constructor() {}
}

export class CanvasEdge {
  constructor() {}
}

export class CanvasContainer {
  constructor() {}
}
