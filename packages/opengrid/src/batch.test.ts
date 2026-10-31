import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function run(create: typeof createAgGrid | typeof createOpenGrid) {
  const host = document.createElement('div');
  host.style.width = '400px';
  host.style.height = '200px';
  document.body.appendChild(host);
  const api = create(host, {
    columnDefs: [{ field: 'name', editable: true }],
    rowData: [{ name: 'Ada' }],
    animateRows: false,
  });
  api.startBatchEdit();
  api.getDisplayedRowAtIndex(0)?.setDataValue('name', 'Zoe');
  const during = JSON.stringify(api.getDisplayedRowAtIndex(0)?.data);
  const editing = api.isBatchEditing();
  api.cancelBatchEdit();
  const cancelled = JSON.stringify(api.getDisplayedRowAtIndex(0)?.data);
  api.startBatchEdit();
  api.getDisplayedRowAtIndex(0)?.setDataValue('name', 'Zoe');
  api.commitBatchEdit();
  const committed = JSON.stringify(api.getDisplayedRowAtIndex(0)?.data);
  api.destroy();
  return { during, editing, cancelled, committed };
}

describe('batch edit', () => {
  it('keeps the row unchanged until commit, matching enterprise', () => {
    const enterprise = run(createAgGrid);
    const ours = run(createOpenGrid);
    expect(ours).toEqual(enterprise);
    expect(ours).toEqual({ during: '{"name":"Ada"}', editing: true, cancelled: '{"name":"Ada"}', committed: '{"name":"Zoe"}' });
  });
});
