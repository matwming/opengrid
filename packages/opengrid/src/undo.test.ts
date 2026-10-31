import { createGrid as createAgGrid } from 'ag-grid-community';
import { AllEnterpriseModule, ModuleRegistry } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

describe('undo cell editing', () => {
  it('undoes and redoes a cell edit the same way as enterprise', () => {
    const make = () => {
      const host = document.createElement('div');
      host.style.width = '640px';
      host.style.height = '200px';
      document.body.appendChild(host);
      return host;
    };
    const options = {
      columnDefs: [{ field: 'name', editable: true }],
      rowData: [{ name: 'Ada' }],
      undoRedoCellEditing: true,
      animateRows: false,
    };
    const enterprise = createAgGrid(make(), options);
    const ours = createOpenGrid(make(), options);
    enterprise.getDisplayedRowAtIndex(0)?.setDataValue('name', 'Zoe');
    ours.getDisplayedRowAtIndex(0)?.setDataValue('name', 'Zoe');
    enterprise.undoCellEditing();
    ours.undoCellEditing();
    expect(ours.getDisplayedRowAtIndex(0)?.data).toEqual(enterprise.getDisplayedRowAtIndex(0)?.data);
    enterprise.redoCellEditing();
    ours.redoCellEditing();
    expect(ours.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Zoe' });
    expect(enterprise.getDisplayedRowAtIndex(0)?.data).toEqual({ name: 'Zoe' });
    enterprise.destroy();
    ours.destroy();
  });
});
