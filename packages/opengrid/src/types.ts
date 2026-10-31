export type SortDirection = 'asc' | 'desc' | null;
export type ColumnPinnedType = 'left' | 'right' | null;
export type RowModelType = 'clientSide' | 'infinite' | 'serverSide' | 'viewport';
export type JoinOperator = 'AND' | 'OR';

export interface ColDef<TData = any, TValue = any> {
  colId?: string;
  field?: string;
  headerName?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number | null;
  hide?: boolean | null;
  pinned?: boolean | ColumnPinnedType;
  sortable?: boolean;
  sort?: SortDirection;
  sortIndex?: number | null;
  sortingOrder?: SortDirection[];
  comparator?: (valueA: TValue, valueB: TValue, nodeA: IRowNode<TData>, nodeB: IRowNode<TData>, isDescending: boolean) => number;
  resizable?: boolean;
  suppressMovable?: boolean;
  editable?: boolean | EditableCallback<TData>;
  filter?: boolean | string;
  filterParams?: FilterParams;
  valueGetter?: string | ValueGetterFunc<TData>;
  valueSetter?: string | ValueSetterFunc<TData>;
  valueFormatter?: string | ValueFormatterFunc<TData>;
  valueParser?: string | ValueParserFunc<TData>;
  colSpan?: (params: { data?: TData }) => number;
  allowFormula?: boolean;
  cellRenderer?: CellRenderer<TData> | string;
  cellEditor?: string;
  cellEditorParams?: { values?: string[] };
  cellDataType?: boolean | string;
  type?: string | string[];
  checkboxSelection?: boolean | ((params: { data: TData | undefined; node: IRowNode<TData> }) => boolean);
  headerCheckboxSelection?: boolean;
  headerClass?: string | string[];
  cellClass?: string | string[] | ((params: CellClassParams<TData>) => string | string[] | null | undefined);
  cellStyle?: Record<string, string> | ((params: CellClassParams<TData>) => Record<string, string> | null | undefined);
  suppressSizeToFit?: boolean;
  rowGroup?: boolean | null;
  rowGroupIndex?: number | null;
  pivot?: boolean | null;
  aggFunc?: string | null;
  pivotKey?: string;
  pivotValueColumn?: string;
  enableRowGroup?: boolean;
  enablePivot?: boolean;
  enableValue?: boolean;
  rowDrag?: boolean;
}

export interface ColGroupDef<TData = any> {
  headerName?: string;
  groupId?: string;
  children: (ColDef<TData> | ColGroupDef<TData>)[];
  marryChildren?: boolean;
  openByDefault?: boolean;
}

export interface FilterParams {
  caseSensitive?: boolean;
  debounceMs?: number;
  maxNumConditions?: number;
  defaultOption?: string;
  buttons?: string[];
  closeOnApply?: boolean;
}

export interface CellClassParams<TData = any> {
  value: unknown;
  data: TData | undefined;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column;
  api: GridApi<TData>;
  context: unknown;
  rowIndex: number | null;
}

export interface ValueGetterParams<TData = any> {
  data: TData | undefined;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column | null;
  api: GridApi<TData> | null;
  context: unknown;
  getValue: (field: string) => unknown;
}

export interface ValueSetterParams<TData = any> {
  oldValue: unknown;
  newValue: unknown;
  data: TData;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column | null;
  api: GridApi<TData> | null;
  context: unknown;
}

export interface ValueFormatterParams<TData = any> {
  value: unknown;
  data: TData | undefined;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column | null;
  api: GridApi<TData> | null;
  context: unknown;
}

export interface ValueParserParams<TData = any> {
  oldValue: unknown;
  newValue: unknown;
  data: TData | undefined;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column | null;
  api: GridApi<TData> | null;
  context: unknown;
}

export type ValueGetterFunc<TData = any> = (params: ValueGetterParams<TData>) => unknown;
export type ValueSetterFunc<TData = any> = (params: ValueSetterParams<TData>) => boolean | void;
export type ValueFormatterFunc<TData = any> = (params: ValueFormatterParams<TData>) => string;
export type ValueParserFunc<TData = any> = (params: ValueParserParams<TData>) => unknown;
export type EditableCallback<TData = any> = (params: { data: TData | undefined; node: IRowNode<TData> | null; colDef: ColDef<TData>; column: Column; api: GridApi<TData> }) => boolean;

export type CellRenderer<TData = any> = (params: CellRendererParams<TData>) => HTMLElement | string | null | undefined;

export interface CellRendererParams<TData = any> {
  value: unknown;
  valueFormatted: string | null;
  data: TData | undefined;
  node: IRowNode<TData> | null;
  colDef: ColDef<TData>;
  column: Column | null;
  api: GridApi<TData> | null;
  context: unknown;
  rowIndex: number | null;
  eGridCell: HTMLElement | null;
}

export interface GetRowIdParams<TData = any> {
  data: TData;
  level: number;
  rowPinned?: 'top' | 'bottom' | null;
}

export interface SingleRowSelectionOptions<TData = any> {
  mode: 'singleRow';
  enableClickSelection?: boolean | 'enableDeselection' | 'enableSelection';
  checkboxes?: boolean;
  isRowSelectable?: (node: IRowNode<TData>) => boolean;
}

export interface MultiRowSelectionOptions<TData = any> {
  mode: 'multiRow';
  enableClickSelection?: boolean | 'enableDeselection' | 'enableSelection';
  checkboxes?: boolean;
  headerCheckbox?: boolean;
  selectAll?: 'all' | 'filtered' | 'currentPage';
  isRowSelectable?: (node: IRowNode<TData>) => boolean;
  enableSelectionWithoutKeys?: boolean;
}

export type RowSelectionOptions<TData = any> = SingleRowSelectionOptions<TData> | MultiRowSelectionOptions<TData>;

export interface IGetRowsParams<TData = any> {
  startRow: number;
  endRow: number;
  successCallback: (rowsThisBlock: TData[], lastRow?: number) => void;
  failCallback: () => void;
  sortModel: { colId: string; sort: 'asc' | 'desc'; type?: string }[];
  filterModel: any;
  context: unknown;
}

export interface IDatasource<TData = any> {
  rowCount?: number;
  getRows: (params: IGetRowsParams<TData>) => void;
  destroy?: () => void;
}

export interface IServerSideGetRowsRequest {
  startRow: number;
  endRow: number;
  sortModel: { colId: string; sort: 'asc' | 'desc' }[];
  filterModel: FilterModel | null;
}

export interface IViewportDatasourceParams<TData = any> {
  setRowCount: (count: number) => void;
  setRowData: (rows: Record<number, TData>) => void;
}

export interface IViewportDatasource<TData = any> {
  init: (params: IViewportDatasourceParams<TData>) => void;
  setViewportRange: (firstRow: number, lastRow: number) => void;
  destroy?: () => void;
}

export interface IServerSideDatasource<TData = any> {
  getRows: (params: {
    request: IServerSideGetRowsRequest;
    success: (params: { rowData: TData[]; rowCount?: number }) => void;
    fail: () => void;
  }) => void;
}

export interface GridOptions<TData = any> {
  columnDefs?: (ColDef<TData> | ColGroupDef<TData>)[] | null;
  defaultColDef?: ColDef<TData>;
  columnTypes?: Record<string, ColDef<TData>>;
  rowData?: TData[] | null;
  rowSelection?: RowSelectionOptions<TData> | 'single' | 'multiple';
  rowMultiSelectWithClick?: boolean;
  suppressRowClickSelection?: boolean;
  rowModelType?: RowModelType;
  datasource?: IDatasource<TData>;
  serverSideDatasource?: IServerSideDatasource<TData>;
  viewportDatasource?: IViewportDatasource<TData>;
  cacheBlockSize?: number;
  cacheOverflowSize?: number;
  infiniteInitialRowCount?: number;
  getRowId?: (params: GetRowIdParams<TData>) => string;
  rowDragManaged?: boolean;
  animateRows?: boolean;
  headerHeight?: number;
  groupHeaderHeight?: number;
  rowHeight?: number;
  suppressCellFocus?: boolean;
  singleClickEdit?: boolean;
  stopEditingWhenCellsLoseFocus?: boolean;
  enterNavigatesVertically?: boolean;
  context?: unknown;
  loading?: boolean;
  overlayNoRowsTemplate?: string;
  overlayLoadingTemplate?: string;
  pagination?: boolean;
  paginationPageSize?: number;
  quickFilterText?: string;
  autoGroupColumnDef?: ColDef<TData>;
  groupDefaultExpanded?: number;
  pivotMode?: boolean;
  treeData?: boolean;
  getDataPath?: (data: TData) => string[];
  cellSelection?: boolean | { handle?: { mode?: 'fill' } };
  statusBar?: { statusPanels?: { statusPanel?: string }[] };
  sideBar?: boolean | { toolPanels?: { id?: string; toolPanel?: string }[] };
  rowNumbers?: boolean | { suppressCellFocus?: boolean };
  rowGroupPanelShow?: 'always' | 'onlyWhenGrouping' | 'never';
  enableAdvancedFilter?: boolean;
  undoRedoCellEditing?: boolean;
  undoRedoCellEditingLimit?: number;
  findSearchValue?: string;
  getContextMenuItems?: (params: { defaultItems: string[] }) => (string | { name: string })[];
  fillOperation?: (params: { currentValue: unknown; values: unknown[] }) => unknown;
  sendToClipboard?: (params: { data: string }) => void;
  processCellForClipboard?: (params: { value: string; column: Column }) => string;
  processCellFromClipboard?: (params: { value: string; column: Column }) => unknown;
  masterDetail?: boolean;
  isRowMaster?: (data: TData) => boolean;
  detailCellRenderer?: (params: { data: TData | undefined }) => string;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  theme?: string;
  ensureDomOrder?: boolean;
  enableCellTextSelection?: boolean;
  onGridReady?: (event: GridReadyEvent<TData>) => void;
  onFirstDataRendered?: (event: AgEvent<TData>) => void;
  onModelUpdated?: (event: AgEvent<TData>) => void;
  onRowDataUpdated?: (event: AgEvent<TData>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<TData>) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<TData>) => void;
  onCellClicked?: (event: CellClickedEvent<TData>) => void;
  onCellDoubleClicked?: (event: CellClickedEvent<TData>) => void;
  onCellFocused?: (event: CellFocusedEvent<TData>) => void;
  onCellEditingStarted?: (event: CellClickedEvent<TData>) => void;
  onCellEditingStopped?: (event: CellClickedEvent<TData>) => void;
  onSortChanged?: (event: AgEvent<TData>) => void;
  onFilterChanged?: (event: AgEvent<TData>) => void;
  onColumnMoved?: (event: ColumnEvent<TData>) => void;
  onColumnResized?: (event: ColumnEvent<TData>) => void;
  onColumnPinned?: (event: ColumnEvent<TData>) => void;
  onColumnVisible?: (event: ColumnEvent<TData>) => void;
  onRowSelected?: (event: RowSelectedEvent<TData>) => void;
  onRowDragEnd?: (event: AgEvent<TData> & { overIndex?: number }) => void;
  onGridPreDestroyed?: (event: AgEvent<TData>) => void;
}

export interface AgEvent<TData = any> {
  type: string;
  api: GridApi<TData>;
  context: unknown;
}

export interface GridReadyEvent<TData = any> extends AgEvent<TData> {
  type: 'gridReady';
}

export interface SelectionChangedEvent<TData = any> extends AgEvent<TData> {
  type: 'selectionChanged';
  source?: string;
}

export interface CellValueChangedEvent<TData = any> extends AgEvent<TData> {
  type: 'cellValueChanged';
  data: TData | undefined;
  node: IRowNode<TData>;
  colDef: ColDef<TData>;
  column: Column;
  oldValue: unknown;
  newValue: unknown;
  value: unknown;
  rowIndex: number | null;
  source?: string;
}

export interface CellClickedEvent<TData = any> extends AgEvent<TData> {
  data: TData | undefined;
  node: IRowNode<TData>;
  colDef: ColDef<TData>;
  column: Column;
  value: unknown;
  rowIndex: number | null;
  event?: Event;
}

export interface CellFocusedEvent<TData = any> extends AgEvent<TData> {
  type: 'cellFocused';
  rowIndex: number | null;
  column: Column | null;
  rowPinned: 'top' | 'bottom' | null;
}

export interface ColumnEvent<TData = any> extends AgEvent<TData> {
  column: Column | null;
  columns: Column[] | null;
  finished?: boolean;
  source?: string;
}

export interface RowSelectedEvent<TData = any> extends AgEvent<TData> {
  type: 'rowSelected';
  node: IRowNode<TData>;
  data: TData | undefined;
  rowIndex: number | null;
  source?: string;
}

export interface IRowNode<TData = any> {
  id: string | undefined;
  data: TData | undefined;
  rowIndex: number | null;
  rowPinned: 'top' | 'bottom' | null;
  displayed: boolean;
  selected: boolean;
  selectable: boolean;
  group: boolean | undefined;
  rowHeight: number | null;
  rowTop: number | null;
  level: number;
  key: string | null;
  expanded: boolean;
  allChildrenCount: number | null;
  aggData: Record<string, number | null> | null;
  setExpanded(expanded: boolean): void;
  setSelected(newValue: boolean, clearSelection?: boolean, source?: string): void;
  isSelected(): boolean | undefined;
  isRowPinned(): boolean;
  setData(data: TData): void;
  setDataValue(colKey: string | Column, newValue: unknown, eventSource?: string): boolean;
  addEventListener(eventType: string, listener: (event: unknown) => void): void;
  removeEventListener(eventType: string, listener: (event: unknown) => void): void;
}

export interface Column {
  getColId(): string;
  getId(): string;
  getColDef(): ColDef;
  getPinned(): ColumnPinnedType;
  isPinned(): boolean;
  isVisible(): boolean;
  isSortable(): boolean;
  getSort(): SortDirection;
  getSortIndex(): number | null;
  getActualWidth(): number;
}

export interface ColumnState {
  colId: string;
  hide?: boolean | null;
  width?: number | null;
  flex?: number | null;
  sort?: SortDirection;
  sortIndex?: number | null;
  pinned?: ColumnPinnedType;
  aggFunc?: string | null;
  pivot?: boolean | null;
  rowGroup?: boolean | null;
  rowGroupIndex?: number | null;
}

export interface ApplyColumnStateParams {
  state?: ColumnState[];
  applyOrder?: boolean;
  defaultState?: Partial<ColumnState>;
}

export interface SimpleFilterModel {
  filterType?: 'text' | 'number' | 'date' | string;
  type?: string | null;
  filter?: string | number | null;
  filterTo?: string | number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface CombinedFilterModel {
  filterType?: string;
  operator: JoinOperator;
  conditions: SimpleFilterModel[];
  condition1?: SimpleFilterModel;
  condition2?: SimpleFilterModel;
}

export interface SetFilterModel {
  filterType: 'set';
  values: (string | null)[];
}

export interface MultiFilterModel {
  filterType: 'multi';
  filterModels: (ProvidedFilterModel | null)[];
}

export interface AdvancedFilterModel {
  filterType: 'join' | 'text' | 'number';
  type?: 'AND' | 'OR' | 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan';
  colId?: string;
  filter?: string | number | null;
  conditions?: AdvancedFilterModel[];
}

export type ProvidedFilterModel = SimpleFilterModel | CombinedFilterModel | SetFilterModel | MultiFilterModel;
export type FilterModel = Record<string, ProvidedFilterModel | null>;

export interface CsvExportParams {
  allColumns?: boolean;
  columnKeys?: (string | Column)[];
  fileName?: string;
  exportedRows?: 'all' | 'filteredAndSorted';
  onlySelected?: boolean;
  skipColumnGroupHeaders?: boolean;
  skipColumnHeaders?: boolean;
  columnSeparator?: string;
  suppressQuotes?: boolean;
  processCellCallback?: (params: { value: unknown; node: IRowNode | null; column: Column }) => string;
  processHeaderCallback?: (params: { column: Column }) => string;
}

export interface StartEditingCellParams {
  rowIndex: number;
  colKey: string | Column;
  rowPinned?: 'top' | 'bottom' | null;
  key?: string;
}

export interface CellPosition {
  rowIndex: number;
  rowPinned: 'top' | 'bottom' | null;
  column: Column;
}

export interface CellRange {
  startRow?: { rowIndex: number };
  endRow?: { rowIndex: number };
  columns: Column[];
}

export interface CellRangeParams {
  rowStartIndex: number;
  rowEndIndex: number;
  columns: (string | Column)[];
}

export interface CreateRangeChartParams {
  cellRange: CellRangeParams;
  chartType?: 'column' | 'bar' | 'line';
}

export interface ChartRef {
  chartId: string;
  destroyChart: () => void;
}

export interface RowDataTransaction<TData = any> {
  add?: TData[];
  addIndex?: number;
  update?: TData[];
  remove?: TData[];
}

export interface RowNodeTransaction<TData = any> {
  add: IRowNode<TData>[];
  remove: IRowNode<TData>[];
  update: IRowNode<TData>[];
}

export interface GridState {
  version?: string;
  sort?: { sortModel: { colId: string; sort: 'asc' | 'desc'; type?: string }[] };
  filter?: { filterModel?: FilterModel | null };
  columnOrder?: { orderedColIds: string[] };
  columnSizing?: { columnSizingModel: { colId: string; width?: number; flex?: number }[] };
  columnPinning?: { leftColIds: string[]; rightColIds: string[] };
  columnVisibility?: { hiddenColIds: string[] };
  pagination?: { page?: number; pageSize?: number };
  rowSelection?: string[];
}

export interface GridApi<TData = any> {
  destroy(): void;
  getGridId(): string;
  isDestroyed(): boolean;
  isModuleRegistered(moduleName: string): boolean;
  getGridOption<Key extends keyof GridOptions<TData>>(key: Key): GridOptions<TData>[Key];
  setGridOption<Key extends keyof GridOptions<TData>>(key: Key, value: GridOptions<TData>[Key]): void;
  updateGridOptions(options: Partial<GridOptions<TData>>): void;
  getColumnDefs(): (ColDef<TData> | ColGroupDef<TData>)[] | undefined;
  getColumnState(): ColumnState[];
  applyColumnState(params: ApplyColumnStateParams): boolean;
  resetColumnState(): void;
  setColumnsVisible(keys: (string | Column)[], visible: boolean): void;
  setColumnsPinned(keys: (string | Column)[], pinned: ColumnPinnedType): void;
  getColumns(): Column[] | null;
  getAllGridColumns(): Column[];
  getDisplayedLeftColumns(): Column[];
  getDisplayedCenterColumns(): Column[];
  getDisplayedRightColumns(): Column[];
  getAllDisplayedColumns(): Column[];
  moveColumns(columnsToMoveKeys: (string | Column)[], toIndex: number): void;
  moveColumnByIndex(fromIndex: number, toIndex: number): void;
  autoSizeColumns(keys: (string | Column)[], skipHeader?: boolean): void;
  autoSizeAllColumns(skipHeader?: boolean): void;
  sizeColumnsToFit(gridWidth?: number): void;
  setColumnWidths(columnWidths: { key: string | Column; newWidth: number }[]): void;
  isPinning(): boolean;
  isPinningLeft(): boolean;
  isPinningRight(): boolean;
  applyTransaction(transaction: RowDataTransaction<TData>): RowNodeTransaction<TData> | null;
  getDisplayedRowCount(): number;
  getDisplayedRowAtIndex(index: number): IRowNode<TData> | undefined;
  getFirstDisplayedRowIndex(): number;
  getLastDisplayedRowIndex(): number;
  paginationIsLastPageFound(): boolean;
  paginationGetPageSize(): number;
  paginationGetCurrentPage(): number;
  paginationGetTotalPages(): number;
  paginationGetRowCount(): number;
  paginationGoToNextPage(): void;
  paginationGoToPreviousPage(): void;
  paginationGoToFirstPage(): void;
  paginationGoToLastPage(): void;
  paginationGoToPage(page: number): void;
  refreshInfiniteCache(): void;
  purgeInfiniteCache(): void;
  getInfiniteRowCount(): number | undefined;
  setRowCount(rowCount: number, maxRowFound?: boolean): void;
  isLastRowIndexKnown(): boolean | undefined;
  getCacheBlockState(): Record<string, { blockNumber: number; startRow: number; endRow: number; pageStatus: string }>;
  getState(): GridState;
  setState(state: GridState, propertiesToIgnore?: (keyof GridState)[]): void;
  forEachNode(callback: (rowNode: IRowNode<TData>, index: number) => void): void;
  forEachNodeAfterFilter(callback: (rowNode: IRowNode<TData>, index: number) => void): void;
  forEachNodeAfterFilterAndSort(callback: (rowNode: IRowNode<TData>, index: number) => void): void;
  forEachLeafNode(callback: (rowNode: IRowNode<TData>) => void): void;
  getRowNode(id: string): IRowNode<TData> | undefined;
  getRowGroupColumns(): Column[];
  setRowGroupColumns(colKeys: (string | Column)[]): void;
  getSelectedNodes(): IRowNode<TData>[];
  getSelectedRows(): TData[];
  selectAll(): void;
  deselectAll(): void;
  setNodesSelected(params: { nodes: IRowNode<TData>[]; newValue: boolean; source?: string }): void;
  setFilterModel(model: FilterModel | null): void;
  getFilterModel(): FilterModel;
  setAdvancedFilterModel(model: AdvancedFilterModel | null): void;
  getAdvancedFilterModel(): AdvancedFilterModel | null;
  undoCellEditing(): void;
  redoCellEditing(): void;
  startBatchEdit(): void;
  commitBatchEdit(): void;
  cancelBatchEdit(): void;
  isBatchEditing(): boolean;
  isAnyFilterPresent(): boolean;
  isColumnFilterPresent(): boolean;
  onFilterChanged(): void;
  showColumnFilter(colKey: string | Column): void;
  hideColumnFilter(): void;
  destroyFilter(key: string | Column): void;
  onSortChanged(): void;
  getFocusedCell(): CellPosition | null;
  setFocusedCell(rowIndex: number, colKey: string | Column, rowPinned?: 'top' | 'bottom' | null): void;
  addCellRange(params: CellRangeParams): void;
  getCellRanges(): CellRange[] | null;
  clearCellSelection(): void;
  copySelectedRangeToClipboard(): void;
  startEditingCell(params: StartEditingCellParams): void;
  stopEditing(cancel?: boolean): void;
  getEditingCells(): { rowIndex: number; colId: string; rowPinned: 'top' | 'bottom' | null }[];
  refreshCells(): void;
  redrawRows(): void;
  refreshHeader(): void;
  ensureIndexVisible(index: number, position?: 'top' | 'bottom' | 'middle' | null): void;
  ensureColumnVisible(key: string | Column, position?: 'auto' | 'start' | 'middle' | 'end'): void;
  getDataAsCsv(params?: CsvExportParams): string;
  exportDataAsCsv(params?: CsvExportParams): void;
  findGetTotalMatches(): number;
  findNext(): void;
  getDataAsExcel(): Blob;
  exportDataAsExcel(): void;
  getDataAsPdf(): Blob;
  createRangeChart(params: CreateRangeChartParams): ChartRef;
  addEventListener(eventType: string, listener: (event: AgEvent<TData>) => void): void;
  removeEventListener(eventType: string, listener: (event: AgEvent<TData>) => void): void;
  getVerticalPixelRange(): { top: number; bottom: number };
  getHorizontalPixelRange(): { left: number; right: number };
  showLoadingOverlay(): void;
  showNoRowsOverlay(): void;
  hideOverlay(): void;
  setColumnGroupOpened(groupId: string, opened: boolean): void;
  getColumnGroupState(): { groupId: string; open: boolean }[];
}
