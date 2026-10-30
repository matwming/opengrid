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
  });
});
