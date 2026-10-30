import type { FilterModel, JoinOperator, MultiFilterModel, ProvidedFilterModel, SetFilterModel, SimpleFilterModel, SortDirection } from './types';
import { cellRaw, displayText, type ColumnStore, type Vector, sortableFloatWords } from './store';

export interface SortKey {
  colId: string;
  direction: Exclude<SortDirection, null>;
}

export interface ViewResult {
  indices: Uint32Array;
  count: number;
  identity: boolean;
}

const EMPTY = new Uint32Array(0);

export function queryView(store: ColumnStore, sort: readonly SortKey[], filter: FilterModel | null, quick?: string | null): ViewResult {
  const filtered = applyQuickFilter(store, applyFilter(store, filter), quick);
  if (sort.length === 0) return filtered;
  const indices = filtered.identity ? identityIndices(filtered.count) : filtered.indices;
  sortIndices(store, indices, filtered.count, sort);
  return { indices, count: filtered.count, identity: false };
}

function identityIndices(count: number): Uint32Array {
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++) indices[i] = i;
  return indices;
}

export function applyFilter(store: ColumnStore, filter: FilterModel | null): ViewResult {
  const active = activeFilters(filter);
  if (active.length === 0) {
    return { indices: EMPTY, count: store.rowCount, identity: true };
  }
  const indices = new Uint32Array(store.rowCount);
  let count = 0;
  for (let row = 0; row < store.rowCount; row++) {
    let pass = true;
    for (let i = 0; i < active.length; i++) {
      const entry = active[i];
      if (!entry) continue;
      const vector = store.columns.get(entry.colId);
      if (!matches(vector, row, entry.model)) {
        pass = false;
        break;
      }
    }
    if (pass) indices[count++] = row;
  }
  return { indices, count, identity: false };
}

export function hasQuickFilter(text: string | null | undefined): boolean {
  return text != null && text.trim() !== '';
}

export function applyQuickFilter(store: ColumnStore, view: ViewResult, text: string | null | undefined): ViewResult {
  if (!hasQuickFilter(text)) return view;
  const tokens = text!.trim().toLowerCase().split(/\s+/);
  const columns = [...store.columns.values()];
  const indices = new Uint32Array(view.count);
  let count = 0;
  for (let index = 0; index < view.count; index++) {
    const row = view.identity ? index : view.indices[index] ?? -1;
    if (row < 0) continue;
    const haystack = columns.map((vector) => displayText(vector, row).toLowerCase());
    if (tokens.every((token) => haystack.some((value) => value.includes(token)))) indices[count++] = row;
  }
  return { indices, count, identity: false };
}

function activeFilters(filter: FilterModel | null): { colId: string; model: ProvidedFilterModel }[] {
  if (!filter) return [];
  const out: { colId: string; model: ProvidedFilterModel }[] = [];
  for (const colId of Object.keys(filter)) {
    const model = filter[colId];
    if (model && modelIsActive(model)) out.push({ colId, model });
  }
  return out;
}

function isMultiFilter(model: ProvidedFilterModel): model is MultiFilterModel {
  return model.filterType === 'multi' && 'filterModels' in model;
}

function modelIsActive(model: ProvidedFilterModel): boolean {
  if (isMultiFilter(model)) return model.filterModels.some((child) => child != null && modelIsActive(child));
  if (isSetFilter(model)) return true;
  if ('conditions' in model && Array.isArray(model.conditions)) {
    return model.conditions.some((condition) => simpleIsActive(condition));
  }
  if ('condition1' in model || 'condition2' in model) return simpleIsActive(model.condition1) || simpleIsActive(model.condition2);
  return simpleIsActive(model);
}

function simpleIsActive(model: SimpleFilterModel | undefined): boolean {
  if (!model || model.type == null || model.type === 'empty') return false;
  if (model.type === 'blank' || model.type === 'notBlank') return true;
  if (model.filterType === 'date' || model.dateFrom != null || model.dateTo != null) {
    if (model.type === 'inRange') return model.dateFrom != null && model.dateTo != null;
    return model.dateFrom != null && model.dateFrom !== '';
  }
  if (model.type === 'inRange') return model.filter != null && model.filter !== '' && model.filterTo != null && model.filterTo !== '';
  return model.filter != null && model.filter !== '';
}

function isSetFilter(model: ProvidedFilterModel): model is SetFilterModel {
  return model.filterType === 'set' && 'values' in model;
}

function matches(vector: Vector | undefined, row: number, model: ProvidedFilterModel): boolean {
  if (isMultiFilter(model)) {
    const active = model.filterModels.filter((child): child is ProvidedFilterModel => child != null && modelIsActive(child));
    return active.every((child) => matches(vector, row, child));
  }
  if (isSetFilter(model)) {
    const text = displayText(vector, row);
    return model.values.map((value) => (value == null ? '' : String(value))).includes(text);
  }
  if ('conditions' in model && Array.isArray(model.conditions) && model.conditions.length > 0) {
    return join(model.operator, model.conditions.map((condition) => matches(vector, row, condition)));
  }
  if ('operator' in model && (model.condition1 || model.condition2)) {
    const parts = [model.condition1, model.condition2].filter((part): part is SimpleFilterModel => simpleIsActive(part));
    return join(model.operator, parts.map((condition) => matches(vector, row, condition)));
  }
  return matchSimple(vector, row, model);
}

function join(operator: JoinOperator | undefined, parts: boolean[]): boolean {
  if (parts.length === 0) return true;
  return operator === 'OR' ? parts.some(Boolean) : parts.every(Boolean);
}

function matchSimple(vector: Vector | undefined, row: number, model: SimpleFilterModel): boolean {
  const type = model.type ?? 'contains';
  if (!vector) return type === 'blank' || type === 'notContains' || type === 'notEqual';
  if (vector.kind === 'number' || vector.kind === 'date') return matchScalar(vector, row, model, type);
  if (vector.kind === 'boolean') {
    const code = vector.values[row];
    const blank = code === 2;
    if (type === 'blank') return blank;
    if (type === 'notBlank') return !blank;
    const text = blank ? '' : code === 1 ? 'true' : 'false';
    return matchText(text, false, model, type);
  }
  const text = vector.values[row];
  return matchText(text, false, model, type);
}

function matchScalar(vector: { values: Float64Array; nulls: Uint8Array }, row: number, model: SimpleFilterModel, type: string): boolean {
  const blank = vector.nulls[row] === 1;
  if (type === 'blank') return blank;
  if (type === 'notBlank') return !blank;
  if (blank) return false;
  const value = vector.values[row] ?? 0;
  const from = model.dateFrom != null ? Number(calendarNumber(model.dateFrom)) : numberOrNull(model.filter);
  const to = model.dateTo != null ? Number(calendarNumber(model.dateTo)) : numberOrNull(model.filterTo);
  if (type === 'inRange') {
    if (from == null || to == null) return true;
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    return value > low && value < high;
  }
  if (from == null) return true;
  if (type === 'equals') return value === from;
  if (type === 'notEqual') return value !== from;
  if (type === 'lessThan') return value < from;
  if (type === 'lessThanOrEqual') return value <= from;
  if (type === 'greaterThan') return value > from;
  if (type === 'greaterThanOrEqual') return value >= from;
  return true;
}

function calendarNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return number === number ? number : null;
}

function matchText(value: string | null, caseSensitive: boolean, model: SimpleFilterModel, type: string): boolean {
  const blank = value == null || value === '';
  if (type === 'blank') return blank;
  if (type === 'notBlank') return !blank;
  const filter = model.filter == null ? '' : String(model.filter);
  if (filter === '' && type !== 'equals' && type !== 'notEqual') return true;
  const left = caseSensitive ? (value ?? '') : (value ?? '').toLocaleLowerCase();
  const right = caseSensitive ? filter : filter.toLocaleLowerCase();
  if (type === 'contains') return left.includes(right);
  if (type === 'notContains') return !left.includes(right);
  if (type === 'equals') return left === right;
  if (type === 'notEqual') return left !== right;
  if (type === 'startsWith') return left.startsWith(right);
  if (type === 'endsWith') return left.endsWith(right);
  return true;
}

export function sortIndices(store: ColumnStore, indices: Uint32Array, count: number, sort: readonly SortKey[]): void {
  if (count <= 1 || sort.length === 0) return;
  const target = indices.length === count ? indices : indices.subarray(0, count);
  for (let keyIndex = sort.length - 1; keyIndex >= 0; keyIndex--) {
    const key = sort[keyIndex];
    if (!key) continue;
    const vector = store.columns.get(key.colId);
    if (!vector) continue;
    if (vector.kind === 'number' || vector.kind === 'date') sortNumeric(target, count, vector.values, vector.nulls, key.direction === 'desc');
    else if (vector.kind === 'boolean') sortBoolean(target, count, vector.values, key.direction === 'desc');
    else sortText(target, count, vector.values, key.direction === 'desc');
  }
}

type Words = Uint32Array<ArrayBufferLike>;
let scratchA: Words = new Uint32Array(0);
let scratchB: Words = new Uint32Array(0);
let nullBuf: Words = new Uint32Array(0);
let keyHi: Words = new Uint32Array(0);
let keyLo: Words = new Uint32Array(0);
const histogram = new Uint32Array(256);

function ensure(rowCount: number, count: number): void {
  if (keyHi.length < rowCount) {
    keyHi = new Uint32Array(rowCount);
    keyLo = new Uint32Array(rowCount);
  }
  if (scratchA.length < count) {
    scratchA = new Uint32Array(count);
    scratchB = new Uint32Array(count);
    nullBuf = new Uint32Array(count);
  }
}

function sortNumeric(indices: Words, count: number, values: Float64Array, nulls: Uint8Array, descending: boolean): void {
  ensure(values.length, count);
  let present = 0;
  let missing = 0;
  for (let i = 0; i < count; i++) {
    const row = indices[i] ?? 0;
    if (nulls[row]) nullBuf[missing++] = row;
    else scratchA[present++] = row;
  }
  for (let i = 0; i < present; i++) {
    const row = scratchA[i] ?? 0;
    const words = sortableFloatWords(values[row] ?? 0);
    if (descending) {
      keyHi[row] = ~words.hi >>> 0;
      keyLo[row] = ~words.lo >>> 0;
    } else {
      keyHi[row] = words.hi;
      keyLo[row] = words.lo;
    }
  }
  radix(scratchA, present);
  const nullsFirst = !descending;
  let cursor = 0;
  if (nullsFirst) {
    for (let i = 0; i < missing; i++) indices[cursor++] = nullBuf[i] ?? 0;
    for (let i = 0; i < present; i++) indices[cursor++] = scratchA[i] ?? 0;
  } else {
    for (let i = 0; i < present; i++) indices[cursor++] = scratchA[i] ?? 0;
    for (let i = 0; i < missing; i++) indices[cursor++] = nullBuf[i] ?? 0;
  }
}

function radix(order: Words, count: number): void {
  let src = order;
  let dst = scratchB.subarray(0, count);
  const shifts = [0, 8, 16, 24];
  for (const shift of shifts) {
    pass(src, dst, keyLo, shift, count);
    const swap = src;
    src = dst;
    dst = swap;
  }
  for (const shift of shifts) {
    pass(src, dst, keyHi, shift, count);
    const swap = src;
    src = dst;
    dst = swap;
  }
  if (src !== order) order.set(src);
}

function pass(src: Words, dst: Words, keys: Words, shift: number, count: number): void {
  histogram.fill(0);
  for (let i = 0; i < count; i++) {
    const row = src[i] ?? 0;
    histogram[(keys[row]! >>> shift) & 255]!++;
  }
  let sum = 0;
  for (let bucket = 0; bucket < 256; bucket++) {
    const amount = histogram[bucket] ?? 0;
    histogram[bucket] = sum;
    sum += amount;
  }
  for (let i = 0; i < count; i++) {
    const row = src[i] ?? 0;
    const bucket = (keys[row]! >>> shift) & 255;
    const at = histogram[bucket] ?? 0;
    dst[at] = row;
    histogram[bucket] = at + 1;
  }
}

function sortText(indices: Uint32Array, count: number, values: (string | null)[], descending: boolean): void {
  const slice = Array.from(indices.subarray(0, count));
  slice.sort((a, b) => {
    const left = values[a] ?? null;
    const right = values[b] ?? null;
    const compared = compareText(left, right);
    return descending ? -compared : compared;
  });
  for (let i = 0; i < count; i++) indices[i] = slice[i] ?? 0;
}

function compareText(left: string | null, right: string | null): number {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortBoolean(indices: Uint32Array, count: number, values: Uint8Array, descending: boolean): void {
  const slice = Array.from(indices.subarray(0, count));
  slice.sort((a, b) => {
    const left = values[a] === 2 ? null : values[a];
    const right = values[b] === 2 ? null : values[b];
    if (left == null && right == null) return 0;
    if (left == null) return descending ? 1 : -1;
    if (right == null) return descending ? -1 : 1;
    const compared = left - right;
    return descending ? -compared : compared;
  });
  for (let i = 0; i < count; i++) indices[i] = slice[i] ?? 0;
}

export function sourceAt(view: ViewResult, displayIndex: number): number {
  if (displayIndex < 0 || displayIndex >= view.count) return -1;
  if (view.identity) return displayIndex;
  return view.indices[displayIndex] ?? -1;
}

export function readCell(store: ColumnStore, colId: string, source: number): unknown {
  return cellRaw(store.columns.get(colId), source);
}
