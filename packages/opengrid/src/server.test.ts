import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('server-side row model', () => {
  it('asks the datasource for a block and shows the returned rows', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '120px';
    document.body.appendChild(host);
    const starts: number[] = [];
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }],
      rowModelType: 'serverSide',
      cacheBlockSize: 2,
      serverSideDatasource: {
        getRows: ({ request, success }) => {
          starts.push(request.startRow);
          const rows = [{ name: 'Ada' }, { name: 'Bea' }];
          success({ rowData: rows.slice(request.startRow, request.endRow), rowCount: rows.length });
        },
      },
    });
    expect(starts).toContain(0);
    expect(api.getDisplayedRowCount()).toBe(2);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Ada' });
    expect(api.getDisplayedRowAtIndex(1)?.data).toEqual({ name: 'Bea' });
    api.destroy();
  });
});
