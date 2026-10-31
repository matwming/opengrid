import type { CellRenderer, ColDef, ColGroupDef, Column, EditableCallback, GridOptions, IRowNode, SortDirection, ValueFormatterFunc, ValueParserFunc, ValueSetterFunc } from './types';
import type { ColumnKind } from './store';
import { readPath } from './store';

export interface Leaf<TData = any> {
  colId: string;
  field?: string;
  headerName: string;
  width: number;
  minWidth: number;
  maxWidth?: number;
  flex?: number;
  pinned: 'left' | 'right' | null;
  hide: boolean;
  sortable: boolean;
  sort: 'asc' | 'desc' | null;
  sortIndex: number | null;
  sortingOrder: SortDirection[];
  resizable: boolean;
  movable: boolean;
  editable: boolean | EditableCallback<TData>;
  filter: false | 'text' | 'number' | 'date' | 'set' | 'multi' | 'group';
  kind: ColumnKind;
  checkbox: boolean;
  headerCheckbox: boolean;
  selectionColumn: boolean;
  valueGetter?: ColDef<TData>['valueGetter'];
  valueSetter?: ValueSetterFunc<TData> | string;
  valueFormatter?: ValueFormatterFunc<TData> | string;
  valueParser?: ValueParserFunc<TData> | string;
  comparator?: ColDef<TData>['comparator'];
  cellRenderer?: CellRenderer<TData>;
  cellClass?: ColDef<TData>['cellClass'];
  cellStyle?: ColDef<TData>['cellStyle'];
  suppressSizeToFit: boolean;
  groupedHide?: boolean;
  def: ColDef<TData>;
  groupId: string | null;
  groupName: string | null;
  marry: boolean;
}

export interface SelectionConfig<TData = any> {
  enabled: boolean;
  multi: boolean;
  checkboxes: boolean;
  headerCheckbox: boolean;
  click: boolean;
  toggleWithoutModifier: boolean;
  selectAll: 'all' | 'filtered' | 'currentPage';
  isRowSelectable?: (node: IRowNode<TData>) => boolean;
}

export const SELECTION_COL_ID = 'ag-Grid-SelectionColumn';
export const AUTO_GROUP_COL_ID = 'ag-Grid-AutoColumn';

export function selectionConfig<TData>(options: GridOptions<TData>): SelectionConfig<TData> {
  const selection = options.rowSelection;
  if (selection == null) {
    return { enabled: false, multi: false, checkboxes: false, headerCheckbox: false, click: false, toggleWithoutModifier: false, selectAll: 'all' };
  }
  if (selection === 'single' || selection === 'multiple') {
    return {
      enabled: true,
      multi: selection === 'multiple',
      checkboxes: false,
      headerCheckbox: false,
      click: !options.suppressRowClickSelection,
      toggleWithoutModifier: Boolean(options.rowMultiSelectWithClick),
      selectAll: 'filtered',
    };
  }
  const multi = selection.mode === 'multiRow';
  const click = selection.enableClickSelection;
  return {
    enabled: true,
    multi,
    checkboxes: selection.checkboxes !== false,
    headerCheckbox: multi && selection.headerCheckbox !== false && selection.checkboxes !== false,
    click: click === true || click === 'enableSelection' || click === 'enableDeselection',
    toggleWithoutModifier: multi && 'enableSelectionWithoutKeys' in selection && Boolean(selection.enableSelectionWithoutKeys),
    selectAll: multi && 'selectAll' in selection && selection.selectAll ? selection.selectAll : 'all',
    isRowSelectable: selection.isRowSelectable,
  };
}

export function buildLeaves<TData>(options: GridOptions<TData>, sample: readonly TData[] | null | undefined): Leaf<TData>[] {
  const leaves: Leaf<TData>[] = [];
  const selection = selectionConfig(options);
  const userCheckbox = hasUserCheckbox(options.columnDefs);
  if (selection.checkboxes && !userCheckbox) {
    leaves.push(selectionLeaf(selection.headerCheckbox));
  }
  walk(options.columnDefs ?? [], null, false, options, sample ?? [], leaves);
  return leaves;
}

function hasUserCheckbox(defs: GridOptions['columnDefs']): boolean {
  if (!defs) return false;
  for (const def of defs) {
    if ('children' in def) {
      if (hasUserCheckbox(def.children)) return true;
    } else if (def.checkboxSelection) return true;
  }
  return false;
}

function selectionLeaf(headerCheckbox: boolean): Leaf {
  const leaf = autoLeaf(SELECTION_COL_ID, '', 52, 'left');
  leaf.checkbox = true;
  leaf.headerCheckbox = headerCheckbox;
  leaf.selectionColumn = true;
  leaf.kind = 'boolean';
  leaf.def = { colId: SELECTION_COL_ID, width: 52, pinned: 'left' };
  return leaf;
}

export function autoGroupLeaf<TData>(headerName: string, width: number): Leaf<TData> {
  const leaf = autoLeaf<TData>(AUTO_GROUP_COL_ID, headerName, width, 'left');
  leaf.kind = 'text';
  leaf.def = { colId: AUTO_GROUP_COL_ID, headerName, width, pinned: 'left' };
  return leaf;
}

export const ROW_NUMBERS_COL_ID = 'ag-Grid-RowNumbersColumn';

export function rowNumberLeaf<TData>(): Leaf<TData> {
  return autoLeaf<TData>(ROW_NUMBERS_COL_ID, '', 70, 'left');
}

function autoLeaf<TData>(colId: string, headerName: string, width: number, pinned: 'left' | 'right' | null): Leaf<TData> {
  return {
    colId,
    headerName,
    width,
    minWidth: 40,
    pinned,
    hide: false,
    sortable: false,
    sort: null,
    sortIndex: null,
    sortingOrder: [null],
    resizable: true,
    movable: false,
    editable: false,
    filter: false,
    kind: 'text',
    checkbox: false,
    headerCheckbox: false,
    selectionColumn: false,
    suppressSizeToFit: true,
    def: { colId, headerName, width, pinned },
    groupId: null,
    groupName: null,
    marry: false,
  };
}

function walk<TData>(
  defs: readonly (ColDef<TData> | ColGroupDef<TData>)[],
  group: { id: string; name: string; marry: boolean } | null,
  marry: boolean,
  options: GridOptions<TData>,
  sample: readonly TData[],
  into: Leaf<TData>[],
): void {
  for (const def of defs) {
    if ('children' in def) {
      const id = def.groupId ?? def.headerName ?? `group-${into.length}`;
      walk(def.children, { id, name: def.headerName ?? id, marry: Boolean(def.marryChildren) }, Boolean(def.marryChildren), options, sample, into);
      continue;
    }
    into.push(leafFrom(def, group, marry, options, sample, into.length));
  }
}

function leafFrom<TData>(
  raw: ColDef<TData>,
  group: { id: string; name: string; marry: boolean } | null,
  marry: boolean,
  options: GridOptions<TData>,
  sample: readonly TData[],
  index: number,
): Leaf<TData> {
  const def = applyTypes(raw, options);
  const field = def.field;
  const colId = def.colId ?? field ?? `col-${index}`;
  const kind = inferKind(def, field, sample);
  const pinned = def.pinned === true ? 'left' : def.pinned === false ? null : (def.pinned ?? null);
  return {
    colId,
    field,
    headerName: def.headerName ?? (field ? titleFromField(field) : colId),
    width: def.width ?? 200,
    minWidth: def.minWidth ?? 10,
    maxWidth: def.maxWidth,
    flex: def.flex ?? undefined,
    pinned,
    hide: Boolean(def.hide),
    sortable: def.sortable !== false,
    sort: def.sort ?? null,
    sortIndex: def.sortIndex ?? null,
    sortingOrder: def.sortingOrder ?? ['asc', 'desc', null],
    resizable: def.resizable !== false,
    movable: def.suppressMovable !== true,
    editable: def.editable ?? false,
    filter: filterKind(def.filter, kind),
    kind,
    checkbox: Boolean(def.checkboxSelection),
    headerCheckbox: Boolean(def.headerCheckboxSelection),
    selectionColumn: false,
    valueGetter: def.valueGetter,
    valueSetter: def.valueSetter,
    valueFormatter: def.valueFormatter,
    valueParser: def.valueParser,
    comparator: def.comparator,
    cellRenderer: sparklineRenderer(def.cellRenderer, def.sparklineOptions?.type),
    cellClass: def.cellClass,
    cellStyle: def.cellStyle,
    suppressSizeToFit: Boolean(def.suppressSizeToFit),
    def,
    groupId: group?.id ?? null,
    groupName: group?.name ?? null,
    marry: marry || Boolean(group?.marry),
  };
}

function applyTypes<TData>(raw: ColDef<TData>, options: GridOptions<TData>): ColDef<TData> {
  const names = typeof raw.type === 'string' ? [raw.type] : (raw.type ?? []);
  const merged: ColDef<TData> = { ...options.defaultColDef };
  for (const name of names) {
    const typed = options.columnTypes?.[name];
    if (typed) Object.assign(merged, typed);
  }
  return { ...merged, ...raw };
}

function titleFromField(field: string): string {
  const base = field.includes('.') ? field.slice(field.lastIndexOf('.') + 1) : field;
  return base.slice(0, 1).toUpperCase() + base.slice(1);
}

export function inferKind<TData>(def: ColDef<TData>, field: string | undefined, sample: readonly TData[]): ColumnKind {
  if (def.cellDataType === 'number' || def.filter === 'agNumberColumnFilter') return 'number';
  if (def.cellDataType === 'date' || def.cellDataType === 'dateString' || def.filter === 'agDateColumnFilter') return 'date';
  if (def.cellDataType === 'boolean') return 'boolean';
  if (def.cellDataType === 'text') return 'text';
  const limit = Math.min(sample.length, 48);
  for (let i = 0; i < limit; i++) {
    const row = sample[i];
    const value = valueSample(def, field, row);
    if (value == null || value === '') continue;
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && def.filter === true) return 'date';
    return 'text';
  }
  return 'text';
}

function valueSample<TData>(def: ColDef<TData>, field: string | undefined, row: TData | undefined): unknown {
  if (typeof def.valueGetter === 'function') {
    return def.valueGetter({
      data: row,
      node: null,
      colDef: def,
      column: null,
      api: null,
      context: undefined,
      getValue: (name) => readPath(row, name),
    });
  }
  if (typeof def.valueGetter === 'string') {
    const path = /^data\.(.+)$/.exec(def.valueGetter.trim());
    if (path?.[1]) return readPath(row, path[1]);
  }
  if (field) return readPath(row, field);
  return undefined;
}

function sparklineRenderer<TData>(renderer: ColDef<TData>['cellRenderer'], sparklineType?: string): Leaf<TData>['cellRenderer'] {
  if (renderer === 'agSparklineCellRenderer') {
    const type = sparklineType === 'bar' ? 'bar' : 'line';
    return (params) => {
      const numbers = Array.isArray(params.value) ? params.value.filter((item): item is number => typeof item === 'number') : [];
      const wrap = document.createElement('div');
      wrap.className = 'og-spark';
      wrap.dataset.values = numbers.join(',');
      wrap.dataset.type = type;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 60 20');
      const max = Math.max(...numbers, 1);
      if (type === 'bar') {
        numbers.forEach((value, index) => {
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          const slot = 60 / Math.max(numbers.length, 1);
          const height = (value / max) * 18;
          bar.setAttribute('x', String(index * slot));
          bar.setAttribute('y', String(20 - height));
          bar.setAttribute('width', String(Math.max(1, slot - 1)));
          bar.setAttribute('height', String(height));
          svg.append(bar);
        });
      } else if (numbers.length > 0) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#1f4b99');
        line.setAttribute('points', numbers.map((value, index) => {
          const x = numbers.length === 1 ? 30 : (index / (numbers.length - 1)) * 60;
          const y = 18 - (value / max) * 16;
          return `${x},${y}`;
        }).join(' '));
        svg.append(line);
      }
      wrap.append(svg);
      return wrap;
    };
  }
  return typeof renderer === 'function' ? renderer : undefined;
}

function filterKind(filter: ColDef['filter'], kind: ColumnKind): false | 'text' | 'number' | 'date' | 'set' | 'multi' {
  if (filter === false || filter == null) return false;
  if (filter === 'agNumberColumnFilter') return 'number';
  if (filter === 'agDateColumnFilter') return 'date';
  if (filter === 'agTextColumnFilter') return 'text';
  if (filter === 'agSetColumnFilter') return 'set';
  if (filter === 'agMultiColumnFilter') return 'multi';
  if (filter === true) {
    if (kind === 'number') return 'number';
    if (kind === 'date') return 'date';
    return 'text';
  }
  return false;
}

export function visibleLeaves<TData>(leaves: readonly Leaf<TData>[]): Leaf<TData>[] {
  return leaves.filter((leaf) => !leaf.hide);
}

export interface ColumnBands<TData> {
  left: Leaf<TData>[];
  center: Leaf<TData>[];
  right: Leaf<TData>[];
}

export function bandsOf<TData>(leaves: readonly Leaf<TData>[]): ColumnBands<TData> {
  const left: Leaf<TData>[] = [];
  const center: Leaf<TData>[] = [];
  const right: Leaf<TData>[] = [];
  for (const leaf of leaves) {
    if (leaf.hide) continue;
    if (leaf.pinned === 'left') left.push(leaf);
    else if (leaf.pinned === 'right') right.push(leaf);
    else center.push(leaf);
  }
  return { left, center, right };
}

export function columnFacade<TData>(leaf: Leaf<TData>): Column {
  return {
    getColId: () => leaf.colId,
    getId: () => leaf.colId,
    getColDef: () => leaf.def,
    getPinned: () => leaf.pinned,
    isPinned: () => leaf.pinned != null,
    isVisible: () => !leaf.hide,
    isSortable: () => leaf.sortable,
    getSort: () => leaf.sort,
    getSortIndex: () => leaf.sortIndex,
    getActualWidth: () => leaf.width,
  };
}

export function groupRuns<TData>(leaves: readonly Leaf<TData>[]): { groupId: string; name: string; leaves: Leaf<TData>[] }[] {
  const runs: { groupId: string; name: string; leaves: Leaf<TData>[] }[] = [];
  for (const leaf of leaves) {
    if (!leaf.groupId) continue;
    const last = runs[runs.length - 1];
    if (last && last.groupId === leaf.groupId) last.leaves.push(leaf);
    else runs.push({ groupId: leaf.groupId, name: leaf.groupName ?? leaf.groupId, leaves: [leaf] });
  }
  return runs;
}
