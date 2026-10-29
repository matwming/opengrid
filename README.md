# Opengrid

Opengrid is a browser data grid with a Community-shaped API. A consumer can swap `ag-grid-community` for `opengrid`, and `ag-grid-react` for `opengrid-react`, and keep `createGrid`, column definitions, `gridOptions`, and the React component `AgGridReact`.

Phase 1 is the client-side grid. It sorts, filters, edits, pins, resizes, moves, and groups columns. It selects rows, exports CSV, and moves focus from the keyboard. The cells are drawn on a canvas. Editors, column headers, and custom cell renderers stay in the DOM. Sort and filter for more than 32,768 rows run in a web worker. The implementation is original. It follows AG Grid's public docs and public type names. It does not copy AG Grid source or themes.

## Run the demo

```bash
npm install
npm run dev
```

Open http://127.0.0.1:44731.

## Use it

```ts
import { ModuleRegistry, AllCommunityModule, createGrid } from 'opengrid';
import 'opengrid/styles.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const api = createGrid(document.querySelector('#grid'), {
  columnDefs: [{ field: 'symbol' }, { field: 'qty', editable: true }],
  rowData: [{ symbol: 'AAPL', qty: 100 }],
});
```

React:

```tsx
import { AgGridReact } from 'opengrid-react';
import 'opengrid/styles.css';

export function Blotter() {
  return (
    <div style={{ height: 480 }}>
      <AgGridReact
        rowData={rows}
        columnDefs={columnDefs}
        rowSelection={{ mode: 'multiRow', enableClickSelection: true }}
      />
    </div>
  );
}
```

Give the host element a height. The grid fills that box.

The package entry is TypeScript. The demo bundles it with Vite, which also bundles `worker.ts`. Above 32,768 rows, sort and filter run in that worker and finish on the `modelUpdated` event. A read on the same turn still sees the previous view. Below that size, the same calls finish before they return.

## Check it

```bash
npm test
npm run e2e
BENCH_ROWS=1000000 BENCH_COLS=50 npm run bench
```

`npm test` compares sort, filter, CSV, selection, and column state with `ag-grid-community` 36.2.0. `npm run e2e` drives the demo in Chromium, Firefox, and WebKit, and runs axe. The benchmark writes `bench/results.json`. CI runs the same bench at 40,000 rows so the worker path still runs.

The parity list is in `ROADMAP.md`.
