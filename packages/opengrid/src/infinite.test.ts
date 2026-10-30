import { AllCommunityModule, ModuleRegistry, createGrid as createAgGrid } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid, type GridApi, type IGetRowsParams } from './index';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Row {
  id: string;
  name: string;
}

const all: Row[] = Array.from({ length: 25 }, (_, index) => ({ id: String(index), name: `n${index}` }));

function callsOf() {
  const calls: { start: number; end: number; sort: unknown; filter: unknown }[] = [];
  const getRows = (params: IGetRowsParams<Row>) => {
    calls.push({ start: params.startRow, end: params.endRow, sort: params.sortModel, filter: params.filterModel });
    const rows = all.slice(params.startRow, params.endRow);
    params.successCallback(rows, params.endRow >= all.length ? all.length : undefined);
  };
  return { calls, getRows };
}

function mount(create: (host: HTMLElement, options: object) => GridApi<Row>) {
  const host = document.createElement('div');
  host.style.width = '800px';
  host.style.height = '200px';
  document.body.appendChild(host);
  const { calls, getRows } = callsOf();
  const api = create(host, {
    columnDefs: [{ field: 'id' }, { field: 'name', sortable: true, filter: true }],
    rowModelType: 'infinite',
    cacheBlockSize: 10,
    infiniteInitialRowCount: 10,
    rowHeight: 28,
    datasource: { getRows },
    getRowId: (params: { data: Row }) => params.data.id,
  });
  return { api, calls };
}

function picture(api: GridApi<Row>) {
  return {
    count: api.getDisplayedRowCount(),
    known: api.isLastRowIndexKnown(),
    infinite: api.getInfiniteRowCount(),
    id0: api.getDisplayedRowAtIndex(0)?.id,
    id9: api.getDisplayedRowAtIndex(9)?.id,
    id10: api.getDisplayedRowAtIndex(10)?.id,
    placeholder: api.getDisplayedRowAtIndex(api.getDisplayedRowCount() - 1)?.data,
  };
}

describe('infinite row model', () => {
  it('loads the same blocks as ag-grid and refetches on sort', async () => {
    const ag = mount(createAgGrid as (host: HTMLElement, options: object) => GridApi<Row>);
    const og = mount(createOpenGrid);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(og.calls, 'initial blocks').toEqual(ag.calls);
    expect(picture(og.api)).toEqual(picture(ag.api));

    ag.api.applyColumnState({ state: [{ colId: 'name', sort: 'asc' }], defaultState: { sort: null } });
    og.api.applyColumnState({ state: [{ colId: 'name', sort: 'asc' }], defaultState: { sort: null } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(og.calls.filter((call) => Array.isArray(call.sort) && (call.sort as { sort?: string }[]).some((item) => item.sort === 'asc'))).toEqual(
      ag.calls.filter((call) => Array.isArray(call.sort) && (call.sort as { sort?: string }[]).some((item) => item.sort === 'asc')),
    );
    expect(picture(og.api), 'after sort').toEqual(picture(ag.api));

    ag.api.purgeInfiniteCache();
    og.api.purgeInfiniteCache();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(Object.keys(og.api.getCacheBlockState()).sort()).toEqual(Object.keys(ag.api.getCacheBlockState()).sort());
    expect(picture(og.api), 'after purge').toEqual(picture(ag.api));

    ag.api.destroy();
    og.api.destroy();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
});
