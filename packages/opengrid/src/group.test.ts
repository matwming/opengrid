import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

const rows = [
  { country: 'USA', year: '2020', sales: 10 },
  { country: 'Ireland', year: '2020', sales: 4 },
  { country: 'USA', year: '2021', sales: 7 },
  { country: 'Ireland', year: '2021', sales: 9 },
];

function ids(api: ReturnType<typeof createGrid>): string[] {
  const out: string[] = [];
  for (let index = 0; index < api.getDisplayedRowCount(); index++) {
    const node = api.getDisplayedRowAtIndex(index);
    out.push(node?.group ? `g:${node.key}` : String(node?.data && (node.data as { country: string; year: string }).year));
  }
  return out;
}

describe('row grouping', () => {
  it('groups rows, collapses them, and can switch the group column', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '320px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [
        { field: 'country', rowGroup: true },
        { field: 'year' },
        { field: 'sales' },
      ],
      rowData: rows,
      groupDefaultExpanded: -1,
    });
    expect(api.getRowGroupColumns().map((column) => column.getColId())).toEqual(['country']);
    expect(ids(api)).toEqual(['g:Ireland', '2020', '2021', 'g:USA', '2020', '2021']);
    const ireland = api.getDisplayedRowAtIndex(0);
    expect(ireland?.group).toBe(true);
    expect(ireland?.allChildrenCount).toBe(2);
    ireland?.setExpanded(false);
    expect(ids(api)).toEqual(['g:Ireland', 'g:USA', '2020', '2021']);
    api.setRowGroupColumns(['year']);
    expect(ids(api)).toEqual(['g:2020', '2020', '2020', 'g:2021', '2021', '2021']);
    api.destroy();
  });

  it('sums, counts, and averages the leaves under a group', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '320px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [
        { field: 'country', rowGroup: true },
        { field: 'sales', aggFunc: 'sum' },
        { field: 'qty', aggFunc: 'avg' },
      ],
      rowData: [
        { country: 'Ireland', sales: 4, qty: 1 },
        { country: 'Ireland', sales: 9, qty: 3 },
        { country: 'USA', sales: 10, qty: 2 },
      ],
      groupDefaultExpanded: 0,
    });
    const ireland = api.getDisplayedRowAtIndex(0);
    const usa = api.getDisplayedRowAtIndex(1);
    expect(ireland?.key).toBe('Ireland');
    expect(ireland?.aggData).toMatchObject({ sales: 13, qty: 2 });
    expect(usa?.aggData).toMatchObject({ sales: 10, qty: 2 });
    api.destroy();
  });
});
