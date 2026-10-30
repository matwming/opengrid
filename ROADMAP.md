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
| CSV export | [CSV export](https://www.ag-grid.com/javascript-data-grid/csv-export/) | partial. Quoted CSV with CRLF matches 36.2.0 on the compat fixture. Excel export is not started. |
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
| Row dragging | [Row dragging](https://www.ag-grid.com/javascript-data-grid/row-dragging/) | partial. `rowDragManaged` moves the gripped row so it lands before the row under the pointer, and fires `onRowDragEnd`. The drop index was not compared with 36.2.0, because happy-dom did not fire that grid's drag events. |
| Pagination | [Row pagination](https://www.ag-grid.com/javascript-data-grid/row-pagination/) | partial. Client-side page size, current page, total pages, and `paginationGoToPage` match 36.2.0. `getDisplayedRowCount` stays the full filtered count. `paginationAutoPageSize` is not started. |
| State save and restore | [Grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/) | partial. `getState` and `setState` round-trip sort, filter, column order, width, pin, visibility, page, and row selection against 36.2.0. Scroll, focus, and group state are not started. |
| Vue wrapper | [Vue getting started](https://www.ag-grid.com/vue-data-grid/getting-started/) | partial. `AgGridVue` takes grid options as props, emits `grid-ready`, and exposes `api`. Changing `rowData` calls `setGridOption`. Framework cell components are not started. |
| Angular wrapper | [Angular getting started](https://www.ag-grid.com/angular-data-grid/getting-started/) | not started |

## Phase 3

| Feature | Doc | Status |
| --- | --- | --- |
| Row grouping | [Grouping](https://www.ag-grid.com/javascript-data-grid/grouping/) | not started |
| Aggregation | [Aggregation](https://www.ag-grid.com/javascript-data-grid/aggregation/) | not started |
| Pivot | [Pivoting](https://www.ag-grid.com/javascript-data-grid/pivoting/) | not started |
| Tree data | [Tree data](https://www.ag-grid.com/javascript-data-grid/tree-data/) | not started |
| Master detail | [Master detail](https://www.ag-grid.com/javascript-data-grid/master-detail/) | not started |
| Set filter | [Set filter](https://www.ag-grid.com/javascript-data-grid/filter-set/) | not started |
| Multi filter | [Multi filter](https://www.ag-grid.com/javascript-data-grid/filter-multi/) | not started |
| Advanced filter | [Advanced filter](https://www.ag-grid.com/javascript-data-grid/filter-advanced/) | not started |
| Range selection | [Range selection](https://www.ag-grid.com/javascript-data-grid/range-selection/) | not started |
| Clipboard | [Clipboard](https://www.ag-grid.com/javascript-data-grid/clipboard/) | not started |
| Fill handle | [Fill handle](https://www.ag-grid.com/javascript-data-grid/cell-selection-fill-handle/) | not started |
| Excel export | [Excel export](https://www.ag-grid.com/javascript-data-grid/excel-export/) | not started |
| Server-side row model | [Server-side model](https://www.ag-grid.com/javascript-data-grid/server-side-model/) | not started |
| Viewport row model | [Viewport](https://www.ag-grid.com/javascript-data-grid/viewport/) | not started |
| Integrated charts | [Integrated charts](https://www.ag-grid.com/javascript-data-grid/integrated-charts/) | not started |
| Sparklines | [Sparklines](https://www.ag-grid.com/javascript-data-grid/sparklines-overview/) | not started |
| Status bar | [Status bar](https://www.ag-grid.com/javascript-data-grid/status-bar/) | not started |
| Side bar | [Side bar](https://www.ag-grid.com/javascript-data-grid/side-bar/) | not started |
| Tool panels | [Tool panel](https://www.ag-grid.com/javascript-data-grid/tool-panel/) | not started |

## Benchmark

Measured on 29 Oct 2026 in this environment. Three repeats. 1,000,000 rows and 50 numeric columns. Chromium. `ag-grid-community` 36.2.0. The medians below are the middle sort run. The full series is in `bench/results.json`.

| Metric | Opengrid | AG Grid Community |
| --- | --- | --- |
| First render | 1106 to 1323 ms | 800 to 817 ms |
| Scroll | 60 fps, p95 frame 16.7 ms | 38.5 to 39 fps, p95 frame 33.3 ms |
| Sort of column `c0` | 76 to 92 ms wall, 61 to 68 ms inside the worker | 1749 to 1893 ms |
| Number filter `greaterThan` 50000 | 54 to 64 ms, 499,990 rows | 961 to 985 ms, same row count and the same sampled values |
| Minified gzip entry | 19,414 bytes | 186,044 bytes |

Opengrid loses first render. The client-side model copies every value into column arrays before `firstDataRendered`. AG Grid paints sooner. Scroll, sort, filter, and the entry bundle are faster or smaller. The bundle comparison is the whole Community entry against this phase 1 entry. Heap delta from `performance.memory` was zero at the reported precision, so this table does not claim a memory win. Grouping was not timed. It is an Enterprise feature, and this benchmark loads only the Community package.
