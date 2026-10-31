import { bandsOf, buildLeaves, columnFacade, groupRuns, selectionConfig, visibleLeaves, AUTO_GROUP_COL_ID, autoGroupLeaf, rowNumberLeaf, ROW_NUMBERS_COL_ID, type Leaf, type SelectionConfig } from './columns';
import { encodeCsv, encodeCsvRaw, downloadCsv } from './csv';
import { workbookBytes } from './xlsx';
import { WORKER_ROW_MIN, WorkerEngine } from './engine-client';
import { applyFilter, applyQuickFilter, hasQuickFilter, queryView, type SortKey, type ViewResult } from './engine';
import { aggregate, flattenGroups, flattenTree, type FlatRow, type GroupFlat } from './group';
import { FALLBACK_COLORS, paintFrame, type PaintColors, type PaintColumn } from './paint';
import { buildStore, cellRaw, formatDay, readPath, sharedMemoryAvailable, writePath, writeVector, type ColumnStore, type StoreField } from './store';
import type {
  AgEvent,
  AdvancedFilterModel,
  ApplyColumnStateParams,
  Column,
  ColumnState,
  CsvExportParams,
  FilterModel,
  GridApi,
  GridOptions,
  GridState,
  IRowNode,
  RowDataTransaction,
  RowNodeTransaction,
  ProvidedFilterModel,
  SimpleFilterModel,
  SortDirection,
} from './types';

const MAX_SCROLL = 8_000_000;
let nextGridId = 1;

interface EditorState<TData> {
  input: HTMLInputElement;
  displayRow: number;
  source: number;
  leaf: Leaf<TData>;
}

export class GridSession<TData = any> {
  readonly id = `og-${nextGridId++}`;
  readonly api: GridApi<TData>;
  private readonly host: HTMLElement;
  private options: GridOptions<TData>;
  private rows: TData[] = [];
  private leaves: Leaf<TData>[] = [];
  private selection: SelectionConfig<TData> = selectionConfig({});
  private store: ColumnStore = { rowCount: 0, columns: new Map() };
  private view: ViewResult = { indices: new Uint32Array(0), count: 0, identity: true };
  private leafView: ViewResult = { indices: new Uint32Array(0), count: 0, identity: true };
  private flat: FlatRow[] | null = null;
  private groupExpanded = new Map<string, boolean>();
  private groupNodes = new Map<string, GroupNode<TData>>();
  private detailOpen = new Set<number>();
  private cellRanges: { rowStartIndex: number; rowEndIndex: number; columns: string[] }[] = [];
  private chartPanel: HTMLElement | null = null;
  private chartSeq = 0;
  private advancedModel: AdvancedFilterModel | null = null;
  private reverse: Uint32Array | null = null;
  private selected = new Uint8Array(0);
  private selectedList: number[] = [];
  private anchor = 0;
  private filterModel: FilterModel = {};
  private focusRow = 0;
  private focusCol = 0;
  private generation = 0;
  private sawFirst = false;
  private destroyed = false;
  private worker: WorkerEngine | null = null;
  private workerReady: Promise<void> = Promise.resolve();
  private editor: EditorState<TData> | null = null;
  private closingEditor = false;
  private colors: PaintColors = FALLBACK_COLORS;
  private leftWidth = 0;
  private centerWidth = 0;
  private rightWidth = 0;
  private positions = new Map<string, { x: number; width: number; pinned: 'left' | 'right' | null }>();
  private nodes = new Map<number, RowNode<TData>>();
  private idToSource = new Map<string, number>();
  private listeners = new Map<string, Set<(event: AgEvent<TData>) => void>>();
  private warned = new Set<string>();
  private root: HTMLElement;
  private headerLeft: HTMLElement;
  private headerShift: HTMLElement;
  private headerRight: HTMLElement;
  private header: HTMLElement;
  private viewport: HTMLElement;
  private spacer: HTMLElement;
  private canvas: HTMLCanvasElement;
  private floatLayer: HTMLElement;
  private popup: HTMLElement;
  private a11y: HTMLElement;
  private live: HTMLElement;
  private empty: HTMLElement;
  private pager: HTMLElement;
  private status: HTMLElement | null = null;
  private groupPanel!: HTMLElement;
  private undoStack: { source: number; colId: string; value: unknown }[] = [];
  private redoStack: { source: number; colId: string; value: unknown }[] = [];
  private lastClipboard = '';
  private pageIndex = 0;
  private infiniteKnown = false;
  private infiniteGen = 0;
  private infiniteBlocks = new Map<number, 'loading' | 'loaded'>();
  private dragFrom = -1;
  private dragOver = -1;
  private resizeObserver: ResizeObserver | null = null;
  private paintFrameId = 0;
  private customText = new Map<string, string>();
  private a11yTimer = 0;

  constructor(host: HTMLElement, options: GridOptions<TData>) {
    if (options.rowModelType && options.rowModelType !== 'clientSide' && options.rowModelType !== 'infinite' && options.rowModelType !== 'serverSide' && options.rowModelType !== 'viewport') {
      throw new Error(`opengrid: rowModelType "${options.rowModelType}" is not in this build`);
    }
    this.host = host;
    this.options = options;
    this.api = this.createApi();
    Object.assign(this.options, { api: this.api });
    this.root = document.createElement('div');
    this.root.className = 'og-root';
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'grid');
    this.root.dataset.gridId = this.id;
    this.header = el('div', 'og-header');
    this.headerLeft = el('div', 'og-h-left');
    this.headerShift = el('div', 'og-h-shift');
    const headerCenter = el('div', 'og-h-center');
    headerCenter.append(this.headerShift);
    this.headerRight = el('div', 'og-h-right');
    this.header.append(this.headerLeft, headerCenter, this.headerRight);
    const body = el('div', 'og-body');
    this.viewport = el('div', 'og-viewport');
    this.spacer = el('div', 'og-spacer');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'og-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.viewport.append(this.spacer);
    this.floatLayer = el('div', 'og-float');
    body.append(this.viewport, this.canvas, this.floatLayer);
    this.popup = el('div', 'og-pop');
    this.popup.hidden = true;
    this.a11y = el('div', 'og-a11y');
    this.live = el('div', 'og-live');
    this.live.setAttribute('aria-live', 'polite');
    this.empty = el('div', 'og-empty');
    this.empty.hidden = true;
    this.pager = el('div', 'og-pager');
    this.pager.hidden = true;
    this.groupPanel = el('div', 'og-group-panel');
    this.groupPanel.hidden = true;
    this.root.append(this.header, body, this.a11y);
    const shell = el('div', 'og-shell');
    shell.append(this.groupPanel, this.root, this.pager, this.popup, this.live, this.empty);
    if (this.options.statusBar?.statusPanels?.length) {
      this.status = el('div', 'og-status');
      shell.append(this.status);
    }
    this.host.classList.add('og-host');
    this.host.replaceChildren(shell);
    this.viewport.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.viewport.addEventListener('click', (event) => this.onBodyClick(event));
    this.viewport.addEventListener('pointerdown', (event) => {
      this.onFillDown(event);
      this.onRangeDown(event);
      this.onRowDragDown(event);
    });
    this.viewport.addEventListener('dblclick', (event) => this.onBodyDoubleClick(event));
    this.viewport.addEventListener('contextmenu', (event) => this.onContextMenu(event));
    this.root.addEventListener('keydown', (event) => this.onKey(event));
    this.root.addEventListener('paste', (event) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text || this.cellRanges.length === 0) return;
      event.preventDefault();
      this.pasteClipboard(text);
    });
    this.root.addEventListener('focus', () => {
      if (this.view.count > 0) this.setFocus(this.focusRow, this.focusCol, false);
    });
    document.addEventListener('pointerdown', (event) => {
      if (!this.popup.hidden && event.target instanceof Node && !this.popup.contains(event.target) && !this.header.contains(event.target)) {
        this.popup.hidden = true;
      }
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.resizeObserver.observe(this.viewport);
    }
    this.readColors();
    this.rebuildColumns(options.rowData ?? []);
    this.mountSide();
    if (this.remoteMode()) this.bootInfinite();
    else if (this.options.rowModelType === 'viewport') this.bootViewport();
    else this.loadRows(options.rowData ?? [], true);
    this.emit('gridReady', {});
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit('gridPreDestroyed', {});
    this.resizeObserver?.disconnect();
    this.worker?.destroy();
    this.worker = null;
    this.options.datasource?.destroy?.();
    this.host.replaceChildren();
    this.host.classList.remove('og-host');
  }

  private rebuildColumns(sample: readonly TData[]): void {
    this.selection = selectionConfig(this.options);
    this.leaves = buildLeaves(this.options, sample);
    if (this.options.rowNumbers) this.leaves.unshift(rowNumberLeaf<TData>());
    this.layout();
  }

  private loadRows(rows: TData[] | null | undefined, initial: boolean): void {
    this.rows = rows ? rows.slice() : [];
    this.nodes.clear();
    this.idToSource.clear();
    const fields: StoreField[] = [];
    for (const leaf of this.leaves) {
      if (leaf.selectionColumn || leaf.colId === ROW_NUMBERS_COL_ID) continue;
      fields.push({
        colId: leaf.colId,
        kind: leaf.kind,
        plainField: !leaf.valueGetter && leaf.field && !leaf.field.includes('.') ? leaf.field : undefined,
        read: (row) => this.readRow(leaf, row),
      });
    }
    const shared = sharedMemoryAvailable() && this.rows.length > WORKER_ROW_MIN;
    this.store = buildStore(this.rows, fields, shared);
    this.selected = new Uint8Array(this.rows.length);
    this.selectedList = [];
    if (this.options.getRowId) {
      for (let source = 0; source < this.rows.length; source++) {
        const row = this.rows[source];
        if (row === undefined) continue;
        this.idToSource.set(this.options.getRowId({ data: row, level: 0 }), source);
      }
    }
    this.startWorker();
    this.focusRow = 0;
    this.focusCol = 0;
    this.refresh(initial ? 'initial' : 'data');
  }

  private startWorker(): void {
    this.worker?.destroy();
    this.worker = null;
    this.root.dataset.engine = 'local';
    if (this.rows.length <= WORKER_ROW_MIN || typeof Worker !== 'function') {
      this.root.dataset.worker = 'skipped';
      return;
    }
    this.root.dataset.worker = 'pending';
    try {
      const engine = new WorkerEngine();
      this.worker = engine;
      this.workerReady = engine.load(this.store).then(() => {
        if (this.worker === engine) {
          this.root.dataset.engine = 'worker';
          this.root.dataset.worker = 'ready';
        }
      }).catch(() => {
        if (this.worker === engine) {
          engine.destroy();
          this.worker = null;
          this.root.dataset.engine = 'local';
          this.root.dataset.worker = 'failed';
        }
      });
    } catch {
      this.worker = null;
      this.root.dataset.engine = 'local';
      this.root.dataset.worker = 'failed';
    }
  }

  private infiniteMode(): boolean {
    return this.options.rowModelType === 'infinite';
  }

  private remoteMode(): boolean {
    return this.options.rowModelType === 'infinite' || this.options.rowModelType === 'serverSide';
  }

  private bootInfinite(): void {
    const known = this.options.rowModelType === 'serverSide' ? undefined : this.options.datasource?.rowCount;
    this.infiniteKnown = typeof known === 'number';
    const count = known ?? this.options.infiniteInitialRowCount ?? 1;
    this.rows = new Array(count);
    this.selected = new Uint8Array(count);
    this.selectedList = [];
    this.view = { indices: new Uint32Array(0), count, identity: true };
    this.store = buildStore([], []);
    this.layout();
    this.ensureInfinite();
  }

  private setInfiniteCount(count: number): void {
    const next = Math.max(0, count);
    if (this.rows.length < next) this.rows.length = next;
    else if (this.rows.length > next) this.rows.length = next;
    if (this.selected.length < next) {
      const grown = new Uint8Array(next);
      grown.set(this.selected);
      this.selected = grown;
    }
    this.view = { indices: new Uint32Array(0), count: next, identity: true };
  }

  private infiniteSortModel(): { colId: string; sort: 'asc' | 'desc'; type: string }[] {
    return this.sortKeys().map((key) => ({ colId: key.colId, sort: key.direction, type: 'default' }));
  }

  private ensureInfinite(): void {
    if (!this.remoteMode() || this.view.count <= 0) return;
    if (this.options.rowModelType === 'infinite' && !this.options.datasource) return;
    if (this.options.rowModelType === 'serverSide' && !this.options.serverSideDatasource) return;
    const size = Math.max(1, this.options.cacheBlockSize ?? 100);
    const rowHeight = this.rowHeight();
    const first = Math.max(0, Math.floor(this.virtualTop() / rowHeight));
    const visible = this.viewport.clientHeight > 0 ? Math.max(1, Math.floor(this.viewport.clientHeight / rowHeight)) : 1;
    const buffer = 10;
    const last = Math.min(this.view.count - 1, first + visible - 1 + buffer);
    const firstBlock = Math.floor(first / size);
    let lastBlock = Math.floor(Math.max(first, last) / size);
    if (!this.infiniteKnown) lastBlock = Math.max(lastBlock, firstBlock + 1);
    const maxBlock = Math.floor(Math.max(0, this.view.count - 1) / size);
    if (this.infiniteKnown) lastBlock = Math.min(lastBlock, maxBlock);
    for (let block = firstBlock; block <= lastBlock; block++) this.loadInfiniteBlock(block, size);
  }

  private loadInfiniteBlock(block: number, size: number): void {
    const datasource = this.options.rowModelType === 'serverSide' ? this.options.serverSideDatasource : this.options.datasource;
    if (!datasource || this.infiniteBlocks.has(block)) return;
    const start = block * size;
    const end = start + size;
    const generation = this.infiniteGen;
    this.infiniteBlocks.set(block, 'loading');
    if (this.options.rowModelType === 'serverSide' && this.options.serverSideDatasource) {
      this.options.serverSideDatasource.getRows({
        request: { startRow: start, endRow: end, sortModel: this.infiniteSortModel(), filterModel: this.filterModel },
        success: ({ rowData, rowCount }) => this.infiniteSuccess(generation, start, end, rowData, rowCount),
        fail: () => {
          if (generation !== this.infiniteGen) return;
          this.infiniteBlocks.delete(block);
        },
      });
      return;
    }
    if (!this.options.datasource) return;
    this.options.datasource.getRows({
      startRow: start,
      endRow: end,
      successCallback: (rows, lastRow) => this.infiniteSuccess(generation, start, end, rows, lastRow),
      failCallback: () => {
        if (generation !== this.infiniteGen) return;
        this.infiniteBlocks.delete(block);
      },
      sortModel: this.infiniteSortModel(),
      filterModel: this.filterModel,
      context: this.options.context,
    });
  }

  private infiniteSuccess(generation: number, start: number, end: number, rows: TData[], lastRow?: number): void {
    if (generation !== this.infiniteGen || this.destroyed) return;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (row === undefined) continue;
      this.rows[start + index] = row;
      if (this.options.getRowId) this.idToSource.set(this.options.getRowId({ data: row, level: 0 }), start + index);
    }
    this.infiniteBlocks.set(Math.floor(start / Math.max(1, this.options.cacheBlockSize ?? 100)), 'loaded');
    if (typeof lastRow === 'number') {
      this.infiniteKnown = true;
      this.setInfiniteCount(lastRow);
    } else if (!this.infiniteKnown) {
      const overflow = this.options.cacheOverflowSize ?? 1;
      this.setInfiniteCount(Math.max(this.view.count, end + overflow));
    }
    this.layout();
    this.syncA11y();
    if (!this.sawFirst && rows.length > 0) {
      this.sawFirst = true;
      this.emit('firstDataRendered', {});
    }
    this.emit('modelUpdated', {});
    this.ensureInfinite();
  }

  private reloadInfinite(purge: boolean): void {
    this.infiniteGen += 1;
    this.infiniteBlocks.clear();
    this.nodes.clear();
    this.idToSource.clear();
    if (purge) {
      const count = this.view.count;
      this.rows = new Array(count);
    }
    this.layout();
    this.ensureInfinite();
  }

  private bootViewport(): void {
    this.rows = [];
    this.selected = new Uint8Array(0);
    this.selectedList = [];
    this.view = { indices: new Uint32Array(0), count: 0, identity: true };
    this.store = buildStore([], []);
    const datasource = this.options.viewportDatasource;
    if (!datasource) return;
    datasource.init({
      setRowCount: (count) => {
        this.setInfiniteCount(count);
        this.layout();
        this.syncA11y();
        this.pushViewport();
      },
      setRowData: (rows) => {
        for (const key of Object.keys(rows)) {
          const index = Number(key);
          const row = rows[index];
          if (!Number.isInteger(index) || index < 0 || row === undefined) continue;
          this.rows[index] = row;
          if (this.options.getRowId) this.idToSource.set(this.options.getRowId({ data: row, level: 0 }), index);
        }
        this.layout();
        this.syncA11y();
      },
    });
    this.pushViewport();
  }

  private pushViewport(): void {
    const datasource = this.options.viewportDatasource;
    if (this.options.rowModelType !== 'viewport' || !datasource || this.view.count <= 0) return;
    const rowHeight = this.rowHeight();
    const first = Math.max(0, Math.floor(this.virtualTop() / rowHeight));
    const visible = this.viewport.clientHeight > 0 ? Math.max(1, Math.floor(this.viewport.clientHeight / rowHeight)) : 1;
    const last = Math.min(this.view.count - 1, first + visible - 1);
    datasource.setViewportRange(first, last);
  }

  private refresh(reason: 'initial' | 'sort' | 'filter' | 'data' | 'edit'): void {
    if (this.remoteMode()) {
      if (reason !== 'initial') this.reloadInfinite(true);
      return;
    }
    const generation = ++this.generation;
    this.root.dataset.generation = String(generation);
    const sort = this.sortKeys();
    const custom = sort.some((key) => this.leafById(key.colId)?.comparator);
    const initial = reason === 'initial';
    const useWorker = Boolean(this.worker) && !custom && this.rows.length > WORKER_ROW_MIN && !initial;
    if (!useWorker) {
      const quick = this.quickText();
      const filtered = applyQuickFilter(this.store, applyFilter(this.store, this.filterModel), quick);
      const view = custom ? this.comparisonSort(filtered, sort) : queryView(this.store, sort, this.filterModel, quick);
      this.applyView(view, generation, reason);
      if (initial && this.worker && (sort.length > 0 || this.hasFilter())) {
        void this.workerReady.then(() => {
          if (this.generation === generation) this.refresh('sort');
        });
      }
      return;
    }
    this.root.dataset.busy = '1';
    void this.workerReady.then(() => this.worker?.query(sort, this.filterModel, this.quickText())).then((view) => {
      if (!view || generation !== this.generation || this.destroyed) return;
      this.root.dataset.computeMs = String(Math.round(view.computeMs));
      this.applyView(view, generation, reason);
    }).catch(() => {
      if (generation !== this.generation) return;
      this.worker?.destroy();
      this.worker = null;
      this.root.dataset.engine = 'local';
      this.refresh(reason);
    });
  }

  private groupLeaves(): Leaf<TData>[] {
    return this.leaves
      .filter((leaf) => leaf.def.rowGroup && leaf.colId !== AUTO_GROUP_COL_ID)
      .slice()
      .sort((left, right) => (left.def.rowGroupIndex ?? 0) - (right.def.rowGroupIndex ?? 0));
  }

  private groupValue(source: number, colId: string): string {
    const leaf = this.leafById(colId);
    if (!leaf) return '';
    const value = this.readSource(source, leaf);
    if (value == null) return '';
    if (leaf.kind === 'date' && typeof value === 'number') return formatDay(value);
    return String(value);
  }

  private undoCellEditing(): void {
    const item = this.undoStack.pop();
    if (!item) return;
    const leaf = this.leafByKey(item.colId);
    if (!leaf) return;
    const current = this.readSource(item.source, leaf);
    this.redoStack.push({ source: item.source, colId: item.colId, value: current });
    this.writeSource(item.source, leaf, item.value, 'undo');
  }

  private redoCellEditing(): void {
    const item = this.redoStack.pop();
    if (!item) return;
    const leaf = this.leafByKey(item.colId);
    if (!leaf) return;
    const current = this.readSource(item.source, leaf);
    this.undoStack.push({ source: item.source, colId: item.colId, value: current });
    this.writeSource(item.source, leaf, item.value, 'redo');
  }

  private applyAdvanced(view: ViewResult): ViewResult {
    if (!this.advancedModel) return view;
    const indices = new Uint32Array(view.count);
    let count = 0;
    for (let index = 0; index < view.count; index++) {
      const source = view.identity ? index : view.indices[index] ?? -1;
      if (source >= 0 && this.advancedPass(this.advancedModel, source)) indices[count++] = source;
    }
    return { indices, count, identity: false };
  }

  private advancedPass(model: AdvancedFilterModel, source: number): boolean {
    if (model.filterType === 'join') {
      const parts = model.conditions ?? [];
      return model.type === 'OR' ? parts.some((part) => this.advancedPass(part, source)) : parts.every((part) => this.advancedPass(part, source));
    }
    const leaf = model.colId ? this.leafByKey(model.colId) : undefined;
    if (!leaf) return false;
    if (model.filterType === 'number') {
      const raw = this.readSource(source, leaf);
      const value = typeof raw === 'number' ? raw : Number(raw);
      const target = Number(model.filter);
      if (Number.isNaN(value) || Number.isNaN(target)) return false;
      if (model.type === 'greaterThan') return value > target;
      if (model.type === 'lessThan') return value < target;
      return value === target;
    }
    const text = this.textFor(source, leaf).toLocaleLowerCase();
    const filter = model.filter == null ? '' : String(model.filter).toLocaleLowerCase();
    if (model.type === 'equals') return text === filter;
    if (model.type === 'startsWith') return text.startsWith(filter);
    return text.includes(filter);
  }

  private attachGroups(): void {
    this.syncGroupColumns();
    const groups = this.groupLeaves();
    const tree = Boolean(this.options.treeData && this.options.getDataPath);
    if (groups.length === 0 && !tree && !this.options.masterDetail) {
      this.flat = null;
      this.view = this.leafView;
      return;
    }
    const sources: number[] = [];
    for (let index = 0; index < this.leafView.count; index++) {
      const source = this.leafView.identity ? index : this.leafView.indices[index] ?? -1;
      if (source >= 0) sources.push(source);
    }
    if (groups.length === 0 && !tree && this.options.masterDetail) {
      this.flat = this.masterFlat(sources);
      this.view = { indices: new Uint32Array(0), count: this.flat.length, identity: false };
      return;
    }
    const expanded = this.options.pivotMode ? -2 : this.options.groupDefaultExpanded ?? 0;
    const isExpanded = (id: string, level: number) => {
      if (expanded === -2) return false;
      const stored = this.groupExpanded.get(id);
      if (stored != null) return stored;
      if (expanded < 0) return true;
      return level < expanded;
    };
    if (tree && this.options.getDataPath) {
      const pathOf = this.options.getDataPath;
      this.ensureAutoGroup();
      this.flat = flattenTree(
        sources.map((source) => ({ source, path: pathOf(this.rows[source] as TData) })),
        isExpanded,
      );
    } else {
      this.flat = flattenGroups(
        sources,
        (source, colId) => this.groupValue(source, colId),
        groups.map((leaf) => leaf.colId),
        isExpanded,
      );
    }
    this.syncPivotColumns(sources);
    this.view = { indices: new Uint32Array(0), count: this.flat.length, identity: false };
  }

  private masterFlat(sources: readonly number[]): FlatRow[] {
    const out: FlatRow[] = [];
    for (const source of sources) {
      out.push({ kind: 'leaf', source, level: 0 });
      if (!this.detailOpen.has(source)) continue;
      const row = this.rows[source];
      if (this.options.isRowMaster && row !== undefined && !this.options.isRowMaster(row)) continue;
      const text = this.options.detailCellRenderer?.({ data: row }) ?? '';
      out.push({ kind: 'group', id: `detail:${source}`, key: text, level: 1, expanded: false, leafCount: 0, leafSources: [] });
    }
    return out;
  }

  private ensureAutoGroup(): void {
    if (this.leaves.some((leaf) => leaf.colId === AUTO_GROUP_COL_ID)) return;
    const header = this.options.autoGroupColumnDef?.headerName ?? 'Group';
    const width = this.options.autoGroupColumnDef?.width ?? 220;
    const auto = autoGroupLeaf<TData>(header, width);
    const selection = this.leaves.findIndex((leaf) => leaf.selectionColumn);
    this.leaves.splice(selection + 1, 0, auto);
  }

  private syncPivotColumns(sources: readonly number[]): void {
    if (!this.options.pivotMode) return;
    const pivot = this.leaves.find((leaf) => leaf.def.pivot && leaf.colId !== AUTO_GROUP_COL_ID);
    const values = this.leaves.filter((leaf) => leaf.def.aggFunc && !leaf.def.pivot && leaf.def.pivotKey == null && leaf.colId !== AUTO_GROUP_COL_ID);
    if (!pivot || values.length === 0) return;
    pivot.hide = true;
    pivot.groupedHide = true;
    const keys = [...new Set(sources.map((source) => this.groupValue(source, pivot.colId)))].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    for (const valueLeaf of values) {
      valueLeaf.hide = true;
      valueLeaf.groupedHide = true;
      for (const key of keys) {
        const colId = `pivot_${pivot.colId}_${key}_${valueLeaf.colId}`;
        const leaf = autoGroupLeaf<TData>(key, 120);
        leaf.colId = colId;
        leaf.pinned = null;
        leaf.headerName = key;
        leaf.def = { colId, headerName: key, aggFunc: valueLeaf.def.aggFunc, pivotKey: key, pivotValueColumn: valueLeaf.colId };
        this.leaves.push(leaf);
      }
    }
  }

  private syncGroupColumns(): void {
    for (const leaf of this.leaves) {
      if (leaf.groupedHide) leaf.hide = false;
      leaf.groupedHide = false;
    }
    this.leaves = this.leaves.filter((leaf) => leaf.colId !== AUTO_GROUP_COL_ID && leaf.def.pivotKey == null);
    const groups = this.groupLeaves();
    if (groups.length === 0) return;
    for (const leaf of groups) {
      leaf.hide = true;
      leaf.groupedHide = true;
    }
    const header = this.options.autoGroupColumnDef?.headerName ?? 'Group';
    const width = this.options.autoGroupColumnDef?.width ?? 220;
    const auto = autoGroupLeaf<TData>(header, width);
    const selection = this.leaves.findIndex((leaf) => leaf.selectionColumn);
    this.leaves.splice(selection + 1, 0, auto);
  }

  private toggleGroup(display: number): void {
    const item = this.flat?.[display];
    if (!item || item.kind !== 'group') return;
    this.groupExpanded.set(item.id, !item.expanded);
    this.attachGroups();
    this.reverse = null;
    this.layout();
    this.syncA11y();
  }

  private reportedColumns(): Leaf<TData>[] {
    if (!this.options.pivotMode) return this.leaves;
    return this.leaves.filter((leaf) => leaf.selectionColumn || leaf.colId === AUTO_GROUP_COL_ID || leaf.def.pivotKey != null || (!leaf.def.rowGroup && !leaf.def.pivot && !leaf.def.aggFunc));
  }

  private groupAgg(item: GroupFlat, colId: string): number | null {
    const leaf = this.leafById(colId);
    const func = leaf?.def.aggFunc;
    if (!leaf || !func) return null;
    const valueLeaf = leaf.def.pivotValueColumn ? this.leafById(leaf.def.pivotValueColumn) ?? leaf : leaf;
    const pivotKey = leaf.def.pivotKey;
    const pivot = this.leaves.find((item) => item.def.pivot && item.def.pivotKey == null);
    const sources = pivot && pivotKey != null ? item.leafSources.filter((source) => this.groupValue(source, pivot.colId) === pivotKey) : item.leafSources;
    return aggregate(func, sources.map((source) => this.readSource(source, valueLeaf)));
  }

  private groupNode(item: GroupFlat): GroupNode<TData> {
    const cached = this.groupNodes.get(item.id);
    if (cached) {
      cached.sync(item);
      return cached;
    }
    const node = new GroupNode(this, item);
    this.groupNodes.set(item.id, node);
    return node;
  }

  private displayedNode(index: number): IRowNode<TData> | undefined {
    const item = this.flat?.[index];
    if (!item) return undefined;
    return item.kind === 'group' ? this.groupNode(item) : this.nodeFor(item.source);
  }

  private groupLabel(display: number, colId: string): string {
    const item = this.flat?.[display];
    if (!item || item.kind !== 'group') return '';
    if (item.id.startsWith('detail:')) {
      const first = this.visibleLeaves().find((leaf) => !leaf.selectionColumn);
      return first?.colId === colId ? item.key : '';
    }
    if (colId !== AUTO_GROUP_COL_ID) {
      const value = item.leafSources.length ? this.groupAgg(item, colId) : null;
      return value == null ? '' : String(value);
    }
    const marker = item.expanded ? 'v' : '>';
    return `${'  '.repeat(item.level)}${marker} ${item.key} (${item.leafCount})`;
  }

  private applyView(view: ViewResult, generation: number, reason: 'initial' | 'sort' | 'filter' | 'data' | 'edit'): void {
    if (generation !== this.generation) return;
    view = this.applyAdvanced(view);
    this.leafView = view;
    this.attachGroups();
    this.reverse = null;
    this.root.dataset.busy = '0';
    this.layout();
    if (reason === 'sort') {
      this.emit('sortChanged', {});
      const key = this.sortKeys()[0];
      const leaf = key ? this.leafById(key.colId) : undefined;
      this.announce(leaf ? `${leaf.headerName} ${key?.direction === 'asc' ? 'ascending' : 'descending'}. ${view.count} rows.` : `${view.count} rows.`);
    }
    if (reason === 'filter') {
      this.emit('filterChanged', {});
      this.announce(`${view.count} rows after filter.`);
    }
    if (reason === 'data') this.emit('rowDataUpdated', {});
    this.emit('modelUpdated', {});
    if (!this.sawFirst) {
      this.sawFirst = true;
      this.emit('firstDataRendered', {});
    }
    this.renderChrome();
    this.syncRenderers();
    this.syncA11y();
  }

  private comparisonSort(filtered: ViewResult, sort: readonly SortKey[]): ViewResult {
    const count = filtered.count;
    const base = filtered.identity ? identityOf(count) : Array.from(filtered.indices.subarray(0, count));
    base.sort((left, right) => {
      for (const key of sort) {
        const leaf = this.leafById(key.colId);
        if (!leaf) continue;
        const compared = compareCells(this.readSource(left, leaf), this.readSource(right, leaf), leaf, this.nodeFor(left), this.nodeFor(right), key.direction === 'desc');
        if (compared !== 0) return key.direction === 'desc' ? -compared : compared;
      }
      return 0;
    });
    return { indices: Uint32Array.from(base), count, identity: false };
  }

  private sortKeys(): SortKey[] {
    return this.leaves
      .filter((leaf) => leaf.sort === 'asc' || leaf.sort === 'desc')
      .slice()
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((leaf) => ({ colId: leaf.colId, direction: leaf.sort === 'desc' ? 'desc' : 'asc' }));
  }

  private quickText(): string {
    return this.options.quickFilterText ?? '';
  }

  private columnFilterPresent(): boolean {
    return Object.values(this.filterModel).some((model) => model != null && modelActive(model));
  }

  private hasFilter(): boolean {
    return this.advancedModel != null || hasQuickFilter(this.quickText()) || Object.values(this.filterModel).some((model) => model != null && modelActive(model));
  }

  private layout(): void {
    const viewportWidth = this.viewport.clientWidth || this.root.clientWidth || 800;
    const { left, center, right } = bandsOf(this.leaves);
    const flexes = center.filter((leaf) => leaf.flex != null && leaf.flex > 0);
    if (flexes.length > 0) {
      const pinned = sumWidth(left) + sumWidth(right);
      const fixed = center.filter((leaf) => leaf.flex == null || leaf.flex <= 0).reduce((total, leaf) => total + leaf.width, 0);
      let remaining = Math.max(0, viewportWidth - pinned - fixed);
      const weight = flexes.reduce((total, leaf) => total + (leaf.flex ?? 0), 0) || 1;
      for (const leaf of flexes) {
        const share = Math.floor((remaining * (leaf.flex ?? 0)) / weight);
        leaf.width = Math.max(leaf.minWidth, leaf.maxWidth != null ? Math.min(leaf.maxWidth, share) : share);
      }
    }
    this.positions.clear();
    this.leftWidth = placeBand(left, this.positions);
    this.centerWidth = placeBand(center, this.positions);
    this.rightWidth = placeBand(right, this.positions);
    const totalHeight = this.scrollRowCount() * this.rowHeight();
    this.spacer.style.height = `${Math.min(Math.max(totalHeight, 1), MAX_SCROLL)}px`;
    this.spacer.style.width = `${Math.max(this.leftWidth + this.centerWidth + this.rightWidth, 1)}px`;
    const bar = this.viewport.offsetWidth - this.viewport.clientWidth;
    this.header.style.paddingRight = `${Math.max(0, bar)}px`;
    this.renderHeader();
    this.paint();
    this.renderEmpty();
    this.renderPager();
    this.renderStatus();
    this.renderGroupPanel();
  }

  private renderHeader(): void {
    const { left, center, right } = bandsOf(this.leaves);
    const grouped = this.leaves.some((leaf) => leaf.groupId);
    this.headerLeft.replaceChildren();
    this.headerShift.replaceChildren();
    this.headerRight.replaceChildren();
    this.fillHeader(this.headerLeft, left, grouped);
    this.fillHeader(this.headerShift, center, grouped);
    this.fillHeader(this.headerRight, right, grouped);
    this.headerShift.style.width = `${this.centerWidth}px`;
    this.headerLeft.style.width = `${this.leftWidth}px`;
    this.headerRight.style.width = `${this.rightWidth}px`;
    this.syncHeaderScroll();
  }

  private fillHeader(parent: HTMLElement, leaves: readonly Leaf<TData>[], grouped: boolean): void {
    if (leaves.length === 0) return;
    if (grouped) {
      const row = el('div', 'og-hrow og-hrow-group');
      row.setAttribute('role', 'row');
      for (const run of groupRuns(leaves)) {
        const cell = el('div', 'og-gcell');
        cell.setAttribute('role', 'columnheader');
        cell.textContent = run.name;
        cell.style.width = `${sumWidth(run.leaves)}px`;
        row.append(cell);
      }
      for (const leaf of leaves.filter((item) => !item.groupId)) {
        const cell = el('div', 'og-gcell');
        cell.setAttribute('role', 'columnheader');
        cell.style.width = `${leaf.width}px`;
        row.append(cell);
      }
      if (row.childElementCount > 0) parent.append(row);
    }
    const row = el('div', 'og-hrow');
    row.setAttribute('role', 'row');
    for (const leaf of leaves) row.append(this.headerCell(leaf));
    parent.append(row);
  }

  private headerCell(leaf: Leaf<TData>): HTMLElement {
    const cell = el('div', 'og-hcell');
    cell.setAttribute('role', 'columnheader');
    cell.style.width = `${leaf.width}px`;
    cell.dataset.colId = leaf.colId;
    const colIndex = this.visibleIndex(leaf);
    if (colIndex >= 0) cell.setAttribute('aria-colindex', String(colIndex + 1));
    cell.setAttribute('aria-sort', leaf.sort === 'asc' ? 'ascending' : leaf.sort === 'desc' ? 'descending' : 'none');
    if (leaf.selectionColumn && leaf.headerCheckbox) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'og-header-check';
      box.ariaLabel = 'Select all rows';
      const targets = this.selectionTargets();
      const selectedCount = targets.filter((source) => this.selected[source] === 1).length;
      box.checked = targets.length > 0 && selectedCount === targets.length;
      box.indeterminate = selectedCount > 0 && selectedCount < targets.length;
      box.addEventListener('click', (event) => {
        event.stopPropagation();
        const on = !(targets.length > 0 && targets.every((source) => this.selected[source] === 1));
        this.selectSources(targets, on, true);
      });
      cell.append(box);
    } else {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'og-hlabel';
      label.textContent = leaf.headerName;
      label.addEventListener('click', (event) => {
        event.stopPropagation();
        this.cycleSort(leaf, event.shiftKey);
      });
      cell.append(label);
      if (leaf.sort) {
        const mark = el('span', 'og-sort');
        const index = this.sortKeys().length > 1 && leaf.sortIndex != null ? String(leaf.sortIndex + 1) : '';
        mark.textContent = `${leaf.sort === 'asc' ? '↑' : '↓'}${index}`;
        cell.append(mark);
      }
    }
    if (leaf.filter) {
      const filter = document.createElement('button');
      filter.type = 'button';
      filter.className = this.filterModel[leaf.colId] ? 'og-filter og-filter-on' : 'og-filter';
      filter.ariaLabel = `Filter ${leaf.headerName}`;
      filter.textContent = '▽';
      filter.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openFilter(leaf, cell);
      });
      cell.append(filter);
    }
    if (!leaf.selectionColumn) {
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.className = 'og-menu';
      menu.ariaLabel = `${leaf.headerName} column menu`;
      menu.textContent = '···';
      menu.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openMenu(leaf, cell);
      });
      cell.append(menu);
    }
    if (leaf.resizable) {
      const handle = el('span', 'og-resize');
      handle.addEventListener('pointerdown', (event) => this.startResize(leaf, event));
      cell.append(handle);
    }
    if (leaf.movable) {
      cell.addEventListener('pointerdown', (event) => this.startMove(leaf, event));
    }
    return cell;
  }

  private sortLeaf(leaf: Leaf<TData>, direction: 'asc' | 'desc'): void {
    if (!leaf.sortable) return;
    for (const other of this.leaves) {
      if (other !== leaf) {
        other.sort = null;
        other.sortIndex = null;
      }
    }
    leaf.sort = direction;
    leaf.sortIndex = 0;
    this.syncLeafDef(leaf);
    this.refresh('sort');
  }

  private resetColumns(): void {
    this.rebuildColumns(this.rows);
    this.refresh('sort');
  }

  private cycleSort(leaf: Leaf<TData>, additive: boolean): void {
    if (!leaf.sortable) return;
    const order = leaf.sortingOrder.length > 0 ? leaf.sortingOrder : (['asc', 'desc', null] as SortDirection[]);
    const index = Math.max(0, order.indexOf(leaf.sort));
    const next = order[(index + 1) % order.length] ?? null;
    if (!additive) {
      for (const other of this.leaves) {
        if (other !== leaf) {
          other.sort = null;
          other.sortIndex = null;
        }
      }
      leaf.sort = next;
      leaf.sortIndex = next ? 0 : null;
    } else {
      leaf.sort = next;
      if (!next) leaf.sortIndex = null;
      else if (leaf.sortIndex == null) {
        const maxIndex = this.leaves.reduce((max, item) => Math.max(max, item.sortIndex ?? -1), -1);
        leaf.sortIndex = maxIndex + 1;
      }
    }
    this.syncLeafDef(leaf);
    this.refresh('sort');
  }

  private startResize(leaf: Leaf<TData>, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = leaf.width;
    const target = event.target;
    if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const width = Math.round(startWidth + next.clientX - startX);
      leaf.width = clamp(width, leaf.minWidth, leaf.maxWidth);
      leaf.flex = undefined;
      this.layout();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.syncLeafDef(leaf);
      const column = columnFacade(leaf);
      this.emit('columnResized', { column, columns: [column], finished: true, source: 'ui' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private startMove(leaf: Leaf<TData>, event: PointerEvent): void {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, .og-resize, input'))) return;
    const startX = event.clientX;
    let dragging = false;
    const move = (next: PointerEvent) => {
      if (!dragging && Math.abs(next.clientX - startX) < 4) return;
      dragging = true;
    };
    const up = (next: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!dragging) return;
      const target = this.leafAtClientX(next.clientX) ?? leaf;
      this.moveLeaf(leaf, target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private moveLeaf(leaf: Leaf<TData>, target: Leaf<TData>): void {
    if (leaf === target || leaf.selectionColumn) return;
    if (leaf.marry && leaf.groupId && leaf.groupId !== target.groupId) return;
    const from = this.leaves.indexOf(leaf);
    const to = this.leaves.indexOf(target);
    if (from < 0 || to < 0) return;
    this.leaves.splice(from, 1);
    this.leaves.splice(to, 0, leaf);
    this.layout();
    const column = columnFacade(leaf);
    this.emit('columnMoved', { column, columns: [column], finished: true, source: 'ui' });
  }

  private leafAtClientX(clientX: number): Leaf<TData> | null {
    const cells = this.header.querySelectorAll<HTMLElement>('.og-hcell');
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return this.leafById(cell.dataset.colId ?? '') ?? null;
    }
    return null;
  }

  private openFilter(leaf: Leaf<TData>, anchor: HTMLElement): void {
    if (leaf.filter === 'set') {
      this.openSetFilter(leaf, anchor);
      return;
    }
    if (leaf.filter === 'multi') {
      this.openMultiFilter(leaf, anchor);
      return;
    }
    const current = this.filterModel[leaf.colId];
    const simple = current && ('values' in current || 'filterModels' in current) ? undefined : current && 'conditions' in current ? current.conditions[0] : current;
    const kind = leaf.filter === 'number' ? 'number' : leaf.filter === 'date' ? 'date' : 'text';
    this.popup.replaceChildren();
    this.popup.hidden = false;
    const select = document.createElement('select');
    select.ariaLabel = `${leaf.headerName} filter operator`;
    for (const option of operators(kind)) {
      const item = document.createElement('option');
      item.value = option;
      item.textContent = optionLabel(option);
      select.append(item);
    }
    select.value = simple?.type ?? (kind === 'text' ? 'contains' : 'equals');
    const input = document.createElement('input');
    input.ariaLabel = `${leaf.headerName} filter value`;
    input.type = kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text';
    input.value = simple?.dateFrom ?? (simple?.filter == null ? '' : String(simple.filter));
    const inputTo = document.createElement('input');
    inputTo.ariaLabel = `${leaf.headerName} filter to`;
    inputTo.type = input.type;
    inputTo.value = simple?.dateTo ?? (simple?.filterTo == null ? '' : String(simple.filterTo));
    const syncTo = () => {
      inputTo.hidden = select.value !== 'inRange';
    };
    syncTo();
    const apply = () => {
      const type = select.value;
      if (type === 'blank' || type === 'notBlank') {
        this.api.setFilterModel({ ...this.filterModel, [leaf.colId]: { filterType: kind, type } });
        return;
      }
      const model: SimpleFilterModel = { filterType: kind, type };
      if (kind === 'date') {
        model.dateFrom = input.value || null;
        if (type === 'inRange') model.dateTo = inputTo.value || null;
      } else if (kind === 'number') {
        model.filter = input.value === '' ? null : Number(input.value);
        if (type === 'inRange') model.filterTo = inputTo.value === '' ? null : Number(inputTo.value);
      } else {
        model.filter = input.value;
        if (type === 'inRange') model.filterTo = inputTo.value;
      }
      this.api.setFilterModel({ ...this.filterModel, [leaf.colId]: model });
    };
    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 180);
    });
    inputTo.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 180);
    });
    select.addEventListener('change', () => {
      syncTo();
      apply();
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      const next = { ...this.filterModel };
      delete next[leaf.colId];
      this.api.setFilterModel(next);
      this.popup.hidden = true;
    });
    this.popup.append(select, input, inputTo, clear);
    const rect = anchor.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    this.popup.style.left = `${Math.max(0, rect.left - rootRect.left)}px`;
    this.popup.style.top = `${rect.bottom - rootRect.top}px`;
  }

  private openSetFilter(leaf: Leaf<TData>, anchor: HTMLElement): void {
    const values = new Set<string>();
    for (let source = 0; source < this.rows.length; source++) {
      if (this.rows[source] === undefined) continue;
      values.add(this.textFor(source, leaf));
    }
    const current = this.filterModel[leaf.colId];
    const selected = current && 'values' in current ? new Set(current.values.map((value) => (value == null ? '' : String(value)))) : new Set(values);
    this.popup.replaceChildren();
    this.popup.hidden = false;
    const list = document.createElement('div');
    for (const value of [...values].sort()) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = selected.has(value);
      box.value = value;
      label.append(box, document.createTextNode(value === '' ? '(Blanks)' : value));
      list.append(label);
    }
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'og-set-apply';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      const chosen = [...list.querySelectorAll('input')].filter((input) => input.checked).map((input) => input.value);
      const next = { ...this.filterModel };
      if (chosen.length === values.size) delete next[leaf.colId];
      else next[leaf.colId] = { filterType: 'set', values: chosen };
      this.api.setFilterModel(next);
      this.popup.hidden = true;
    });
    this.popup.append(list, apply);
    const rect = anchor.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    this.popup.style.left = `${Math.max(0, rect.left - rootRect.left)}px`;
    this.popup.style.top = `${rect.bottom - rootRect.top}px`;
  }

  private openMultiFilter(leaf: Leaf<TData>, anchor: HTMLElement): void {
    this.popup.replaceChildren();
    this.popup.hidden = false;
    const first = document.createElement('input');
    first.ariaLabel = `${leaf.headerName} first filter`;
    const second = document.createElement('input');
    second.ariaLabel = `${leaf.headerName} second filter`;
    const current = this.filterModel[leaf.colId];
    if (current && 'filterModels' in current) {
      const models = current.filterModels;
      const textOf = (model: (typeof models)[number]) => (model && 'filter' in model && model.filter != null ? String(model.filter) : '');
      first.value = textOf(models[0]);
      second.value = textOf(models[1]);
    }
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'og-multi-apply';
    apply.textContent = 'Apply';
    apply.addEventListener('click', () => {
      const models = [first.value, second.value]
        .filter((value) => value !== '')
        .map((value) => ({ filterType: 'text' as const, type: 'contains' as const, filter: value }));
      const next = { ...this.filterModel };
      if (models.length === 0) delete next[leaf.colId];
      else next[leaf.colId] = { filterType: 'multi', filterModels: models };
      this.api.setFilterModel(next);
      this.popup.hidden = true;
    });
    this.popup.append(first, second, apply);
    const rect = anchor.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    this.popup.style.left = `${Math.max(0, rect.left - rootRect.left)}px`;
    this.popup.style.top = `${rect.bottom - rootRect.top}px`;
  }

  private contextLabels(items: readonly (string | { name: string })[]): string[] {
    const names: Record<string, string> = {
      cut: 'Cut',
      copy: 'Copy',
      copyWithHeaders: 'Copy with Headers',
      copyWithGroupHeaders: 'Copy with Group Headers',
      paste: 'Paste',
      export: 'Export',
    };
    return items.map((item) => (typeof item === 'string' ? names[item] ?? item : item.name));
  }

  private onContextMenu(event: MouseEvent): void {
    const found = this.hit(event.clientX, event.clientY);
    if (!found || found.leaf.selectionColumn) return;
    event.preventDefault();
    const defaults = ['cut', 'copy', 'copyWithHeaders', 'copyWithGroupHeaders', 'paste', 'export'];
    const items = this.options.getContextMenuItems?.({ defaultItems: defaults }) ?? defaults;
    const labels = this.contextLabels(items);
    this.popup.replaceChildren();
    this.popup.hidden = false;
    this.popup.classList.add('og-context');
    labels.forEach((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'og-context-item';
      button.textContent = label;
      button.addEventListener('click', () => {
        this.runContextItem(typeof items[index] === 'string' ? items[index] : label, found.display, found.leaf);
        this.popup.hidden = true;
        this.popup.classList.remove('og-context');
      });
      this.popup.append(button);
    });
    const rect = this.viewport.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    this.popup.style.left = `${Math.max(0, event.clientX - rootRect.left)}px`;
    this.popup.style.top = `${Math.max(0, event.clientY - rect.top)}px`;
  }

  private runContextItem(token: string, display: number, leaf: Leaf<TData>): void {
    const copy = (headers: boolean) => {
      const previous = this.cellRanges.slice();
      this.cellRanges = [{ rowStartIndex: display, rowEndIndex: display, columns: [leaf.colId] }];
      let data = this.clipboardText();
      if (headers) data = `${leaf.groupName ? `${leaf.groupName}\n` : ''}${leaf.headerName}\n${data}`;
      this.cellRanges = previous;
      this.lastClipboard = data;
      this.options.sendToClipboard?.({ data });
    };
    if (token === 'copy' || token === 'Copy') copy(false);
    else if (token === 'copyWithHeaders' || token === 'Copy with Headers' || token === 'copyWithGroupHeaders' || token === 'Copy with Group Headers') copy(true);
    else if (token === 'cut' || token === 'Cut') {
      copy(false);
      const source = this.sourceAt(display);
      if (source >= 0) this.writeSource(source, leaf, '', 'edit');
    }
    else if (token === 'paste' || token === 'Paste') this.pasteClipboard(this.lastClipboard);
    else if (token === 'export' || token === 'Export') this.options.sendToClipboard?.({ data: this.csv() });
  }

  private openMenu(leaf: Leaf<TData>, anchor: HTMLElement): void {
    this.popup.replaceChildren();
    this.popup.hidden = false;
    for (const item of [
      ['Sort Ascending', () => this.sortLeaf(leaf, 'asc')],
      ['Sort Descending', () => this.sortLeaf(leaf, 'desc')],
      ['Pin Column', () => this.pin(leaf, leaf.pinned === 'left' ? null : 'left')],
      ['Autosize This Column', () => this.autoSize([leaf.colId], false)],
      ['Autosize All Columns', () => this.autoSize(this.visibleLeaves().map((item) => item.colId), false)],
      ['Choose Columns', () => this.ensureColumnsPanel()],
      ['Reset Columns', () => this.resetColumns()],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'og-colmenu-item';
      button.textContent = item[0];
      button.addEventListener('click', () => {
        item[1]();
        this.popup.hidden = true;
      });
      this.popup.append(button);
    }
    const rect = anchor.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    this.popup.style.left = `${Math.max(0, rect.right - rootRect.left - 140)}px`;
    this.popup.style.top = `${rect.bottom - rootRect.top}px`;
  }

  private pin(leaf: Leaf<TData>, pinned: 'left' | 'right' | null): void {
    leaf.pinned = pinned;
    this.syncLeafDef(leaf);
    this.layout();
    const column = columnFacade(leaf);
    this.emit('columnPinned', { column, columns: [column], source: 'ui' });
  }

  private ensureColumnsPanel(): void {
    if (this.host.querySelector('.og-tool-columns')) return;
    const side = el('div', 'og-side');
    side.append(this.columnsToolPanel());
    this.host.append(side);
  }

  private mountSide(): void {
    const option = this.options.sideBar;
    if (!option) return;
    const panels = option === true
      ? [{ id: 'columns', toolPanel: 'agColumnsToolPanel' }, { id: 'filters', toolPanel: 'agFiltersToolPanel' }]
      : option.toolPanels ?? [];
    if (panels.length === 0) return;
    const side = el('div', 'og-side');
    for (const panel of panels) {
      if (panel.toolPanel === 'agColumnsToolPanel' || panel.id === 'columns') side.append(this.columnsToolPanel());
      if (panel.toolPanel === 'agFiltersToolPanel' || panel.id === 'filters') side.append(this.filtersToolPanel());
    }
    this.host.append(side);
  }

  private columnsToolPanel(): HTMLElement {
    const box = el('div', 'og-tool-columns');
    for (const leaf of this.leaves) {
      if (leaf.selectionColumn) continue;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !leaf.hide;
      input.addEventListener('change', () => this.api.setColumnsVisible([leaf.colId], input.checked));
      label.append(input, document.createTextNode(leaf.headerName));
      box.append(label);
    }
    return box;
  }

  private filtersToolPanel(): HTMLElement {
    const box = el('div', 'og-tool-filters');
    for (const leaf of this.leaves) {
      if (!leaf.filter || leaf.selectionColumn) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = leaf.headerName;
      button.addEventListener('click', () => this.openFilter(leaf, button));
      box.append(button);
    }
    return box;
  }

  private fillHandle(): boolean {
    const selection = this.options.cellSelection;
    return typeof selection === 'object' && selection.handle?.mode === 'fill';
  }

  private cellSelectionOn(): boolean {
    return this.options.cellSelection === true || typeof this.options.cellSelection === 'object';
  }

  private onRangeDown(event: PointerEvent): void {
    if (!this.cellSelectionOn() || event.button !== 0) return;
    const found = this.hit(event.clientX, event.clientY);
    if (!found || found.leaf.selectionColumn) return;
    if (this.fillHandle() && this.cellRanges[0]) {
      const range = this.cellRanges[0];
      const end = Math.max(range.rowStartIndex, range.rowEndIndex);
      if (found.display === end && range.columns.includes(found.leaf.colId)) return;
    }
    const startRow = found.display;
    const startCol = found.leaf.colId;
    const write = (row: number, colId: string) => {
      const visible = this.visibleLeaves().filter((leaf) => !leaf.selectionColumn);
      const from = visible.findIndex((leaf) => leaf.colId === startCol);
      const to = visible.findIndex((leaf) => leaf.colId === colId);
      const columns = from < 0 || to < 0 ? [startCol] : visible.slice(Math.min(from, to), Math.max(from, to) + 1).map((leaf) => leaf.colId);
      this.cellRanges = [{ rowStartIndex: Math.min(startRow, row), rowEndIndex: Math.max(startRow, row), columns }];
    };
    write(startRow, startCol);
    const move = (ev: PointerEvent) => {
      const next = this.hit(ev.clientX, ev.clientY);
      if (next && !next.leaf.selectionColumn) write(next.display, next.leaf.colId);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private onFillDown(event: PointerEvent): void {
    if (!this.fillHandle() || event.button !== 0 || this.cellRanges.length === 0) return;
    const found = this.hit(event.clientX, event.clientY);
    if (!found) return;
    const range = this.cellRanges[0];
    if (!range) return;
    const end = Math.max(range.rowStartIndex, range.rowEndIndex);
    if (found.display !== end || !range.columns.includes(found.leaf.colId)) return;
    const sourceRow = Math.min(range.rowStartIndex, range.rowEndIndex);
    let over = end;
    const move = (ev: PointerEvent) => {
      const next = this.hit(ev.clientX, ev.clientY);
      if (next) over = next.display;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (over <= end) return;
      this.applyFill(range.columns, sourceRow, over);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private applyFill(columns: readonly string[], sourceRow: number, endRow: number): void {
    for (const colId of columns) {
      const leaf = this.leafByKey(colId);
      const source = this.sourceAt(sourceRow);
      if (!leaf || source < 0) continue;
      const value = this.readSource(source, leaf);
      const next = this.options.fillOperation?.({ currentValue: value, values: [value] }) ?? value;
      for (let row = sourceRow + 1; row <= endRow; row++) {
        const target = this.sourceAt(row);
        if (target < 0) continue;
        this.writeSource(target, leaf, next, 'fill');
      }
    }
    const range = this.cellRanges[0];
    if (range) range.rowEndIndex = endRow;
    this.paint();
    this.syncA11y();
  }

  private onRowDragDown(event: PointerEvent): void {
    if (!this.options.rowDragManaged || event.button !== 0) return;
    const found = this.hit(event.clientX, event.clientY);
    if (!found?.leaf.def.rowDrag) return;
    const placed = this.positions.get(found.leaf.colId);
    if (!placed) return;
    const rect = this.viewport.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let screen = placed.x;
    if (found.leaf.pinned === 'right') screen = this.viewport.clientWidth - this.rightWidth + placed.x;
    else if (found.leaf.pinned == null) screen = this.leftWidth + placed.x - this.viewport.scrollLeft;
    if (x < screen || x >= screen + 18) return;
    this.dragFrom = found.display;
    this.dragOver = found.display;
    const move = (ev: PointerEvent) => {
      const next = this.hit(ev.clientX, ev.clientY);
      if (next) this.dragOver = next.display;
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const from = this.dragFrom;
      const over = this.dragOver;
      this.dragFrom = -1;
      if (from >= 0 && over >= 0 && from !== over) this.moveManagedRow(from, over);
      this.emit('rowDragEnd', { overIndex: over });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private moveManagedRow(from: number, over: number): void {
    const sourceFrom = this.sourceAt(from);
    const sourceOver = this.sourceAt(over);
    if (sourceFrom < 0 || sourceOver < 0) return;
    const next = this.rows.slice();
    const [row] = next.splice(sourceFrom, 1);
    if (row === undefined) return;
    next.splice(sourceOver > sourceFrom ? sourceOver - 1 : sourceOver, 0, row);
    const selected = new Set(this.selectedIds());
    this.loadRows(next, false);
    this.selectedList = [];
    for (let source = 0; source < this.rows.length; source++) {
      if (!selected.has(this.rowId(source))) continue;
      this.selected[source] = 1;
      this.selectedList.push(source);
    }
  }

  private onScroll(): void {
    this.syncHeaderScroll();
    if (this.remoteMode()) this.ensureInfinite();
    if (this.options.rowModelType === 'viewport') this.pushViewport();
    if (this.paintFrameId) return;
    this.paintFrameId = requestAnimationFrame(() => {
      this.paintFrameId = 0;
      if (this.leaves.some((leaf) => leaf.cellRenderer)) this.syncRenderers();
      this.paint();
      this.scheduleA11y();
    });
  }

  private syncHeaderScroll(): void {
    this.headerShift.style.transform = `translateX(${-this.viewport.scrollLeft}px)`;
  }

  private paint(): void {
    const ctx = this.canvas.getContext('2d');
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (!ctx || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const top = this.virtualTop();
    const rowHeight = this.rowHeight();
    const origin = this.displayOrigin();
    const localFirst = Math.floor(top / rowHeight);
    const firstRow = origin + localFirst;
    const rowOffset = top - localFirst * rowHeight;
    const columns: PaintColumn[] = [];
    const { left, center, right } = bandsOf(this.leaves);
    for (const leaf of [...left, ...center, ...right]) {
      const placed = this.positions.get(leaf.colId);
      if (!placed) continue;
      columns.push({ colId: leaf.colId, x: placed.x, width: leaf.width, pinned: leaf.pinned, checkbox: leaf.selectionColumn || leaf.checkbox });
    }
    const focusLeaf = this.visibleLeaves()[this.focusCol];
    paintFrame(ctx, {
      width,
      height,
      dpr,
      rowHeight,
      firstRow,
      rowOffset,
      viewCount: origin + this.scrollRowCount(),
      leftWidth: this.leftWidth,
      rightWidth: this.rightWidth,
      scrollLeft: this.viewport.scrollLeft,
      columns,
      sourceAt: (display) => this.sourceAt(display),
      textAt: (source, colId) => {
        const leaf = this.leafById(colId);
        return leaf ? this.textFor(source, leaf) : '';
      },
      groupText: (display, colId) => this.groupLabel(display, colId),
      selected: (source) => this.selected[source] === 1,
      styleAt: (source, colId) => {
        const leaf = this.leafById(colId);
        if (!leaf) return null;
        const style = this.paintStyle(source, leaf);
        if (!style.background && !style.color) return null;
        return { background: style.background, color: style.color };
      },
      focusColId: focusLeaf?.colId ?? null,
      focusRow: this.view.count > 0 ? this.focusRow : null,
      colors: this.colors,
    });
    this.positionEditor();
  }

  private renderEmpty(): void {
    const show = this.view.count === 0;
    this.empty.hidden = !show;
    if (!show) return;
    if (this.options.loading || this.options.rowData === undefined) {
      this.empty.textContent = this.options.overlayLoadingTemplate ? '' : 'Loading';
      if (this.options.overlayLoadingTemplate) this.empty.innerHTML = this.options.overlayLoadingTemplate;
      return;
    }
    if (this.options.overlayNoRowsTemplate) this.empty.innerHTML = this.options.overlayNoRowsTemplate;
    else this.empty.textContent = 'No Rows To Show';
  }

  private renderChrome(): void {
    const cols = this.visibleLeaves().length;
    const headerRows = this.leaves.some((leaf) => leaf.groupId) ? 2 : 1;
    this.root.setAttribute('aria-rowcount', String(this.view.count + headerRows));
    this.root.setAttribute('aria-colcount', String(cols));
    this.renderEmpty();
    this.paint();
  }

  private onBodyClick(event: MouseEvent): void {
    const hit = this.hit(event.clientX, event.clientY);
    if (!hit) return;
    if (this.flat?.[hit.display]?.kind === 'group') {
      this.toggleGroup(hit.display);
      return;
    }
    const leaf = hit.leaf;
    this.setFocus(hit.display, this.visibleLeaves().indexOf(leaf), false);
    const node = this.nodeFor(hit.source);
    const value = this.readSource(hit.source, leaf);
    this.emit('cellClicked', { data: this.rows[hit.source], node, colDef: leaf.def, column: columnFacade(leaf), value, rowIndex: hit.display, event });
    if (leaf.selectionColumn || leaf.checkbox) {
      this.toggleRow(hit.source, event.shiftKey, event.metaKey || event.ctrlKey, true);
      return;
    }
    if (this.selection.enabled && this.selection.click && !this.options.suppressRowClickSelection) {
      this.toggleRow(hit.source, event.shiftKey, event.metaKey || event.ctrlKey || this.selection.toggleWithoutModifier, false);
    }
    if (this.options.singleClickEdit && this.isEditable(leaf, hit.source)) this.beginEdit(hit.display, leaf, undefined);
  }

  private onBodyDoubleClick(event: MouseEvent): void {
    const hit = this.hit(event.clientX, event.clientY);
    if (!hit) return;
    const node = this.nodeFor(hit.source);
    this.emit('cellDoubleClicked', { data: this.rows[hit.source], node, colDef: hit.leaf.def, column: columnFacade(hit.leaf), value: this.readSource(hit.source, hit.leaf), rowIndex: hit.display, event });
    if (this.isEditable(hit.leaf, hit.source)) this.beginEdit(hit.display, hit.leaf, undefined);
  }

  private toggleRow(source: number, shift: boolean, toggle: boolean, fromCheckbox: boolean): void {
    if (!this.selection.enabled || !this.canSelect(source)) return;
    const display = this.displayIndex(source) ?? 0;
    if (this.selection.multi && shift) {
      const start = Math.min(this.anchor, display);
      const end = Math.max(this.anchor, display);
      const sources: number[] = [];
      for (let index = start; index <= end; index++) {
        const row = this.sourceAt(index);
        if (row >= 0) sources.push(row);
      }
      this.selectSources(sources, true, true);
      return;
    }
    if (this.selection.multi && (toggle || fromCheckbox)) {
      this.setSourceSelected(source, this.selected[source] !== 1, false, 'checkboxSelected');
      this.anchor = display;
      return;
    }
    this.setSourceSelected(source, true, true, 'rowClicked');
    this.anchor = display;
  }

  private selectSources(sources: readonly number[], selected: boolean, replace: boolean): void {
    if (replace) {
      this.selected.fill(0);
      this.selectedList = [];
    }
    for (const source of sources) {
      if (!this.canSelect(source)) continue;
      if (selected) {
        if (this.selected[source] !== 1) this.selectedList.push(source);
        this.selected[source] = 1;
      } else {
        this.selected[source] = 0;
        this.selectedList = this.selectedList.filter((item) => item !== source);
      }
    }
    this.emit('selectionChanged', { type: 'selectionChanged', source: 'api' });
    this.paint();
    this.renderHeader();
  }

  private setSourceSelected(source: number, selected: boolean, clear: boolean, sourceName: string): void {
    if (!this.canSelect(source)) return;
    if (clear || !this.selection.multi) {
      this.selected.fill(0);
      this.selectedList = [];
    }
    if (selected) {
      if (!this.selection.multi) {
        this.selected.fill(0);
        this.selectedList = [];
      }
      if (this.selected[source] !== 1) this.selectedList.push(source);
      this.selected[source] = 1;
    } else {
      this.selected[source] = 0;
      this.selectedList = this.selectedList.filter((item) => item !== source);
    }
    const node = this.nodeFor(source);
    node.emit('rowSelected');
    this.emit('rowSelected', { type: 'rowSelected', node, data: node.data, rowIndex: node.rowIndex, source: sourceName });
    this.emit('selectionChanged', { type: 'selectionChanged', source: sourceName });
    this.paint();
  }

  private canSelect(source: number): boolean {
    if (!this.selection.enabled) return false;
    const predicate = this.selection.isRowSelectable;
    if (!predicate) return true;
    return predicate(this.nodeFor(source));
  }

  private selectionTargets(): number[] {
    if (this.selection.selectAll === 'all') return Array.from({ length: this.rows.length }, (_, index) => index);
    const sources: number[] = [];
    for (let display = 0; display < this.view.count; display++) {
      const source = this.sourceAt(display);
      if (source >= 0) sources.push(source);
    }
    return sources;
  }

  private onKey(event: KeyboardEvent): void {
    if (this.editor) return;
    const key = event.key;
    if (key === 'ArrowDown') this.moveFocus(1, 0, event);
    else if (key === 'ArrowUp') this.moveFocus(-1, 0, event);
    else if (key === 'ArrowRight' || (key === 'Tab' && !event.shiftKey)) this.moveFocus(0, 1, event);
    else if (key === 'ArrowLeft' || (key === 'Tab' && event.shiftKey)) this.moveFocus(0, -1, event);
    else if (key === 'PageDown') this.moveFocus(this.pageSize(), 0, event);
    else if (key === 'PageUp') this.moveFocus(-this.pageSize(), 0, event);
    else if (key === 'Home' && (event.ctrlKey || event.metaKey)) this.setFocus(0, 0, true, event);
    else if (key === 'End' && (event.ctrlKey || event.metaKey)) this.setFocus(Math.max(0, this.view.count - 1), Math.max(0, this.visibleLeaves().length - 1), true, event);
    else if (key === 'Home') this.setFocus(this.focusRow, 0, true, event);
    else if (key === 'End') this.setFocus(this.focusRow, Math.max(0, this.visibleLeaves().length - 1), true, event);
    else if (key === 'Enter') {
      const leaf = this.visibleLeaves()[this.focusCol];
      if (leaf && this.isEditable(leaf, this.sourceAt(this.focusRow))) this.beginEdit(this.focusRow, leaf, undefined);
      else this.moveFocus(this.options.enterNavigatesVertically ? 1 : 0, this.options.enterNavigatesVertically ? 0 : 1, event);
    } else if (key === ' ' && this.selection.enabled) {
      event.preventDefault();
      const source = this.sourceAt(this.focusRow);
      if (source >= 0) this.toggleRow(source, event.shiftKey, true, true);
    } else if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'a' && this.selection.multi) {
      event.preventDefault();
      this.selectSources(this.selectionTargets(), true, true);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const leaf = this.visibleLeaves()[this.focusCol];
      const source = this.sourceAt(this.focusRow);
      if (leaf && source >= 0 && this.isEditable(leaf, source)) this.beginEdit(this.focusRow, leaf, key);
    }
  }

  private moveFocus(rowDelta: number, colDelta: number, event?: Event): void {
    event?.preventDefault();
    const rows = this.view.count;
    const cols = this.visibleLeaves().length;
    if (rows === 0 || cols === 0) return;
    this.setFocus(clamp(this.focusRow + rowDelta, 0, rows - 1), clamp(this.focusCol + colDelta, 0, cols - 1), true);
  }

  private setFocus(row: number, col: number, scroll: boolean, event?: Event): void {
    event?.preventDefault();
    this.focusRow = row;
    this.focusCol = col;
    if (scroll) this.ensureVisible(row, this.visibleLeaves()[col]?.colId ?? null);
    const leaf = this.visibleLeaves()[col];
    this.root.setAttribute('aria-activedescendant', leaf ? this.cellDomId(row, col) : '');
    this.syncRenderers();
    this.paint();
    this.scheduleA11y();
    this.emit('cellFocused', { type: 'cellFocused', rowIndex: row, column: leaf ? columnFacade(leaf) : null, rowPinned: null });
  }

  private beginEdit(display: number, leaf: Leaf<TData>, seed: string | undefined): void {
    const source = this.sourceAt(display);
    if (source < 0 || !this.isEditable(leaf, source)) return;
    this.closeEditor(true);
    const input = document.createElement('input');
    input.className = 'og-editor';
    input.ariaLabel = leaf.headerName;
    input.value = seed ?? this.textFor(source, leaf);
    this.floatLayer.append(input);
    this.editor = { input, displayRow: display, source, leaf };
    this.positionEditor();
    input.focus();
    if (seed == null) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        this.closeEditor(false);
        this.moveFocus(1, 0);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeEditor(true);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        this.closeEditor(false);
        this.moveFocus(0, event.shiftKey ? -1 : 1);
      }
    });
    input.addEventListener('blur', () => {
      if (this.closingEditor) return;
      this.closeEditor(false);
    });
    const node = this.nodeFor(source);
    this.emit('cellEditingStarted', { data: this.rows[source], node, colDef: leaf.def, column: columnFacade(leaf), value: this.readSource(source, leaf), rowIndex: display });
  }

  private closeEditor(cancel: boolean): void {
    const editor = this.editor;
    if (!editor) return;
    this.closingEditor = true;
    if (!cancel) this.writeEditor(editor);
    editor.input.remove();
    this.editor = null;
    this.closingEditor = false;
    const node = this.nodeFor(editor.source);
    this.emit('cellEditingStopped', { data: this.rows[editor.source], node, colDef: editor.leaf.def, column: columnFacade(editor.leaf), value: this.readSource(editor.source, editor.leaf), rowIndex: editor.displayRow });
    this.root.focus();
  }

  private writeEditor(editor: EditorState<TData>): void {
    const text = editor.input.value;
    let next: unknown = text;
    if (typeof editor.leaf.valueParser === 'function') {
      next = editor.leaf.valueParser({
        oldValue: this.readSource(editor.source, editor.leaf),
        newValue: text,
        data: this.rows[editor.source],
        node: this.nodeFor(editor.source),
        colDef: editor.leaf.def,
        column: columnFacade(editor.leaf),
        api: this.api,
        context: this.options.context,
      });
    } else if (editor.leaf.kind === 'number') next = text.trim() === '' ? null : Number(text);
    else if (editor.leaf.kind === 'date') next = text.trim() === '' ? null : text;
    else if (editor.leaf.kind === 'boolean') next = text === 'true';
    this.writeSource(editor.source, editor.leaf, next, 'edit');
  }

  private positionEditor(): void {
    if (!this.editor) return;
    const rect = this.cellRect(this.editor.displayRow, this.editor.leaf);
    if (!rect) return;
    this.editor.input.style.left = `${rect.x}px`;
    this.editor.input.style.top = `${rect.y}px`;
    this.editor.input.style.width = `${rect.width}px`;
    this.editor.input.style.height = `${rect.height}px`;
  }

  private writeSource(source: number, leaf: Leaf<TData>, next: unknown, eventSource: string): boolean {
    if (leaf.selectionColumn) return false;
    const oldValue = this.readSource(source, leaf);
    if (this.options.undoRedoCellEditing && eventSource !== 'undo' && eventSource !== 'redo') {
      this.undoStack.push({ source, colId: leaf.colId, value: oldValue });
      const limit = this.options.undoRedoCellEditingLimit ?? 10;
      while (this.undoStack.length > limit) this.undoStack.shift();
      this.redoStack = [];
    }
    const row = this.rows[source];
    if (row == null) return false;
    if (typeof leaf.valueSetter === 'function') {
      const result = leaf.valueSetter({
        oldValue,
        newValue: next,
        data: row,
        node: this.nodeFor(source),
        colDef: leaf.def,
        column: columnFacade(leaf),
        api: this.api,
        context: this.options.context,
      });
      if (result === false) return false;
    } else if (leaf.field) writePath(row, leaf.field, next);
    else return false;
    const stored = this.readRow(leaf, row);
    const vector = this.store.columns.get(leaf.colId);
    if (vector) writeVector(vector, source, stored);
    if (this.worker) void this.worker.patch(leaf.colId, source, stored);
    const node = this.nodeFor(source);
    this.emit('cellValueChanged', {
      type: 'cellValueChanged',
      data: row,
      node,
      colDef: leaf.def,
      column: columnFacade(leaf),
      oldValue,
      newValue: stored,
      value: stored,
      rowIndex: this.displayIndex(source),
      source: eventSource,
    });
    this.refresh('edit');
    return stored !== oldValue;
  }

  private readRow(leaf: Leaf<TData>, row: unknown): unknown {
    if (typeof leaf.valueGetter === 'function') {
      return leaf.valueGetter({
        data: row as TData,
        node: null,
        colDef: leaf.def,
        column: columnFacade(leaf),
        api: this.api,
        context: this.options.context,
        getValue: (field) => readPath(row, field),
      });
    }
    if (typeof leaf.valueGetter === 'string') {
      const path = /^data\.(.+)$/.exec(leaf.valueGetter.trim());
      if (path?.[1]) return readPath(row, path[1]);
    }
    if (leaf.field) return readPath(row, leaf.field);
    return undefined;
  }

  private readSource(source: number, leaf: Leaf<TData>): unknown {
    if (leaf.selectionColumn) return this.selected[source] === 1;
    const row = this.rows[source];
    if (leaf.valueGetter) return this.readRow(leaf, row);
    return cellRaw(this.store.columns.get(leaf.colId), source);
  }

  private paintStyle(source: number, leaf: Leaf<TData>): { background: string | null; color: string | null; className: string } {
    if (!leaf.cellStyle && !leaf.cellClass) return { background: null, color: null, className: '' };
    const params = {
      value: this.readSource(source, leaf),
      data: this.rows[source],
      node: this.nodeFor(source),
      colDef: leaf.def,
      column: columnFacade(leaf),
      api: this.api,
      context: this.options.context,
      rowIndex: this.displayIndex(source),
    };
    const style = typeof leaf.cellStyle === 'function' ? leaf.cellStyle(params) : leaf.cellStyle;
    const rawClass = typeof leaf.cellClass === 'function' ? leaf.cellClass(params) : leaf.cellClass;
    const className = Array.isArray(rawClass) ? rawClass.join(' ') : (rawClass ?? '');
    return {
      background: style?.backgroundColor ?? style?.background ?? null,
      color: style?.color ?? null,
      className,
    };
  }

  private formulaValue(source: number, leaf: Leaf<TData>): unknown {
    const value = this.readSource(source, leaf);
    if (!leaf.def.allowFormula || typeof value !== 'string' || !value.startsWith('=')) return value;
    const computed = this.evalFormula(value.slice(1), source, new Set());
    return computed == null ? value : computed;
  }

  private evalFormula(expr: string, source: number, seen: Set<string>): number | null {
    const replaced = expr.replace(/\[([^\]]+)\]/g, (_match, colId: string) => {
      const key = `${source}:${colId}`;
      if (seen.has(key)) return '0';
      const nextSeen = new Set(seen);
      nextSeen.add(key);
      const leaf = this.leafByKey(colId);
      if (!leaf) return '0';
      const raw = this.readSource(source, leaf);
      if (leaf.def.allowFormula && typeof raw === 'string' && raw.startsWith('=')) {
        const inner = this.evalFormula(raw.slice(1), source, nextSeen);
        return inner == null ? '0' : String(inner);
      }
      const number = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(number) ? String(number) : '0';
    });
    if (!/^[\d+\-*/().\s]+$/.test(replaced)) return null;
    try {
      const value = Function(`"use strict"; return (${replaced})`)() as unknown;
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  private textFor(source: number, leaf: Leaf<TData>): string {
    if (leaf.colId === ROW_NUMBERS_COL_ID) {
      const display = this.displayIndex(source);
      return display == null ? '' : String(display + 1);
    }
    if (leaf.selectionColumn) return '';
    const value = this.formulaValue(source, leaf);
    if (typeof leaf.valueFormatter === 'function') {
      return leaf.valueFormatter({
        value,
        data: this.rows[source],
        node: null,
        colDef: leaf.def,
        column: columnFacade(leaf),
        api: this.api,
        context: this.options.context,
      });
    }
    const custom = this.customText.get(`${source}:${leaf.colId}`);
    if (custom != null) return custom;
    if (leaf.kind === 'date' && typeof value === 'number') return formatDay(value);
    return value == null ? '' : String(value);
  }

  private hit(clientX: number, clientY: number): { display: number; source: number; leaf: Leaf<TData> } | null {
    const rect = this.viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const top = this.virtualTop();
    const display = this.displayOrigin() + Math.floor((top + y) / this.rowHeight());
    if (display >= this.displayOrigin() + this.scrollRowCount()) return null;
    const source = this.sourceAt(display);
    const group = this.flat?.[display]?.kind === 'group';
    if (source < 0 && !group) return null;
    const leaf = this.leafAtViewportX(x);
    if (!leaf) return null;
    return { display, source, leaf };
  }

  private leafAtViewportX(x: number): Leaf<TData> | null {
    const scrollLeft = this.viewport.scrollLeft;
    for (const leaf of visibleLeaves(this.leaves)) {
      const placed = this.positions.get(leaf.colId);
      if (!placed) continue;
      let screen = placed.x;
      if (leaf.pinned === 'right') screen = (this.viewport.clientWidth - this.rightWidth) + placed.x;
      else if (leaf.pinned == null) screen = this.leftWidth + placed.x - scrollLeft;
      if (x >= screen && x < screen + leaf.width) return leaf;
    }
    return null;
  }

  private cellRect(display: number, leaf: Leaf<TData>): { x: number; y: number; width: number; height: number } | null {
    const placed = this.positions.get(leaf.colId);
    if (!placed) return null;
    const top = this.virtualTop();
    const y = (display - this.displayOrigin()) * this.rowHeight() - top;
    let x = placed.x;
    if (leaf.pinned === 'right') x = this.viewport.clientWidth - this.rightWidth + placed.x;
    else if (leaf.pinned == null) x = this.leftWidth + placed.x - this.viewport.scrollLeft;
    return { x, y, width: leaf.width, height: this.rowHeight() };
  }

  private ensureVisible(display: number, colId: string | null): void {
    if (this.paginationOn()) {
      const page = Math.floor(display / this.paginationPageSize());
      if (page !== this.pageIndex) {
        this.pageIndex = page;
        this.viewport.scrollTop = 0;
        this.layout();
      }
    }
    const rowHeight = this.rowHeight();
    const top = this.virtualTop();
    const viewHeight = this.viewport.clientHeight;
    const rowTop = (display - this.displayOrigin()) * rowHeight;
    if (rowTop < top) this.setVirtualTop(rowTop);
    else if (rowTop + rowHeight > top + viewHeight) this.setVirtualTop(rowTop + rowHeight - viewHeight);
    if (!colId) return;
    const leaf = this.leafById(colId);
    const placed = leaf ? this.positions.get(leaf.colId) : undefined;
    if (!leaf || !placed || leaf.pinned) return;
    const left = this.leftWidth + placed.x;
    const right = left + leaf.width;
    const viewLeft = this.viewport.scrollLeft + this.leftWidth;
    const viewRight = this.viewport.scrollLeft + this.viewport.clientWidth - this.rightWidth;
    if (left < viewLeft) this.viewport.scrollLeft = Math.max(0, left - this.leftWidth);
    else if (right > viewRight) this.viewport.scrollLeft += right - viewRight;
  }

  private virtualTop(): number {
    const total = this.scrollRowCount() * this.rowHeight();
    if (total <= MAX_SCROLL) return this.viewport.scrollTop;
    const maxScroll = this.viewport.scrollHeight - this.viewport.clientHeight;
    if (maxScroll <= 0) return 0;
    const maxVirtual = Math.max(0, total - this.viewport.clientHeight);
    return (this.viewport.scrollTop / maxScroll) * maxVirtual;
  }

  private setVirtualTop(top: number): void {
    const total = this.scrollRowCount() * this.rowHeight();
    const clamped = Math.max(0, top);
    if (total <= MAX_SCROLL) {
      this.viewport.scrollTop = clamped;
      return;
    }
    const maxScroll = this.viewport.scrollHeight - this.viewport.clientHeight;
    const maxVirtual = Math.max(1, total - this.viewport.clientHeight);
    this.viewport.scrollTop = (clamped / maxVirtual) * maxScroll;
  }

  private syncRenderers(): void {
    const previous = this.floatLayer.querySelectorAll('.og-custom');
    for (const node of previous) node.remove();
    this.customText.clear();
    if (!this.leaves.some((leaf) => leaf.cellRenderer)) return;
    const origin = this.displayOrigin();
    const first = origin + Math.max(0, Math.floor(this.virtualTop() / this.rowHeight()));
    const last = Math.min(origin + this.scrollRowCount(), first + this.pageSize() + 1);
    for (let display = first; display < last; display++) {
      const source = this.sourceAt(display);
      if (source < 0) continue;
      for (const leaf of this.visibleLeaves()) {
        if (!leaf.cellRenderer) continue;
        let value = this.readSource(source, leaf);
        if (leaf.def.cellRenderer === 'agSparklineCellRenderer' && leaf.field) {
          const raw = readPath(this.rows[source], leaf.field);
          if (Array.isArray(raw)) value = raw;
        }
        const rendered = leaf.cellRenderer({
          value,
          valueFormatted: null,
          data: this.rows[source],
          node: this.nodeFor(source),
          colDef: leaf.def,
          column: columnFacade(leaf),
          api: this.api,
          context: this.options.context,
          rowIndex: display,
          eGridCell: null,
        });
        if (typeof rendered === 'string') {
          this.customText.set(`${source}:${leaf.colId}`, rendered);
          continue;
        }
        if (!(rendered instanceof HTMLElement)) continue;
        const rect = this.cellRect(display, leaf);
        if (!rect) continue;
        rendered.classList.add('og-custom');
        rendered.style.position = 'absolute';
        rendered.style.left = `${rect.x}px`;
        rendered.style.top = `${rect.y}px`;
        rendered.style.width = `${rect.width}px`;
        rendered.style.height = `${rect.height}px`;
        rendered.style.pointerEvents = 'auto';
        this.floatLayer.append(rendered);
      }
    }
  }

  private scheduleA11y(): void {
    window.clearTimeout(this.a11yTimer);
    this.a11yTimer = window.setTimeout(() => this.syncA11y(), 60);
  }

  private syncA11y(): void {
    const leaves = this.visibleLeaves();
    const headerRows = this.leaves.some((leaf) => leaf.groupId) ? 2 : 1;
    const origin = this.displayOrigin();
    const first = Math.max(origin, origin + Math.floor(this.virtualTop() / this.rowHeight()) - 1);
    const last = Math.min(origin + this.scrollRowCount(), first + this.pageSize() + 3);
    const fragment = document.createDocumentFragment();
    for (let display = first; display < last; display++) {
      const source = this.sourceAt(display);
      const group = this.flat?.[display]?.kind === 'group';
      if (source < 0 && !group) continue;
      const row = el('div', 'og-arow');
      row.setAttribute('role', 'row');
      row.setAttribute('aria-rowindex', String(headerRows + display + 1));
      if (source >= 0 && this.selected[source] === 1) row.setAttribute('aria-selected', 'true');
      let coveredUntil = 0;
      leaves.forEach((leaf, index) => {
        if (index < coveredUntil) return;
        const span = source >= 0 && typeof leaf.def.colSpan === 'function' ? Math.max(1, Math.floor(leaf.def.colSpan({ data: this.rows[source] }))) : 1;
        coveredUntil = index + span;
        const cell = el('div', 'og-acell');
        cell.id = this.cellDomId(display, index);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-colindex', String(index + 1));
        cell.dataset.colId = leaf.colId;
        if (span > 1) {
          cell.setAttribute('aria-colspan', String(span));
          const width = leaves.slice(index, index + span).reduce((sum, item) => sum + item.width, 0);
          cell.style.width = `${width}px`;
        }
        cell.textContent = leaf.selectionColumn ? (this.selected[source] === 1 ? 'selected' : 'not selected') : source < 0 ? this.groupLabel(display, leaf.colId) : this.textFor(source, leaf);
        const paint = this.paintStyle(source, leaf);
        if (paint.className) cell.classList.add(...paint.className.split(/\s+/).filter(Boolean));
        if (paint.background) cell.style.backgroundColor = paint.background;
        if (paint.color) cell.style.color = paint.color;
        row.append(cell);
      });
      fragment.append(row);
    }
    this.a11y.replaceChildren(fragment);
  }

  private cellDomId(display: number, col: number): string {
    return `${this.id}-r${display}-c${col}`;
  }

  private clipboardText(): string {
    const lines: string[] = [];
    for (const range of this.cellRanges) {
      const start = Math.min(range.rowStartIndex, range.rowEndIndex);
      const end = Math.max(range.rowStartIndex, range.rowEndIndex);
      for (let row = start; row <= end; row++) {
        const source = this.sourceAt(row);
        const cells = range.columns.map((colId) => {
          const leaf = this.leafByKey(colId);
          if (!leaf || source < 0) return '';
          const value = this.textFor(source, leaf);
          const next = this.options.processCellForClipboard?.({ value, column: columnFacade(leaf) });
          return next == null ? value : String(next);
        });
        lines.push(cells.join('\t'));
      }
    }
    return lines.join('\n');
  }

  private pasteClipboard(text: string): void {
    const range = this.cellRanges[0];
    if (!range) return;
    const start = Math.min(range.rowStartIndex, range.rowEndIndex);
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    rows.forEach((line, rowOffset) => {
      const source = this.sourceAt(start + rowOffset);
      if (source < 0) return;
      line.split('\t').forEach((cell, colOffset) => {
        const colId = range.columns[colOffset];
        const leaf = colId ? this.leafByKey(colId) : undefined;
        if (!leaf) return;
        const parsed = this.options.processCellFromClipboard?.({ value: cell, column: columnFacade(leaf) }) ?? cell;
        const current = this.readSource(source, leaf);
        const next = typeof current === 'number' && typeof parsed === 'string' && parsed !== '' && !Number.isNaN(Number(parsed)) ? Number(parsed) : parsed;
        this.writeSource(source, leaf, next, 'clipboard');
      });
    });
    this.paint();
    this.syncA11y();
  }

  private sourceAt(display: number): number {
    if (this.flat) {
      const item = this.flat[display];
      if (!item || item.kind !== 'leaf') return -1;
      return item.source;
    }
    if (display < 0 || display >= this.view.count) return -1;
    if (this.view.identity) return display;
    return this.view.indices[display] ?? -1;
  }

  private displayIndex(source: number): number | null {
    if (this.flat) {
      const index = this.flat.findIndex((item) => item.kind === 'leaf' && item.source === source);
      return index < 0 ? null : index;
    }
    if (source < 0 || source >= this.rows.length) return null;
    if (this.view.identity) return source < this.view.count ? source : null;
    if (!this.reverse) {
      this.reverse = new Uint32Array(this.rows.length);
      this.reverse.fill(0xffffffff);
      for (let index = 0; index < this.view.count; index++) {
        const sourceIndex = this.view.indices[index];
        if (sourceIndex != null) this.reverse[sourceIndex] = index;
      }
    }
    const value = this.reverse[source];
    return value == null || value === 0xffffffff ? null : value;
  }

  private nodeFor(source: number): RowNode<TData> {
    const cached = this.nodes.get(source);
    if (cached) return cached;
    const node = new RowNode(this, source);
    this.nodes.set(source, node);
    return node;
  }

  private rowId(source: number): string {
    if (this.options.getRowId) {
      const row = this.rows[source];
      if (row !== undefined) return this.options.getRowId({ data: row, level: 0 });
    }
    return String(source);
  }

  private leafById(colId: string): Leaf<TData> | undefined {
    return this.leaves.find((leaf) => leaf.colId === colId);
  }

  private leafByKey(key: string | Column): Leaf<TData> | undefined {
    const colId = typeof key === 'string' ? key : key.getColId();
    return this.leafById(colId) ?? this.leaves.find((leaf) => leaf.field === colId);
  }

  private visibleLeaves(): Leaf<TData>[] {
    return visibleLeaves(this.leaves);
  }

  private visibleIndex(leaf: Leaf<TData>): number {
    return this.visibleLeaves().indexOf(leaf);
  }

  private isEditable(leaf: Leaf<TData>, source: number): boolean {
    if (leaf.selectionColumn || source < 0) return false;
    if (typeof leaf.editable === 'function') {
      return leaf.editable({ data: this.rows[source], node: this.nodeFor(source), colDef: leaf.def, column: columnFacade(leaf), api: this.api });
    }
    return leaf.editable === true;
  }

  private rowHeight(): number {
    return this.options.rowHeight ?? 36;
  }

  private paginationOn(): boolean {
    return this.options.pagination === true;
  }

  private paginationPageSize(): number {
    const size = this.options.paginationPageSize;
    return typeof size === 'number' && size > 0 ? Math.floor(size) : 100;
  }

  private pageCount(): number {
    if (!this.paginationOn()) return 1;
    return Math.max(1, Math.ceil(this.view.count / this.paginationPageSize()));
  }

  private clampPage(): void {
    if (!this.paginationOn()) {
      this.pageIndex = 0;
      return;
    }
    const last = this.pageCount() - 1;
    if (this.pageIndex > last) this.pageIndex = last;
    if (this.pageIndex < 0) this.pageIndex = 0;
  }

  private displayOrigin(): number {
    if (!this.paginationOn() || this.view.count === 0) return 0;
    this.clampPage();
    return this.pageIndex * this.paginationPageSize();
  }

  private scrollRowCount(): number {
    if (!this.paginationOn()) return this.view.count;
    if (this.view.count === 0) return 0;
    return Math.min(this.paginationPageSize(), this.view.count - this.displayOrigin());
  }

  private firstDisplayed(): number {
    if (this.view.count === 0) return -1;
    const origin = this.displayOrigin();
    const local = Math.floor(this.virtualTop() / this.rowHeight());
    return Math.min(origin + this.scrollRowCount() - 1, origin + local);
  }

  private lastDisplayed(): number {
    if (this.view.count === 0) return -1;
    const first = this.firstDisplayed();
    const pageEnd = this.displayOrigin() + this.scrollRowCount() - 1;
    const measured = this.viewport.clientHeight;
    const fitsPage = this.paginationOn() && (measured === 0 || measured >= this.scrollRowCount() * this.rowHeight());
    if (fitsPage) return pageEnd;
    return Math.min(pageEnd, first + this.pageSize() - 1);
  }

  private goToPage(page: number): void {
    if (!this.paginationOn()) return;
    const last = this.pageCount() - 1;
    const next = Math.min(last, Math.max(0, Math.floor(page)));
    if (next === this.pageIndex) return;
    this.pageIndex = next;
    this.viewport.scrollTop = 0;
    this.layout();
    this.syncA11y();
  }

  private renderGroupPanel(): void {
    const mode = this.options.rowGroupPanelShow ?? 'never';
    const groups = this.groupLeaves();
    const show = mode === 'always' || (mode === 'onlyWhenGrouping' && groups.length > 0);
    this.groupPanel.hidden = !show;
    this.groupPanel.replaceChildren();
    if (!show) return;
    if (groups.length === 0) {
      this.groupPanel.textContent = 'Drag here to set row groups';
      return;
    }
    for (const leaf of groups) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = leaf.headerName;
      chip.addEventListener('click', () => {
        this.api.setRowGroupColumns(groups.filter((item) => item !== leaf).map((item) => item.colId));
      });
      this.groupPanel.append(chip);
    }
  }

  private renderStatus(): void {
    if (!this.status) return;
    const panels = this.options.statusBar?.statusPanels ?? [];
    const wantsCount = panels.some((panel) => panel.statusPanel === 'agTotalRowCountComponent' || panel.statusPanel === 'agTotalAndFilteredRowCountComponent');
    this.status.textContent = wantsCount ? `Rows: ${this.view.count}` : '';
  }

  private renderPager(): void {
    if (!this.paginationOn()) {
      this.pager.hidden = true;
      this.pager.replaceChildren();
      return;
    }
    this.pager.hidden = false;
    const count = this.view.count;
    const origin = this.displayOrigin();
    const shown = this.scrollRowCount();
    const from = count === 0 ? 0 : origin + 1;
    const to = count === 0 ? 0 : origin + shown;
    const pages = this.pageCount();
    const range = el('span', 'og-pager-range');
    range.textContent = `${from} to ${to} of ${count}`;
    const label = el('span', 'og-pager-label');
    label.textContent = `Page ${this.pageIndex + 1} of ${pages}`;
    const button = (text: string, target: number, disabled: boolean) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = text;
      node.disabled = disabled;
      node.addEventListener('click', () => this.goToPage(target));
      return node;
    };
    this.pager.replaceChildren(
      range,
      button('First', 0, this.pageIndex === 0),
      button('Previous', this.pageIndex - 1, this.pageIndex === 0),
      label,
      button('Next', this.pageIndex + 1, this.pageIndex >= pages - 1),
      button('Last', pages - 1, this.pageIndex >= pages - 1),
    );
  }

  private pageSize(): number {
    return Math.max(1, Math.floor(this.viewport.clientHeight / this.rowHeight()));
  }

  private readColors(): void {
    const style = getComputedStyle(this.root);
    const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    this.colors = {
      bg: pick('--og-bg', FALLBACK_COLORS.bg),
      stripe: pick('--og-stripe', FALLBACK_COLORS.stripe),
      text: pick('--og-text', FALLBACK_COLORS.text),
      line: pick('--og-line', FALLBACK_COLORS.line),
      selected: pick('--og-selected', FALLBACK_COLORS.selected),
      focus: pick('--og-focus', FALLBACK_COLORS.focus),
      checkbox: pick('--og-checkbox', FALLBACK_COLORS.checkbox),
      muted: pick('--og-muted', FALLBACK_COLORS.muted),
    };
  }

  private syncLeafDef(leaf: Leaf<TData>): void {
    leaf.def.width = leaf.width;
    leaf.def.sort = leaf.sort;
    leaf.def.sortIndex = leaf.sortIndex;
    leaf.def.hide = leaf.hide;
    leaf.def.pinned = leaf.pinned;
    leaf.def.flex = leaf.flex ?? null;
  }

  private gridState(): GridState {
    const columns = this.columnState();
    const sortModel = columns
      .filter((column) => column.sort === 'asc' || column.sort === 'desc')
      .slice()
      .sort((left, right) => (left.sortIndex ?? 0) - (right.sortIndex ?? 0))
      .map((column) => ({ colId: column.colId, sort: column.sort === 'desc' ? 'desc' as const : 'asc' as const, type: 'default' }));
    const hiddenColIds = columns.filter((column) => column.hide).map((column) => column.colId);
    const leftColIds = columns.filter((column) => column.pinned === 'left').map((column) => column.colId);
    const rightColIds = columns.filter((column) => column.pinned === 'right').map((column) => column.colId);
    const filterModel = JSON.parse(JSON.stringify(this.filterModel)) as FilterModel;
    const state: GridState = {
      version: '0.1.0',
      columnOrder: { orderedColIds: columns.map((column) => column.colId) },
      columnSizing: {
        columnSizingModel: columns.map((column) => {
          const item: { colId: string; width?: number; flex?: number } = { colId: column.colId };
          if (typeof column.width === 'number') item.width = column.width;
          if (column.flex != null) item.flex = column.flex;
          return item;
        }),
      },
    };
    if (sortModel.length > 0) state.sort = { sortModel };
    if (Object.keys(filterModel).length > 0) state.filter = { filterModel };
    if (leftColIds.length > 0 || rightColIds.length > 0) state.columnPinning = { leftColIds, rightColIds };
    if (hiddenColIds.length > 0) state.columnVisibility = { hiddenColIds };
    if (this.paginationOn()) state.pagination = { page: this.pageIndex, pageSize: this.paginationPageSize() };
    const selected = this.selectedIds();
    if (selected.length > 0) state.rowSelection = selected;
    return state;
  }

  private selectedIds(): string[] {
    const ids: string[] = [];
    for (let source = 0; source < this.rows.length; source++) {
      if (this.selected[source] === 1) ids.push(this.rowId(source));
    }
    return ids;
  }

  private restoreState(state: GridState, ignore: (keyof GridState)[] | undefined): void {
    const skip = new Set(ignore ?? []);
    if (!skip.has('columnOrder') && state.columnOrder) {
      this.applyColumnState({ state: state.columnOrder.orderedColIds.map((colId) => ({ colId })), applyOrder: true });
    }
    if (!skip.has('columnSizing') && state.columnSizing) {
      this.api.setColumnWidths(
        state.columnSizing.columnSizingModel
          .filter((item) => item.width != null)
          .map((item) => ({ key: item.colId, newWidth: item.width ?? 0 })),
      );
      for (const item of state.columnSizing.columnSizingModel) {
        const leaf = this.leafById(item.colId);
        if (!leaf || item.flex == null) continue;
        leaf.flex = item.flex;
        this.syncLeafDef(leaf);
      }
    }
    if (!skip.has('columnPinning') && state.columnPinning) {
      this.api.setColumnsPinned(this.leaves.map((leaf) => leaf.colId), null);
      if (state.columnPinning.leftColIds.length > 0) this.api.setColumnsPinned(state.columnPinning.leftColIds, 'left');
      if (state.columnPinning.rightColIds.length > 0) this.api.setColumnsPinned(state.columnPinning.rightColIds, 'right');
    }
    if (!skip.has('columnVisibility') && state.columnVisibility) {
      const hidden = new Set(state.columnVisibility.hiddenColIds);
      const shown = this.leaves.map((leaf) => leaf.colId).filter((colId) => !hidden.has(colId));
      if (shown.length > 0) this.api.setColumnsVisible(shown, true);
      if (hidden.size > 0) this.api.setColumnsVisible([...hidden], false);
    }
    if (!skip.has('sort') && state.sort) {
      this.api.applyColumnState({
        state: state.sort.sortModel.map((item, index) => ({ colId: item.colId, sort: item.sort, sortIndex: index })),
        defaultState: { sort: null },
      });
    }
    if (!skip.has('filter') && state.filter) this.api.setFilterModel(state.filter.filterModel ?? null);
    if (!skip.has('pagination') && state.pagination) {
      if (state.pagination.pageSize != null) this.api.setGridOption('paginationPageSize', state.pagination.pageSize);
      if (state.pagination.page != null) this.goToPage(state.pagination.page);
    }
    if (!skip.has('rowSelection') && Array.isArray(state.rowSelection)) {
      this.api.deselectAll();
      const nodes = state.rowSelection.map((id) => this.api.getRowNode(id)).filter((node): node is NonNullable<typeof node> => node != null);
      if (nodes.length > 0) this.api.setNodesSelected({ nodes, newValue: true });
    }
    this.layout();
  }

  private columnState(): ColumnState[] {
    return this.leaves.map((leaf) => ({
      colId: leaf.colId,
      hide: leaf.hide,
      width: leaf.width,
      flex: leaf.flex ?? null,
      sort: leaf.sort,
      sortIndex: leaf.sortIndex,
      pinned: leaf.pinned,
    }));
  }

  private applyState(leaf: Leaf<TData>, state: Partial<ColumnState>): void {
    if (state.hide != null) leaf.hide = Boolean(state.hide);
    if (state.width != null) leaf.width = state.width;
    if (state.flex !== undefined) leaf.flex = state.flex ?? undefined;
    if (state.pinned !== undefined) leaf.pinned = state.pinned;
    if (state.sort !== undefined) leaf.sort = state.sort ?? null;
    if (state.sortIndex !== undefined) leaf.sortIndex = state.sortIndex ?? null;
    this.syncLeafDef(leaf);
  }

  private autoSize(keys: readonly string[], skipHeader: boolean): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = '13px "Liberation Sans", "Segoe UI", sans-serif';
    for (const key of keys) {
      const leaf = this.leafById(key);
      if (!leaf || leaf.selectionColumn) continue;
      let width = skipHeader || !ctx ? 0 : ctx.measureText(leaf.headerName).width + 36;
      const limit = Math.min(this.view.count, 200);
      for (let display = 0; display < limit; display++) {
        const source = this.sourceAt(display);
        if (source < 0) continue;
        const text = this.textFor(source, leaf);
        const measured = ctx ? ctx.measureText(text).width : text.length * 8;
        width = Math.max(width, measured + 24);
      }
      leaf.width = clamp(Math.ceil(width), leaf.minWidth, leaf.maxWidth);
      leaf.flex = undefined;
      this.syncLeafDef(leaf);
    }
    this.layout();
  }

  private csv(params?: CsvExportParams): string {
    const leaves = this.exportLeaves(params);
    const columns = leaves.map((leaf) => columnFacade(leaf));
    const header = leaves.map((leaf, index) => params?.processHeaderCallback?.({ column: columns[index]! }) ?? leaf.headerName);
    const lines: string[][] = [];
    if (!params?.skipColumnGroupHeaders && leaves.some((leaf) => leaf.groupName)) {
      lines.push(leaves.map((leaf) => leaf.groupName ?? ''));
    }
    if (!params?.skipColumnHeaders) lines.push(header);
    const displays = this.exportDisplays(params);
    for (const display of displays) {
      const source = params?.exportedRows === 'all' ? display : this.sourceAt(display);
      if (source < 0) continue;
      const node = this.nodeFor(source);
      lines.push(leaves.map((leaf, index) => {
        const value = this.exportValue(source, leaf);
        const column = columns[index];
        if (params?.processCellCallback && column) return params.processCellCallback({ value, node, column });
        return value == null ? '' : String(value);
      }));
    }
    return params?.suppressQuotes ? encodeCsvRaw(lines, params.columnSeparator ?? ',') : encodeCsv(lines, params?.columnSeparator ?? ',');
  }

  private createRangeChart(params: { cellRange: { rowStartIndex: number; rowEndIndex: number; columns: (string | Column)[] }; chartType?: string }): { chartId: string; destroyChart: () => void } {
    this.chartPanel?.remove();
    const start = Math.min(params.cellRange.rowStartIndex, params.cellRange.rowEndIndex);
    const end = Math.max(params.cellRange.rowStartIndex, params.cellRange.rowEndIndex);
    const colIds = params.cellRange.columns.map((key) => (typeof key === 'string' ? key : key.getColId()));
    const valueCol = colIds.find((colId) => this.leafByKey(colId)?.kind === 'number') ?? colIds[colIds.length - 1] ?? '';
    const labelCol = colIds.find((colId) => colId !== valueCol) ?? valueCol;
    const points: { label: string; value: number }[] = [];
    for (let row = start; row <= end; row++) {
      const source = this.sourceAt(row);
      const valueLeaf = this.leafByKey(valueCol);
      const labelLeaf = this.leafByKey(labelCol);
      if (!valueLeaf || source < 0) continue;
      const raw = this.readSource(source, valueLeaf);
      const value = typeof raw === 'number' ? raw : Number(raw);
      points.push({ label: labelLeaf ? this.textFor(source, labelLeaf) : String(row), value: Number.isNaN(value) ? 0 : value });
    }
    const panel = document.createElement('div');
    panel.className = 'og-chart';
    panel.dataset.chartType = params.chartType ?? 'column';
    panel.dataset.series = points.map((point) => String(point.value)).join(',');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 80');
    const max = Math.max(...points.map((point) => point.value), 1);
    points.forEach((point, index) => {
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const slot = 200 / Math.max(points.length, 1);
      const height = (point.value / max) * 70;
      bar.setAttribute('x', String(index * slot + 4));
      bar.setAttribute('y', String(75 - height));
      bar.setAttribute('width', String(Math.max(1, slot - 8)));
      bar.setAttribute('height', String(height));
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${point.label} ${point.value}`;
      bar.append(title);
      svg.append(bar);
    });
    panel.append(svg);
    this.host.append(panel);
    this.chartPanel = panel;
    const chartId = `chart-${++this.chartSeq}`;
    return {
      chartId,
      destroyChart: () => {
        panel.remove();
        if (this.chartPanel === panel) this.chartPanel = null;
      },
    };
  }

  private excelRows(): string[][] {
    const leaves = this.exportLeaves();
    const lines: string[][] = [leaves.map((leaf) => leaf.headerName)];
    for (const display of this.exportDisplays()) {
      const source = this.sourceAt(display);
      if (source < 0) continue;
      lines.push(leaves.map((leaf) => {
        const value = this.exportValue(source, leaf);
        return value == null ? '' : String(value);
      }));
    }
    return lines;
  }

  private exportLeaves(params?: CsvExportParams): Leaf<TData>[] {
    if (params?.columnKeys) return params.columnKeys.map((key) => this.leafByKey(key)).filter((leaf): leaf is Leaf<TData> => Boolean(leaf));
    if (params?.allColumns) return this.leaves.filter((leaf) => !leaf.selectionColumn);
    return this.visibleLeaves().filter((leaf) => !leaf.selectionColumn);
  }

  private exportDisplays(params?: CsvExportParams): number[] {
    if (params?.exportedRows === 'all') return Array.from({ length: this.rows.length }, (_, index) => index);
    const displays: number[] = [];
    for (let display = 0; display < this.view.count; display++) {
      const source = this.sourceAt(display);
      if (params?.onlySelected && this.selected[source] !== 1) continue;
      displays.push(display);
    }
    return displays;
  }

  private exportValue(source: number, leaf: Leaf<TData>): unknown {
    if (leaf.kind === 'date') {
      const value = this.readSource(source, leaf);
      return typeof value === 'number' ? formatDay(value) : value;
    }
    if (typeof leaf.valueFormatter === 'function') return this.textFor(source, leaf);
    return this.readSource(source, leaf);
  }

  private applyTransaction(transaction: RowDataTransaction<TData>): RowNodeTransaction<TData> {
    const selectedIds = new Set(this.selectedList.map((source) => this.rowId(source)));
    let next = this.rows.slice();
    const removed: IRowNode<TData>[] = [];
    const updatedData: TData[] = [];
    const addedData: TData[] = [];
    if (transaction.remove?.length) {
      const drop = new Set<number>();
      for (const item of transaction.remove) {
        const source = this.findRow(item, next);
        const row = source >= 0 ? next[source] : undefined;
        if (source < 0 || row === undefined) continue;
        drop.add(source);
        removed.push(this.frozenNode(row));
      }
      next = next.filter((_, index) => !drop.has(index));
    }
    if (transaction.update?.length) {
      for (const item of transaction.update) {
        const source = this.findRow(item, next);
        if (source < 0) continue;
        next[source] = item;
        updatedData.push(item);
      }
    }
    if (transaction.add?.length) {
      const index = transaction.addIndex == null ? next.length : Math.max(0, Math.min(transaction.addIndex, next.length));
      next.splice(index, 0, ...transaction.add);
      addedData.push(...transaction.add);
    }
    this.loadRows(next, false);
    this.selected.fill(0);
    this.selectedList = [];
    for (let source = 0; source < this.rows.length; source++) {
      if (!selectedIds.has(this.rowId(source))) continue;
      this.selected[source] = 1;
      this.selectedList.push(source);
    }
    this.paint();
    const lookup = (item: TData) => {
      const source = this.findRow(item, this.rows);
      return source < 0 ? null : this.nodeFor(source);
    };
    return {
      add: addedData.map(lookup).filter((node): node is RowNode<TData> => node != null),
      remove: removed,
      update: updatedData.map(lookup).filter((node): node is RowNode<TData> => node != null),
    };
  }

  private findRow(item: TData, rows: readonly TData[]): number {
    if (this.options.getRowId) {
      const id = this.options.getRowId({ data: item, level: 0 });
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (row !== undefined && this.options.getRowId({ data: row, level: 0 }) === id) return index;
      }
      return -1;
    }
    return rows.indexOf(item);
  }

  private frozenNode(data: TData): IRowNode<TData> {
    const id = this.options.getRowId?.({ data, level: 0 });
    return {
      id,
      data,
      rowIndex: null,
      rowPinned: null,
      displayed: false,
      selected: false,
      selectable: false,
      group: false,
      rowHeight: this.rowHeight(),
      rowTop: null,
      level: 0,
      key: null,
      expanded: false,
      allChildrenCount: null,
      aggData: null,
      setExpanded() {},
      setSelected() {},
      isSelected: () => false,
      isRowPinned: () => false,
      setData() {},
      setDataValue: () => false,
      addEventListener() {},
      removeEventListener() {},
    };
  }

  private announce(text: string): void {
    this.live.textContent = text;
  }

  private warn(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`opengrid: ${message}`);
  }

  private emit(type: string, extra: Record<string, unknown>): void {
    const event = { type, api: this.api, context: this.options.context, ...extra };
    const handlerName = `on${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    const handler = (this.options as Record<string, unknown>)[handlerName];
    if (typeof handler === 'function') handler(event);
    for (const listener of this.listeners.get(type) ?? []) listener(event as AgEvent<TData>);
  }

  private createApi(): GridApi<TData> {
    const session = this;
    return {
      destroy: () => session.destroy(),
      getGridId: () => session.id,
      isDestroyed: () => session.destroyed,
      isModuleRegistered: (name) => name === 'AllCommunity' || name === 'CommunityCore',
      getGridOption: (key) => session.options[key],
      setGridOption: (key, value) => {
        (session.options as Record<string, unknown>)[key as string] = value;
        if (key === 'rowData') session.loadRows((value as TData[] | null | undefined) ?? [], false);
        else if (key === 'columnDefs' || key === 'defaultColDef' || key === 'columnTypes') {
          session.rebuildColumns(session.rows);
          session.loadRows(session.rows, false);
        } else if (key === 'rowSelection') {
          session.selection = selectionConfig(session.options);
          session.rebuildColumns(session.rows);
          session.layout();
        } else if (key === 'rowHeight' || key === 'headerHeight') session.layout();
        else if (key === 'datasource') {
          session.infiniteKnown = typeof (value as { rowCount?: number } | null)?.rowCount === 'number';
          session.reloadInfinite(true);
        }
        else if (key === 'quickFilterText') session.refresh('filter');
        else if (key === 'pagination' || key === 'paginationPageSize') {
          session.clampPage();
          session.viewport.scrollTop = 0;
          session.layout();
          session.syncA11y();
        }
      },
      updateGridOptions: (options) => {
        for (const [key, value] of Object.entries(options)) session.api.setGridOption(key as keyof GridOptions<TData>, value as never);
      },
      getColumnDefs: () => session.leaves.filter((leaf) => !leaf.selectionColumn).map((leaf) => leaf.def),
      getColumnState: () => session.columnState(),
      applyColumnState: (params) => {
        session.applyColumnState(params);
        return true;
      },
      resetColumnState: () => {
        session.rebuildColumns(session.rows);
        session.refresh('sort');
      },
      setColumnsVisible: (keys, visible) => {
        const columns: Column[] = [];
        for (const key of keys) {
          const leaf = session.leafByKey(key);
          if (!leaf) continue;
          leaf.hide = !visible;
          session.syncLeafDef(leaf);
          columns.push(columnFacade(leaf));
        }
        session.layout();
        session.emit('columnVisible', { column: columns[0] ?? null, columns, source: 'api' });
      },
      setColumnsPinned: (keys, pinned) => {
        const columns: Column[] = [];
        for (const key of keys) {
          const leaf = session.leafByKey(key);
          if (!leaf) continue;
          leaf.pinned = pinned;
          session.syncLeafDef(leaf);
          columns.push(columnFacade(leaf));
        }
        session.layout();
        session.emit('columnPinned', { column: columns[0] ?? null, columns, source: 'api' });
      },
      getColumns: () => session.leaves.map((leaf) => columnFacade(leaf)),
      getAllGridColumns: () => session.reportedColumns().map((leaf) => columnFacade(leaf)),
      getDisplayedLeftColumns: () => bandsOf(session.leaves).left.map((leaf) => columnFacade(leaf)),
      getDisplayedCenterColumns: () => bandsOf(session.leaves).center.map((leaf) => columnFacade(leaf)),
      getDisplayedRightColumns: () => bandsOf(session.leaves).right.map((leaf) => columnFacade(leaf)),
      getAllDisplayedColumns: () => {
        const { left, center, right } = bandsOf(session.leaves);
        return [...left, ...center, ...right].map((leaf) => columnFacade(leaf));
      },
      moveColumns: (keys, toIndex) => {
        const moving = keys.map((key) => session.leafByKey(key)).filter((leaf): leaf is Leaf<TData> => Boolean(leaf));
        const stay = session.leaves.filter((leaf) => !moving.includes(leaf));
        stay.splice(Math.max(0, Math.min(toIndex, stay.length)), 0, ...moving);
        session.leaves = stay;
        session.layout();
        session.emit('columnMoved', { column: moving[0] ? columnFacade(moving[0]) : null, columns: moving.map((leaf) => columnFacade(leaf)), finished: true, source: 'api' });
      },
      moveColumnByIndex: (fromIndex, toIndex) => {
        const leaf = session.visibleLeaves()[fromIndex];
        if (!leaf) return;
        session.api.moveColumns([leaf.colId], toIndex);
      },
      autoSizeColumns: (keys, skipHeader) => session.autoSize(keys.map((key) => (typeof key === 'string' ? key : key.getColId())), Boolean(skipHeader)),
      autoSizeAllColumns: (skipHeader) => session.autoSize(session.leaves.map((leaf) => leaf.colId), Boolean(skipHeader)),
      sizeColumnsToFit: (gridWidth) => {
        const available = (gridWidth ?? session.viewport.clientWidth) - session.leftWidth - session.rightWidth;
        const columns = bandsOf(session.leaves).center.filter((leaf) => !leaf.suppressSizeToFit);
        const total = columns.reduce((sum, leaf) => sum + leaf.width, 0);
        if (total <= 0 || available <= 0) return;
        let used = 0;
        columns.forEach((leaf, index) => {
          const width = index === columns.length - 1 ? available - used : Math.floor((leaf.width / total) * available);
          leaf.width = clamp(width, leaf.minWidth, leaf.maxWidth);
          leaf.flex = undefined;
          used += leaf.width;
          session.syncLeafDef(leaf);
        });
        session.layout();
      },
      setColumnWidths: (columnWidths) => {
        for (const item of columnWidths) {
          const leaf = session.leafByKey(item.key);
          if (!leaf) continue;
          leaf.width = clamp(item.newWidth, leaf.minWidth, leaf.maxWidth);
          leaf.flex = undefined;
          session.syncLeafDef(leaf);
        }
        session.layout();
      },
      isPinning: () => session.leaves.some((leaf) => !leaf.hide && leaf.pinned != null),
      isPinningLeft: () => session.leaves.some((leaf) => !leaf.hide && leaf.pinned === 'left'),
      isPinningRight: () => session.leaves.some((leaf) => !leaf.hide && leaf.pinned === 'right'),
      applyTransaction: (transaction) => session.applyTransaction(transaction),
      getDisplayedRowCount: () => session.view.count,
      getDisplayedRowAtIndex: (index) => {
        if (session.flat) return session.displayedNode(index);
        const source = session.sourceAt(index);
        return source < 0 ? undefined : session.nodeFor(source);
      },
      getFirstDisplayedRowIndex: () => session.firstDisplayed(),
      getLastDisplayedRowIndex: () => session.lastDisplayed(),
      paginationIsLastPageFound: () => !session.infiniteMode() || session.infiniteKnown,
      paginationGetPageSize: () => session.paginationPageSize(),
      paginationGetCurrentPage: () => (session.paginationOn() ? session.pageIndex : 0),
      paginationGetTotalPages: () => (session.paginationOn() ? session.pageCount() : 1),
      paginationGetRowCount: () => session.view.count,
      paginationGoToNextPage: () => session.goToPage(session.pageIndex + 1),
      paginationGoToPreviousPage: () => session.goToPage(session.pageIndex - 1),
      paginationGoToFirstPage: () => session.goToPage(0),
      paginationGoToLastPage: () => session.goToPage(session.pageCount() - 1),
      paginationGoToPage: (page) => session.goToPage(page),
      refreshInfiniteCache: () => session.reloadInfinite(false),
      purgeInfiniteCache: () => session.reloadInfinite(true),
      getInfiniteRowCount: () => (session.infiniteMode() ? session.view.count : undefined),
      setRowCount: (rowCount, maxRowFound) => {
        if (maxRowFound !== undefined) session.infiniteKnown = maxRowFound;
        session.setInfiniteCount(rowCount);
        session.layout();
        session.ensureInfinite();
      },
      isLastRowIndexKnown: () => (session.infiniteMode() ? session.infiniteKnown : undefined),
      getCacheBlockState: () => {
        const size = Math.max(1, session.options.cacheBlockSize ?? 100);
        const state: Record<string, { blockNumber: number; startRow: number; endRow: number; pageStatus: string }> = {};
        for (const [block, status] of session.infiniteBlocks) {
          state[String(block)] = { blockNumber: block, startRow: block * size, endRow: block * size + size, pageStatus: status };
        }
        return state;
      },
      getState: () => session.gridState(),
      setState: (state, ignore) => session.restoreState(state, ignore),
      forEachNode: (callback) => {
        for (let source = 0; source < session.rows.length; source++) callback(session.nodeFor(source), source);
      },
      forEachNodeAfterFilter: (callback) => {
        const filtered = applyQuickFilter(session.store, applyFilter(session.store, session.filterModel), session.quickText());
        for (let index = 0; index < filtered.count; index++) {
          const source = filtered.identity ? index : filtered.indices[index] ?? -1;
          if (source >= 0) callback(session.nodeFor(source), index);
        }
      },
      forEachNodeAfterFilterAndSort: (callback) => {
        if (session.flat) {
          session.flat.forEach((item, index) => callback(item.kind === 'group' ? session.groupNode(item) : session.nodeFor(item.source), index));
          return;
        }
        for (let index = 0; index < session.view.count; index++) {
          const source = session.sourceAt(index);
          if (source >= 0) callback(session.nodeFor(source), index);
        }
      },
      forEachLeafNode: (callback) => {
        for (let source = 0; source < session.rows.length; source++) callback(session.nodeFor(source));
      },
      getRowNode: (id) => {
        if (session.groupNodes.has(id)) return session.groupNodes.get(id);
        if (session.idToSource.size > 0) {
          const source = session.idToSource.get(id);
          return source == null ? undefined : session.nodeFor(source);
        }
        if (/^\d+$/.test(id)) {
          const source = Number(id);
          return source >= 0 && source < session.rows.length ? session.nodeFor(source) : undefined;
        }
        return undefined;
      },
      getRowGroupColumns: () => session.groupLeaves().map((leaf) => columnFacade(leaf)),
      setRowGroupColumns: (colKeys) => {
        const ids = colKeys.map((key) => (typeof key === 'string' ? key : key.getColId()));
        for (const leaf of session.leaves) {
          if (leaf.selectionColumn || leaf.colId === AUTO_GROUP_COL_ID) continue;
          const index = ids.indexOf(leaf.colId);
          leaf.def.rowGroup = index >= 0 ? true : null;
          leaf.def.rowGroupIndex = index >= 0 ? index : null;
        }
        session.groupExpanded.clear();
        session.refresh('sort');
      },
      getSelectedNodes: () => session.selectedList.map((source) => session.nodeFor(source)),
      getSelectedRows: () => session.selectedList.map((source) => session.rows[source]).filter((row): row is TData => row !== undefined),
      selectAll: () => session.selectSources(session.selectionTargets(), true, true),
      deselectAll: () => session.selectSources([], true, true),
      setNodesSelected: ({ nodes, newValue }) => {
        session.selectSources(nodes.map((node) => (node as RowNode<TData>).sourceIndex), newValue, false);
      },
      setFilterModel: (model) => {
        session.filterModel = model ?? {};
        session.refresh('filter');
      },
      getFilterModel: () => ({ ...session.filterModel }),
      setAdvancedFilterModel: (model) => {
        session.advancedModel = model;
        session.refresh('filter');
      },
      getAdvancedFilterModel: () => session.advancedModel,
      undoCellEditing: () => session.undoCellEditing(),
      redoCellEditing: () => session.redoCellEditing(),
      isAnyFilterPresent: () => session.hasFilter(),
      isColumnFilterPresent: () => session.columnFilterPresent(),
      onFilterChanged: () => session.refresh('filter'),
      showColumnFilter: (colKey) => {
        const leaf = session.leafByKey(colKey);
        const cell = leaf ? session.header.querySelector<HTMLElement>(`[data-col-id="${leaf.colId}"]`) : null;
        if (leaf && cell) session.openFilter(leaf, cell);
      },
      hideColumnFilter: () => {
        session.popup.hidden = true;
      },
      destroyFilter: (key) => {
        const leaf = session.leafByKey(key);
        if (!leaf) return;
        const next = { ...session.filterModel };
        delete next[leaf.colId];
        session.api.setFilterModel(next);
      },
      onSortChanged: () => session.refresh('sort'),
      getFocusedCell: () => {
        const leaf = session.visibleLeaves()[session.focusCol];
        if (!leaf || session.view.count === 0) return null;
        return { rowIndex: session.focusRow, rowPinned: null, column: columnFacade(leaf) };
      },
      setFocusedCell: (rowIndex, colKey) => {
        const leaf = session.leafByKey(colKey);
        const col = leaf ? session.visibleLeaves().indexOf(leaf) : 0;
        session.setFocus(rowIndex, Math.max(0, col), true);
      },
      addCellRange: (params) => {
        session.cellRanges.push({
          rowStartIndex: params.rowStartIndex,
          rowEndIndex: params.rowEndIndex,
          columns: params.columns.map((key) => (typeof key === 'string' ? key : key.getColId())),
        });
      },
      getCellRanges: () => {
        if (session.cellRanges.length === 0) return null;
        return session.cellRanges.map((range) => ({
          startRow: { rowIndex: range.rowStartIndex },
          endRow: { rowIndex: range.rowEndIndex },
          columns: range.columns.flatMap((colId) => {
            const leaf = session.leafByKey(colId);
            return leaf ? [columnFacade(leaf)] : [];
          }),
        }));
      },
      clearCellSelection: () => {
        session.cellRanges = [];
      },
      copySelectedRangeToClipboard: () => {
        session.options.sendToClipboard?.({ data: session.clipboardText() });
      },
      startEditingCell: (params) => {
        const leaf = session.leafByKey(params.colKey);
        if (leaf) session.beginEdit(params.rowIndex, leaf, params.key);
      },
      stopEditing: (cancel) => session.closeEditor(Boolean(cancel)),
      getEditingCells: () => (session.editor ? [{ rowIndex: session.editor.displayRow, colId: session.editor.leaf.colId, rowPinned: null }] : []),
      refreshCells: () => session.paint(),
      redrawRows: () => session.paint(),
      refreshHeader: () => session.renderHeader(),
      ensureIndexVisible: (index, position) => {
        if (session.paginationOn() && index >= 0) {
          const page = Math.floor(index / session.paginationPageSize());
          if (page !== session.pageIndex) {
            session.pageIndex = page;
            session.viewport.scrollTop = 0;
            session.layout();
          }
        }
        const rowHeight = session.rowHeight();
        const rowTop = (index - session.displayOrigin()) * rowHeight;
        const view = session.viewport.clientHeight;
        const top = session.virtualTop();
        if (position === 'top') session.setVirtualTop(rowTop);
        else if (position === 'bottom') session.setVirtualTop(rowTop + rowHeight - view);
        else if (position === 'middle') session.setVirtualTop(rowTop - view / 2 + rowHeight / 2);
        else if (rowTop < top) session.setVirtualTop(rowTop);
        else if (rowTop + rowHeight > top + view) session.setVirtualTop(rowTop + rowHeight - view);
      },
      ensureColumnVisible: (key) => {
        const leaf = session.leafByKey(key);
        if (leaf) session.ensureVisible(session.focusRow, leaf.colId);
      },
      getDataAsCsv: (params) => session.csv(params),
      exportDataAsCsv: (params) => downloadCsv(session.csv(params), params?.fileName),
      getDataAsExcel: () => new Blob([Uint8Array.from(workbookBytes(session.excelRows()))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      exportDataAsExcel: () => {
        const blob = new Blob([Uint8Array.from(workbookBytes(session.excelRows()))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'export.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      },
      createRangeChart: (params) => session.createRangeChart(params),
      addEventListener: (eventType, listener) => {
        const set = session.listeners.get(eventType) ?? new Set();
        set.add(listener);
        session.listeners.set(eventType, set);
      },
      removeEventListener: (eventType, listener) => {
        session.listeners.get(eventType)?.delete(listener);
      },
      getVerticalPixelRange: () => {
        const top = session.virtualTop();
        return { top, bottom: top + session.viewport.clientHeight };
      },
      getHorizontalPixelRange: () => ({ left: session.viewport.scrollLeft, right: session.viewport.scrollLeft + session.viewport.clientWidth }),
      showLoadingOverlay: () => {
        session.options.loading = true;
        session.renderEmpty();
      },
      showNoRowsOverlay: () => {
        session.empty.hidden = false;
        session.empty.textContent = 'No Rows To Show';
      },
      hideOverlay: () => {
        session.options.loading = false;
        session.renderEmpty();
      },
      setColumnGroupOpened: () => session.warn('group', 'collapsing column groups is not implemented yet'),
      getColumnGroupState: () => groupRuns(session.leaves).map((run) => ({ groupId: run.groupId, open: true })),
    };
  }

  private applyColumnState(params: ApplyColumnStateParams): void {
    const listed = new Set((params.state ?? []).map((state) => state.colId));
    if (params.defaultState) {
      for (const leaf of this.leaves) {
        if (!listed.has(leaf.colId)) this.applyState(leaf, params.defaultState);
      }
    }
    for (const state of params.state ?? []) {
      const leaf = this.leafById(state.colId);
      if (leaf) this.applyState(leaf, state);
    }
    if (params.applyOrder && params.state) {
      const order = params.state.map((state) => state.colId);
      this.leaves.sort((a, b) => {
        const left = order.indexOf(a.colId);
        const right = order.indexOf(b.colId);
        if (left === -1 && right === -1) return 0;
        if (left === -1) return 1;
        if (right === -1) return -1;
        return left - right;
      });
    }
    this.refresh('sort');
  }
}

class GroupNode<TData> implements IRowNode<TData> {
  readonly group = true;
  readonly rowPinned = null;
  readonly data = undefined;
  readonly selectable = false;
  readonly selected = false;
  readonly rowHeight = null;
  readonly rowTop = null;
  private item: GroupFlat;

  constructor(private readonly session: GridSession<TData>, item: GroupFlat) {
    this.item = item;
  }

  sync(item: GroupFlat): void {
    this.item = item;
  }

  get id(): string {
    return this.item.id;
  }

  get key(): string {
    return this.item.key;
  }

  get level(): number {
    return this.item.level;
  }

  get expanded(): boolean {
    return this.item.expanded;
  }

  get allChildrenCount(): number {
    return this.item.leafCount;
  }

  get aggData(): Record<string, number | null> | null {
    const data: Record<string, number | null> = {};
    let any = false;
    for (const leaf of this.session['leaves']) {
      if (!leaf.def.aggFunc || leaf.colId === AUTO_GROUP_COL_ID) continue;
      if (this.session['options'].pivotMode && leaf.def.pivotKey == null) continue;
      any = true;
      data[leaf.colId] = this.session['groupAgg'](this.item, leaf.colId);
    }
    return any ? data : null;
  }

  get rowIndex(): number | null {
    const index = this.session['flat']?.findIndex((item) => item.kind === 'group' && item.id === this.item.id) ?? -1;
    return index < 0 ? null : index;
  }

  get displayed(): boolean {
    return this.rowIndex != null;
  }

  setExpanded(expanded: boolean): void {
    this.session['groupExpanded'].set(this.item.id, expanded);
    this.session['attachGroups']();
    this.session['reverse'] = null;
    this.session['layout']();
    this.session['syncA11y']();
  }

  setSelected(): void {}

  isSelected(): boolean {
    return false;
  }

  isRowPinned(): boolean {
    return false;
  }

  setData(): void {}

  setDataValue(): boolean {
    return false;
  }

  addEventListener(): void {}

  removeEventListener(): void {}
}

class RowNode<TData> implements IRowNode<TData> {
  readonly level = 0;
  readonly group = false;
  readonly rowPinned = null;
  readonly key = null;
  readonly allChildrenCount = null;
  readonly aggData = null;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(private readonly session: GridSession<TData>, readonly sourceIndex: number) {}

  get id(): string {
    return this.session['rowId'](this.sourceIndex);
  }

  get data(): TData | undefined {
    return this.session['rows'][this.sourceIndex];
  }

  get rowIndex(): number | null {
    return this.session['displayIndex'](this.sourceIndex);
  }

  get displayed(): boolean {
    return this.rowIndex != null;
  }

  get expanded(): boolean {
    return this.session['detailOpen'].has(this.sourceIndex);
  }

  get selected(): boolean {
    return this.session['selected'][this.sourceIndex] === 1;
  }

  get selectable(): boolean {
    return this.session['canSelect'](this.sourceIndex);
  }

  get rowHeight(): number {
    return this.session['rowHeight']();
  }

  get rowTop(): number | null {
    const index = this.rowIndex;
    return index == null ? null : index * this.rowHeight;
  }

  setSelected(newValue: boolean, clearSelection = false, source?: string): void {
    this.session['setSourceSelected'](this.sourceIndex, newValue, clearSelection, source ?? 'api');
  }

  setExpanded(expanded: boolean): void {
    const options = this.session['options'];
    if (!options.masterDetail) return;
    if (options.isRowMaster && this.data !== undefined && !options.isRowMaster(this.data)) return;
    if (expanded) this.session['detailOpen'].add(this.sourceIndex);
    else this.session['detailOpen'].delete(this.sourceIndex);
    this.session['attachGroups']();
    this.session['reverse'] = null;
    this.session['layout']();
    this.session['syncA11y']();
  }

  isSelected(): boolean {
    return this.selected;
  }

  isRowPinned(): boolean {
    return false;
  }

  setData(data: TData): void {
    this.session['rows'][this.sourceIndex] = data;
    this.session['loadRows'](this.session['rows'], false);
  }

  setDataValue(colKey: string | Column, newValue: unknown, eventSource?: string): boolean {
    const leaf = this.session['leafByKey'](colKey);
    if (!leaf) return false;
    return this.session['writeSource'](this.sourceIndex, leaf, newValue, eventSource ?? 'api');
  }

  addEventListener(eventType: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(eventType) ?? new Set();
    set.add(listener);
    this.listeners.set(eventType, set);
  }

  removeEventListener(eventType: string, listener: (event: unknown) => void): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  emit(eventType: string): void {
    for (const listener of this.listeners.get(eventType) ?? []) listener({ type: eventType, node: this });
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function sumWidth<TData>(leaves: readonly Leaf<TData>[]): number {
  return leaves.reduce((total, leaf) => total + leaf.width, 0);
}

function placeBand<TData>(leaves: readonly Leaf<TData>[], positions: Map<string, { x: number; width: number; pinned: 'left' | 'right' | null }>): number {
  let cursor = 0;
  for (const leaf of leaves) {
    positions.set(leaf.colId, { x: cursor, width: leaf.width, pinned: leaf.pinned });
    cursor += leaf.width;
  }
  return cursor;
}

function clamp(value: number, min: number, max: number | undefined): number {
  const lower = Math.max(min, value);
  return max == null ? lower : Math.min(max, lower);
}

function identityOf(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function compareCells<TData>(left: unknown, right: unknown, leaf: Leaf<TData>, nodeA: IRowNode<TData>, nodeB: IRowNode<TData>, descending: boolean): number {
  if (leaf.comparator) return leaf.comparator(left as never, right as never, nodeA, nodeB, descending);
  const leftBlank = left == null || (typeof left === 'number' && Number.isNaN(left));
  const rightBlank = right == null || (typeof right === 'number' && Number.isNaN(right));
  if (leftBlank && rightBlank) return 0;
  if (leftBlank) return -1;
  if (rightBlank) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const a = String(left);
  const b = String(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function modelActive(model: ProvidedFilterModel): boolean {
  if ('conditions' in model && Array.isArray(model.conditions)) return model.conditions.length > 0;
  if ('type' in model) return Boolean(model.type && model.type !== 'empty');
  return false;
}

function operators(kind: 'text' | 'number' | 'date'): string[] {
  if (kind === 'text') return ['contains', 'notContains', 'equals', 'notEqual', 'startsWith', 'endsWith', 'blank', 'notBlank'];
  return ['equals', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'inRange', 'blank', 'notBlank'];
}

function optionLabel(option: string): string {
  const labels: Record<string, string> = {
    contains: 'Contains',
    notContains: 'Not contains',
    equals: 'Equals',
    notEqual: 'Not equal',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    blank: 'Blank',
    notBlank: 'Not blank',
    lessThan: 'Less than',
    lessThanOrEqual: 'Less than or equal',
    greaterThan: 'Greater than',
    greaterThanOrEqual: 'Greater than or equal',
    inRange: 'In range',
  };
  return labels[option] ?? option;
}

export function createGrid<TData = any>(eGridDiv: HTMLElement, gridOptions: GridOptions<TData>): GridApi<TData> {
  const previous = sessions.get(eGridDiv);
  previous?.destroy();
  const session = new GridSession<TData>(eGridDiv, gridOptions);
  sessions.set(eGridDiv, session);
  return session.api;
}

const sessions = new WeakMap<HTMLElement, { destroy(): void }>();
