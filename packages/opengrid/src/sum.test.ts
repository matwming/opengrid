import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('formula sum', () => {
  it('adds the listed cells the same way as enterprise', () => {
    const options = {
      columnDefs: [
        { field: 'qty' },
        { field: 'bonus' },
        { field: 'total', allowFormula: true },
      ],
      rowData: [
        { qty: 4, bonus: 1, total: '=SUM([qty],[bonus])' },
        { qty: 3, bonus: 2, total: '=SUM([qty])' },
      ],
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '220px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '220px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    const read = (root: ParentNode, selector: string, attr: string) => [...root.querySelectorAll(selector)].filter((cell) => cell.getAttribute(attr) === 'total').map((cell) => cell.textContent);
    expect(read(host, '.og-acell', 'data-col-id')).toEqual(read(enterpriseHost, '.ag-cell', 'col-id'));
    expect(read(host, '.og-acell', 'data-col-id')).toEqual(['5', '3']);
    enterprise.destroy();
    api.destroy();
  });
});
