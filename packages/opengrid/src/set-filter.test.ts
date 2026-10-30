import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('set filter popup', () => {
  it('keeps the checked values after Apply', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name', filter: 'agSetColumnFilter' }],
      rowData: [{ name: 'Ada' }, { name: 'Bea' }],
    });
    const opener = host.querySelector<HTMLButtonElement>('button.og-filter');
    if (!opener) throw new Error(host.innerHTML.slice(0, 500));
    opener.click();
    const bea = [...host.querySelectorAll<HTMLInputElement>('.og-pop input')].find((input) => input.value === 'Bea');
    if (!bea) throw new Error('missing Bea');
    bea.checked = false;
    host.querySelector<HTMLButtonElement>('.og-set-apply')?.click();
    expect(api.getDisplayedRowCount()).toBe(1);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Ada' });
    expect(api.getFilterModel()).toEqual({ name: { filterType: 'set', values: ['Ada'] } });
    api.destroy();
  });
});
