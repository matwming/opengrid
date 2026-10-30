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
