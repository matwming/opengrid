import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('advanced filter', () => {
  it('joins a text condition and a number condition', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [
        { name: 'Ada', qty: 1 },
        { name: 'Bea', qty: 4 },
        { name: 'Amy', qty: 3 },
      ],
      enableAdvancedFilter: true,
    });
    api.setAdvancedFilterModel({
      filterType: 'join',
      type: 'AND',
      conditions: [
        { filterType: 'text', colId: 'name', type: 'contains', filter: 'a' },
        { filterType: 'number', colId: 'qty', type: 'greaterThan', filter: 2 },
      ],
    });
    const names: string[] = [];
    for (let index = 0; index < api.getDisplayedRowCount(); index++) {
      names.push(String((api.getDisplayedRowAtIndex(index)?.data as { name: string } | undefined)?.name));
    }
    expect(names).toEqual(['Bea', 'Amy']);
    expect(api.getAdvancedFilterModel()?.type).toBe('AND');
    api.destroy();
  });
});
