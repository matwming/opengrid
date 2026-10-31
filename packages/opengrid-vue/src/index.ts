import { createGrid, type ColDef, type GridApi, type GridOptions } from 'opengrid';
import { defineComponent, h, onBeforeUnmount, onMounted, ref, render, watch, type Component, type PropType } from 'vue';

const OPTION_KEYS = [
  'columnDefs',
  'defaultColDef',
  'rowData',
  'rowSelection',
  'getRowId',
  'pagination',
  'paginationPageSize',
  'quickFilterText',
  'rowHeight',
  'headerHeight',
  'rowModelType',
  'datasource',
  'cacheBlockSize',
  'infiniteInitialRowCount',
  'rowDragManaged',
  'context',
  'loading',
  'onGridReady',
  'onFirstDataRendered',
  'onModelUpdated',
  'onSelectionChanged',
  'onCellValueChanged',
  'onSortChanged',
  'onFilterChanged',
  'onRowDragEnd',
] as const;

type OptionKey = (typeof OPTION_KEYS)[number];

const EVENT_KEYS = [
  'onGridReady',
  'onFirstDataRendered',
  'onModelUpdated',
  'onSelectionChanged',
  'onCellValueChanged',
  'onSortChanged',
  'onFilterChanged',
  'onRowDragEnd',
] as const;

function eventName(handler: string): string {
  const raw = handler.slice(2);
  return raw.charAt(0).toLowerCase() + raw.slice(1).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function isVueComponent(value: unknown): value is Component {
  return Boolean(value) && typeof value === 'object' && ('setup' in value || 'render' in value || 'template' in value);
}

function vueColumns(defs: GridOptions['columnDefs']): GridOptions['columnDefs'] {
  return defs?.map((def) => {
    if ('children' in def) return { ...def, children: vueColumns(def.children) ?? [] };
    if (!isVueComponent(def.cellRenderer)) return def;
    const component = def.cellRenderer;
    const cellRenderer = (params: { value: unknown }) => {
      const host = document.createElement('div');
      render(h(component, { params }), host);
      return host;
    };
    return { ...def, cellRenderer } as ColDef;
  });
}

function readOptions(props: Record<string, unknown>): GridOptions {
  const options: GridOptions = { ...((props.gridOptions as GridOptions | undefined) ?? {}) };
  for (const key of OPTION_KEYS) {
    if (key.startsWith('on')) continue;
    if (props[key] !== undefined) options[key] = props[key] as never;
  }
  options.columnDefs = vueColumns(options.columnDefs);
  return options;
}

export const AgGridVue = defineComponent({
  name: 'AgGridVue',
  props: {
    gridOptions: { type: Object as PropType<GridOptions>, default: undefined },
    ...Object.fromEntries(OPTION_KEYS.map((key) => [key, { default: undefined }])),
  },
  emits: EVENT_KEYS.map((key) => eventName(key)),
  setup(props, { emit, expose }) {
    const host = ref<HTMLDivElement | null>(null);
    const handle: { api: GridApi | null } = { api: null };
    expose(handle);
    let alive = false;

    onMounted(() => {
      const element = host.value;
      if (!element) return;
      const options = readOptions(props as Record<string, unknown>);
      for (const key of EVENT_KEYS) {
        const fromOptions = (props.gridOptions as GridOptions | undefined)?.[key] as ((event: never) => void) | undefined;
        options[key] = ((event: never) => {
          fromOptions?.(event);
          emit(eventName(key), event);
        }) as never;
      }
      handle.api = createGrid(element, options);
      alive = true;
    });

    watch(
      () => (props as { rowData?: unknown }).rowData,
      (value) => {
        if (!alive) return;
        handle.api?.setGridOption('rowData', value as never);
      },
    );

    watch(
      () => (props as { columnDefs?: unknown }).columnDefs,
      (value) => {
        if (!alive) return;
        handle.api?.setGridOption('columnDefs', value as never);
      },
    );

    onBeforeUnmount(() => {
      handle.api?.destroy();
      handle.api = null;
      alive = false;
    });

    return () => h('div', { ref: host, class: 'og-vue', style: { width: '100%', height: '100%' } });
  },
});

export type { OptionKey };
