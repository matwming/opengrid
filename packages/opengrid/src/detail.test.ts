import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('master detail', () => {
  it('inserts a detail row under an expanded master and removes it when collapsed', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '280px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'id' }, { field: 'name' }],
      rowData: [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Bea' },
      ],
      masterDetail: true,
      isRowMaster: (data: { id: string }) => data.id === 'a',
      detailCellRenderer: (params: { data: { id: string } | undefined }) => `note ${params.data?.id}`,
    });
    const labels = () => {
      const out: string[] = [];
      for (let index = 0; index < api.getDisplayedRowCount(); index++) {
        const node = api.getDisplayedRowAtIndex(index);
        out.push(node?.id?.startsWith('detail_') ? `d:${node.key}` : String((node?.data as { id: string } | undefined)?.id));
      }
      return out;
    };
    expect(labels()).toEqual(['a', 'b']);
    const master = api.getDisplayedRowAtIndex(0);
    master?.setExpanded(true);
    expect(master?.expanded).toBe(true);
    expect(labels()).toEqual(['a', 'd:note a', 'b']);
    api.getDisplayedRowAtIndex(1)?.setExpanded(true);
    expect(labels()).toEqual(['a', 'd:note a', 'b']);
    master?.setExpanded(false);
    expect(labels()).toEqual(['a', 'b']);
    api.destroy();
  });
});
