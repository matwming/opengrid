import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('integrated chart', () => {
  it('draws a column for each value in the range and removes it on destroy', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [
        { name: 'Ada', qty: 4 },
        { name: 'Bea', qty: 9 },
      ],
    });
    const chart = api.createRangeChart({
      chartType: 'column',
      cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] },
    });
    const panel = host.querySelector('.og-chart');
    expect(panel?.getAttribute('data-series')).toBe('4,9');
    expect(panel?.querySelectorAll('rect').length).toBe(2);
    expect(panel?.querySelector('title')?.textContent).toBe('Ada 4');
    chart.destroyChart();
    expect(host.querySelector('.og-chart')).toBeNull();
    for (const [chartType, shape, tag] of [['line', 'line', 'polyline'], ['area', 'area', 'polygon'], ['pie', 'pie', 'path'], ['scatter', 'scatter', 'circle']] as const) {
      api.createRangeChart({ chartType, cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
      const next = host.querySelector('.og-chart');
      expect(next?.getAttribute('data-shape')).toBe(shape);
      expect(next?.getAttribute('data-series')).toBe('4,9');
      expect(next?.querySelector(tag)).toBeTruthy();
    }
    api.destroy();
  });
});
