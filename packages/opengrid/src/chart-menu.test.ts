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
    expect(tabs).toEqual(['Chart', 'Set Up', 'Customize']);
    const themes = [...host.querySelectorAll('.og-chart-theme button')].map((button) => button.textContent);
    expect(themes).toEqual(['ag-default', 'ag-vivid']);
    (host.querySelectorAll('.og-chart-theme button')[1] as HTMLButtonElement).click();
    expect(panel?.getAttribute('data-theme')).toBe('ag-vivid');
    expect(host.querySelector('.og-chart rect')?.getAttribute('fill')).toBe('#ef6c00');
    (host.querySelectorAll('.og-chart-tabs button')[1] as HTMLButtonElement).click();
    const setup = host.querySelector('.og-chart-data')?.textContent ?? '';
    expect(setup).toContain('Categories');
    expect(setup).toContain('Series');
    expect(setup).toContain('Switch Category / Series');
    expect(setup).toContain('Name');
    expect(setup).toContain('Qty');
    (host.querySelector('[aria-label="Switch Category / Series"]') as HTMLInputElement).click();
    expect(panel?.getAttribute('data-series')).toBe('0,0');
    expect(panel?.getAttribute('data-category')).toBe('qty');
    (host.querySelector('[aria-label="Switch Category / Series"]') as HTMLInputElement).click();
    expect(panel?.getAttribute('data-series')).toBe('4,9');
    (host.querySelectorAll('.og-chart-tabs button')[2] as HTMLButtonElement).click();
    const format = host.querySelector('.og-chart-format')?.textContent ?? '';
    expect(format).toContain('Titles');
    expect(format).toContain('Legend');
    expect(format).toContain('Horizontal Axis');
    expect(format).toContain('Vertical Axis');
    expect(format).toContain('Series');
    expect(format).toContain('Font');
    (host.querySelectorAll('[aria-label="Axis Type"]')[0] as HTMLSelectElement).value = 'Number';
    (host.querySelectorAll('[aria-label="Axis Type"]')[0] as HTMLSelectElement).dispatchEvent(new Event('change', { bubbles: true }));
    expect(panel?.getAttribute('data-x-axis')).toBe('Number');
    const thickness = host.querySelector('[aria-label="Thickness"]') as HTMLInputElement;
    thickness.value = '4';
    thickness.dispatchEvent(new Event('input', { bubbles: true }));
    expect(host.querySelector('.og-chart rect')?.getAttribute('stroke-width')).toBe('4');
    const font = host.querySelector('[aria-label="Font"]') as HTMLInputElement;
    font.value = 'Georgia';
    font.dispatchEvent(new Event('input', { bubbles: true }));
    expect(panel?.getAttribute('data-font')).toBe('Georgia');
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
