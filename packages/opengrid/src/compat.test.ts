import { AllCommunityModule, ModuleRegistry, createGrid as createAgGrid } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid, type GridApi } from './index';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Row {
  id: string;
  name: string | null;
  qty: number | null;
  when: string | null;
}

function data(): Row[] {
  return [
    { id: 'a', name: 'Nora', qty: 2, when: '2020-05-02' },
    { id: 'b', name: 'nora', qty: null, when: '2020-01-04' },
    { id: 'c', name: 'Amy', qty: 10, when: null },
    { id: 'd', name: 'Bo', qty: 10, when: '2019-12-01' },
    { id: 'e', name: null, qty: -3, when: '2020-05-02' },
    { id: 'f', name: '', qty: 0, when: '2020-05-01' },
  ];
}

function options() {
  return {
    columnDefs: [
      { field: 'id' },
      { field: 'name', sortable: true, filter: 'agTextColumnFilter' },
      { field: 'qty', sortable: true, filter: 'agNumberColumnFilter' },
      { field: 'when', sortable: true, filter: 'agDateColumnFilter' },
    ],
    rowData: data(),
    getRowId: (params: { data: Row }) => params.data.id,
    rowSelection: { mode: 'multiRow' as const, checkboxes: false, headerCheckbox: false, enableClickSelection: true },
  };
}

function ids(api: GridApi<Row>): string[] {
  const out: string[] = [];
  const count = api.getDisplayedRowCount();
  for (let index = 0; index < count; index++) out.push(api.getDisplayedRowAtIndex(index)?.id ?? '');
  return out;
}

function mount(create: (el: HTMLElement, gridOptions: ReturnType<typeof options>) => GridApi<Row>): GridApi<Row> {
  const host = document.createElement('div');
  host.style.width = '900px';
  host.style.height = '420px';
  document.body.appendChild(host);
  return create(host, options());
}

describe('community api compatibility', () => {
  const ag = mount(createAgGrid);
  const og = mount(createOpenGrid);

  it('matches sort, filter, edit, selection, and csv on the same calls', () => {
    expect(ids(og)).toEqual(ids(ag));

    ag.applyColumnState({ state: [{ colId: 'name', sort: 'asc' }], defaultState: { sort: null } });
    og.applyColumnState({ state: [{ colId: 'name', sort: 'asc' }], defaultState: { sort: null } });
    expect(ids(og), 'name asc').toEqual(ids(ag));

    ag.applyColumnState({ state: [{ colId: 'name', sort: 'desc' }], defaultState: { sort: null } });
    og.applyColumnState({ state: [{ colId: 'name', sort: 'desc' }], defaultState: { sort: null } });
    expect(ids(og), 'name desc').toEqual(ids(ag));

    ag.applyColumnState({ state: [{ colId: 'qty', sort: 'asc' }], defaultState: { sort: null } });
    og.applyColumnState({ state: [{ colId: 'qty', sort: 'asc' }], defaultState: { sort: null } });
    expect(ids(og), 'qty asc').toEqual(ids(ag));

    ag.applyColumnState({ state: [{ colId: 'when', sort: 'desc' }], defaultState: { sort: null } });
    og.applyColumnState({ state: [{ colId: 'when', sort: 'desc' }], defaultState: { sort: null } });
    expect(ids(og), 'when desc').toEqual(ids(ag));

    const filters = [
      { name: { filterType: 'text', type: 'contains', filter: 'no' } },
      { name: { filterType: 'text', type: 'equals', filter: 'nora' } },
      { name: { filterType: 'text', type: 'blank' } },
      { qty: { filterType: 'number', type: 'greaterThan', filter: 2 } },
      { qty: { filterType: 'number', type: 'inRange', filter: 0, filterTo: 10 } },
      { qty: { filterType: 'number', type: 'blank' } },
      { qty: { filterType: 'number', type: 'equals', filter: 10 } },
      { when: { filterType: 'date', type: 'equals', dateFrom: '2020-05-02' } },
      { when: { filterType: 'date', type: 'lessThan', dateFrom: '2020-01-01' } },
      {
        name: {
          filterType: 'text',
          operator: 'OR' as const,
          conditions: [
            { filterType: 'text', type: 'equals', filter: 'Amy' },
            { filterType: 'text', type: 'startsWith', filter: 'Bo' },
          ],
        },
      },
    ];
    for (const model of filters) {
      ag.setFilterModel(model);
      og.setFilterModel(model);
      expect(ids(og), JSON.stringify(model)).toEqual(ids(ag));
    }

    ag.setFilterModel(null);
    og.setFilterModel(null);
    ag.applyColumnState({ state: [{ colId: 'qty', sort: 'asc', sortIndex: 0 }], defaultState: { sort: null } });
    og.applyColumnState({ state: [{ colId: 'qty', sort: 'asc', sortIndex: 0 }], defaultState: { sort: null } });
    expect(ag.getDataAsCsv()).toEqual(og.getDataAsCsv());

    expect(ag.getRowNode('a')?.setDataValue('qty', 42)).toBe(true);
    expect(og.getRowNode('a')?.setDataValue('qty', 42)).toBe(true);
    expect(og.getRowNode('a')?.data?.qty).toBe(ag.getRowNode('a')?.data?.qty);

    ag.deselectAll();
    og.deselectAll();
    ag.getRowNode('c')?.setSelected(true);
    og.getRowNode('c')?.setSelected(true);
    expect(og.getSelectedRows().map((row) => row.id).sort()).toEqual(ag.getSelectedRows().map((row) => row.id).sort());
    ag.selectAll();
    og.selectAll();
    expect(og.getSelectedRows().map((row) => row.id).sort()).toEqual(ag.getSelectedRows().map((row) => row.id).sort());

    ag.setColumnsPinned(['name'], 'left');
    og.setColumnsPinned(['name'], 'left');
    expect(og.getDisplayedLeftColumns().map((column) => column.getColId())).toEqual(ag.getDisplayedLeftColumns().map((column) => column.getColId()));

    ag.moveColumns(['when'], 0);
    og.moveColumns(['when'], 0);
    expect(og.getColumnState().map((column) => column.colId)).toEqual(ag.getColumnState().map((column) => column.colId));

    const agNodes: string[] = [];
    const ogNodes: string[] = [];
    ag.forEachNode((node, index) => agNodes.push(`${index}:${node.id}:${node.displayed}`));
    og.forEachNode((node, index) => ogNodes.push(`${index}:${node.id}:${node.displayed}`));
    expect(ogNodes).toEqual(agNodes);
  });
});
