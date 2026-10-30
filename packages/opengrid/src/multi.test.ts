import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('multi filter', () => {
  it('keeps a row only when every text condition matches', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name', filter: 'agMultiColumnFilter' }],
      rowData: [{ name: 'Nora' }, { name: 'Noel' }, { name: 'Amy' }],
    });
    host.querySelector<HTMLButtonElement>('button.og-filter')?.click();
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.og-pop input')];
    if (inputs.length < 2) throw new Error('missing inputs');
    inputs[0]!.value = 'no';
    inputs[1]!.value = 'el';
    host.querySelector<HTMLButtonElement>('.og-multi-apply')?.click();
    expect(api.getDisplayedRowCount()).toBe(1);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Noel' });
    api.destroy();
  });
});
