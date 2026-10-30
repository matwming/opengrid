import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('fill handle', () => {
  it('copies the source cell down through the rows the pointer covers', () => {
    const host = document.createElement('div');
    host.style.width = '600px';
    host.style.height = '300px';
    document.body.appendChild(host);
    const api = createGrid<{ name: string; qty: number }>(host, {
      columnDefs: [
        { field: 'name', width: 100 },
        { field: 'qty', width: 100 },
      ],
      rowData: [
        { name: 'Ada', qty: 4 },
        { name: 'Bea', qty: 0 },
        { name: 'Cy', qty: 0 },
      ],
      rowHeight: 36,
      cellSelection: { handle: { mode: 'fill' } },
      fillOperation: ({ currentValue }) => (typeof currentValue === 'number' ? currentValue + 1 : currentValue),
    });
    api.addCellRange({ rowStartIndex: 0, rowEndIndex: 0, columns: ['qty'] });
    const viewport = host.querySelector('.og-viewport');
    if (!(viewport instanceof HTMLElement)) throw new Error('missing viewport');
    viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, toJSON: () => ({}) });
    const pointer = (type: string, y: number) => {
      const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: 120, clientY: y, button: 0 });
      (type === 'pointerdown' ? viewport : document).dispatchEvent(event);
    };
    pointer('pointerdown', 8);
    pointer('pointermove', 80);
    pointer('pointerup', 80);
    expect(api.getDisplayedRowAtIndex(1)?.data?.qty).toBe(5);
    expect(api.getDisplayedRowAtIndex(2)?.data?.qty).toBe(5);
    expect(api.getCellRanges()?.[0]?.endRow?.rowIndex).toBe(2);
    api.destroy();
  });
});
