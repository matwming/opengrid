import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('formula ranges', () => {
  it('sums A1:A2 and A1:B2 the same way as enterprise', () => {
    const options = {
      columnDefs: [
        { field: 'qty', allowFormula: true },
        { field: 'bonus', allowFormula: true },
        { field: 'total', allowFormula: true },
      ],
      rowData: [
        { qty: 4, bonus: 1, total: '=SUM(A1:B2)' },
        { qty: 3, bonus: 2, total: '=B1' },
        { qty: 4, bonus: 3, total: '=SUM(A1:A2)' },
      ],
      rowNumbers: true,
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '240px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    const text = (root: HTMLElement) => [...root.querySelectorAll('.ag-cell, .og-acell')].filter((cell) => (cell.getAttribute('col-id') ?? cell.getAttribute('data-col-id')) === 'total').map((cell) => cell.textContent);
    expect(text(host)).toEqual(text(enterpriseHost));
    expect(text(host)).toEqual(['10', '1', '7']);
    enterprise.destroy();
    api.destroy();
  });
});
