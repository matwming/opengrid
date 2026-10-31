import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function memory() {
  const notes = new Map<string, { text: string; author?: string; updatedAt?: string }>();
  return {
    getNote(params: { column: { getColId: () => string }; rowNode: { id?: string | null } }) {
      return notes.get(`${params.rowNode.id}:${params.column.getColId()}`);
    },
    setNote(params: { column: { getColId: () => string }; rowNode: { id?: string | null }; note?: { text: string; author?: string; updatedAt?: string } }) {
      const key = `${params.rowNode.id}:${params.column.getColId()}`;
      if (!params.note) notes.delete(key);
      else notes.set(key, params.note);
    },
  };
}

describe('note edit', () => {
  it('writes the edited note back like enterprise', async () => {
    const options = {
      columnDefs: [{ field: 'name', editable: true }],
      rowData: [{ name: 'Ada' }],
      getRowId: (params: { data: { name: string } }) => params.data.name,
      noteTrigger: 'click' as const,
      noteHideDelay: 0,
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
    const note = { text: 'hello', author: 'Ada', updatedAt: '2020-01-02' };
    enterprise.setNote({ column: 'name', rowNode: enterprise.getDisplayedRowAtIndex(0)!, note });
    api.setNote({ column: 'name', rowNode: api.getDisplayedRowAtIndex(0)!, note });
    (enterpriseHost.querySelector('.ag-cell') as HTMLElement).click();
    (host.querySelector('.og-acell') as HTMLElement).click();
    const enterpriseEditor = document.body.querySelector('.ag-notes-popup textarea') as HTMLTextAreaElement;
    const editor = document.body.querySelector('.og-notes textarea') as HTMLTextAreaElement;
    enterpriseEditor.value = 'there';
    enterpriseEditor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.value = 'there';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    const leave = new PointerEvent('pointerleave', { bubbles: true, pointerType: 'mouse' });
    (enterpriseHost.querySelector('.ag-cell') as HTMLElement).dispatchEvent(leave);
    (host.querySelector('.og-acell') as HTMLElement).dispatchEvent(leave);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const read = (grid: { getNote: (params: { column: string; rowNode: { id?: string | null } }) => { text?: string; author?: string; updatedAt?: string } | undefined; getDisplayedRowAtIndex: (index: number) => { id?: string | null } | undefined }) => {
      const row = grid.getDisplayedRowAtIndex(0);
      return row ? grid.getNote({ column: 'name', rowNode: row }) : undefined;
    };
    expect(read(api)?.text).toBe('there');
    expect(read(api)?.author).toBe(read(enterprise)?.author);
    expect(read(enterprise)?.text).toBe(read(api)?.text);
    enterprise.destroy();
    api.destroy();
  });
});
