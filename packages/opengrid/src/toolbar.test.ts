import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function mount(create: typeof createAgGrid) {
  const element = document.createElement('div');
  element.style.width = '640px';
  element.style.height = '240px';
  document.body.appendChild(element);
  let clicked = 0;
  const api = create(element, {
    columnDefs: [{ field: 'name' }, { field: 'city' }],
    rowData: [{ name: 'Ada', city: 'London' }, { name: 'Zoe', city: 'Paris' }],
    animateRows: false,
    toolbar: {
      items: [
        { label: 'Export', action: () => { clicked += 1; } },
        'separator',
        { toolbarItem: 'agQuickFilterToolbarItem' },
        { toolbarItem: 'agFindToolbarItem' },
        { toolbarItem: 'agRowGroupPanelToolbarItem' },
      ],
    },
  });
  return { element, api, clicked: () => clicked };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('toolbar', () => {
  it('matches the enterprise button, filters, find count, and group placeholder', async () => {
    const enterprise = mount(createAgGrid);
    const ours = mount(createOpenGrid);
    const read = (element: HTMLElement) => {
      const toolbar = element.querySelector('.ag-toolbar, .og-toolbar') as HTMLElement;
      const inputs = [...toolbar.querySelectorAll('input')];
      const next = [...toolbar.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Next Match');
      return {
        label: toolbar.querySelector('.ag-toolbar-button-label, .og-toolbar-button-label')?.textContent,
        placeholders: inputs.map((input) => input.placeholder),
        labels: inputs.map((input) => input.getAttribute('aria-label')),
        panel: toolbar.querySelector('.ag-toolbar-panel, .og-toolbar-panel')?.textContent,
        count: toolbar.querySelector('.ag-toolbar-find-match-count, .og-find-count')?.textContent,
        rows: element === enterprise.element ? enterprise.api.getDisplayedRowCount() : ours.api.getDisplayedRowCount(),
        next,
      };
    };
    (enterprise.element.querySelector('.ag-toolbar-button') as HTMLButtonElement).click();
    (ours.element.querySelector('.og-toolbar-button') as HTMLButtonElement).click();
    expect(enterprise.clicked()).toBe(ours.clicked());
    const enterpriseInputs = [...enterprise.element.querySelectorAll<HTMLInputElement>('.ag-toolbar input')];
    const ourInputs = [...ours.element.querySelectorAll<HTMLInputElement>('.og-toolbar input')];
    type(enterpriseInputs[0]!, 'zoe');
    type(ourInputs[0]!, 'zoe');
    type(enterpriseInputs[1]!, 'ada');
    type(ourInputs[1]!, 'ada');
    await new Promise((resolve) => setTimeout(resolve, 350));
    const enterpriseNow = read(enterprise.element);
    const oursNow = read(ours.element);
    expect(oursNow.label).toBe(enterpriseNow.label);
    expect(oursNow.placeholders).toEqual(enterpriseNow.placeholders);
    expect(oursNow.labels).toEqual(enterpriseNow.labels);
    expect(oursNow.panel).toBe(enterpriseNow.panel);
    expect(oursNow.rows).toBe(enterpriseNow.rows);
    expect(oursNow.count).toBe(enterpriseNow.count);
    enterpriseNow.next?.click();
    oursNow.next?.click();
    expect(read(ours.element).count).toBe(read(enterprise.element).count);
    enterprise.api.destroy();
    ours.api.destroy();
  });
});
