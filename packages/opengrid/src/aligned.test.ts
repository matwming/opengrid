import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function host() {
  const element = document.createElement('div');
  element.style.width = '640px';
  element.style.height = '240px';
  document.body.appendChild(element);
  return element;
}

function pair(create: typeof createAgGrid) {
  const columns = [
    { field: 'name', width: 200 },
    { field: 'city', width: 200 },
    { field: 'note', width: 400 },
  ];
  const rows = [{ name: 'Ada', city: 'London', note: 'note' }];
  const topHost = host();
  const bottomHost = host();
  let bottom: ReturnType<typeof createAgGrid>;
  const top = create(topHost, {
    columnDefs: columns,
    rowData: rows,
    alignedGrids: () => [bottom],
    animateRows: false,
  });
  bottom = create(bottomHost, {
    columnDefs: columns,
    rowData: rows,
    alignedGrids: () => [top],
    animateRows: false,
  });
  return { topHost, bottomHost, top, bottom };
}

function setScroll(element: HTMLElement, value: number): number {
  const node = element.querySelector('.ag-body-horizontal-scroll-viewport, .og-viewport') as HTMLElement;
  node.scrollLeft = value;
  node.dispatchEvent(new Event('scroll'));
  const other = element.parentElement;
  void other;
  return node.scrollLeft;
}

function readScroll(element: HTMLElement): number {
  const node = element.querySelector('.ag-body-horizontal-scroll-viewport, .og-viewport') as HTMLElement;
  return node.scrollLeft;
}

describe('aligned grids', () => {
  it('keeps horizontal scroll, width, order, and visibility together', () => {
    const enterprise = pair(createAgGrid);
    const ours = pair(createOpenGrid);
    setScroll(enterprise.topHost, 80);
    setScroll(ours.topHost, 80);
    expect(readScroll(ours.bottomHost)).toBe(readScroll(enterprise.bottomHost));
    expect(readScroll(ours.bottomHost)).toBe(80);
    enterprise.top.setColumnWidths([{ key: 'name', newWidth: 260 }]);
    ours.top.setColumnWidths([{ key: 'name', newWidth: 260 }]);
    enterprise.top.moveColumns(['city'], 0);
    ours.top.moveColumns(['city'], 0);
    enterprise.top.setColumnsVisible(['name'], false);
    ours.top.setColumnsVisible(['name'], false);
    const shape = (api: ReturnType<typeof createAgGrid>) => api.getColumnState().map((state) => `${state.colId}:${state.width}:${state.hide}`);
    expect(shape(ours.bottom)).toEqual(shape(enterprise.bottom));
    enterprise.top.destroy();
    enterprise.bottom.destroy();
    ours.top.destroy();
    ours.bottom.destroy();
  });
});
