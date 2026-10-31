import { describe, expect, it } from 'vitest';
import { createGrid } from './index';

describe('chart menu', () => {
  it('switches theme, title, and legend from the chart menu', () => {
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const api = createGrid(host, {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 4 }, { name: 'Bea', qty: 9 }],
      chartThemes: ['ag-default', 'ag-vivid'],
    });
    api.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
    const panel = host.querySelector('.og-chart');
    expect(panel?.getAttribute('data-theme')).toBe('ag-default');
    expect(panel?.querySelector('.og-chart-panels')?.hasAttribute('hidden')).toBe(true);
    (host.querySelector('[aria-label="Chart Menu"]') as HTMLButtonElement).click();
    (host.querySelector('.og-chart-list button') as HTMLButtonElement).click();
    expect(panel?.querySelector('.og-chart-panels')?.hasAttribute('hidden')).toBe(false);
    const tabs = [...host.querySelectorAll('.og-chart-tabs button')].map((button) => button.textContent);
    expect(tabs).toEqual(['Chart', 'Customize']);
    const themes = [...host.querySelectorAll('.og-chart-theme button')].map((button) => button.textContent);
    expect(themes).toEqual(['ag-default', 'ag-vivid']);
    (host.querySelectorAll('.og-chart-theme button')[1] as HTMLButtonElement).click();
    expect(panel?.getAttribute('data-theme')).toBe('ag-vivid');
    expect(host.querySelector('.og-chart rect')?.getAttribute('fill')).toBe('#ef6c00');
    (host.querySelectorAll('.og-chart-tabs button')[1] as HTMLButtonElement).click();
    const format = host.querySelector('.og-chart-format')?.textContent ?? '';
    expect(format).toContain('Titles');
    expect(format).toContain('Legend');
    const title = host.querySelector('[aria-label="Chart Title"]') as HTMLInputElement;
    title.value = 'Sales';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelector('.og-chart-title')?.textContent).toBe('Sales');
    expect(host.querySelector('.og-chart-legend')?.textContent).toBe('Ada, Bea');
    (host.querySelector('[aria-label="Enabled"]') as HTMLInputElement).click();
    expect(panel?.getAttribute('data-legend')).toBe('false');
    expect(host.querySelector('.og-chart-legend')?.hasAttribute('hidden')).toBe(true);
    api.destroy();
  });
});
