export interface GroupFlat {
  kind: 'group';
  id: string;
  key: string;
  level: number;
  expanded: boolean;
  leafCount: number;
  leafSources: number[];
}

export interface LeafFlat {
  kind: 'leaf';
  source: number;
  level: number;
}

export type FlatRow = GroupFlat | LeafFlat;

export function aggregate(func: string, values: readonly unknown[]): number | null {
  const numbers = values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  if (func === 'count') return numbers.length;
  if (numbers.length === 0) return null;
  if (func === 'sum') return numbers.reduce((total, value) => total + value, 0);
  if (func === 'min') return Math.min(...numbers);
  if (func === 'max') return Math.max(...numbers);
  if (func === 'avg') return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  return null;
}

export function flattenGroups(
  sources: readonly number[],
  valueAt: (source: number, colId: string) => string,
  groupColIds: readonly string[],
  isExpanded: (id: string, level: number) => boolean,
): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (rows: readonly number[], depth: number, path: string) => {
    if (depth >= groupColIds.length) {
      for (const source of rows) out.push({ kind: 'leaf', source, level: depth });
      return;
    }
    const colId = groupColIds[depth] ?? '';
    const buckets = new Map<string, number[]>();
    for (const source of rows) {
      const key = valueAt(source, colId);
      const list = buckets.get(key);
      if (list) list.push(source);
      else buckets.set(key, [source]);
    }
    const keys = [...buckets.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    for (const key of keys) {
      const children = buckets.get(key) ?? [];
      const id = `${path}${colId}:${key}`;
      const expanded = isExpanded(id, depth);
      out.push({ kind: 'group', id, key, level: depth, expanded, leafCount: children.length, leafSources: children });
      if (expanded) walk(children, depth + 1, `${id}/`);
    }
  };
  walk(sources, 0, '');
  return out;
}

export function flattenTree(
  items: readonly { source: number; path: readonly string[] }[],
  isExpanded: (id: string, level: number) => boolean,
): FlatRow[] {
  interface Bucket {
    source?: number;
    kids: Map<string, Bucket>;
  }
  const root = new Map<string, Bucket>();
  for (const item of items) {
    let level = root;
    item.path.forEach((key, index) => {
      const bucket = level.get(key) ?? { kids: new Map<string, Bucket>() };
      level.set(key, bucket);
      if (index === item.path.length - 1) bucket.source = item.source;
      level = bucket.kids;
    });
  }
  const out: FlatRow[] = [];
  const walk = (level: Map<string, Bucket>, depth: number, path: string) => {
    const keys = [...level.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    for (const key of keys) {
      const bucket = level.get(key);
      if (!bucket) continue;
      const id = `${path}${key}`;
      if (bucket.kids.size > 0) {
        const expanded = isExpanded(id, depth);
        const leafCount = countLeaves(bucket);
        out.push({ kind: 'group', id, key, level: depth, expanded, leafCount, leafSources: collectLeaves(bucket) });
        if (expanded) walk(bucket.kids, depth + 1, `${id}/`);
      } else if (bucket.source != null) {
        out.push({ kind: 'leaf', source: bucket.source, level: depth });
      }
    }
  };
  walk(root, 0, '');
  return out;
}

interface TreeBucket {
  source?: number;
  kids: Map<string, TreeBucket>;
}

function countLeaves(bucket: TreeBucket): number {
  let count = bucket.kids.size === 0 && bucket.source != null ? 1 : 0;
  for (const child of bucket.kids.values()) count += countLeaves(child);
  return count;
}

function collectLeaves(bucket: TreeBucket): number[] {
  const sources: number[] = [];
  if (bucket.kids.size === 0 && bucket.source != null) sources.push(bucket.source);
  for (const child of bucket.kids.values()) sources.push(...collectLeaves(child));
  return sources;
}
