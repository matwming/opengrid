import { describe, expect, it } from 'vitest';
import { createGrid, type GridApi } from './index';

interface Row {
  id: string;
  name: string | null;
  qty: number | null;
  when: string | null;
}

const rows = (): Row[] => [
  { id: 'a', name: 'Nora', qty: 2, when: '2020-05-02' },
  { id: 'b', name: 'nora', qty: null, when: '2020-01-04' },
  { id: 'c', name: 'Amy', qty: 10, when: null },
  { id: 'd', name: 'Bo', qty: 10, when: '2019-12-01' },
  { id: 'e', name: null, qty: -3, when: '2020-05-02' },
  { id: 'f', name: '', qty: 0, when: '2020-05-01' },
];

function mount(): { host: HTMLElement; api: GridApi<Row>; data: Row[] } {
  const host = document.createElement('div');
  host.style.width = '800px';
  host.style.height = '400px';
  document.body.appendChild(host);
  const data = rows();
  const api = createGrid<Row>(host, {
    columnDefs: [
      { field: 'id', sortable: true },
      {
        headerName: 'Trade',
        groupId: 'trade',
        children: [{ field: 'name', filter: 'agTextColumnFilter' }],
      },
      { field: 'qty', filter: 'agNumberColumnFilter', editable: true },
      { field: 'when', filter: 'agDateColumnFilter' },
    ],
    rowData: data,
    getRowId: (params) => params.data.id,
    rowSelection: { mode: 'multiRow', checkboxes: false, headerCheckbox: false, enableClickSelection: true },
  });
  return { host, api, data };
}

function ids(api: GridApi<Row>): string[] {
  const out: string[] = [];
  for (let index = 0; index < api.getDisplayedRowCount(); index++) out.push(api.getDisplayedRowAtIndex(index)?.id ?? '');
  return out;
}

describe('createGrid', () => {
  it('sorts, filters, selects, edits, pins, moves, and exports csv', () => {
    const { host, api, data } = mount();
    expect(api.getDisplayedRowCount()).toBe(6);
    expect(ids(api)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);

    api.applyColumnState({ state: [{ colId: 'name', sort: 'asc' }], defaultState: { sort: null } });
    expect(ids(api)).toEqual(['e', 'f', 'c', 'd', 'a', 'b']);

    api.applyColumnState({ state: [{ colId: 'qty', sort: 'desc' }], defaultState: { sort: null } });
    expect(ids(api)).toEqual(['c', 'd', 'a', 'f', 'e', 'b']);

    api.setFilterModel({ name: { filterType: 'text', type: 'contains', filter: 'no' } });
    expect(ids(api)).toEqual(['a', 'b']);
    api.setFilterModel({ qty: { filterType: 'number', type: 'inRange', filter: 0, filterTo: 10 } });
    expect(ids(api)).toEqual(['a']);
    api.setFilterModel({ when: { filterType: 'date', type: 'equals', dateFrom: '2020-05-02' } });
    expect(ids(api)).toEqual(['a', 'e']);
    api.setFilterModel(null);
    expect(api.isAnyFilterPresent()).toBe(false);

    expect(api.getRowNode('a')?.setDataValue('qty', 42)).toBe(true);
    expect(data[0]?.qty).toBe(42);
    expect(api.getRowNode('a')?.data?.qty).toBe(42);

    api.getRowNode('c')?.setSelected(true);
    expect(api.getSelectedRows().map((row) => row.id)).toEqual(['c']);
    api.selectAll();
    expect(api.getSelectedRows()).toHaveLength(6);
    api.deselectAll();
    expect(api.getSelectedRows()).toHaveLength(0);

    api.setColumnsPinned(['name'], 'left');
    expect(api.getDisplayedLeftColumns().map((column) => column.getColId())).toContain('name');
    api.moveColumns(['when'], 0);
    expect(api.getColumnState().map((column) => column.colId)[0]).toBe('when');

    api.applyColumnState({ state: [{ colId: 'qty', sort: 'asc', sortIndex: 0 }], defaultState: { sort: null } });
    const csv = api.getDataAsCsv();
    expect(csv).toContain('"When","Id","Name","Qty"');
    expect(csv.includes('\r\n')).toBe(true);
    expect(csv).toContain('"a"');

    const seen: string[] = [];
    api.forEachNode((node, index) => seen.push(`${index}:${node.id}`));
    expect(seen[0]).toBe('0:a');
    api.destroy();
    expect(api.isDestroyed()).toBe(true);
    host.remove();
  });

  it('commits an editor through the public editing api', () => {
    const { host, api, data } = mount();
    api.setFilterModel(null);
    api.applyColumnState({ defaultState: { sort: null } });
    api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
    const input = host.querySelector('input');
    expect(input).toBeTruthy();
    if (!(input instanceof HTMLInputElement)) throw new Error('missing editor');
    input.value = '7';
    api.stopEditing();
    expect(data[0]?.qty).toBe(7);
    expect(api.getEditingCells()).toHaveLength(0);
    api.destroy();
    host.remove();
  });

  it('quotes commas in csv cells', () => {
    const host = document.createElement('div');
    host.style.width = '400px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Bo, Jr' }],
    });
    expect(api.getDataAsCsv()).toContain('"Bo, Jr"');
    api.destroy();
    host.remove();
  });

  it('mounts an element returned by cellRenderer', () => {
    const host = document.createElement('div');
    host.style.width = '600px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{
        field: 'name',
        cellRenderer: (params) => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = `row ${String(params.value)}`;
          return badge;
        },
      }],
      rowData: [{ name: 'Ada' }, { name: 'Lin' }],
      rowHeight: 36,
    });
    const badge = host.querySelector('.badge');
    expect(badge?.textContent).toBe('row Ada');
    api.destroy();
    host.remove();
  });
});
