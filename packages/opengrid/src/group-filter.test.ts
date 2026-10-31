import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const rows = [
  { country: 'USA', year: '2020', sales: 10 },
  { country: 'Ireland', year: '2020', sales: 4 },
  { country: 'USA', year: '2021', sales: 7 },
];

function labels(api: { getDisplayedRowCount: () => number; getDisplayedRowAtIndex: (index: number) => { group?: boolean; key?: string | null; data?: { year?: string } } | undefined }) {
  const out: string[] = [];
  for (let index = 0; index < api.getDisplayedRowCount(); index++) {
    const node = api.getDisplayedRowAtIndex(index);
    out.push(node?.group ? `g:${node.key}` : String(node?.data?.year));
  }
  return out;
}

describe('group filter', () => {
  it('hides groups that have no matching child, like enterprise', () => {
    const options = {
      columnDefs: [
        { field: 'country', rowGroup: true, hide: true },
        { field: 'year', filter: 'agTextColumnFilter' },
        { field: 'sales' },
      ],
      rowData: rows,
      groupDefaultExpanded: -1,
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '280px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '280px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    const model = { year: { filterType: 'text', type: 'equals', filter: '2021' } };
    enterprise.setFilterModel(model);
    api.setFilterModel(model);
    expect(labels(api)).toEqual(labels(enterprise));
    expect(labels(api)).toEqual(['g:USA', '2021']);
    enterprise.destroy();
    api.destroy();
  });
});
