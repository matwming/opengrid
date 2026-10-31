import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('cell span', () => {
  it('covers the next column the way enterprise widens the cell', () => {
    const options = {
      columnDefs: [
        { field: 'name', width: 200, colSpan: () => 2 },
        { field: 'qty', width: 200 },
      ],
      rowData: [{ name: 'Ada', qty: 1 }],
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
    const enterpriseCells = [...enterpriseHost.querySelectorAll('.ag-cell')];
    const ourCells = [...host.querySelectorAll('.og-acell')];
    expect(enterpriseCells.map((cell) => cell.getAttribute('col-id'))).toEqual(['name']);
    expect((enterpriseCells[0] as HTMLElement).style.width).toBe('400px');
    expect(ourCells).toHaveLength(1);
    expect(ourCells[0]?.getAttribute('aria-colspan')).toBe('2');
    expect((ourCells[0] as HTMLElement).style.width).toBe('400px');
    expect(ourCells[0]?.textContent).toBe('Ada');
    enterprise.destroy();
    api.destroy();
  });
});
