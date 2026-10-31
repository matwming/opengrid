import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('large sort', () => {
  it('shows the sorted row in the same turn above 32768 rows', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const rowData = Array.from({ length: 40_000 }, (_, index) => ({ qty: index }));
    const api = createGrid(host, {
      columnDefs: [{ field: 'qty', sort: 'desc' }],
      rowData,
    });
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ qty: 39_999 });
    api.applyColumnState({ state: [{ colId: 'qty', sort: 'asc' }], defaultState: { sort: null } });
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ qty: 0 });
    api.destroy();
  });
});
