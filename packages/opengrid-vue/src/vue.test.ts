import { createGrid } from 'opengrid';
import { createApp, nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { AgGridVue } from './index';

describe('AgGridVue', () => {
  it('exposes api and updates rowData', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const counts: number[] = [];
    const app = createApp({
      components: { AgGridVue },
      data: () => ({
        rows: [
          { id: 'a', name: 'Ada' },
          { id: 'b', name: 'Bea' },
        ],
        cols: [{ field: 'id' }, { field: 'name' }],
      }),
      methods: {
        ready(event: { api: { getDisplayedRowCount: () => number } }) {
          counts.push(event.api.getDisplayedRowCount());
        },
      },
      template: `<AgGridVue ref="grid" style="height:240px;width:480px" :rowData="rows" :columnDefs="cols" @grid-ready="ready" />`,
    });
    const vm = app.mount(root) as unknown as { $refs: { grid: { api: ReturnType<typeof createGrid> } }; rows: { id: string; name: string }[] };
    await nextTick();
    expect(counts).toEqual([2]);
    expect(vm.$refs.grid.api.getDisplayedRowAtIndex(0)?.data).toMatchObject({ id: 'a' });
    vm.rows = [{ id: 'c', name: 'Cy' }];
    await nextTick();
    expect(vm.$refs.grid.api.getDisplayedRowCount()).toBe(1);
    expect(vm.$refs.grid.api.getDisplayedRowAtIndex(0)?.data).toMatchObject({ id: 'c' });
    app.unmount();
  });
});
