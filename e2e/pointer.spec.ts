import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test.beforeAll(() => {
  execFileSync('npx', ['esbuild', 'e2e/pointer-harness.ts', '--bundle', '--format=iife', '--outfile=e2e/pointer-harness.js', '--platform=browser'], { stdio: 'inherit' });
});

test('fill, row drag, chart, and sparkline match enterprise in Chromium', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head></head><body>
    <div id="ag-fill" class="ag-theme-quartz" style="width:420px;height:220px"></div>
    <div id="og-fill" style="width:420px;height:220px"></div>
    <div id="ag-drag" class="ag-theme-quartz" style="width:320px;height:260px"></div>
    <div id="og-drag" style="width:320px;height:260px"></div>
    <div id="ag-chart" class="ag-theme-quartz" style="width:480px;height:220px"></div>
    <div id="ag-types" class="ag-theme-quartz" style="width:480px;height:180px"></div>
    <div id="og-types" style="width:480px;height:180px"></div>
    <div id="ag-surface" class="ag-theme-quartz" style="width:520px;height:240px"></div>
    <div id="og-surface" style="width:520px;height:240px"></div>
    <div id="og-chart" style="width:480px;height:220px"></div>
  </body></html>`);
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-grid.css' });
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-theme-quartz.css' });
  await page.addStyleTag({ path: 'packages/opengrid/src/theme.css' });
  await page.addScriptTag({ path: 'e2e/pointer-harness.js' });
  const setup = await page.evaluate(() => (window as unknown as { probeSetup: () => {
    agHandle: { x: number; y: number } | null;
    ogHandle: { x: number; y: number } | null;
    agDrag: { x: number; y: number } | null;
    ogDrag: { x: number; y: number; w: number; h: number } | null;
  } }).probeSetup());
  const drag = async (from: { x: number; y: number }, dy: number) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + dy, { steps: 12 });
    await page.mouse.up();
  };
  if (setup.agHandle) await drag(setup.agHandle, 84);
  if (setup.ogHandle) await drag(setup.ogHandle, 84);
  if (setup.agDrag) await drag(setup.agDrag, 84);
  await page.locator('#og-drag .og-viewport').scrollIntoViewIfNeeded();
  const ogBox = await page.locator('#og-drag .og-viewport').boundingBox();
  if (ogBox) await drag({ x: ogBox.x + 8, y: ogBox.y + 21 }, 84);
  const read = await page.evaluate(() => (window as unknown as { probeRead: () => unknown }).probeRead());
  await page.evaluate(() => (window as unknown as { probeChart: () => unknown }).probeChart());
  await page.waitForTimeout(600);
  const chart = await page.evaluate(() => (window as unknown as { probeChartRead: () => unknown }).probeChartRead());
  const rows = read as { agQty: number[]; ogQty: number[]; agRange: number; ogRange: number; agIds: string[]; ogIds: string[]; agDragOver: number; ogDragOver: number };
  expect(rows.ogQty).toEqual(rows.agQty);
  expect(rows.ogQty).toEqual([4, 4, 4]);
  expect(rows.ogRange).toBe(rows.agRange);
  expect(rows.ogRange).toBe(2);
  expect(rows.ogIds).toEqual(rows.agIds);
  expect(rows.ogIds).toEqual(['b', 'c', 'a', 'd']);
  expect(rows.ogDragOver).toBe(rows.agDragOver);
  expect(rows.ogDragOver).toBe(2);
  const drawn = chart as { series: { yKey: string }[]; ogSeries: string; ogBars: number; ogSpark: string; ogSparkType: string; sparkline: boolean; canvases: number };
  expect(drawn.series[0]?.yKey).toBe('qty');
  expect(drawn.ogSeries).toBe('4,9');
  expect(drawn.ogBars).toBe(2);
  expect(drawn.canvases).toBeGreaterThan(0);
  expect(drawn.sparkline).toBe(true);
  expect(drawn.ogSpark).toBe('1,3,2');
  expect(drawn.ogSparkType).toBe('line');
});

test('chart types and area sparklines match enterprise', async ({ page }) => {
  await page.setContent(`<div id="ag-types" class="ag-theme-quartz" style="width:480px;height:180px"></div><div id="og-types" style="width:480px;height:180px"></div>`);
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-grid.css' });
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-theme-quartz.css' });
  await page.addStyleTag({ path: 'packages/opengrid/src/theme.css' });
  await page.addScriptTag({ path: 'e2e/pointer-harness.js' });
  const result = await page.evaluate(() => (window as unknown as { probeChartTypes: () => { charts: { chartType: string; series?: string; shape?: string | null; values?: string | null; error?: string }[]; agArea: boolean; ogArea: string | null } }).probeChartTypes());
  const wanted = ['line', 'area', 'pie', 'scatter', 'bar', 'donut', 'histogram'];
  for (const chartType of wanted) {
    const row = result.charts.find((item) => item.chartType === chartType);
    expect(row?.error).toBeUndefined();
    expect(row?.shape).toBe(row?.series);
    expect(row?.values).toBe('4,9');
  }
  expect(result.charts.filter((item) => item.series).every((item) => item.shape === item.series)).toBe(true);
  expect(result.agArea).toBe(true);
  expect(result.ogArea).toBe('area');
});

test('chart theme and format panels match enterprise', async ({ page }) => {
  await page.setContent(`<div id="ag-menu" class="ag-theme-quartz" style="width:640px;height:280px"></div><div id="og-menu" style="width:640px;height:280px"></div>`);
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-grid.css' });
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-theme-quartz.css' });
  await page.addStyleTag({ path: 'packages/opengrid/src/theme.css' });
  await page.addScriptTag({ path: 'e2e/pointer-harness.js' });
  const menu = await page.evaluate(() => (window as unknown as { probeChartMenu: () => Promise<{
    agMenu: string[];
    agTabs: string[];
    agCards: number;
    agTheme: string;
    agFormat: string;
    agSetup: string;
    ogTabs: string[];
    ogThemes: string[];
    ogTheme: string | null;
    ogFormat: string;
    ogSetup: string;
    ogTitle: string;
    classes: string[];
  }> }).probeChartMenu());
  console.log(JSON.stringify(menu));
  expect(menu.agMenu).toEqual(expect.arrayContaining(['Edit Chart']));
  expect(menu.agTabs).toEqual(expect.arrayContaining(['Chart', 'Set Up', 'Customize']));
  expect(menu.ogTabs).toEqual(['Chart', 'Set Up', 'Customize']);
  expect(menu.agCards).toBe(5);
  expect(menu.ogThemes).toEqual(['ag-default', 'ag-material', 'ag-sheets', 'ag-polychroma', 'ag-vivid']);
  expect(menu.agFormat).toContain('Titles');
  expect(menu.agFormat).toContain('Legend');
  expect(menu.ogFormat).toContain('Titles');
  expect(menu.ogFormat).toContain('Legend');
  expect(menu.agFormat).toContain('Horizontal Axis');
  expect(menu.agFormat).toContain('Series');
  expect(menu.agFormat).toContain('Font');
  expect(menu.ogFormat).toContain('Horizontal Axis');
  expect(menu.ogFormat).toContain('Vertical Axis');
  expect(menu.ogFormat).toContain('Series');
  expect(menu.ogFormat).toContain('Font');
  expect(menu.agFormat).toContain('Grid Lines');
  expect(menu.agFormat).toContain('Ticks');
  expect(menu.agFormat).toContain('Rotation');
  expect(menu.ogFormat).toContain('Grid Lines');
  expect(menu.ogFormat).toContain('Ticks');
  expect(menu.ogFormat).toContain('Rotation');
  expect(menu.agFormat).toContain('Line Dash');
  expect(menu.agFormat).toContain('Padding');
  expect(menu.ogFormat).toContain('Line Dash');
  expect(menu.ogFormat).toContain('Color');
  expect(menu.ogFormat).toContain('Padding');
  expect(menu.agFormat).toContain('Shadow');
  expect(menu.agFormat).toContain('Blur');
  expect(menu.ogFormat).toContain('Markers');
  expect(menu.ogFormat).toContain('Shadow');
  expect(menu.ogFormat).toContain('Gradient');
  expect(menu.agSetup).toContain('Reverse');
  expect(menu.ogSetup).toContain('Reverse');
  expect(menu.agSetup).toContain('Aggregate');
  expect(menu.agSetup).toContain('Direction');
  expect(menu.agSetup).toContain('Group Type');
  expect(menu.ogSetup).toContain('Aggregate');
  expect(menu.ogSetup).toContain('Direction');
  expect(menu.ogSetup).toContain('Group Type');
  expect(menu.agSetup).toContain('Categories');
  expect(menu.agSetup).toContain('Switch Category / Series');
  expect(menu.ogSetup).toContain('Categories');
  expect(menu.ogSetup).toContain('Switch Category / Series');
  expect(menu.ogTitle).toBe('Sales');
  expect(menu.ogTheme).toBe('ag-material');
  expect(menu.agTheme).toContain('ag-material');
});

test('chart toolbar, grid link, and advanced filter builder', async ({ page }) => {
  await page.setContent(`<div id="ag-surface" class="ag-theme-quartz" style="width:520px;height:240px"></div><div id="og-surface" style="width:520px;height:240px"></div>`);
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-grid.css' });
  await page.addStyleTag({ path: 'node_modules/ag-grid-community/styles/ag-theme-quartz.css' });
  await page.addStyleTag({ path: 'packages/opengrid/src/theme.css' });
  await page.addScriptTag({ path: 'e2e/pointer-harness.js' });
  const surface = await page.evaluate(() => (window as unknown as { probeSurface: () => { agTitles: string[]; ogTitles: string[]; agRange: number; ogRange: number; agFilter: boolean; ogFilter: boolean; agMs: number; ogMs: number } }).probeSurface());
  console.log(JSON.stringify(surface));
  expect(surface.ogTitles).toEqual(expect.arrayContaining(['Linked to Grid', 'Download Chart']));
  expect(surface.ogRange).toBeGreaterThan(0);
  expect(surface.agRange).toBeGreaterThan(0);
  expect(surface.ogFilter).toBe(true);
  await page.locator('#og-surface .og-chart rect').nth(1).click();
  const focused = await page.evaluate(() => (document.querySelector('#og-surface .og-root') as HTMLElement | null)?.getAttribute('aria-activedescendant') ?? '');
  expect(focused).toContain('-r1-');
});
