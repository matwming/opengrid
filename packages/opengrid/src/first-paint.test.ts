import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('first paint', () => {
  it('draws the first rows before the column store is copied', async () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const rows = Array.from({ length: 1000 }, (_, index) => ({ qty: index }));
    const api = createGrid(host, {
      columnDefs: [{ field: 'qty', width: 120 }],
      rowData: rows,
    });
    const root = host.querySelector('.og-root');
    expect(root?.getAttribute('data-store')).toBe('deferred');
    expect(api.getDisplayedRowAtIndex(0)?.data?.qty).toBe(0);
    expect(api.getDisplayedRowAtIndex(999)?.data?.qty).toBe(999);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root?.getAttribute('data-store')).toBe('partial');
    api.applyColumnState({ state: [{ colId: 'qty', sort: 'desc' }], defaultState: { sort: null } });
    expect(api.getDisplayedRowAtIndex(0)?.data?.qty).toBe(999);
    await new Promise<void>((resolve) => {
      const check = () => {
        if (root?.getAttribute('data-store') === 'ready') resolve();
        else setTimeout(check, 0);
      };
      check();
    });
    expect(Number(root?.getAttribute('data-slice-ms'))).toBeLessThan(50);
    api.applyColumnState({ state: [{ colId: 'qty', sort: 'desc' }], defaultState: { sort: null } });
    expect(api.getDisplayedRowAtIndex(0)?.data?.qty).toBe(999);
    api.destroy();
  });
});
