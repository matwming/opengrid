import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('pdf export', () => {
  it('returns a PDF like enterprise and includes the cell text', async () => {
    const options = {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }],
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '200px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    const enterprisePdf = enterprise.getDataAsPdf();
    const ourPdf = api.getDataAsPdf();
    const enterpriseBytes = new Uint8Array(await enterprisePdf!.arrayBuffer());
    const ourBytes = new Uint8Array(await ourPdf.arrayBuffer());
    expect(String.fromCharCode(...enterpriseBytes.slice(0, 4))).toBe('%PDF');
    expect(String.fromCharCode(...ourBytes.slice(0, 4))).toBe('%PDF');
    expect(new TextDecoder().decode(ourBytes)).toContain('Ada');
    enterprise.destroy();
    api.destroy();
  });
});
