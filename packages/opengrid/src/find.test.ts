import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('find', () => {
  it('counts the same cells as enterprise and moves to the next match', () => {
    const options = {
      columnDefs: [{ field: 'name' }, { field: 'city' }],
      rowData: [
        { name: 'Ada', city: 'Paris' },
        { name: 'Bea', city: 'Ada' },
      ],
      findSearchValue: 'ada',
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
    expect(api.findGetTotalMatches()).toBe(enterprise.findGetTotalMatches());
    expect(api.findGetTotalMatches()).toBe(2);
    api.findNext();
    expect(api.getFocusedCell()?.rowIndex).toBe(0);
    expect(api.getFocusedCell()?.column.getColId()).toBe('name');
    api.findNext();
    expect(api.getFocusedCell()?.rowIndex).toBe(1);
    expect(api.getFocusedCell()?.column.getColId()).toBe('city');
    enterprise.destroy();
    api.destroy();
  });
});
