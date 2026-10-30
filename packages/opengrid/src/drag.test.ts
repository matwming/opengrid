import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('managed row drag', () => {
  it('moves the gripped row to the row under the pointer', () => {
    const host = document.createElement('div');
    host.style.width = '600px';
    host.style.height = '300px';
    document.body.appendChild(host);
    const ended: number[] = [];
    const api = createGrid(host, {
      columnDefs: [{ field: 'id', rowDrag: true, width: 120 }],
      rowData: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      rowDragManaged: true,
      rowHeight: 36,
      getRowId: (params: { data: { id: string } }) => params.data.id,
      onRowDragEnd: (event: { overIndex?: number }) => {
        if (typeof event.overIndex === 'number') ended.push(event.overIndex);
      },
    });
    const viewport = host.querySelector('.og-viewport');
    if (!(viewport instanceof HTMLElement)) throw new Error('missing viewport');
    viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300, toJSON: () => ({}) });
    const pointer = (type: string, y: number) => {
      const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: 4, clientY: y, button: 0 });
      (type === 'pointerdown' ? viewport : document).dispatchEvent(event);
    };
    pointer('pointerdown', 8);
    pointer('pointermove', 80);
    pointer('pointerup', 80);
    const ids: string[] = [];
    api.forEachNode((node) => ids.push(String(node.data && (node.data as { id: string }).id)));
    expect(ids).toEqual(['b', 'a', 'c', 'd']);
    expect(ended).toEqual([2]);
    api.destroy();
  });
});
