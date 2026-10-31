# Parity matrix

Status words mean the following.

- **done** means the public behavior is covered for the client-side grid and checked against `ag-grid-community` 36.2.0 or the demo.
- **partial** means the common path works and named gaps remain.
- **not started** means the package does not implement it yet.

## Phase 1

| Feature | Doc | Status |
| --- | --- | --- |
| Client-side row model | [Row models](https://www.ag-grid.com/javascript-data-grid/row-models/) | partial. The grid loads `rowData`, sorts, filters, and applies `applyTransaction`. Above 32,768 rows, sort and filter finish on `modelUpdated`. A read in the same turn still sees the previous view. |
| Row and column virtualisation | [DOM virtualisation](https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/) | done |
| Sort | [Row sorting](https://www.ag-grid.com/javascript-data-grid/row-sorting/) | partial. Built-in sort matches 36.2.0, including nulls and stable ties. A custom `comparator` runs on the main thread. |
| Text, number, and date filters | [Filtering](https://www.ag-grid.com/javascript-data-grid/filtering/) | partial. Simple filters, `inRange`, blank, and `AND`/`OR` conditions match the 36.2.0 probe. Floating filters and custom filter components are not started. |
| Editing | [Cell editing](https://www.ag-grid.com/javascript-data-grid/cell-editing/) | partial. A text input, `valueParser`, and `valueSetter` work. Custom editor components are not started. |
| Cell style and class | [Column definitions](https://www.ag-grid.com/javascript-data-grid/column-definitions/) | partial. `cellStyle` background and color are drawn. `cellClass` is applied on the accessibility cells. |
| Pin, resize, move | [Column pinning](https://www.ag-grid.com/javascript-data-grid/column-pinning/), [Column sizing](https://www.ag-grid.com/javascript-data-grid/column-sizing/), [Column moving](https://www.ag-grid.com/javascript-data-grid/column-moving/) | done |
| Column groups | [Column groups](https://www.ag-grid.com/javascript-data-grid/column-groups/) | partial. Headers render. `marryChildren` blocks a drag out of the group. Collapsing a group is not started. |
| Selection | [Row selection](https://www.ag-grid.com/javascript-data-grid/row-selection/) | partial. Single and multi row selection, the checkbox column, and the header checkbox work. Group selection does not, because grouping is not started. |
| CSV export | [CSV export](https://www.ag-grid.com/javascript-data-grid/csv-export/) | partial. Quoted CSV with CRLF matches 36.2.0 on the compat fixture. Excel export writes an `.xlsx` workbook. |
| Keyboard and ARIA | [Keyboard navigation](https://www.ag-grid.com/javascript-data-grid/keyboard-navigation/), [Accessibility](https://www.ag-grid.com/javascript-data-grid/accessibility/) | partial. Arrow keys, Enter, Escape, Space, and Ctrl or Cmd A work. The demo has no serious or critical axe findings. Not every documented shortcut is wired. |
| Theme | [Getting started](https://www.ag-grid.com/javascript-data-grid/getting-started/) | done. The theme is original. Import `opengrid/styles.css`. |
| `createGrid` and core `GridApi` | [Grid API](https://www.ag-grid.com/javascript-data-grid/grid-api/) | partial. The methods used by the compat test, `applyTransaction`, and the demo work. Methods for phase 2 and phase 3 are absent or warn. |
| React wrapper | [React getting started](https://www.ag-grid.com/react-data-grid/getting-started/) | partial. `AgGridReact` accepts grid options as props and exposes `ref.api`. React cell components are mounted only when `cellRenderer` returns an element or a string. |
| Custom cell renderer | [Cell renderer](https://www.ag-grid.com/javascript-data-grid/component-cell-renderer/) | partial. A function may return a string for the canvas, or an element for the visible window. Other framework components are not started. |

## Phase 2

| Feature | Doc | Status |
| --- | --- | --- |
| Infinite row model | [Infinite scrolling](https://www.ag-grid.com/javascript-data-grid/infinite-scrolling/) | partial. With `cacheBlockSize` 10, the first blocks, the row count, the sort refetch, and the cache keys after `purgeInfiniteCache` match 36.2.0. When the last row is unknown, the count is the loaded end plus one row. |
| Quick filter | [Filtering](https://www.ag-grid.com/javascript-data-grid/filtering/) | partial. The default search matches `ag-grid-community` 36.2.0, including a hidden column. Words are case-insensitive and a row must match every word. `quickFilterParser` and `getQuickFilterText` are not started. |
| Row dragging | [Row dragging](https://www.ag-grid.com/javascript-data-grid/row-dragging/) | partial. In Chromium, dragging `a` onto the third row yields `b, c, a, d` and `onRowDragEnd` reports `overIndex` 2, matching `ag-grid-enterprise` 36.2.0. |
| Pagination | [Row pagination](https://www.ag-grid.com/javascript-data-grid/row-pagination/) | partial. Client-side page size, current page, total pages, and `paginationGoToPage` match 36.2.0. `getDisplayedRowCount` stays the full filtered count. `paginationAutoPageSize` is not started. |
| State save and restore | [Grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/) | partial. `getState` and `setState` round-trip sort, filter, column order, width, pin, visibility, page, and row selection against 36.2.0. Scroll, focus, and group state are not started. |
| Vue wrapper | [Vue getting started](https://www.ag-grid.com/vue-data-grid/getting-started/) | partial. `AgGridVue` takes grid options as props, emits `grid-ready`, and exposes `api`. Changing `rowData` calls `setGridOption`. Framework cell components are not started. |
| Angular wrapper | [Angular getting started](https://www.ag-grid.com/angular-data-grid/getting-started/) | partial. `AgGridAngular` binds `rowData` and `columnDefs`, emits `gridReady`, and sets `api`. A later `rowData` change calls `setGridOption`. Framework cell components are not started. |

## Phase 3

| Feature | Doc | Status |
| --- | --- | --- |
| Row grouping | [Grouping](https://www.ag-grid.com/javascript-data-grid/grouping/) | partial. Client-side `rowGroup` builds one auto group column. Group keys follow first appearance, which matches `ag-grid-enterprise` 36.2.0 on the probe fixture (USA before Ireland). `groupDefaultExpanded` and `setExpanded` work. `setRowGroupColumns` switches the group. Footer rows and group selection are not started. |
| Aggregation | [Aggregation](https://www.ag-grid.com/javascript-data-grid/aggregation/) | partial. Group rows expose `aggData` for `sum`, `min`, `max`, `count`, and `avg`. Count ignores values that are not numbers. Not compared with Enterprise. |
| Pivot | [Pivoting](https://www.ag-grid.com/javascript-data-grid/pivoting/) | partial. `pivotMode` column ids and the first group's `aggData` match `ag-grid-enterprise` 36.2.0 on the probe. Ids look like `pivot_year_2020_sales`. The original group, pivot, and value columns are left out of `getAllGridColumns`. Multiple pivot columns and pivot totals are not started. |
| Tree data | [Tree data](https://www.ag-grid.com/javascript-data-grid/tree-data/) | partial. `treeData` with `getDataPath` nests rows. A path that has children is a group. `setExpanded(false)` hides that branch. Not compared with Enterprise. |
| Master detail | [Master detail](https://www.ag-grid.com/javascript-data-grid/master-detail/) | partial. `masterDetail` plus `setExpanded(true)` inserts a detail row whose id is `detail_0` and whose `detail` flag is true, matching `ag-grid-enterprise` 36.2.0. `isRowMaster` can refuse a row. |
| Set filter | [Set filter](https://www.ag-grid.com/javascript-data-grid/filter-set/) | partial. A `filterType: 'set'` model keeps the same rows as `ag-grid-enterprise` 36.2.0 on the probe fixture. `agSetColumnFilter` opens a checkbox list, and Apply keeps the checked values. Mini filter search inside the popup is not started. |
| Multi filter | [Multi filter](https://www.ag-grid.com/javascript-data-grid/filter-multi/) | partial. `agMultiColumnFilter` opens two text boxes. Apply keeps a row only when every condition matches. Not compared with Enterprise. |
| Advanced filter | [Advanced filter](https://www.ag-grid.com/javascript-data-grid/filter-advanced/) | partial. `setAdvancedFilterModel` joins text and number conditions with AND or OR. The builder shows Select a column, Select an option, Enter a value..., and Apply. Contains `y` leaves Amy. |
| Range selection | [Cell selection](https://www.ag-grid.com/javascript-data-grid/cell-selection/) | partial. `addCellRange` remembers the rows and columns. `getCellRanges` reads them back. `clearCellSelection` drops them. Dragging across cells with `cellSelection` set replaces the range with the rows and columns under the pointer. Not compared with Enterprise. |
| Clipboard | [Clipboard](https://www.ag-grid.com/javascript-data-grid/clipboard/) | partial. `copySelectedRangeToClipboard` sends tab-separated text with CRLF line breaks, matching `ag-grid-enterprise` 36.2.0. `processCellForClipboard` can change each cell. A paste event writes the text back into the range and keeps a number as a number. |
| Fill handle | [Fill handle](https://www.ag-grid.com/javascript-data-grid/cell-selection-fill-handle/) | partial. In Chromium, dragging the fill handle copies 4 into the next two rows and the range ends at row 2, matching `ag-grid-enterprise` 36.2.0. `fillOperation` can change the written value. |
| Excel export | [Excel export](https://www.ag-grid.com/javascript-data-grid/excel-export/) | partial. `getDataAsExcel` returns an `.xlsx` workbook that starts with PK and contains the cell text Ada, the same checks as `ag-grid-enterprise` 36.2.0. Styles, multiple sheets, and the Excel export popup are not started. |
| Server-side row model | [Server-side model](https://www.ag-grid.com/javascript-data-grid/server-side-model/) | partial. The first `getRows` call asks for block 0, matching `ag-grid-enterprise` 36.2.0, and `success` fills Ada. Grouping and pivoting on the server are not started. |
| Viewport row model | [Viewport](https://www.ag-grid.com/javascript-data-grid/viewport/) | partial. With a 240px grid, 36px rows, and 4 rows, `setViewportRange` is `0` to `3`, matching `ag-grid-enterprise` 36.2.0. |
| Integrated charts | [Integrated charts](https://www.ag-grid.com/javascript-data-grid/integrated-charts/) | partial. `createRangeChart` covers the chart types `ag-grid-enterprise` 36.2.0 can create. Customize includes Line Dash, Color, and Padding. Set Up includes Reverse. Enterprise shows those labels. Markers, shadows, and gradients are not started. |
| Sparklines | [Sparklines](https://www.ag-grid.com/javascript-data-grid/sparklines-overview/) | partial. The default sparkline is a line. `sparklineOptions.type: 'area'` draws an area, and `'bar'` draws bars. In Chromium the area sparkline for `[1, 3, 2]` renders `ag-sparkline-wrapper` on enterprise and `data-type="area"` here. |
| Status bar | [Status bar](https://www.ag-grid.com/javascript-data-grid/status-bar/) | partial. `agTotalRowCountComponent` shows `Total Rows : 2` and keeps that count after a filter, matching `ag-grid-enterprise` 36.2.0. `agTotalAndFilteredRowCountComponent` shows `Rows : 2` when every row is visible, and `Rows : 1 of 2` after a filter removes a row. |
| Side bar | [Side bar](https://www.ag-grid.com/javascript-data-grid/side-bar/) | partial. `sideBar: true` shows Columns and Filters, the same tab labels as `ag-grid-enterprise` 36.2.0. The columns panel hides a column. The filters panel opens that column's filter. |
| Row numbers | [Row numbers](https://www.ag-grid.com/javascript-data-grid/row-numbers/) | partial. `rowNumbers: true` adds `ag-Grid-RowNumbersColumn` in the same place as `ag-grid-enterprise` 36.2.0. The cells show 1 and 2 for the first two displayed rows. |
| Row grouping panel | [Row group panel](https://www.ag-grid.com/javascript-data-grid/grouping-group-panel/) | partial. `rowGroupPanelShow: 'always'` shows `Drag here to set row groups`, the same text as `ag-grid-enterprise` 36.2.0. Dropping the Country header onto the panel groups by `country`, and the chip text matches enterprise. Enterprise's own pointer drag needs a laid-out page, so the gesture compared here is the HTML5 drop. |
| Aligned grids | [Aligned grids](https://www.ag-grid.com/javascript-data-grid/aligned-grids/) | partial. `alignedGrids` keeps horizontal scroll, column width, column order, and column visibility in step with `ag-grid-enterprise` 36.2.0. |
| Toolbar | [Toolbar](https://www.ag-grid.com/javascript-data-grid/toolbar/) | partial. An action button runs `action`. `agQuickFilterToolbarItem` and `agFindToolbarItem` use the placeholders `Filter...` and `Find...`, and write through after 300ms. The find count and the row-group placeholder match `ag-grid-enterprise` 36.2.0. `agMenuToolbarItem` lists Copy and Export. Copy shows the shortcut `Ctrl+C`, matching `ag-grid-enterprise` 36.2.0. `agPivotPanelToolbarItem` shows the pivot column name Year. |
| Undo and redo | [Undo redo edits](https://www.ag-grid.com/javascript-data-grid/undo-redo-edits/) | partial. With `undoRedoCellEditing`, `undoCellEditing` and `redoCellEditing` restore a `setDataValue` edit the same way as `ag-grid-enterprise` 36.2.0. The default stack limit is 10. |
| Context menu | [Context menu](https://www.ag-grid.com/javascript-data-grid/context-menu/) | partial. A right click lists Cut, Copy, Copy with Headers, Copy with Group Headers, Paste, and Export, the same labels as `ag-grid-enterprise` 36.2.0. Copy sends the cell text through `sendToClipboard`. Submenus and keyboard shortcuts are not started. |
| Column menu | [Column menu](https://www.ag-grid.com/javascript-data-grid/column-menu/) | partial. The header menu lists Sort Ascending, Sort Descending, Pin Column, Autosize This Column, Autosize All Columns, Choose Columns, and Reset Columns, the same labels as `ag-grid-enterprise` 36.2.0. Sort Ascending orders the rows. Pin and filter submenus are not started. |
| Cell spanning | [Cell spanning](https://www.ag-grid.com/javascript-data-grid/cell-spanning/) | partial. `colSpan` widens the accessibility cell and drops the covered column. A span of 2 on a 200px column is 400px. `enableCellSpan` with `spanRows` merges two USA cells into one cell with `aria-rowspan` 2 and height 83px, matching `ag-grid-enterprise` 36.2.0. |
| Formulas | [Formulas](https://www.ag-grid.com/javascript-data-grid/formulas/) | partial. `allowFormula` displays `=[qty]*2` as 8 and `=1+2` as 3. `=SUM([qty],[bonus])` is 5 and `=SUM([qty])` is 3. `=SUM(A1:B2)` is 10, `=B1` is 1, and `=SUM(A1:A2)` is 7, matching `ag-grid-enterprise` 36.2.0. Row-number columns are skipped when assigning letters. `formulaDataSource` returning `=1+2` displays 3 while the row value stays 9, and `refreshFormulas` matches `ag-grid-enterprise` 36.2.0. |
| Find | [Find](https://www.ag-grid.com/javascript-data-grid/find/) | partial. `findSearchValue: 'ada'` reports 2 matches, the same count as `ag-grid-enterprise` 36.2.0. `findNext` moves focus from the name cell to the city cell. Each match is a `mark` whose text is `Ada`, the same text as enterprise `.ag-find-match`. After two `findNext` calls the active mark is the city cell, matching enterprise. |
| PDF export | [PDF export](https://www.ag-grid.com/javascript-data-grid/pdf-export/) | partial. `getDataAsPdf` returns a file that starts with `%PDF`, the same header as `ag-grid-enterprise` 36.2.0. The page text includes the cell value. Page setup and images are not started. |
| Rich select | [Rich select](https://www.ag-grid.com/javascript-data-grid/provided-cell-editors/#rich-select-editor) | partial. `agRichSelectCellEditor` opens a list. Enterprise opens `.ag-rich-select`. The list here is Red and Green, and choosing Green writes that value. The enterprise list stayed on Loading in happy-dom, so the painted rows were not compared. |
| Batch edit | [Batch editing](https://www.ag-grid.com/javascript-data-grid/batch-editing/) | partial. `startBatchEdit` keeps the row as Ada while `isBatchEditing` is true. `cancelBatchEdit` leaves Ada. `commitBatchEdit` writes Zoe. This matches `ag-grid-enterprise` 36.2.0. |
| Group filter | [Group filter](https://www.ag-grid.com/javascript-data-grid/grouping/) | partial. A filter on a child column hides groups that have no matching child. Equals `2021` leaves `g:USA` and `2021`. `agGroupColumnFilter` opens `Select field:` with Country and Year. Choosing Year and contains `2021` matches `ag-grid-enterprise` 36.2.0. |
| Notes | [Notes](https://www.ag-grid.com/javascript-data-grid/notes/) | partial. `notesDataSource` plus `setNote` and `getNote` store `hello` on the name cell, matching `ag-grid-enterprise` 36.2.0. `noteTrigger: 'click'` opens a popup whose text is `hello` and whose author line is `Ada · 2020-01-02`. Editing the text to `there` and leaving the cell writes `there` back and keeps the author, matching `ag-grid-enterprise` 36.2.0. |
| Tool panels | [Tool panel](https://www.ag-grid.com/javascript-data-grid/tool-panel/) | partial. The columns and filters panels ship with the side bar. A custom `toolPanel` component is not started. |

## Benchmark

Measured on 31 Oct 2026 at 14:26 Australia/Melbourne. Three repeats. 1,000,000 rows and 50 numeric columns. Chromium. `ag-grid-enterprise` 36.2.0 with `AllEnterpriseModule`. The ranges below cover the three runs. The full series is in `bench/results.json`. The progress page quotes the middle sort run.

| Metric | Opengrid | AG Grid Enterprise |
| --- | --- | --- |
| First render | 20 to 23 ms | 964 to 1020 ms |
| Sort and filter ready | 12 to 13 ms after first paint | 0 ms |
| Deferred copy of every column | 3895 to 3996 ms wall. Longest main-thread slice 9 to 10 ms | 0 ms |
| Scroll | 60 fps, p95 frame 16.7 ms | 46 fps on the middle sort run, p95 frame 33.3 ms |
| Sort of column `c0` | 65 ms on the middle run, 56 ms inside the query | 1479 ms on the middle run |
| Number filter `greaterThan` 50000 | 60.1 ms, 499,990 rows on the middle run | 858 ms, same row count and sampled values |
| Minified gzip entry | 41,429 bytes | 721,207 bytes |

The copy yields every 8 ms, so the wall time is longer than the old 1016 ms block and the main thread is not busy for a full second. `/bench` prints the longest slice next to the copy time. Heap delta from `performance.memory` was zero at the reported precision, so this table does not claim a memory win. Grouping was not timed.
