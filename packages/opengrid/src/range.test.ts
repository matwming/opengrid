import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('cell range', () => {
  it('remembers a cell range and clears it', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [
        { name: 'Ada', qty: 1 },
        { name: 'Bea', qty: 2 },
      ],
      cellSelection: true,
    });
    expect(api.getCellRanges()).toBeNull();
    api.addCellRange({ rowStartIndex: 0, rowEndIndex: 1, columns: ['name'] });
    const ranges = api.getCellRanges();
    expect(ranges?.[0]?.startRow?.rowIndex).toBe(0);
    expect(ranges?.[0]?.endRow?.rowIndex).toBe(1);
    expect(ranges?.[0]?.columns.map((column) => column.getColId())).toEqual(['name']);
    api.clearCellSelection();
    expect(api.getCellRanges()).toBeNull();
    api.destroy();
  });
});
