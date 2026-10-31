import { describe, expect, it } from 'vitest';
import { AgGridAngular } from './index';

describe('AgGridAngular', () => {
  it('creates the grid from inputs and applies a later rowData change', () => {
    const host = document.createElement('div');
    host.style.width = '480px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const grid = new AgGridAngular<{ id: string }>();
    grid.hostElement = host;
    grid.columnDefs = [{ field: 'id' }];
    grid.rowData = [{ id: 'a' }, { id: 'b' }];
    const counts: number[] = [];
    grid.gridReady.subscribe((event) => counts.push(event.api.getDisplayedRowCount()));
    grid.ngAfterViewInit();
    expect(counts).toEqual([2]);
    expect(grid.api?.getDisplayedRowAtIndex(0)?.data).toMatchObject({ id: 'a' });

    grid.rowData = [{ id: 'c' }];
    grid.ngOnChanges({
      rowData: {
        previousValue: [{ id: 'a' }, { id: 'b' }],
        currentValue: grid.rowData,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(grid.api?.getDisplayedRowCount()).toBe(1);
    expect(grid.api?.getDisplayedRowAtIndex(0)?.data).toMatchObject({ id: 'c' });
    grid.ngOnDestroy();

    class NameCell {
      private el = document.createElement('span');
      agInit(params: { value?: unknown }): void {
        this.el.className = 'ng-cell';
        this.el.textContent = String(params.value ?? '');
      }
      getGui(): HTMLElement {
        return this.el;
      }
    }
    const cellHost = document.createElement('div');
    cellHost.style.width = '400px';
    cellHost.style.height = '200px';
    document.body.appendChild(cellHost);
    const cells = new AgGridAngular<{ name: string }>();
    cells.hostElement = cellHost;
    cells.columnDefs = [{ field: 'name', cellRenderer: NameCell }];
    cells.rowData = [{ name: 'Ada' }];
    cells.ngAfterViewInit();
    expect(cellHost.querySelector('.ng-cell')?.textContent).toBe('Ada');
    cells.ngOnDestroy();
    grid.ngOnDestroy();
  });
});
