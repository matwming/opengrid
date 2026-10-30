import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('drag a cell range', () => {
  it('selects the rows and columns under the pointer', () => {
    const host = document.createElement('div');
    host.style.width = '600px';
    host.style.height = '300px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [
        { field: 'name', width: 100 },
        { field: 'qty', width: 100 },
      ],
      rowData: [
        { name: 'Ada', qty: 1 },
        { name: 'Bea', qty: 2 },
        { name: 'Cy', qty: 3 },
      ],
      rowHeight: 36,
      cellSelection: true,
    });
    const viewport = host.querySelector('.og-viewport');
    if (!(viewport instanceof HTMLElement)) throw new Error('missing viewport');
    viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, toJSON: () => ({}) });
    const pointer = (type: string, x: number, y: number) => {
      const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      (type === 'pointerdown' ? viewport : document).dispatchEvent(event);
    };
    pointer('pointerdown', 20, 8);
    pointer('pointermove', 120, 80);
    pointer('pointerup', 120, 80);
    const range = api.getCellRanges()?.[0];
    expect(range?.startRow?.rowIndex).toBe(0);
    expect(range?.endRow?.rowIndex).toBe(2);
    expect(range?.columns.map((column) => column.getColId())).toEqual(['name', 'qty']);
    api.destroy();
  });
});
