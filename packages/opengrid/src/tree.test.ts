import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('tree data', () => {
  it('nests rows by getDataPath and can collapse a branch', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '320px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }],
      rowData: [
        { name: 'CEO', path: ['CEO'] },
        { name: 'Sales', path: ['CEO', 'Sales'] },
        { name: 'EU', path: ['CEO', 'Sales', 'EU'] },
        { name: 'Support', path: ['CEO', 'Support'] },
      ],
      treeData: true,
      getDataPath: (data: { path: string[] }) => data.path,
      groupDefaultExpanded: -1,
    });
    const labels = () => {
      const out: string[] = [];
      for (let index = 0; index < api.getDisplayedRowCount(); index++) {
        const node = api.getDisplayedRowAtIndex(index);
        out.push(node?.group ? `g:${node.key}` : String((node?.data as { name: string } | undefined)?.name));
      }
      return out;
    };
    expect(labels()).toEqual(['g:CEO', 'g:Sales', 'EU', 'Support']);
    api.getDisplayedRowAtIndex(1)?.setExpanded(false);
    expect(labels()).toEqual(['g:CEO', 'g:Sales', 'Support']);
    api.destroy();
  });
});
