import type { SortKey, ViewResult } from './engine';
import type { ColumnStore } from './store';
import type { FilterModel } from './types';

export const WORKER_ROW_MIN = 32_768;

interface WorkerReply {
  op: string;
  id: number;
  count?: number;
  identity?: boolean;
  indices?: Uint32Array;
  message?: string;
  computeMs?: number;
}

export class WorkerEngine {
  readonly kind = 'worker' as const;
  private readonly worker: Worker;
  private readonly pending = new Map<number, (reply: WorkerReply) => void>();
  private seq = 1;
  private failed = false;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const done = this.pending.get(event.data.id);
      if (!done) return;
      this.pending.delete(event.data.id);
      done(event.data);
    };
    this.worker.onerror = () => {
      this.failed = true;
      for (const [id, done] of this.pending) {
        this.pending.delete(id);
        done({ op: 'error', id, message: 'worker failed' });
      }
    };
  }

  get alive(): boolean {
    return !this.failed;
  }

  load(store: ColumnStore): Promise<void> {
    const id = this.seq++;
    const columns = [];
    const transfer: Transferable[] = [];
    for (const [colId, vector] of store.columns) {
      if (vector.kind === 'text') {
        columns.push({ colId, kind: 'text' as const, values: vector.values });
        continue;
      }
      if (vector.kind === 'boolean') {
        const shared = isShared(vector.values.buffer);
        const values = shared ? vector.values : vector.values.slice();
        if (!shared) transfer.push(values.buffer);
        columns.push({ colId, kind: 'boolean' as const, values });
        continue;
      }
      const shared = isShared(vector.values.buffer);
      const values = shared ? vector.values : vector.values.slice();
      const nulls = shared ? vector.nulls : vector.nulls.slice();
      if (!shared) transfer.push(values.buffer, nulls.buffer);
      columns.push({ colId, kind: vector.kind, values, nulls });
    }
    return this.send(id, { op: 'load', id, rowCount: store.rowCount, columns }, transfer).then((reply) => {
      if (reply.op === 'error') throw new Error(reply.message ?? 'worker load failed');
    });
  }

  query(sort: readonly SortKey[], filter: FilterModel | null, quick?: string | null): Promise<ViewResult & { computeMs: number }> {
    const id = this.seq++;
    return this.send(id, { op: 'query', id, sort, filter, quick }).then((reply) => {
      if (reply.op === 'error' || reply.count == null) throw new Error(reply.message ?? 'worker query failed');
      const computeMs = reply.computeMs ?? 0;
      if (reply.identity) return { indices: new Uint32Array(0), count: reply.count, identity: true, computeMs };
      return { indices: reply.indices ?? new Uint32Array(0), count: reply.count, identity: false, computeMs };
    });
  }

  patch(colId: string, row: number, value: unknown): Promise<void> {
    const id = this.seq++;
    return this.send(id, { op: 'patch', id, colId, row, value }).then(() => undefined);
  }

  destroy(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  private send(id: number, message: unknown, transfer?: Transferable[]): Promise<WorkerReply> {
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage(message, transfer ?? []);
    });
  }
}

function isShared(buffer: ArrayBufferLike): buffer is SharedArrayBuffer {
  return typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer;
}
