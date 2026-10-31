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

describe('group column filter', () => {
  it('lets you pick the grouped field and filters like enterprise', async () => {
    const options = {
      columnDefs: [
        { field: 'country', rowGroup: true, hide: true, filter: 'agTextColumnFilter' },
        { field: 'year', rowGroup: true, hide: true, filter: 'agTextColumnFilter' },
        { field: 'sales' },
      ],
      autoGroupColumnDef: { filter: 'agGroupColumnFilter' },
      rowData: rows,
      groupDefaultExpanded: -1,
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '720px';
    enterpriseHost.style.height = '320px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '720px';
    host.style.height = '320px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    (enterpriseHost.querySelector('.ag-header-cell-filter-button') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(document.body.textContent).toContain('Select field:');
    (host.querySelector('.og-filter') as HTMLButtonElement).click();
    const field = host.querySelector('.og-group-filter-field') as HTMLSelectElement;
    expect([...field.options].map((option) => option.text)).toEqual(['Country', 'Year']);
    expect(host.textContent).toContain('Select field:');
    field.value = 'year';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    const input = host.querySelector('input') as HTMLInputElement;
    input.value = '2021';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 220));
    enterprise.setFilterModel({ year: { filterType: 'text', type: 'contains', filter: '2021' } });
    expect(labels(api)).toEqual(labels(enterprise));
    expect(labels(api)).toEqual(['g:USA', 'g:2021', '2021']);
    enterprise.destroy();
    api.destroy();
  });
});
