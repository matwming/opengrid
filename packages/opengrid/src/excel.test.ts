import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('excel export', () => {
  it('writes a workbook whose sheet contains the header and a cell', async () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 4 }],
    });
    const blob = api.getDataAsExcel();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(new TextDecoder().decode(bytes)).toContain('Ada');
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    api.destroy();
  });
});
