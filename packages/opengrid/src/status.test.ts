import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('status bar', () => {
  it('shows the displayed row count', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }, { name: 'Bea' }],
      statusBar: { statusPanels: [{ statusPanel: 'agTotalRowCountComponent' }] },
    });
    expect(host.querySelector('.og-status')?.textContent).toBe('Rows: 2');
    api.setFilterModel({ name: { filterType: 'text', type: 'equals', filter: 'Ada' } });
    expect(host.querySelector('.og-status')?.textContent).toBe('Rows: 1');
    api.destroy();
  });
});
