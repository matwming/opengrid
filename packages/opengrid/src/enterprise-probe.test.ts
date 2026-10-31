import { createGrid as createAgGrid, type GridApi as AgApi } from 'ag-grid-community';
import { AllEnterpriseModule, ModuleRegistry } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid, type GridApi as OpenApi } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface Row {
  country: string;
  year: string;
  sales: number;
}

const rows: Row[] = [
  { country: 'USA', year: '2020', sales: 10 },
  { country: 'Ireland', year: '2020', sales: 4 },
  { country: 'USA', year: '2021', sales: 7 },
  { country: 'Ireland', year: '2021', sales: 9 },
];

function labels(api: { getDisplayedRowCount: () => number; getDisplayedRowAtIndex: (index: number) => { group?: boolean; key?: string | null; data?: Row } | undefined }): string[] {
  const out: string[] = [];
  for (let index = 0; index < api.getDisplayedRowCount(); index++) {
    const node = api.getDisplayedRowAtIndex(index);
    out.push(node?.group ? `g:${node.key}` : String(node?.data?.year));
  }
  return out;
}

function ag(options: object): AgApi<Row> {
  const host = document.createElement('div');
  host.style.width = '640px';
  host.style.height = '320px';
  document.body.appendChild(host);
  return createAgGrid(host, options as never);
}

function open(options: object): OpenApi<Row> {
  const host = document.createElement('div');
  host.style.width = '640px';
  host.style.height = '320px';
  document.body.appendChild(host);
  return createOpenGrid(host, options as never);
}

describe('enterprise probe', () => {
  it('matches grouped row order and a sum', () => {
    const options = {
      columnDefs: [
        { field: 'country', rowGroup: true, hide: true },
        { field: 'year' },
        { field: 'sales', aggFunc: 'sum' },
      ],
      rowData: rows,
      groupDefaultExpanded: -1,
      animateRows: false,
      suppressAggFuncInHeader: true,
    };
    const enterprise = ag(options);
    const ours = open(options);
    expect(labels(ours)).toEqual(labels(enterprise));
    const enterpriseSum = enterprise.getDisplayedRowAtIndex(0)?.aggData?.sales;
    const ourSum = ours.getDisplayedRowAtIndex(0)?.aggData?.sales;
    expect(ourSum).toBe(enterpriseSum);
    enterprise.destroy();
    ours.destroy();
  });

  it('matches pivot column ids and the first group aggregate', () => {
    const options = {
      columnDefs: [
        { field: 'country', rowGroup: true },
        { field: 'year', pivot: true },
        { field: 'sales', aggFunc: 'sum' },
      ],
      rowData: rows,
      pivotMode: true,
      groupDefaultExpanded: 0,
      animateRows: false,
      suppressAggFuncInHeader: true,
    };
    const enterprise = ag(options);
    const ours = open(options);
    const idsOf = (api: { getAllGridColumns: () => { getColId: () => string }[] }) => api.getAllGridColumns().map((column) => column.getColId());
    expect(idsOf(ours)).toEqual(idsOf(enterprise));
    expect(ours.getDisplayedRowAtIndex(0)?.aggData).toEqual(enterprise.getDisplayedRowAtIndex(0)?.aggData);
    enterprise.destroy();
    ours.destroy();
  });

  it('matches the row number column id', () => {
    const hostFor = () => {
      const host = document.createElement('div');
      host.style.width = '640px';
      host.style.height = '240px';
      document.body.appendChild(host);
      return host;
    };
    const options = {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }, { name: 'Bea' }],
      rowNumbers: true,
      animateRows: false,
    };
    const enterpriseHost = hostFor();
    const ourHost = hostFor();
    const enterprise = createAgGrid(enterpriseHost, options);
    const ours = createOpenGrid(ourHost, options);
    expect(ours.getAllGridColumns().map((column) => column.getColId())).toEqual(enterprise.getAllGridColumns().map((column) => column.getColId()));
    const cells = [...ourHost.querySelectorAll('[role="gridcell"]')].map((cell) => cell.textContent);
    expect(cells).toContain('1');
    expect(cells).toContain('2');
    enterprise.destroy();
    ours.destroy();
  });

  it('matches a set filter', () => {
    const options = {
      columnDefs: [{ field: 'country', filter: 'agSetColumnFilter' }, { field: 'year' }],
      rowData: rows,
      animateRows: false,
    };
    const enterprise = ag(options);
    const ours = open(options);
    const model = { country: { filterType: 'set', values: ['USA'] } };
    enterprise.setFilterModel(model);
    ours.setFilterModel(model);
    const years = (api: { getDisplayedRowCount: () => number; getDisplayedRowAtIndex: (index: number) => { data?: Row } | undefined }) => {
      const out: string[] = [];
      for (let index = 0; index < api.getDisplayedRowCount(); index++) out.push(String(api.getDisplayedRowAtIndex(index)?.data?.year));
      return out;
    };
    expect(years(ours)).toEqual(years(enterprise));
    enterprise.destroy();
    ours.destroy();
  });
});
