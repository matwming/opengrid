import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('advanced filter builder', () => {
  it('applies the column, option, and value from the builder', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 1 }, { name: 'Bea', qty: 4 }, { name: 'Amy', qty: 3 }],
      enableAdvancedFilter: true,
    });
    const column = host.querySelector('[aria-label="Select a column"]') as HTMLSelectElement;
    const operator = host.querySelector('[aria-label="Select an option"]') as HTMLSelectElement;
    const input = host.querySelector('[aria-label="Enter a value..."]') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter a value...');
    column.value = 'name';
    operator.value = 'contains';
    input.value = 'y';
    [...host.querySelectorAll('.og-advanced button')].find((button) => button.textContent === 'Apply')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const names = [];
    for (let index = 0; index < api.getDisplayedRowCount(); index++) names.push((api.getDisplayedRowAtIndex(index)?.data as { name: string }).name);
    expect(names).toEqual(['Amy']);
    api.destroy();
  });
});
