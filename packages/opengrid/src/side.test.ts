import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('side bar', () => {
  it('hides a column from the columns tool panel and opens a filter from the filters tool panel', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name', filter: true }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 1 }],
      sideBar: true,
    });
    const labels = [...host.querySelectorAll('.og-tool-columns label')];
    const qty = labels.find((label) => label.textContent === 'Qty');
    const box = qty?.querySelector('input');
    if (!(box instanceof HTMLInputElement)) throw new Error('missing qty checkbox');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(api.getColumnState().find((column) => column.colId === 'qty')?.hide).toBe(true);
    host.querySelector<HTMLButtonElement>('.og-tool-filters button')?.click();
    expect(host.querySelector('.og-pop select')).toBeTruthy();
    api.destroy();
  });
});
