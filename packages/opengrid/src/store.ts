export type ColumnKind = 'number' | 'text' | 'date' | 'boolean';

export interface NumberVector {
  kind: 'number';
  values: Float64Array;
  nulls: Uint8Array;
}

export interface TextVector {
  kind: 'text';
  values: (string | null)[];
}

export interface DateVector {
  kind: 'date';
  values: Float64Array;
  nulls: Uint8Array;
}

export interface BoolVector {
  kind: 'boolean';
  values: Uint8Array;
}

export type Vector = NumberVector | TextVector | DateVector | BoolVector;

export interface ColumnStore {
  rowCount: number;
  columns: Map<string, Vector>;
}

export interface StoreField {
  colId: string;
  kind: ColumnKind;
  read: (row: unknown) => unknown;
  plainField?: string;
}

const NO_NULLS = new Uint8Array(0);
const keyBuffer = new Float64Array(1);
const keyWords = new Uint32Array(keyBuffer.buffer);

export function sortableFloatWords(value: number): { hi: number; lo: number } {
  keyBuffer[0] = value === 0 ? 0 : value;
  let lo = keyWords[0] ?? 0;
  let hi = keyWords[1] ?? 0;
  if (hi & 0x80000000) {
    hi = ~hi >>> 0;
    lo = ~lo >>> 0;
  } else {
    hi = (hi ^ 0x80000000) >>> 0;
  }
  return { hi, lo };
}

export function readPath(row: unknown, field: string): unknown {
  if (row == null || typeof row !== 'object') return undefined;
  if (!field.includes('.')) return (row as Record<string, unknown>)[field];
  let current: unknown = row;
  for (const part of field.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function writePath(row: unknown, field: string, value: unknown): void {
  if (row == null || typeof row !== 'object') return;
  if (!field.includes('.')) {
    (row as Record<string, unknown>)[field] = value;
    return;
  }
  const parts = field.split('.');
  let current: Record<string, unknown> = row as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] ?? '';
    const next = current[key];
    if (next == null || typeof next !== 'object') {
      const created: Record<string, unknown> = {};
      current[key] = created;
      current = created;
    } else {
      current = next as Record<string, unknown>;
    }
  }
  current[parts[parts.length - 1] ?? ''] = value;
}

export function calendarDay(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) return null;
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    const date = new Date(value);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    const date = new Date(parsed);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  return null;
}

export function formatDay(day: number): string {
  const date = new Date(day);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function allocFloat(length: number, shared: boolean): Float64Array {
  if (shared) return new Float64Array(new SharedArrayBuffer(length * 8));
  return new Float64Array(length);
}

function allocBytes(length: number, shared: boolean): Uint8Array {
  if (shared) return new Uint8Array(new SharedArrayBuffer(length));
  return new Uint8Array(length);
}

export function sharedMemoryAvailable(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && typeof crossOriginIsolated === 'boolean' && crossOriginIsolated;
}

export function emptyVector(kind: ColumnKind, rowCount: number): Vector {
  if (kind === 'number') return { kind: 'number', values: new Float64Array(rowCount), nulls: NO_NULLS };
  if (kind === 'date') return { kind: 'date', values: new Float64Array(rowCount), nulls: new Uint8Array(rowCount) };
  if (kind === 'boolean') return { kind: 'boolean', values: new Uint8Array(rowCount) };
  return { kind: 'text', values: new Array(rowCount) };
}

export function fillFieldRange(rows: readonly unknown[], field: StoreField, vector: Vector, start: number, end: number): void {
  const name = field.plainField;
  if (vector.kind === 'number' && name) {
    const values = vector.values;
    for (let row = start; row < end; row++) {
      const source = rows[row];
      const raw = source != null && typeof source === 'object' ? (source as Record<string, unknown>)[name] : undefined;
      if (typeof raw === 'number' && raw === raw) values[row] = raw;
      else {
        if (vector.nulls.length !== values.length) vector.nulls = new Uint8Array(values.length);
        vector.nulls[row] = 1;
      }
    }
    return;
  }
  for (let row = start; row < end; row++) writeVector(vector, row, name ? plainRead(rows[row], name) : field.read(rows[row]));
}

function plainRead(row: unknown, name: string): unknown {
  if (row == null || typeof row !== 'object') return undefined;
  return (row as Record<string, unknown>)[name];
}

export function buildStore(rows: readonly unknown[], fields: readonly StoreField[], shared = false): ColumnStore {
  if (fields.every((field) => field.plainField)) return buildPlainStore(rows, fields, shared);
  return buildStoreFromReaders(rows, fields, shared);
}

function buildPlainStore(rows: readonly unknown[], fields: readonly StoreField[], shared: boolean): ColumnStore {
  const rowCount = rows.length;
  const columns = new Map<string, Vector>();
  const plans = fields.map((field) => {
    const name = field.plainField ?? '';
    if (field.kind === 'number') {
      const values = allocFloat(rowCount, shared);
      const vector: NumberVector = { kind: 'number', values, nulls: NO_NULLS };
      columns.set(field.colId, vector);
      return { name, kind: 'number' as const, values, nulls: vector.nulls, vector };
    }
    if (field.kind === 'date') {
      const values = allocFloat(rowCount, shared);
      const nulls = allocBytes(rowCount, shared);
      columns.set(field.colId, { kind: 'date', values, nulls });
      return { name, kind: 'date' as const, values, nulls };
    }
    if (field.kind === 'boolean') {
      const values = allocBytes(rowCount, shared);
      columns.set(field.colId, { kind: 'boolean', values });
      return { name, kind: 'boolean' as const, values };
    }
    const values: (string | null)[] = new Array(rowCount);
    columns.set(field.colId, { kind: 'text', values });
    return { name, kind: 'text' as const, values };
  });
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const record = objectRow(rows[rowIndex]);
    if (!record) continue;
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index];
      if (!plan) continue;
      const raw = record[plan.name];
      if (plan.kind === 'number') {
        if (typeof raw === 'number' && raw === raw) plan.vector.values[rowIndex] = raw;
        else {
          if (plan.vector.nulls.length !== rowCount) plan.vector.nulls = allocBytes(rowCount, false);
          plan.vector.nulls[rowIndex] = 1;
        }
      } else if (plan.kind === 'text') {
        plan.values[rowIndex] = raw == null ? null : typeof raw === 'string' ? raw : String(raw);
      } else if (plan.kind === 'boolean') {
        writeVector({ kind: 'boolean', values: plan.values }, rowIndex, raw);
      } else {
        writeVector({ kind: 'date', values: plan.values, nulls: plan.nulls }, rowIndex, raw);
      }
    }
  }
  return { rowCount, columns };
}

function objectRow(row: unknown): Record<string, unknown> | null {
  if (row == null || typeof row !== 'object') return null;
  return row as Record<string, unknown>;
}

function buildStoreFromReaders(rows: readonly unknown[], fields: readonly StoreField[], shared: boolean): ColumnStore {
  const rowCount = rows.length;
  const columns = new Map<string, Vector>();
  const plans = fields.map((field) => {
    if (field.kind === 'number') {
      const vector: NumberVector = { kind: 'number', values: allocFloat(rowCount, shared), nulls: allocBytes(rowCount, shared) };
      columns.set(field.colId, vector);
      return { field, vector };
    }
    if (field.kind === 'date') {
      const vector: DateVector = { kind: 'date', values: allocFloat(rowCount, shared), nulls: allocBytes(rowCount, shared) };
      columns.set(field.colId, vector);
      return { field, vector };
    }
    if (field.kind === 'boolean') {
      const vector: BoolVector = { kind: 'boolean', values: allocBytes(rowCount, shared) };
      columns.set(field.colId, vector);
      return { field, vector };
    }
    const vector: TextVector = { kind: 'text', values: new Array(rowCount) };
    columns.set(field.colId, vector);
    return { field, vector };
  });

  const numbers = plans.filter((plan) => plan.vector.kind === 'number');
  const dates = plans.filter((plan) => plan.vector.kind === 'date');
  const bools = plans.filter((plan) => plan.vector.kind === 'boolean');
  const texts = plans.filter((plan) => plan.vector.kind === 'text');
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const row = rows[rowIndex];
    for (let index = 0; index < numbers.length; index++) {
      const plan = numbers[index];
      if (!plan || plan.vector.kind !== 'number') continue;
      const raw = plan.field.read(row);
      if (typeof raw === 'number' && raw === raw) plan.vector.values[rowIndex] = raw === 0 ? 0 : raw;
      else plan.vector.nulls[rowIndex] = 1;
    }
    for (let index = 0; index < dates.length; index++) {
      const plan = dates[index];
      if (!plan || plan.vector.kind !== 'date') continue;
      writeVector(plan.vector, rowIndex, plan.field.read(row));
    }
    for (let index = 0; index < bools.length; index++) {
      const plan = bools[index];
      if (!plan || plan.vector.kind !== 'boolean') continue;
      writeVector(plan.vector, rowIndex, plan.field.read(row));
    }
    for (let index = 0; index < texts.length; index++) {
      const plan = texts[index];
      if (!plan || plan.vector.kind !== 'text') continue;
      writeVector(plan.vector, rowIndex, plan.field.read(row));
    }
  }
  return { rowCount, columns };
}

export function writeVector(vector: Vector, rowIndex: number, raw: unknown): void {
  if (vector.kind === 'number') {
    if (typeof raw === 'number' && raw === raw) {
      vector.values[rowIndex] = raw === 0 ? 0 : raw;
      if (vector.nulls.length) vector.nulls[rowIndex] = 0;
    } else if (typeof raw === 'string' && raw.trim() !== '' && raw.trim() === String(Number(raw))) {
      vector.values[rowIndex] = Number(raw);
      if (vector.nulls.length) vector.nulls[rowIndex] = 0;
    } else {
      vector.values[rowIndex] = 0;
      if (vector.nulls.length !== vector.values.length) vector.nulls = new Uint8Array(vector.values.length);
      vector.nulls[rowIndex] = 1;
    }
    return;
  }
  if (vector.kind === 'date') {
    const day = calendarDay(raw);
    if (day == null) {
      vector.values[rowIndex] = 0;
      vector.nulls[rowIndex] = 1;
    } else {
      vector.values[rowIndex] = day;
      vector.nulls[rowIndex] = 0;
    }
    return;
  }
  if (vector.kind === 'boolean') {
    if (raw == null || raw === '') vector.values[rowIndex] = 2;
    else vector.values[rowIndex] = raw === true || raw === 'true' || raw === 1 ? 1 : 0;
    return;
  }
  if (raw == null) vector.values[rowIndex] = null;
  else vector.values[rowIndex] = typeof raw === 'string' ? raw : String(raw);
}

export function cellRaw(vector: Vector | undefined, rowIndex: number): unknown {
  if (!vector) return undefined;
  if (vector.kind === 'number') return vector.nulls[rowIndex] ? null : vector.values[rowIndex];
  if (vector.kind === 'date') return vector.nulls[rowIndex] ? null : vector.values[rowIndex];
  if (vector.kind === 'boolean') {
    const code = vector.values[rowIndex];
    if (code === 2) return null;
    return code === 1;
  }
  return vector.values[rowIndex] ?? null;
}

export function displayText(vector: Vector | undefined, rowIndex: number): string {
  const raw = cellRaw(vector, rowIndex);
  if (raw == null) return '';
  if (vector?.kind === 'date' && typeof raw === 'number') return formatDay(raw);
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  return String(raw);
}
