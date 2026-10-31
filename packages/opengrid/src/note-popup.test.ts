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

describe('note popup', () => {
  it('opens the same note text and author line as enterprise', async () => {
    const options = {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }],
      getRowId: (params: { data: { name: string } }) => params.data.name,
      noteTrigger: 'click' as const,
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
    await new Promise((resolve) => setTimeout(resolve, 20));
    const enterprisePopup = document.body.querySelector('.ag-notes-popup');
    const popup = document.body.querySelector('.og-notes');
    expect(popup?.querySelector('.og-notes-meta')?.textContent).toBe(enterprisePopup?.querySelector('.ag-notes-popup-meta')?.textContent);
    expect((popup?.querySelector('textarea') as HTMLTextAreaElement).value).toBe((enterprisePopup?.querySelector('textarea') as HTMLTextAreaElement).value);
    expect(popup?.querySelector('.og-notes-meta')?.textContent).toBe('Ada · 2020-01-02');
    expect(host.querySelector('.og-has-note')).toBeTruthy();
    enterprise.destroy();
    api.destroy();
  });
});
