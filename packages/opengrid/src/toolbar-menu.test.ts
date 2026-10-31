import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('toolbar menu and pivot', () => {
  it('lists Copy and Export and shows the pivot drop text', async () => {
    const options = {
      columnDefs: [{ field: 'name' }, { field: 'year', pivot: true }, { field: 'sales', aggFunc: 'sum' }],
      rowData: [{ name: 'Ada', year: '2020', sales: 1 }],
      pivotMode: true,
      animateRows: false,
      toolbar: {
        items: [
          { toolbarItem: 'agMenuToolbarItem', label: 'Menu', toolbarItemParams: { menuItems: ['copy', 'export'] } },
          { toolbarItem: 'agPivotPanelToolbarItem' },
        ],
      },
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
    expect(host.querySelector('.og-pivot-panel')?.textContent?.trim()).toBe(enterpriseHost.querySelector('.ag-toolbar-panel')?.textContent?.trim());
    expect(host.querySelector('.og-pivot-panel')?.textContent?.trim()).toBe('Year');
    (enterpriseHost.querySelector('.ag-toolbar-button') as HTMLButtonElement).click();
    (host.querySelector('.og-toolbar-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const enterpriseItems = [...document.body.querySelectorAll('.ag-menu-option-text')].map((node) => node.textContent?.trim());
    const ourItems = [...host.querySelectorAll('.og-menu-option-text')].map((node) => node.textContent);
    expect(ourItems).toEqual(enterpriseItems);
    expect(ourItems).toEqual(['Copy', 'Export']);
    const enterpriseKeys = [...document.body.querySelectorAll('.ag-menu-option-shortcut')].map((node) => node.textContent?.trim()).filter(Boolean);
    const ourKeys = [...host.querySelectorAll('.og-menu-shortcut')].map((node) => node.textContent);
    expect(ourKeys).toEqual(enterpriseKeys);
    expect(ourKeys).toEqual(['Ctrl+C']);
    enterprise.destroy();
    api.destroy();
  });
});
