import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const options = {
  columnDefs: [{
    field: 'name',
    editable: true,
    cellEditor: 'agRichSelectCellEditor',
    cellEditorParams: { values: ['Red', 'Green'] },
  }],
  rowData: [{ name: 'Red' }],
  animateRows: false,
};

describe('rich select', () => {
  it('lists the same values as enterprise and writes the chosen one', async () => {
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '240px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, options);
    enterprise.startEditingCell({ rowIndex: 0, colKey: 'name' });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(document.querySelector('.ag-rich-select')).toBeTruthy();
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, options);
    api.startEditingCell({ rowIndex: 0, colKey: 'name' });
    const ourValues = [...host.querySelectorAll('.og-rich button')].map((node) => node.textContent);
    expect(ourValues).toEqual(['Red', 'Green']);
    host.querySelectorAll('.og-rich button')[1]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Green' });
    enterprise.destroy();
    api.destroy();
  });
});
