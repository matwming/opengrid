import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('viewport row model', () => {
  it('asks for the visible range and shows the rows the datasource supplies', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '80px';
    document.body.appendChild(host);
    const ranges: [number, number][] = [];
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }],
      rowModelType: 'viewport',
      rowHeight: 36,
      viewportDatasource: {
        init: (params) => {
          params.setRowCount(4);
          params.setRowData({ 0: { name: 'Ada' }, 1: { name: 'Bea' } });
        },
        setViewportRange: (firstRow, lastRow) => {
          ranges.push([firstRow, lastRow]);
        },
      },
    });
    expect(ranges[0]?.[0]).toBe(0);
    expect(ranges[0]?.[1]).toBeGreaterThanOrEqual(0);
    expect(api.getDisplayedRowCount()).toBe(4);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Ada' });
    expect(api.getDisplayedRowAtIndex(1)?.data).toEqual({ name: 'Bea' });
    api.destroy();
  });
});
