import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('chart toolbar', () => {
  it('links a clicked point back to the grid and can unlink it', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 4 }, { name: 'Bea', qty: 9 }],
    });
    api.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
    const titles = [...host.querySelectorAll('.og-chart-menu button')].map((button) => button.getAttribute('aria-label'));
    expect(titles).toEqual(['Unlink from Grid', 'Download Chart']);
    expect(api.getCellRanges()?.[0]?.endRow?.rowIndex).toBe(1);
    host.querySelectorAll('.og-chart rect')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(api.getFocusedCell()?.rowIndex).toBe(1);
    expect(api.getFocusedCell()?.column.getColId()).toBe('qty');
    (host.querySelector('.og-chart-menu button') as HTMLButtonElement).click();
    expect(api.getCellRanges()).toBeNull();
    expect(host.querySelector('.og-chart-menu button')?.getAttribute('aria-label')).toBe('Link to Grid');
    api.destroy();
  });
});
