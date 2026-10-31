import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { describe, expect, it } from 'vitest';
import { createGrid as createOpenGrid } from './index';

ModuleRegistry.registerModules([AllEnterpriseModule]);

function host(height = '240px') {
  const element = document.createElement('div');
  element.style.width = '640px';
  element.style.height = height;
  document.body.appendChild(element);
  return element;
}

describe('enterprise parity', () => {
  it('copies the same line breaks and writes the same total row label', () => {
    const options = {
      columnDefs: [{ field: 'name' }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 1 }, { name: 'Bea', qty: 2 }],
      cellSelection: true,
      processCellForClipboard: ({ value }: { value: string }) => String(value).toUpperCase(),
      statusBar: { statusPanels: [{ statusPanel: 'agTotalRowCountComponent' }, { statusPanel: 'agTotalAndFilteredRowCountComponent' }] },
      animateRows: false,
    };
    let enterpriseCopied = '';
    let ourCopied = '';
    const enterpriseHost = host();
    const enterprise = createAgGrid(enterpriseHost, { ...options, sendToClipboard: ({ data }: { data: string }) => { enterpriseCopied = data; } });
    const ourHost = host();
    const ours = createOpenGrid(ourHost, { ...options, sendToClipboard: ({ data }: { data: string }) => { ourCopied = data; } });
    enterprise.addCellRange({ rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] });
    ours.addCellRange({ rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] });
    enterprise.copySelectedRangeToClipboard();
    ours.copySelectedRangeToClipboard();
    expect(ourCopied).toBe(enterpriseCopied);
    expect(ourHost.querySelector('.og-status')?.textContent).toBe(enterpriseHost.querySelector('.ag-status-bar')?.textContent?.replace(/\s+/g, ' ').trim());
    enterprise.destroy();
    ours.destroy();
  });

  it('expands a detail row with the enterprise id', async () => {
    const options = {
      columnDefs: [{ field: 'id' }, { field: 'name' }],
      rowData: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }],
      masterDetail: true,
      isRowMaster: (data: { id: string }) => data.id === 'a',
      animateRows: false,
    };
    const enterprise = createAgGrid(host(), options);
    const ours = createOpenGrid(host(), options);
    enterprise.getDisplayedRowAtIndex(0)?.setExpanded(true);
    ours.getDisplayedRowAtIndex(0)?.setExpanded(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const shape = (api: { getDisplayedRowCount: () => number; getDisplayedRowAtIndex: (index: number) => { id?: string | null; detail?: boolean } | undefined }) => {
      const middle = api.getDisplayedRowAtIndex(1);
      return { count: api.getDisplayedRowCount(), id: middle?.id, detail: middle?.detail };
    };
    expect(shape(ours)).toEqual(shape(enterprise));
    expect(shape(ours)).toEqual({ count: 3, id: 'detail_0', detail: true });
    enterprise.destroy();
    ours.destroy();
  });

  it('asks the server and the viewport for the same range', async () => {
    const serverOptions = {
      columnDefs: [{ field: 'name' }],
      rowModelType: 'serverSide' as const,
      cacheBlockSize: 2,
      animateRows: false,
    };
    const makeServer = (create: typeof createAgGrid) => {
      const starts: number[] = [];
      const api = create(host('120px'), {
        ...serverOptions,
        serverSideDatasource: {
          getRows: ({ request, success }: { request: { startRow: number; endRow: number }; success: (params: { rowData: { name: string }[]; rowCount: number }) => void }) => {
            starts.push(request.startRow);
            success({ rowData: [{ name: 'Ada' }, { name: 'Bea' }].slice(request.startRow, request.endRow), rowCount: 2 });
          },
        },
      });
      return { api, starts };
    };
    const enterpriseServer = makeServer(createAgGrid);
    const ourServer = makeServer(createOpenGrid);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ourServer.starts).toEqual(enterpriseServer.starts);
    expect(ourServer.api.getDisplayedRowAtIndex(0)?.data).toEqual(enterpriseServer.api.getDisplayedRowAtIndex(0)?.data);
    enterpriseServer.api.destroy();
    ourServer.api.destroy();
    const ranges = (create: typeof createAgGrid) => {
      const seen: [number, number][] = [];
      const api = create(host(), {
        columnDefs: [{ field: 'name' }],
        rowModelType: 'viewport' as const,
        rowHeight: 36,
        animateRows: false,
        viewportDatasource: {
          init: (params: { setRowCount: (count: number) => void; setRowData: (rows: Record<number, { name: string }>) => void }) => {
            params.setRowCount(4);
            params.setRowData({ 0: { name: 'Ada' }, 1: { name: 'Bea' } });
          },
          setViewportRange: (first: number, last: number) => seen.push([first, last]),
        },
      });
      return { api, seen };
    };
    const enterpriseView = ranges(createAgGrid);
    const ourView = ranges(createOpenGrid);
    expect(ourView.seen[0]).toEqual(enterpriseView.seen[0]);
    expect(ourView.seen[0]).toEqual([0, 3]);
    expect(ourView.api.getDisplayedRowAtIndex(0)?.data).toEqual(enterpriseView.api.getDisplayedRowAtIndex(0)?.data);
    enterpriseView.api.destroy();
    ourView.api.destroy();
  });

  it('lists Columns and Filters and exports a workbook that contains Ada', async () => {
    const options = {
      columnDefs: [{ field: 'name', filter: true }, { field: 'qty' }],
      rowData: [{ name: 'Ada', qty: 4 }],
      sideBar: true,
      animateRows: false,
    };
    const enterpriseHost = host();
    const enterprise = createAgGrid(enterpriseHost, options);
    const ourHost = host();
    const ours = createOpenGrid(ourHost, options);
    const enterpriseTabs = [...enterpriseHost.querySelectorAll('.ag-side-button')].map((node) => node.textContent?.trim());
    const ourTabs = [...ourHost.querySelectorAll('.og-side-buttons button')].map((node) => node.textContent);
    expect(ourTabs).toEqual(enterpriseTabs);
    expect(ourTabs).toEqual(['Columns', 'Filters']);
    const enterpriseBook = new Uint8Array(await enterprise.getDataAsExcel().arrayBuffer());
    const ourBook = new Uint8Array(await ours.getDataAsExcel().arrayBuffer());
    expect(ourBook[0]).toBe(enterpriseBook[0]);
    expect(new TextDecoder().decode(ourBook).includes('Ada')).toBe(new TextDecoder().decode(enterpriseBook).includes('Ada'));
    enterprise.destroy();
    ours.destroy();
  });
});
