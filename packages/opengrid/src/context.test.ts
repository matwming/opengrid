import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const labels = ['Cut', 'Copy', 'Copy with Headers', 'Copy with Group Headers', 'Paste', 'Export'];

describe('context menu', () => {
  it('shows the same items as enterprise and copies the cell', () => {
    const enterpriseHost = document.createElement('div');
    enterpriseHost.style.width = '640px';
    enterpriseHost.style.height = '240px';
    document.body.appendChild(enterpriseHost);
    const enterprise = createAgGrid(enterpriseHost, {
      columnDefs: [{ field: 'name' }],
      rowData: [{ name: 'Ada' }],
      animateRows: false,
    });
    enterpriseHost.querySelector('.ag-cell')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30, button: 2 }));
    const enterpriseItems = [...document.querySelectorAll('.ag-menu-option-text')].map((node) => node.textContent);
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    let copied = '';
    const api = createOpenGrid(host, {
      columnDefs: [{ field: 'name', width: 120 }],
      rowData: [{ name: 'Ada' }],
      sendToClipboard: ({ data }) => {
        copied = data;
      },
    });
    const viewport = host.querySelector('.og-viewport');
    if (!(viewport instanceof HTMLElement)) throw new Error('missing viewport');
    viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 640, height: 240, right: 640, bottom: 240, toJSON: () => ({}) });
    viewport.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 8, button: 2 }));
    const ourItems = [...host.querySelectorAll('.og-context-item')].map((node) => node.textContent);
    expect(ourItems).toEqual(enterpriseItems);
    expect(ourItems).toEqual(labels);
    host.querySelectorAll('.og-context-item')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(copied).toBe('Ada');
    enterprise.destroy();
    api.destroy();
  });
});
