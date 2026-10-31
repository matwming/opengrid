import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
import { createGrid as createAgGrid, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, IntegratedChartsModule, SparklinesModule } from 'ag-grid-enterprise';
import { createGrid as createOpenGrid } from '../packages/opengrid/src/index';

ModuleRegistry.registerModules([
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule),
  SparklinesModule.with(AgChartsEnterpriseModule),
]);

type GridApi = {
  addCellRange: (params: { rowStartIndex: number; rowEndIndex: number; columns: string[] }) => void;
  getCellRanges?: () => { endRow?: { rowIndex: number } }[] | null;
  getDisplayedRowAtIndex: (index: number) => { data?: { qty?: number; id?: string } } | undefined;
  forEachNode: (callback: (node: { data?: { id?: string } }) => void) => void;
  createRangeChart: (params: { chartType: string; cellRange: { rowStartIndex: number; rowEndIndex: number; columns: string[] } }) => { chart?: { getOptions?: () => unknown }; chartElement?: HTMLElement; destroyChart: () => void };
  destroy: () => void;
};

function box(node: Element | null) {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height, tag: node.className };
}

function mount(create: (host: HTMLElement, options: object) => GridApi, host: HTMLElement, options: object) {
  host.replaceChildren();
  return create(host, options);
}

const fillOptions = {
  columnDefs: [{ field: 'name', width: 140 }, { field: 'qty', width: 140 }],
  rowData: [
    { name: 'Ada', qty: 4 },
    { name: 'Bea', qty: 0 },
    { name: 'Cy', qty: 0 },
  ],
  rowHeight: 42,
  cellSelection: { handle: { mode: 'fill' } },
  animateRows: false,
};

const dragOptions = {
  columnDefs: [{ field: 'id', rowDrag: true, width: 180 }],
  rowData: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
  rowDragManaged: true,
  rowHeight: 42,
  getRowId: (params: { data: { id: string } }) => params.data.id,
  animateRows: false,
};

function ids(api: GridApi) {
  const out: string[] = [];
  api.forEachNode((node) => {
    if (node.data?.id) out.push(node.data.id);
  });
  return out;
}

function qtys(api: GridApi) {
  return [0, 1, 2].map((index) => api.getDisplayedRowAtIndex(index)?.data?.qty);
}

declare global {
  interface Window {
    probeSetup: () => unknown;
    probeRead: () => unknown;
    probeChart: () => unknown;
  }
}

let agFill: GridApi;
let ogFill: GridApi;
let agDrag: GridApi;
let ogDrag: GridApi;
let agDragOver: number | null = null;
let ogDragOver: number | null = null;

window.probeSetup = () => {
  const agFillHost = document.querySelector('#ag-fill') as HTMLElement;
  const ogFillHost = document.querySelector('#og-fill') as HTMLElement;
  const agDragHost = document.querySelector('#ag-drag') as HTMLElement;
  const ogDragHost = document.querySelector('#og-drag') as HTMLElement;
  agFill = mount(createAgGrid, agFillHost, fillOptions);
  ogFill = mount(createOpenGrid, ogFillHost, fillOptions);
  agFill.addCellRange({ rowStartIndex: 0, rowEndIndex: 0, columns: ['qty'] });
  ogFill.addCellRange({ rowStartIndex: 0, rowEndIndex: 0, columns: ['qty'] });
  agDrag = mount(createAgGrid, agDragHost, {
    ...dragOptions,
    onRowDragEnd: (event: { overIndex?: number }) => {
      agDragOver = event.overIndex ?? null;
    },
  });
  ogDrag = mount(createOpenGrid, ogDragHost, {
    ...dragOptions,
    onRowDragEnd: (event: { overIndex?: number }) => {
      ogDragOver = event.overIndex ?? null;
    },
  });
  const agCell = agFillHost.querySelector('.ag-cell[col-id="qty"]') as HTMLElement | null;
  const ogCell = ogFillHost.querySelector('.og-acell[data-col-id="qty"]') as HTMLElement | null;
  return {
    agHandle: box(agFillHost.querySelector('.ag-fill-handle')),
    ogHandle: box(ogFillHost.querySelector('.og-fill')),
    agCell: box(agCell),
    ogCell: box(ogCell),
    agDrag: box(agDragHost.querySelector('.ag-row-drag, .ag-drag-handle, .ag-icon-grip')),
    ogDrag: box(ogDragHost.querySelector('.og-viewport')),
    agClasses: [...agDragHost.querySelectorAll('[class]')].map((node) => String(node.className)).filter((name) => /drag|grip/i.test(name)).slice(0, 12),
  };
};

window.probeRead = () => ({
  agQty: qtys(agFill),
  ogQty: qtys(ogFill),
  agRange: agFill.getCellRanges?.()?.[0]?.endRow?.rowIndex,
  ogRange: ogFill.getCellRanges?.()?.[0]?.endRow?.rowIndex,
  agIds: ids(agDrag),
  ogIds: ids(ogDrag),
  agDragOver,
  ogDragOver,
});

window.probeChart = () => {
  const host = document.querySelector('#ag-chart') as HTMLElement;
  const ours = document.querySelector('#og-chart') as HTMLElement;
  const ag = mount(createAgGrid, host, {
    columnDefs: [
      { field: 'name', width: 120 },
      { field: 'qty', width: 120 },
      { field: 'trend', width: 140, cellRenderer: 'agSparklineCellRenderer' },
    ],
    rowData: [
      { name: 'Ada', qty: 4, trend: [1, 3, 2] },
      { name: 'Bea', qty: 9, trend: [4, 1] },
    ],
    animateRows: false,
  });
  const og = mount(createOpenGrid, ours, {
    columnDefs: [
      { field: 'name', width: 120 },
      { field: 'qty', width: 120 },
      { field: 'trend', width: 140, cellRenderer: 'agSparklineCellRenderer' },
    ],
    rowData: [
      { name: 'Ada', qty: 4, trend: [1, 3, 2] },
      { name: 'Bea', qty: 9, trend: [4, 1] },
    ],
    animateRows: false,
  });
  const chart = ag.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  const ogChart = og.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  if (chart.chartElement) host.append(chart.chartElement);
  (window as unknown as { __chartHosts: { host: HTMLElement; ours: HTMLElement; chart: typeof chart } }).__chartHosts = { host, ours, chart };
  return true;
};

window.probeChartRead = () => {
  const saved = (window as unknown as { __chartHosts: { host: HTMLElement; ours: HTMLElement; chart: { chart?: { getOptions?: () => { series?: Record<string, unknown>[] } }; chartElement?: HTMLElement } } }).__chartHosts;
  const { host, ours, chart } = saved;
  const options = chart.chart?.getOptions?.();
  const spark = host.querySelector('.ag-cell[col-id="trend"]');
  const firstSpark = ours.querySelector('.og-spark');
  return {
    series: options?.series?.map((item) => ({ keys: Object.keys(item), yKey: item.yKey, yName: item.yName })),
    chartTag: chart.chartElement?.tagName,
    canvases: host.querySelectorAll('canvas').length,
    sparkKids: spark ? [...spark.querySelectorAll('*')].slice(0, 10).map((node) => `${node.tagName}.${node.className}`) : [],
    sparkCanvas: document.querySelectorAll('canvas').length,
    ogSeries: ours.querySelector('.og-chart')?.getAttribute('data-series'),
    ogBars: ours.querySelectorAll('.og-chart rect').length,
    ogSpark: firstSpark?.getAttribute('data-values'),
    ogSparkType: firstSpark?.getAttribute('data-type'),
    sparkline: Boolean(spark?.querySelector('.ag-sparkline-wrapper')),
  };
};
