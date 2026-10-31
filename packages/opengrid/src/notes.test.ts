import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('notes', () => {
  it('stores a cell note and reads it back like enterprise', () => {
    const memory = () => {
      const notes = new Map<string, { text: string }>();
      return {
        getNote(params: { column: { getColId: () => string }; rowNode: { id?: string | null } }) {
          return notes.get(`${params.rowNode.id}:${params.column.getColId()}`);
        },
        setNote(params: { column: { getColId: () => string }; rowNode: { id?: string | null }; note?: { text: string } }) {
          const key = `${params.rowNode.id}:${params.column.getColId()}`;
          if (!params.note) notes.delete(key);
          else notes.set(key, params.note);
        },
      };
    };
    const options = {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }],
      getRowId: (params: { data: { name: string } }) => params.data.name,
      animateRows: false,
    };
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '400px';
    enterpriseHost.style.height = '200px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, { ...options, notesDataSource: memory() });
    const host = document.createElement('div');
    host.style.width = '400px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const api = createOpenGrid(host, { ...options, notesDataSource: memory() });
    const enterpriseNode = enterprise.getDisplayedRowAtIndex(0)!;
    const ourNode = api.getDisplayedRowAtIndex(0)!;
    enterprise.setNote({ column: 'name', rowNode: enterpriseNode, note: { text: 'hello' } });
    api.setNote({ column: 'name', rowNode: ourNode, note: { text: 'hello' } });
    expect(api.getNote({ column: 'name', rowNode: ourNode })?.text).toBe('hello');
    expect(api.getNote({ column: 'name', rowNode: ourNode })?.text).toBe(enterprise.getNote({ column: 'name', rowNode: enterpriseNode })?.text);
    expect(host.querySelector('.og-acell')?.getAttribute('data-note')).toBe('hello');
    enterprise.destroy();
    api.destroy();
  });
});
