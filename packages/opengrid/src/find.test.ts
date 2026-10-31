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
    const activeCol = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map((node) => node.closest('.ag-cell, .og-acell')?.getAttribute('col-id') ?? node.closest('.og-acell')?.getAttribute('data-col-id'));
    api.findNext();
    enterprise.findNext();
    expect(api.getFocusedCell()?.rowIndex).toBe(0);
    expect(api.getFocusedCell()?.column.getColId()).toBe('name');
    expect(activeCol(host, '.og-find-active')).toEqual(activeCol(enterpriseHost, '.ag-find-active-match'));
    api.findNext();
    enterprise.findNext();
    expect(api.getFocusedCell()?.rowIndex).toBe(1);
    expect(api.getFocusedCell()?.column.getColId()).toBe('city');
    expect(host.querySelectorAll('.og-find')).toHaveLength(enterprise.findGetTotalMatches());
    const enterpriseMarks = [...enterpriseHost.querySelectorAll('.ag-find-match')].map((node) => node.textContent);
    const ourMarks = [...host.querySelectorAll('.og-find')].map((node) => node.textContent);
    expect(ourMarks).toEqual(enterpriseMarks);
    expect(ourMarks).toEqual(['Ada', 'Ada']);
    expect(activeCol(host, '.og-find-active')).toEqual(activeCol(enterpriseHost, '.ag-find-active-match'));
    expect(activeCol(host, '.og-find-active')).toEqual(['city']);
    enterprise.destroy();
    api.destroy();
  });
});
