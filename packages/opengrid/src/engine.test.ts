import { describe, expect, it } from 'vitest';
import { queryView } from './engine';
import { buildStore, type StoreField } from './store';

function rowsOf(partial: Record<string, unknown>[]): { store: ReturnType<typeof buildStore>; rows: Record<string, unknown>[] } {
  const fields: StoreField[] = [
    { colId: 'name', kind: 'text', read: (row) => (row as Record<string, unknown>).name },
    { colId: 'qty', kind: 'number', read: (row) => (row as Record<string, unknown>).qty },
    { colId: 'when', kind: 'date', read: (row) => (row as Record<string, unknown>).when },
  ];
  return { rows: partial, store: buildStore(partial, fields) };
}

function ids(store: ReturnType<typeof buildStore>, rows: Record<string, unknown>[], sort: { colId: string; direction: 'asc' | 'desc' }[] = [], filter: Parameters<typeof queryView>[2] = null, quick?: string): string[] {
  const view = queryView(store, sort, filter, quick);
  const out: string[] = [];
  for (let i = 0; i < view.count; i++) {
    const source = view.identity ? i : view.indices[i];
    out.push(String(rows[source ?? 0]?.id));
  }
  return out;
}

const fixture = [
  { id: 'a', name: 'Nora', qty: 2, when: '2020-05-02' },
  { id: 'b', name: 'nora', qty: null, when: '2020-01-04' },
  { id: 'c', name: 'Amy', qty: 10, when: null },
  { id: 'd', name: 'Bo', qty: 10, when: '2019-12-01' },
  { id: 'e', name: null, qty: -3, when: '2020-05-02' },
  { id: 'f', name: '', qty: 0, when: '2020-05-01' },
];

describe('client-side view', () => {
  const { store, rows } = rowsOf(fixture);

  it('sorts text with nulls below every value, case sensitive and stable', () => {
    expect(ids(store, rows, [{ colId: 'name', direction: 'asc' }])).toEqual(['e', 'f', 'c', 'd', 'a', 'b']);
    expect(ids(store, rows, [{ colId: 'name', direction: 'desc' }])).toEqual(['b', 'a', 'd', 'c', 'f', 'e']);
  });

  it('sorts numbers and dates with nulls as the lowest value', () => {
    expect(ids(store, rows, [{ colId: 'qty', direction: 'asc' }])).toEqual(['b', 'e', 'f', 'a', 'c', 'd']);
    expect(ids(store, rows, [{ colId: 'qty', direction: 'desc' }])).toEqual(['c', 'd', 'a', 'f', 'e', 'b']);
    expect(ids(store, rows, [{ colId: 'when', direction: 'asc' }])).toEqual(['c', 'd', 'b', 'f', 'a', 'e']);
    expect(ids(store, rows, [{ colId: 'when', direction: 'desc' }])).toEqual(['a', 'e', 'f', 'b', 'd', 'c']);
  });

  it('filters text, number, and date the way the community grid does', () => {
    expect(ids(store, rows, [{ colId: 'when', direction: 'desc' }], { name: { filterType: 'text', type: 'contains', filter: 'no' } })).toEqual(['a', 'b']);
    expect(ids(store, rows, [{ colId: 'when', direction: 'desc' }], { name: { filterType: 'text', type: 'equals', filter: 'nora' } })).toEqual(['a', 'b']);
    expect(ids(store, rows, [], { name: { filterType: 'text', type: 'blank' } })).toEqual(['e', 'f']);
    expect(ids(store, rows, [{ colId: 'when', direction: 'desc' }], { qty: { filterType: 'number', type: 'greaterThan', filter: 2 } })).toEqual(['d', 'c']);
    expect(ids(store, rows, [], { qty: { filterType: 'number', type: 'inRange', filter: 0, filterTo: 10 } })).toEqual(['a']);
    expect(ids(store, rows, [], { qty: { filterType: 'number', type: 'blank' } })).toEqual(['b']);
    expect(ids(store, rows, [], { qty: { filterType: 'number', type: 'equals', filter: 10 } })).toEqual(['c', 'd']);
    expect(ids(store, rows, [], { when: { filterType: 'date', type: 'equals', dateFrom: '2020-05-02' } })).toEqual(['a', 'e']);
    expect(ids(store, rows, [], { when: { filterType: 'date', type: 'lessThan', dateFrom: '2020-01-01' } })).toEqual(['d']);
    expect(ids(store, rows, [{ colId: 'when', direction: 'desc' }], {
      name: {
        filterType: 'text',
        operator: 'OR',
        conditions: [
          { filterType: 'text', type: 'equals', filter: 'Amy' },
          { filterType: 'text', type: 'startsWith', filter: 'Bo' },
        ],
      },
    })).toEqual(['d', 'c']);
  });

  it('matches a reference sort for random numeric columns', () => {
    const values = Array.from({ length: 5000 }, () => {
      const roll = Math.random();
      if (roll < 0.05) return null;
      if (roll < 0.07) return 0;
      if (roll < 0.08) return -0;
      const n = (Math.random() - 0.5) * 1e6;
      return Math.random() < 0.05 ? Math.trunc(n) : n;
    });
    const data = values.map((qty, index) => ({ id: String(index), qty }));
    const built = rowsOf(data);
    for (const direction of ['asc', 'desc'] as const) {
      const actual = ids(built.store, built.rows, [{ colId: 'qty', direction }]);
      const expected = data
        .map((row, index) => ({ index, qty: row.qty }))
        .sort((a, b) => {
          const aNull = a.qty == null;
          const bNull = b.qty == null;
          if (aNull && bNull) return 0;
          if (aNull) return direction === 'desc' ? 1 : -1;
          if (bNull) return direction === 'desc' ? -1 : 1;
          const delta = Number(a.qty) - Number(b.qty);
          if (delta === 0) return 0;
          return direction === 'desc' ? -delta : delta;
        })
        .map((row) => String(row.index));
      expect(actual).toEqual(expected);
    }
  });

  it('matches a quick filter as case-insensitive words across columns', () => {
    expect(ids(store, rows, [], null, 'no')).toEqual(['a', 'b']);
    expect(ids(store, rows, [], null, '10')).toEqual(['c', 'd']);
    expect(ids(store, rows, [], null, '2020')).toEqual(['a', 'b', 'e', 'f']);
    expect(ids(store, rows, [], null, 'bo   10')).toEqual(['d']);
    expect(ids(store, rows, [], null, 'alpha beta')).toEqual([]);
    expect(ids(store, rows, [], null, '  ')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(ids(store, rows, [], { qty: { filterType: 'number', type: 'equals', filter: 10 } }, 'no')).toEqual([]);
  });
});
