import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('column menu', () => {
  it('lists the same items as enterprise and sorts ascending', () => {
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '240px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Bea' }, { name: 'Ada' }],
      animateRows: false,
    });
    enterpriseHost.querySelector('.ag-header-cell-menu-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const enterpriseItems = [...document.querySelectorAll('.ag-menu-option-text')].map((node) => node.textContent);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Bea' }, { name: 'Ada' }],
    });
    host.querySelector<HTMLButtonElement>('button.og-menu')?.click();
    const ourItems = [...host.querySelectorAll('.og-colmenu-item')].map((node) => node.textContent);
    expect(ourItems).toEqual(enterpriseItems);
    host.querySelector<HTMLButtonElement>('.og-colmenu-item')?.click();
    expect(api.getColumnState().find((column) => column.colId === 'name')?.sort).toBe('asc');
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Ada' });
    enterprise.destroy();
    api.destroy();
  });
});
