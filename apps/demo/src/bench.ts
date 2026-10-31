import { AllEnterpriseModule, ModuleRegistry, createGrid as createAgGrid } from 'ag-grid-enterprise';
import { createGrid as createOpenGrid } from 'opengrid';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'opengrid/styles.css';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface Row {
  [key: string]: number;
}

interface Mounted {
  firstRenderMs: number;
  sortReadyMs: number;
  copyMs: number;
  sliceMs: number;
  workerWaitMs: number;
  engine: string;
  isolated: boolean;
  rows: number;
}

const root = document.querySelector('#bench-root');
if (!(root instanceof HTMLElement)) throw new Error('missing bench root');

interface BenchGrid {
  destroy(): void;
  getDisplayedRowCount(): number;
  getDisplayedRowAtIndex(index: number): { data?: Row } | undefined;
  applyColumnState(params: { state?: { colId: string; sort?: 'asc' | 'desc' | null; sortIndex?: number | null }[]; defaultState?: { sort: null } }): boolean;
  setFilterModel(model: Record<string, unknown> | null): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

let rows: Row[] = [];
let cols = 0;
let api: BenchGrid | null = null;
let host: HTMLElement | null = null;
let kind: 'opengrid' | 'ag' = 'opengrid';

function note(text: string): void {
  const line = document.createElement('p');
  line.textContent = text;
  root?.append(line);
}

function columnDefs(count: number): { field: string; width: number; sortable: boolean; filter: string | false; resizable: boolean }[] {
  return Array.from({ length: count }, (_, index) => ({
    field: `c${index}`,
    width: 110,
    sortable: true,
    filter: index === 0 ? 'agNumberColumnFilter' : false,
    resizable: true,
  }));
}

function scroller(): HTMLElement {
  if (kind === 'opengrid') {
    const found = host?.querySelector('.og-viewport');
    if (found instanceof HTMLElement) return found;
    throw new Error('opengrid scroller is missing');
  }
  const candidates = host ? Array.from(host.querySelectorAll<HTMLElement>('div')) : [];
  const scrolling = candidates
    .filter((element) => element.scrollHeight > element.clientHeight + 8)
    .sort((a, b) => b.scrollHeight - a.scrollHeight);
  const found = scrolling[0];
  if (!found) throw new Error('ag scroller is missing');
  return found;
}

const bench = {
  prepare(rowCount: number, colCount: number): { prepareMs: number; rows: number; cols: number } {
    const started = performance.now();
    cols = colCount;
    const next: Row[] = new Array(rowCount);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row: Row = {};
      for (let colIndex = 0; colIndex < colCount; colIndex++) row[`c${colIndex}`] = (rowIndex * 17 + colIndex * 13) % 100000;
      next[rowIndex] = row;
    }
    rows = next;
    const prepareMs = performance.now() - started;
    note(`prepared ${rowCount} x ${colCount} in ${prepareMs.toFixed(0)} ms`);
    return { prepareMs, rows: rowCount, cols: colCount };
  },

  async mount(next: 'opengrid' | 'ag'): Promise<Mounted> {
    bench.destroy();
    kind = next;
    const element = document.createElement('div');
    element.style.height = '640px';
    element.style.width = '1100px';
    if (next === 'ag') element.className = 'ag-theme-quartz';
    root?.append(element);
    host = element;
    const started = performance.now();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`${next} firstDataRendered timed out`)), 120000);
      const options = {
        columnDefs: columnDefs(cols),
        rowData: rows,
        rowHeight: 28,
        headerHeight: 36,
        animateRows: false,
        onFirstDataRendered: () => {
          window.clearTimeout(timer);
          resolve();
        },
      };
      api = next === 'ag' ? createAgGrid(element, options) : createOpenGrid(element, options);
    });
    const firstRenderMs = performance.now() - started;
    const engineNode = element.querySelector('.og-root');
    let sortReadyMs = 0;
    if (next === 'opengrid' && rows.length > 32_768) {
      const readyAt = performance.now();
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('column copy timed out')), 90_000);
        const check = () => {
          const state = engineNode?.getAttribute('data-store');
          if (state === 'partial' || state === 'ready') {
            window.clearTimeout(timer);
            resolve();
            return;
          }
          setTimeout(check, 0);
        };
        check();
      });
      sortReadyMs = performance.now() - readyAt;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('column copy timed out')), 90_000);
        const check = () => {
          if (engineNode?.getAttribute('data-store') === 'ready') {
            window.clearTimeout(timer);
            resolve();
            return;
          }
          setTimeout(check, 0);
        };
        check();
      });
    }
    const engine = engineNode?.getAttribute('data-engine') ?? (next === 'ag' ? 'ag-grid' : 'missing');
    const result = {
      firstRenderMs,
      sortReadyMs,
      copyMs: Number(engineNode?.getAttribute('data-copy-ms') ?? '0'),
      sliceMs: Number(engineNode?.getAttribute('data-slice-ms') ?? '0'),
      workerWaitMs: performance.now() - started - firstRenderMs - sortReadyMs,
      engine,
      isolated: crossOriginIsolated,
      rows: api?.getDisplayedRowCount() ?? 0,
    };
    note(`${next} first render ${result.firstRenderMs.toFixed(0)} ms, sort-ready ${result.sortReadyMs.toFixed(0)} ms, full column copy ${result.copyMs.toFixed(0)} ms, longest main-thread slice ${result.sliceMs.toFixed(0)} ms, engine ${engine}`);
    return result;
  },

  async scroll(): Promise<{ frames: number; elapsedMs: number; fps: number; p95Ms: number }> {
    const view = scroller();
    const samples: number[] = [];
    const started = performance.now();
    let previous = started;
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        samples.push(now - previous);
        previous = now;
        const elapsed = now - started;
        const max = Math.max(0, view.scrollHeight - view.clientHeight);
        view.scrollTop = max === 0 ? 0 : max * ((elapsed % 800) / 800);
        if (elapsed < 2000) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    const frames = samples.slice(1);
    const elapsedMs = frames.reduce((total, frame) => total + frame, 0);
    const ordered = frames.slice().sort((a, b) => a - b);
    const p95Ms = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))] ?? 0;
    const fps = elapsedMs === 0 ? 0 : frames.length / (elapsedMs / 1000);
    note(`${kind} scroll ${fps.toFixed(1)} fps p95 ${p95Ms.toFixed(1)} ms`);
    return { frames: frames.length, elapsedMs, fps, p95Ms };
  },

  async sort(): Promise<{ ms: number; ordered: boolean; sample: Array<number | null>; computeMs: number }> {
    if (!api) throw new Error('no grid');
    const current = api;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const done = () => {
        current.removeEventListener('modelUpdated', done);
        resolve();
      };
      current.addEventListener('modelUpdated', done);
      current.applyColumnState({ state: [{ colId: 'c0', sort: 'asc' }], defaultState: { sort: null } });
    });
    const ms = performance.now() - started;
    const count = current.getDisplayedRowCount();
    const sample = checkpoints(count).map((index) => current.getDisplayedRowAtIndex(index)?.data?.c0 ?? null);
    let ordered = true;
    let previousValue = -Infinity;
    const step = Math.max(1, Math.floor(count / 200));
    for (let index = 0; index < count; index += step) {
      const value = current.getDisplayedRowAtIndex(index)?.data?.c0;
      if (typeof value !== 'number' || value < previousValue) ordered = false;
      if (typeof value === 'number') previousValue = value;
    }
    note(`${kind} sort ${ms.toFixed(0)} ms ordered ${ordered}`);
    const computeMs = Number(host?.querySelector('.og-root')?.getAttribute('data-compute-ms') ?? '0');
    return { ms, ordered, sample, computeMs };
  },

  async filter(): Promise<{ ms: number; count: number; sample: Array<number | null> }> {
    if (!api) throw new Error('no grid');
    const current = api;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const done = () => {
        current.removeEventListener('modelUpdated', done);
        resolve();
      };
      current.addEventListener('modelUpdated', done);
      current.setFilterModel({ c0: { filterType: 'number', type: 'greaterThan', filter: 50000 } });
    });
    const count = current.getDisplayedRowCount();
    const ms = performance.now() - started;
    const sample = checkpoints(count).map((index) => current.getDisplayedRowAtIndex(index)?.data?.c0 ?? null);
    note(`${kind} filter ${ms.toFixed(0)} ms rows ${count}`);
    return { ms, count, sample };
  },

  heap(): number | null {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory?.usedJSHeapSize ?? null;
  },

  destroy(): void {
    api?.destroy();
    host?.remove();
    api = null;
    host = null;
  },
};

function checkpoints(count: number): number[] {
  const points = [0, 1, 9, 10, 100, 1000, 10_000, 100_000];
  if (count > 0) points.push(count - 1);
  return points.filter((index) => index >= 0 && index < count);
}

window.__opengridBench = bench;
note('sort-ready 是首次绘制之后到可以排序、过滤的等待。全部列拷贝拆到空闲时间，slice 是其中最长的一段主线程时间。copyMs 是拷完所有列的墙上时间，不含 worker。企业版绘制完就可以排，所以它的 sort-ready 记 0。');
note('bench controller ready');

declare global {
  interface Window {
    __opengridBench: typeof bench;
  }
}
