import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('clipboard', () => {
  it('copies a range as tab-separated text and pastes it back', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    let copied = '';
    const api = createGrid<{ name: string; qty: number }>(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [
        { name: 'Ada', qty: 1 },
        { name: 'Bea', qty: 2 },
      ],
      cellSelection: true,
      processCellForClipboard: ({ value }) => value.toUpperCase(),
      sendToClipboard: ({ data }) => {
        copied = data;
      },
    });
    api.addCellRange({ rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] });
    api.copySelectedRangeToClipboard();
    expect(copied).toBe('ADA\t1\nBEA\t2');
    const data = new DataTransfer();
    data.setData('text/plain', 'Cara\t9');
    host.querySelector('.og-root')?.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }));
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Cara', qty: 9 });
    expect(api.getDisplayedRowAtIndex(1)?.data).toEqual({ name: 'Bea', qty: 2 });
    api.destroy();
  });
});
