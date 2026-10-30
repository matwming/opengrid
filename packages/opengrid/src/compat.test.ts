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

  it('matches quick filter text and pagination against the same calls', () => {
    const gridOptions = {
      ...options(),
      pagination: true,
      paginationPageSize: 2,
      paginationPageSizeSelector: [2, 10],
    };
    const hostFor = () => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.height = '420px';
      document.body.appendChild(host);
      return host;
    };
    const agPage = createAgGrid(hostFor(), gridOptions);
    const ogPage = createOpenGrid(hostFor(), gridOptions);
    for (const text of ['no', '10', '2020', 'bo   10', 'alpha beta', '  ']) {
      agPage.setGridOption('quickFilterText', text);
      ogPage.setGridOption('quickFilterText', text);
      expect(ids(ogPage), JSON.stringify(text)).toEqual(ids(agPage));
    }
    agPage.setGridOption('quickFilterText', 'no');
    ogPage.setGridOption('quickFilterText', 'no');
    agPage.setFilterModel({ qty: { filterType: 'number', type: 'greaterThan', filter: 0 } });
    ogPage.setFilterModel({ qty: { filterType: 'number', type: 'greaterThan', filter: 0 } });
    expect(ids(ogPage), 'quick and column').toEqual(ids(agPage));
    agPage.setGridOption('quickFilterText', '');
    ogPage.setGridOption('quickFilterText', '');
    agPage.setFilterModel(null);
    ogPage.setFilterModel(null);

    const snapshot = (api: GridApi<Row>) => ({
      first: api.getFirstDisplayedRowIndex(),
      last: api.getLastDisplayedRowIndex(),
      count: api.getDisplayedRowCount(),
      page: api.paginationGetCurrentPage(),
      size: api.paginationGetPageSize(),
      total: api.paginationGetTotalPages(),
      rows: api.paginationGetRowCount(),
      known: api.paginationIsLastPageFound(),
    });
    expect(snapshot(ogPage)).toEqual(snapshot(agPage));
    agPage.paginationGoToNextPage();
    ogPage.paginationGoToNextPage();
    expect(snapshot(ogPage), 'next').toEqual(snapshot(agPage));
    agPage.paginationGoToPage(99);
    ogPage.paginationGoToPage(99);
    expect(snapshot(ogPage), 'last').toEqual(snapshot(agPage));
    agPage.setGridOption('quickFilterText', '2020');
    ogPage.setGridOption('quickFilterText', '2020');
    expect(snapshot(ogPage), 'filtered page').toEqual(snapshot(agPage));
    agPage.setGridOption('quickFilterText', 'no');
    ogPage.setGridOption('quickFilterText', 'no');
    expect(ogPage.isColumnFilterPresent(), 'quick filter is not a column filter').toBe(agPage.isColumnFilterPresent());
    agPage.setColumnsVisible(['name'], false);
    ogPage.setColumnsVisible(['name'], false);
    expect(ids(ogPage), 'hidden name').toEqual(ids(agPage));
    agPage.destroy();
    ogPage.destroy();
  });

  it('saves and restores sort, filter, columns, page, and selection', () => {
    const gridOptions = {
      ...options(),
      pagination: true,
      paginationPageSize: 2,
      paginationPageSizeSelector: [2, 10],
    };
    const hostFor = () => {
      const host = document.createElement('div');
      host.style.width = '900px';
      host.style.height = '420px';
      document.body.appendChild(host);
      return host;
    };
    const agPage = createAgGrid(hostFor(), gridOptions);
    const ogPage = createOpenGrid(hostFor(), gridOptions);
    const arrange = (api: GridApi<Row>) => {
      api.applyColumnState({ state: [{ colId: 'name', sort: 'asc', width: 140 }], defaultState: { sort: null } });
      api.setColumnsPinned(['name'], 'left');
      api.setColumnsVisible(['when'], false);
      api.setFilterModel({ name: { filterType: 'text', type: 'contains', filter: 'o' } });
      api.paginationGoToPage(1);
      api.getRowNode('d')?.setSelected(true);
    };
    arrange(agPage);
    arrange(ogPage);
    const { version: agVersion, ...agState } = agPage.getState();
    const { version: ogVersion, ...ogState } = ogPage.getState();
    expect(ogVersion).toBe('0.1.0');
    expect(agVersion).toBe('36.2.0');
    expect(ogState).toEqual(agState);

    const agRestored = createAgGrid(hostFor(), gridOptions);
    const ogRestored = createOpenGrid(hostFor(), gridOptions);
    agRestored.setState(agPage.getState());
    ogRestored.setState(ogPage.getState());
    expect(ids(ogRestored)).toEqual(ids(agRestored));
    expect(ogRestored.getColumnState().map((column) => ({ colId: column.colId, hide: column.hide, sort: column.sort, pinned: column.pinned, width: column.width }))).toEqual(
      agRestored.getColumnState().map((column) => ({ colId: column.colId, hide: column.hide, sort: column.sort, pinned: column.pinned, width: column.width })),
    );
    expect(ogRestored.paginationGetCurrentPage()).toBe(agRestored.paginationGetCurrentPage());
    expect(ogRestored.getSelectedRows().map((row) => row.id).sort()).toEqual(agRestored.getSelectedRows().map((row) => row.id).sort());
    agPage.destroy();
    ogPage.destroy();
    agRestored.destroy();
    ogRestored.destroy();
  });
});
