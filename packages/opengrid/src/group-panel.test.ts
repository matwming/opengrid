import { createGrid as createAgGrid } from 'ag-grid-community';
import { AllEnterpriseModule, ModuleRegistry } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('row group panel', () => {
  it('shows the enterprise placeholder and the grouped column name', () => {
    const make = (grouped: boolean) => {
      const host = document.createElement('div');
      host.style.width = '640px';
      host.style.height = '240px';
      document.body.appendChild(host);
      return host;
    };
    const plain = {
      columnDefs: [{ field: 'country' }, { field: 'year' }],
      rowData: [{ country: 'USA', year: '2020' }],
      rowGroupPanelShow: 'always' as const,
      animateRows: false,
    };
    const enterpriseHost = make(false);
    const enterprise = createAgGrid(enterpriseHost, plain);
    const oursHost = make(false);
    const ours = createOpenGrid(oursHost, plain);
    expect(oursHost.querySelector('.og-group-panel')?.textContent).toBe('Drag here to set row groups');
    expect(enterpriseHost.textContent).toContain('Drag here to set row groups');
    const groupedHost = make(true);
    const grouped = createOpenGrid(groupedHost, {
      columnDefs: [{ field: 'country', rowGroup: true }, { field: 'year' }],
      rowData: [{ country: 'USA', year: '2020' }],
      rowGroupPanelShow: 'always',
      animateRows: false,
    });
    expect(groupedHost.querySelector('.og-group-panel button')?.textContent).toBe('Country');
    enterprise.destroy();
    ours.destroy();
    grouped.destroy();
  });
});
