import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  type OnChanges,
  type OnDestroy,
  Output,
  type SimpleChanges,
  ViewChild,
} from '@angular/core';
import { createGrid, type GridApi, type GridOptions, type GridReadyEvent } from 'opengrid';

@Component({
  selector: 'ag-grid-angular',
  standalone: true,
  template: `<div #eGrid style="width: 100%; height: 100%"></div>`,
})
export class AgGridAngular<TData = any> implements OnChanges, OnDestroy {
  @ViewChild('eGrid', { static: true }) eGrid?: ElementRef<HTMLDivElement>;
  hostElement: HTMLElement | null = null;

  @Input() gridOptions?: GridOptions<TData>;
  @Input() columnDefs?: GridOptions<TData>['columnDefs'];
  @Input() rowData?: GridOptions<TData>['rowData'];
  @Input() defaultColDef?: GridOptions<TData>['defaultColDef'];
  @Input() rowSelection?: GridOptions<TData>['rowSelection'];
  @Input() getRowId?: GridOptions<TData>['getRowId'];
  @Input() pagination?: boolean;
  @Input() paginationPageSize?: number;
  @Input() quickFilterText?: string;
  @Input() rowHeight?: number;

  @Output() gridReady = new EventEmitter<GridReadyEvent<TData>>();
  api: GridApi<TData> | null = null;
  private alive = false;

  ngAfterViewInit(): void {
    const element = this.eGrid?.nativeElement ?? this.hostElement;
    if (!element) throw new Error('opengrid: ag-grid-angular has no host element');
    const options: GridOptions<TData> = { ...(this.gridOptions ?? {}) };
    this.copyInputs(options);
    const userReady = options.onGridReady;
    options.onGridReady = (event) => {
      this.api = event.api;
      userReady?.(event);
      this.gridReady.emit(event);
    };
    this.api = createGrid(element, options);
    this.alive = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.alive || !this.api) return;
    for (const key of Object.keys(changes)) {
      const change = changes[key];
      if (!change || change.firstChange || key === 'gridOptions') continue;
      this.api.setGridOption(key as keyof GridOptions<TData>, change.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.api?.destroy();
    this.api = null;
    this.alive = false;
  }

  private copyInputs(options: GridOptions<TData>): void {
    const fields = ['columnDefs', 'rowData', 'defaultColDef', 'rowSelection', 'getRowId', 'pagination', 'paginationPageSize', 'quickFilterText', 'rowHeight'] as const;
    for (const key of fields) {
      if (this[key] !== undefined) options[key] = this[key] as never;
    }
    options.columnDefs = angularColumns(options.columnDefs);
  }
}

function angularColumns<TData>(defs: GridOptions<TData>['columnDefs']): GridOptions<TData>['columnDefs'] {
  return defs?.map((def) => {
    if ('children' in def) return { ...def, children: angularColumns(def.children) ?? [] };
    const renderer = def.cellRenderer;
    if (typeof renderer !== 'function' || !renderer.prototype) return def;
    const proto = renderer.prototype as { agInit?: (params: unknown) => void; getGui?: () => HTMLElement };
    if (typeof proto.agInit !== 'function' && typeof proto.getGui !== 'function') return def;
    return {
      ...def,
      cellRenderer: (params: { value: unknown }) => {
        const instance = new (renderer as new () => { agInit?: (params: unknown) => void; getGui?: () => HTMLElement })();
        instance.agInit?.(params);
        return instance.getGui?.() ?? document.createElement('span');
      },
    };
  });
}
