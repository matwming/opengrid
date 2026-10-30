import { queryView, type SortKey, type ViewResult } from './engine';
import { writeVector, type ColumnStore, type Vector } from './store';
import type { FilterModel } from './types';

type LoadColumn =
  | { colId: string; kind: 'number' | 'date'; values: Float64Array; nulls: Uint8Array }
  | { colId: string; kind: 'boolean'; values: Uint8Array }
  | { colId: string; kind: 'text'; values: (string | null)[] };

interface LoadMessage {
  op: 'load';
  id: number;
  rowCount: number;
  columns: LoadColumn[];
}

interface QueryMessage {
  op: 'query';
  id: number;
  sort: SortKey[];
  filter: FilterModel | null;
  quick?: string | null;
}

interface PatchMessage {
  op: 'patch';
  id: number;
  colId: string;
  row: number;
  value: unknown;
}

type Inbound = LoadMessage | QueryMessage | PatchMessage;

let store: ColumnStore | null = null;

function post(message: unknown, transfer?: Transferable[]): void {
  const worker = self as unknown as { postMessage: (message: unknown, transfer?: Transferable[]) => void };
  if (transfer) worker.postMessage(message, transfer);
  else worker.postMessage(message);
}

self.onmessage = (event: MessageEvent<Inbound>) => {
  const message = event.data;
  if (message.op === 'load') {
    const columns = new Map<string, Vector>();
    for (const column of message.columns) {
      if (column.kind === 'text') columns.set(column.colId, { kind: 'text', values: column.values });
      else if (column.kind === 'boolean') columns.set(column.colId, { kind: 'boolean', values: column.values });
      else columns.set(column.colId, { kind: column.kind, values: column.values, nulls: column.nulls });
    }
    store = { rowCount: message.rowCount, columns };
    post({ op: 'ready', id: message.id });
    return;
  }
  if (!store) {
    post({ op: 'error', id: message.id, message: 'worker has no rows' });
    return;
  }
  if (message.op === 'patch') {
    const vector = store.columns.get(message.colId);
    if (vector) writeVector(vector, message.row, message.value);
    post({ op: 'patched', id: message.id });
    return;
  }
  const started = performance.now();
  const view = queryView(store, message.sort, message.filter, message.quick);
  const computeMs = performance.now() - started;
  if (view.identity) {
    post({ op: 'view', id: message.id, count: view.count, identity: true, computeMs });
    return;
  }
  const indices = view.indices.slice(0, view.count);
  post({ op: 'view', id: message.id, count: view.count, identity: false, indices, computeMs }, [indices.buffer]);
};

export type { ViewResult };
