import { createGrid, type GridApi, type GridOptions } from 'opengrid';
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactElement } from 'react';

export interface AgGridReactProps<TData = any> extends GridOptions<TData> {
  className?: string;
}

export interface AgGridReactRef<TData = any> {
  api: GridApi<TData>;
}

function AgGridReactInner<TData>(props: AgGridReactProps<TData>, ref: React.Ref<AgGridReactRef<TData>>): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GridApi<TData> | null>(null);
  const initial = useRef(props);
  const skipRow = useRef(true);
  const skipCols = useRef(true);

  useImperativeHandle(ref, () => ({
    get api() {
      if (!apiRef.current) throw new Error('opengrid: the grid is not ready');
      return apiRef.current;
    },
  }));

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const { className: _className, ...options } = initial.current;
    const api = createGrid(element, options);
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (skipRow.current) {
      skipRow.current = false;
      return;
    }
    apiRef.current?.setGridOption('rowData', props.rowData);
  }, [props.rowData]);

  useEffect(() => {
    if (skipCols.current) {
      skipCols.current = false;
      return;
    }
    apiRef.current?.setGridOption('columnDefs', props.columnDefs);
  }, [props.columnDefs]);

  const className = ['og-react', props.className].filter(Boolean).join(' ');
  return <div ref={host} className={className} style={{ height: '100%', width: '100%' }} />;
}

export const AgGridReact = forwardRef(AgGridReactInner) as <TData = any>(
  props: AgGridReactProps<TData> & { ref?: React.Ref<AgGridReactRef<TData>> },
) => ReactElement;
