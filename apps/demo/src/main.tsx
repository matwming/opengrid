import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AgGridReact, type AgGridReactRef } from 'opengrid-react';
import type { ColDef, ColGroupDef, GridReadyEvent } from 'opengrid';
import 'opengrid/styles.css';
import './demo.css';

interface Ticket {
  id: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: number;
  price: number;
  trader: string;
  desk: string;
  when: string;
  note: string;
}

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'TSLA', 'AVGO'];
const TRADERS = ['Chen', 'Okoye', 'Berg', 'Ito', 'Singh', 'Duarte'];
const DESKS = ['Index', 'Single stock', 'ETF'];

function buildTickets(count: number): Ticket[] {
  const tickets: Ticket[] = [];
  for (let index = 0; index < count; index++) {
    const symbol = SYMBOLS[index % SYMBOLS.length] ?? 'AAPL';
    tickets.push({
      id: `t${index}`,
      symbol,
      side: index % 3 === 0 ? 'Sell' : 'Buy',
      qty: (index % 40) * 25 + 25,
      price: Math.round((80 + (index % 170) + (index % 7) * 0.25) * 100) / 100,
      trader: TRADERS[index % TRADERS.length] ?? 'Chen',
      desk: DESKS[index % DESKS.length] ?? 'Index',
      when: `2026-04-${String((index % 27) + 1).padStart(2, '0')}`,
      note: index % 11 === 0 ? 'Worked' : '',
    });
  }
  return tickets;
}

const columnDefs: (ColDef<Ticket> | ColGroupDef<Ticket>)[] = [
  {
    headerName: 'Ticket',
    groupId: 'ticket',
    marryChildren: true,
    children: [
      { field: 'symbol', pinned: 'left', width: 110 },
      { field: 'side', width: 90 },
      { field: 'trader', width: 120 },
      { field: 'desk', width: 140 },
    ],
  },
  {
    headerName: 'Economics',
    groupId: 'economics',
    children: [
      { field: 'qty', filter: 'agNumberColumnFilter', editable: true, width: 110 },
      { field: 'price', filter: 'agNumberColumnFilter', editable: true, width: 120, valueFormatter: (params) => (typeof params.value === 'number' ? params.value.toFixed(2) : '') },
      { field: 'when', headerName: 'Trade date', filter: 'agDateColumnFilter', width: 140 },
      { field: 'note', filter: 'agTextColumnFilter', editable: true, flex: 1, minWidth: 160 },
    ],
  },
];

const params = new URLSearchParams(location.search);
const initialCount = Number(params.get('rows') ?? '4000');

function App() {
  const grid = useRef<AgGridReactRef<Ticket>>(null);
  const [count, setCount] = useState(Number.isFinite(initialCount) && initialCount > 0 ? initialCount : 4000);
  const [shown, setShown] = useState(count);
  const rowData = useMemo(() => buildTickets(count), [count]);

  function onGridReady(event: GridReadyEvent<Ticket>) {
    setShown(event.api.getDisplayedRowCount());
    event.api.addEventListener('modelUpdated', () => setShown(event.api.getDisplayedRowCount()));
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="kicker">Opengrid</p>
          <h1>Desk blotter</h1>
        </div>
        <p className="shown" data-testid="row-count">{shown.toLocaleString()} rows</p>
        <div className="actions">
          <label>
            Rows
            <input
              aria-label="Row count"
              type="number"
              min={1}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => grid.current?.api.exportDataAsCsv({ fileName: 'blotter.csv' })}>Export CSV</button>
          <button type="button" onClick={() => grid.current?.api.sizeColumnsToFit()}>Fit columns</button>
        </div>
      </header>
      <div className="grid-shell">
        <AgGridReact<Ticket>
          ref={grid}
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => params.data.id}
          rowSelection={{ mode: 'multiRow', enableClickSelection: true }}
          defaultColDef={{ sortable: true, resizable: true, filter: true }}
          onGridReady={onGridReady}
        />
      </div>
      <footer>
        <p>Click a header to sort. Shift-click adds a sort key. Drag a header to move it, or the edge to resize it.</p>
        <p>Arrow keys move the focus. Enter edits. Escape cancels. Space toggles the row. Ctrl or Cmd A selects every row.</p>
      </footer>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
