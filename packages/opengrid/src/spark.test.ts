import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('sparkline', () => {
  it('draws one bar for each number in the cell', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name', width: 120 }, { field: 'trend', width: 120, cellRenderer: 'agSparklineCellRenderer' }],
      rowData: [{ name: 'Ada', trend: [1, 3, 2] }],
    });
    const spark = host.querySelector('.og-spark');
    expect(spark?.getAttribute('data-type')).toBe('line');
    expect(spark?.getAttribute('data-values')).toBe('1,3,2');
    expect(spark?.querySelector('polyline')).toBeTruthy();
    api.destroy();
    const areaHost = document.createElement('div');
    areaHost.style.width = '640px';
    areaHost.style.height = '240px';
    document.body.appendChild(areaHost);
    const area = createGrid(areaHost, {
      columnDefs: [{ field: 'trend', width: 120, cellRenderer: 'agSparklineCellRenderer', sparklineOptions: { type: 'area' } }],
      rowData: [{ trend: [1, 3, 2] }],
    });
    const areaSpark = areaHost.querySelector('.og-spark');
    expect(areaSpark?.getAttribute('data-type')).toBe('area');
    expect(areaSpark?.querySelector('polygon')).toBeTruthy();
    area.destroy();
  });
});
