import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function source() {
  const stored = new Map<string, string>();
  return {
    stored,
    getFormula(params: { column: { getColId: () => string }; rowNode: { id?: string | null } }) {
      return stored.get(`${params.rowNode.id}:${params.column.getColId()}`);
    },
    setFormula(params: { column: { getColId: () => string }; rowNode: { id?: string | null }; formula?: string }) {
      const key = `${params.rowNode.id}:${params.column.getColId()}`;
      if (!params.formula) stored.delete(key);
      else stored.set(key, params.formula);
    },
  };
}

describe('formula data source', () => {
  it('shows the stored formula and leaves the row value alone', () => {
    const enterpriseStore = source();
    const ourStore = source();
    const options = {
      columnDefs: [{ field: 'qty' }, { field: 'total', allowFormula: true }],
      rowData: [{ qty: 4, total: 9 }],
      getRowId: (params: { data: { qty: number } }) => String(params.data.qty),
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '480px';
    enterpriseHost.style.height = '200px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, { ...options, formulaDataSource: enterpriseStore });
    const host = document.createElement('div');
    host.style.width = '480px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, { ...options, formulaDataSource: ourStore });
    enterpriseStore.stored.set('4:total', '=1+2');
    ourStore.stored.set('4:total', '=1+2');
    enterprise.refreshFormulas();
    api.refreshFormulas();
    const text = (root: HTMLElement, selector: string, idName: string) => [...root.querySelectorAll(selector)].filter((cell) => cell.getAttribute(idName) === 'total').map((cell) => cell.textContent);
    expect(text(host, '.og-acell', 'data-col-id')).toEqual(text(enterpriseHost, '.ag-cell', 'col-id'));
    expect(text(host, '.og-acell', 'data-col-id')).toEqual(['3']);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual(enterprise.getDisplayedRowAtIndex(0)?.data);
    expect(api.getDisplayedRowAtIndex(0)?.data).toEqual({ qty: 4, total: 9 });
    enterprise.destroy();
    api.destroy();
  });
});
