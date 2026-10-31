import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('span rows', () => {
  it('merges equal country cells the way enterprise does', () => {
    const options = {
      columnDefs: [
        { field: 'country', spanRows: true, width: 160 },
        { field: 'city', width: 160 },
      ],
      rowData: [
        { country: 'USA', city: 'A' },
        { country: 'USA', city: 'B' },
        { country: 'Ireland', city: 'C' },
      ],
      rowHeight: 42,
      enableCellSpan: true,
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
    const read = (root: HTMLElement, selector: string, idName: string) => [...root.querySelectorAll(selector)].filter((cell) => cell.getAttribute(idName) === 'country').map((cell) => ({
      text: cell.textContent,
      rowspan: cell.getAttribute('aria-rowspan'),
      height: (cell as HTMLElement).style.height,
    }));
    expect(read(host, '.og-acell', 'data-col-id')).toEqual(read(enterpriseHost, '.ag-cell', 'col-id'));
    expect(read(host, '.og-acell', 'data-col-id')).toEqual([
      { text: 'USA', rowspan: '2', height: '83px' },
      { text: 'Ireland', rowspan: null, height: '' },
    ]);
    enterprise.destroy();
    api.destroy();
  });
});
