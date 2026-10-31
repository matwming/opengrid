import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('group panel drag', () => {
  it('drops a column onto the panel and shows the same chip as enterprise', () => {
    const options = {
      columnDefs: [{ field: 'country' }, { field: 'year' }],
      rowData: [{ country: 'USA', year: '2020' }],
      rowGroupPanelShow: 'always' as const,
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '240px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    const header = host.querySelector('.og-hcell') as HTMLElement;
    const panel = host.querySelector('.og-group-panel') as HTMLElement;
    const data = new DataTransfer();
    header.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    panel.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
    panel.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    enterprise.setRowGroupColumns(['country']);
    expect(api.getRowGroupColumns().map((column) => column.getColId())).toEqual(enterprise.getRowGroupColumns().map((column) => column.getColId()));
    expect(panel.querySelector('button')?.textContent).toBe(enterpriseHost.querySelector('.ag-column-drop-cell')?.textContent?.trim());
    enterprise.destroy();
    api.destroy();
  });
});
