import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type CDPSession, type Page } from '@playwright/test';

const rows = Number(process.env.BENCH_ROWS ?? '1000000');
const cols = Number(process.env.BENCH_COLS ?? '50');

interface ScrollSample {
  frames: number;
  elapsedMs: number;
  fps: number;
  p95Ms: number;
}

interface BenchController {
  prepare(rowCount: number, colCount: number): { prepareMs: number; rows: number; cols: number };
  mount(kind: 'opengrid' | 'ag'): Promise<{ firstRenderMs: number; sortReadyMs: number; copyMs: number; workerWaitMs: number; engine: string; isolated: boolean; rows: number }>;
  scroll(): Promise<ScrollSample>;
  sort(): Promise<{ ms: number; ordered: boolean; sample: Array<number | null>; computeMs: number }>;
  filter(): Promise<{ ms: number; count: number; sample: Array<number | null> }>;
  heap(): number | null;
  destroy(): void;
}

declare global {
  interface Window {
    __opengridBench: BenchController;
  }
}

test(`enterprise comparison ${rows} x ${cols}`, async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('/bench.html');
  await page.waitForFunction(() => Boolean(window.__opengridBench));
  const prepare = await page.evaluate(({ rowCount, colCount }) => window.__opengridBench.prepare(rowCount, colCount), { rowCount: rows, colCount: cols });

  const runs = [];
  for (let round = 0; round < 3; round++) {
    const opengrid = await measure(page, 'opengrid');
    const ag = await measure(page, 'ag');
    runs.push({ round, opengrid, ag });
  }
  const bundle = bundleSizes();
  const opengrid = medianRun(runs.map((run) => run.opengrid));
  const ag = medianRun(runs.map((run) => run.ag));
  const report = {
    measuredAt: new Date().toISOString(),
    rows,
    cols,
    repeats: 3,
    prepare,
    opengrid,
    ag,
    runs,
    bundle,
    pageErrors: errors,
    notes: {
      memory: 'performance.memory.usedJSHeapSize did not move between samples in an earlier run, so this report does not claim a heap delta.',
      bundle: 'Gzip sizes are esbuild bundles of each package entry. ag-grid-enterprise registers AllEnterpriseModule. opengrid is the phase 1 entry.',
      scroll: 'fps is requestAnimationFrame intervals while the test drives scrollTop for 2 seconds. traceBeginFrames counts Chrome BeginFrame events in the same window.',
      sort: 'ms is the wait from applyColumnState until modelUpdated. computeMs is the main-thread query. The worker still loads above 32768 rows but does not run the sort.',
      sortReady: 'sortReadyMs is the wait after firstDataRendered until a sort or filter can run. Touched columns are copied inside that call, so this wait does not include the background copy of every column. copyMs is that full copy. Enterprise sortReadyMs is 0.',
    },
    group: {
      status: 'not-run',
      reason: 'This run times create, scroll, sort, and the number filter. Grouping is not in the timed path.',
    },
    targets: {
      scrollNear60Fps: opengrid.scroll.fps >= 55,
      sortUnder300ms: opengrid.sort.ms < 300,
      fasterReady: opengrid.mount.firstRenderMs < ag.mount.firstRenderMs,
      fasterScroll: opengrid.scroll.fps > ag.scroll.fps,
      fasterSort: opengrid.sort.ms < ag.sort.ms,
      fasterFilter: opengrid.filter.ms < ag.filter.ms,
      smallerGzipBundle: bundle.opengridGzip < bundle.agGridGzip,
    },
  };
  mkdirSync('bench', { recursive: true });
  writeFileSync('bench/results.json', JSON.stringify(report, null, 2));
  expect(['local', 'worker'], 'opengrid engine').toContain(opengrid.mount.engine);
  if (rows > 32_768) expect(opengrid.mount.sortReadyMs).toBeGreaterThan(0);
  for (const run of runs) {
    expect(run.opengrid.sort.ordered, 'opengrid sort order').toBe(true);
    expect(run.ag.sort.ordered, 'ag-grid sort order').toBe(true);
    expect(run.opengrid.filter.count).toBe(run.ag.filter.count);
    expect(run.opengrid.sort.sample).toEqual(run.ag.sort.sample);
    expect(run.opengrid.filter.sample).toEqual(run.ag.filter.sample);
  }
  expect(opengrid.filter.count).toBeGreaterThan(0);
  expect(opengrid.filter.count).toBeLessThan(rows);
  expect(opengrid.scroll.frames).toBeGreaterThan(10);
  expect(ag.scroll.frames).toBeGreaterThan(10);
  expect(errors, 'page errors').toEqual([]);
});

function medianRun<T extends { sort: { ms: number } }>(samples: T[]): T {
  const ranked = samples.slice().sort((left, right) => left.sort.ms - right.sort.ms);
  const middle = ranked[Math.floor(ranked.length / 2)];
  if (!middle) throw new Error('no benchmark runs');
  return middle;
}

async function measure(page: Page, kind: 'opengrid' | 'ag') {
  await page.evaluate(() => {
    const cleaner = (globalThis as { gc?: () => void }).gc;
    cleaner?.();
  });
  const before = await page.evaluate(() => window.__opengridBench.heap());
  const mount = await page.evaluate((name) => window.__opengridBench.mount(name), kind);
  const afterReady = await page.evaluate(() => window.__opengridBench.heap());
  const traced = await traceScroll(page);
  const sort = await page.evaluate(() => window.__opengridBench.sort());
  const filter = await page.evaluate(() => window.__opengridBench.filter());
  await page.evaluate(() => window.__opengridBench.destroy());
  return { mount, scroll: traced.scroll, sort, filter, heapBefore: before, heapAfterReady: afterReady, traceBeginFrames: traced.beginFrames };
}

async function traceScroll(page: Page): Promise<{ scroll: ScrollSample; beginFrames: number }> {
  const client: CDPSession = await page.context().newCDPSession(page);
  const chunks: { name?: string }[] = [];
  client.on('Tracing.dataCollected', (payload: { value?: { name?: string }[] }) => {
    if (payload.value) chunks.push(...payload.value);
  });
  const complete = new Promise<void>((resolve) => {
    client.on('Tracing.tracingComplete', () => resolve());
  });
  await client.send('Tracing.start', {
    categories: 'disabled-by-default-devtools.timeline.frame,devtools.timeline',
  });
  const scroll = await page.evaluate(() => window.__opengridBench.scroll());
  await client.send('Tracing.end');
  await complete;
  await client.detach();
  return { scroll, beginFrames: chunks.filter((event) => event.name === 'BeginFrame').length };
}

function bundleSizes(): { opengridGzip: number; agGridGzip: number; opengridRaw: number; agGridRaw: number } {
  const raw = execSync('node scripts/bundle-size.mjs', { cwd: process.cwd(), encoding: 'utf8' });
  return JSON.parse(raw) as { opengridGzip: number; agGridGzip: number; opengridRaw: number; agGridRaw: number };
}
