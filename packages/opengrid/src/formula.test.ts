import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('formulas', () => {
  it('shows the same evaluated totals as enterprise and keeps the formula string', () => {
    const options = {
      columnDefs: [
        { field: 'qty' },
        { field: 'total', allowFormula: true },
      ],
      rowData: [
        { qty: 4, total: '=[qty]*2' },
        { qty: 3, total: '=1+2' },
      ],
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
    const enterpriseTotals = [...enterpriseHost.querySelectorAll('.ag-cell')].filter((cell) => cell.getAttribute('col-id') === 'total').map((cell) => cell.textContent);
    const ourTotals = [...host.querySelectorAll('.og-acell')].filter((cell) => cell.getAttribute('data-col-id') === 'total').map((cell) => cell.textContent);
    expect(ourTotals).toEqual(enterpriseTotals);
    expect(ourTotals).toEqual(['8', '3']);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ qty: 4, total: '=[qty]*2' });
    enterprise.destroy();
    api.destroy();
  });
});
