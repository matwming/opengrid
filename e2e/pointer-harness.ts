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
    probeChartMenu: () => Promise<unknown>;
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

const chartTypes = ['column', 'groupedColumn', 'stackedColumn', 'normalizedColumn', 'bar', 'groupedBar', 'stackedBar', 'normalizedBar', 'line', 'stackedLine', 'normalizedLine', 'scatter', 'bubble', 'pie', 'donut', 'doughnut', 'area', 'stackedArea', 'normalizedArea', 'histogram', 'radarLine', 'radarArea', 'nightingale', 'radialColumn', 'radialBar', 'sunburst', 'rangeBar', 'rangeArea', 'boxPlot', 'treemap', 'heatmap', 'waterfall', 'columnLineCombo', 'areaColumnCombo', 'funnel', 'coneFunnel', 'pyramid'] as const;

window.probeSurface = () => {
  const agHost = document.querySelector('#ag-surface') as HTMLElement;
  const ogHost = document.querySelector('#og-surface') as HTMLElement;
  const options = {
    columnDefs: [{ field: 'name' }, { field: 'qty' }],
    rowData: [{ name: 'Ada', qty: 4 }, { name: 'Bea', qty: 9 }, { name: 'Amy', qty: 3 }],
    enableAdvancedFilter: true,
    cellSelection: true,
    animateRows: false,
  };
  const ag = mount(createAgGrid, agHost, options);
  const og = mount(createOpenGrid, ogHost, options);
  const agChart = ag.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  if (agChart.chartElement) agHost.append(agChart.chartElement);
  og.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  const rows = Array.from({ length: 20_000 }, (_, index) => ({ qty: index }));
  const time = (create: typeof createAgGrid) => {
    const host = document.createElement('div');
    host.style.width = '400px';
    host.style.height = '200px';
    document.body.appendChild(host);
    const started = performance.now();
    const api = create(host, { columnDefs: [{ field: 'qty' }], rowData: rows, animateRows: false });
    const ms = Math.round(performance.now() - started);
    api.destroy();
    host.remove();
    return ms;
  };
  return {
    agTitles: [...agHost.querySelectorAll('[title]')].map((node) => node.getAttribute('title')).filter(Boolean),
    ogTitles: [...ogHost.querySelectorAll('.og-chart-menu button')].map((button) => button.title),
    agRange: ag.getCellRanges?.()?.length ?? 0,
    ogRange: og.getCellRanges?.()?.length ?? 0,
    agFilter: agHost.textContent?.includes('Enter a value') || agHost.textContent?.includes('Advanced Filter'),
    ogFilter: ogHost.querySelector('[aria-label="Enter a value..."]') instanceof HTMLInputElement,
    agMs: time(createAgGrid),
    ogMs: time(createOpenGrid),
  };
};

window.probeChartTypes = async () => {
  const host = document.querySelector('#ag-types') as HTMLElement;
  const ours = document.querySelector('#og-types') as HTMLElement;
  const options = {
    columnDefs: [
      { field: 'name', width: 80 },
      { field: 'qty', width: 80 },
      { field: 'bonus', width: 80 },
      { field: 'size', width: 80 },
      { field: 'trend', width: 80, cellRenderer: 'agSparklineCellRenderer', sparklineOptions: { type: 'area' } },
    ],
    rowData: [{ name: 'Ada', qty: 4, bonus: 1, size: 3, trend: [1, 3, 2] }, { name: 'Bea', qty: 9, bonus: 2, size: 5, trend: [4, 1] }],
    animateRows: false,
  };
  const api = mount(createAgGrid, host, options);
  const og = mount(createOpenGrid, ours, options);
  const charts: { chartType: string; series?: string; shape?: string | null; values?: string | null; error?: string }[] = [];
  for (const chartType of chartTypes) {
    try {
      const chart = api.createRangeChart({ chartType, cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty', 'bonus', 'size'] } });
      const series = (chart.chart?.getOptions?.() as { series?: { type?: string }[] } | undefined)?.series?.[0]?.type;
      chart.destroyChart();
      const drawn = og.createRangeChart({ chartType, cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty', 'bonus', 'size'] } });
      const panel = ours.querySelector('.og-chart');
      charts.push({ chartType, series, shape: panel?.getAttribute('data-shape'), values: panel?.getAttribute('data-series') });
      drawn.destroyChart();
    } catch (error) {
      charts.push({ chartType, error: String(error).slice(0, 100) });
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    charts,
    agArea: Boolean(host.querySelector('.ag-sparkline-wrapper')),
    ogArea: ours.querySelector('.og-spark')?.getAttribute('data-type'),
    agTrend: host.querySelector('.ag-cell[col-id="trend"]')?.innerHTML.slice(0, 180),
  };
};

function themeName(chart: { chart?: { getOptions?: () => { theme?: unknown } } }): string {
  const theme = chart.chart?.getOptions?.()?.theme;
  if (typeof theme === 'string') return theme;
  if (theme && typeof theme === 'object') {
    const record = theme as { name?: string; baseTheme?: unknown };
    if (typeof record.name === 'string') return record.name;
    if (typeof record.baseTheme === 'string') return record.baseTheme;
    return JSON.stringify(theme).slice(0, 180);
  }
  return '';
}

window.probeChartMenu = async () => {
  const agHost = document.querySelector('#ag-menu') as HTMLElement;
  const ogHost = document.querySelector('#og-menu') as HTMLElement;
  const options = {
    columnDefs: [{ field: 'name' }, { field: 'qty' }],
    rowData: [{ name: 'Ada', qty: 4 }, { name: 'Bea', qty: 9 }],
    cellSelection: true,
    animateRows: false,
  };
  const ag = mount(createAgGrid, agHost, options);
  const og = mount(createOpenGrid, ogHost, options);
  const agChart = ag.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  if (agChart.chartElement) agHost.append(agChart.chartElement);
  og.createRangeChart({ chartType: 'column', cellRange: { rowStartIndex: 0, rowEndIndex: 1, columns: ['name', 'qty'] } });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const menu = [...agHost.querySelectorAll('button')].find((button) => button.title === 'Menu' || button.getAttribute('aria-label') === 'Chart Menu');
  menu?.click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const agMenu = [...document.querySelectorAll('.ag-menu-option-text')].map((node) => node.textContent?.trim() ?? '');
  const edit = [...document.querySelectorAll('.ag-menu-option')].find((node) => node.textContent?.includes('Edit Chart'));
  edit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const agTabs = [...document.querySelectorAll('.ag-tab')].map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  const agCards = document.querySelectorAll('.ag-chart-settings-card-item').length;
  const cards = [...document.querySelectorAll('.ag-chart-settings-card-item')];
  cards[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  const agTheme = themeName(agChart);
  const formatTab = [...document.querySelectorAll('.ag-tab')].find((node) => node.textContent?.includes('Customize'));
  formatTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const agFormat = (document.querySelector('.ag-chart-format')?.textContent ?? document.body.textContent ?? '').replace(/\s+/g, ' ');
  const setupTab = [...document.querySelectorAll('.ag-tab')].find((node) => node.textContent?.includes('Set Up'));
  setupTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const agSetup = (document.querySelector('.ag-chart-data-wrapper')?.textContent ?? document.body.textContent ?? '').replace(/\s+/g, ' ');
  (ogHost.querySelector('[aria-label="Chart Menu"]') as HTMLButtonElement | null)?.click();
  (ogHost.querySelector('.og-chart-list button') as HTMLButtonElement | null)?.click();
  const ogTabs = [...ogHost.querySelectorAll('.og-chart-tabs button')].map((button) => button.textContent ?? '');
  const ogThemes = [...ogHost.querySelectorAll('.og-chart-theme button')].map((button) => button.textContent ?? '');
  (ogHost.querySelectorAll('.og-chart-theme button')[1] as HTMLButtonElement | undefined)?.click();
  (ogHost.querySelectorAll('.og-chart-tabs button')[1] as HTMLButtonElement | undefined)?.click();
  const title = ogHost.querySelector('[aria-label="Chart Title"]') as HTMLInputElement | null;
  if (title) {
    title.value = 'Sales';
    title.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return {
    agMenu,
    agTabs,
    agCards,
    agTheme,
    agFormat,
    agSetup,
    ogTabs,
    ogThemes,
    ogTheme: ogHost.querySelector('.og-chart')?.getAttribute('data-theme'),
    ogFormat: ogHost.querySelector('.og-chart-format')?.textContent ?? '',
    ogSetup: ogHost.querySelector('.og-chart-data')?.textContent ?? '',
    ogTitle: ogHost.querySelector('.og-chart-title')?.textContent ?? '',
    classes: [...document.querySelectorAll('[class]')].map((node) => String(node.className)).filter((name) => /ag-chart|ag-tab|ag-group-title/.test(name)).slice(0, 40),
  };
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
