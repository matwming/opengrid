import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('pivot', () => {
  it('turns pivot keys into columns and aggregates each one', () => {
    const host = document.createElement('div');
    host.style.width = '720px';
    host.style.height = '280px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [
        { field: 'country', rowGroup: true },
        { field: 'year', pivot: true },
        { field: 'sales', aggFunc: 'sum' },
      ],
      rowData: [
        { country: 'Ireland', year: '2020', sales: 4 },
        { country: 'Ireland', year: '2021', sales: 9 },
        { country: 'USA', year: '2020', sales: 10 },
        { country: 'USA', year: '2021', sales: 7 },
      ],
      pivotMode: true,
      groupDefaultExpanded: -1,
    });
    expect(api.getDisplayedRowCount()).toBe(2);
    const headers = api.getAllDisplayedColumns().map((column) => column.getColDef().headerName);
    expect(headers).toContain('2020');
    expect(headers).toContain('2021');
    const ireland = api.getDisplayedRowAtIndex(0);
    const usa = api.getDisplayedRowAtIndex(1);
    expect(ireland?.key).toBe('Ireland');
    expect(ireland?.aggData?.['ag-Grid-Pivot-sales-2020']).toBe(4);
    expect(ireland?.aggData?.['ag-Grid-Pivot-sales-2021']).toBe(9);
    expect(usa?.aggData?.['ag-Grid-Pivot-sales-2020']).toBe(10);
    expect(usa?.aggData?.['ag-Grid-Pivot-sales-2021']).toBe(7);
    api.destroy();
  });
});
