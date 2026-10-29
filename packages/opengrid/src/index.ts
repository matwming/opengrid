export type {
  AgEvent,
  ApplyColumnStateParams,
  CellClickedEvent,
  CellFocusedEvent,
  CellPosition,
  CellValueChangedEvent,
  ColDef,
  ColGroupDef,
  Column,
  ColumnPinnedType,
  ColumnState,
  CombinedFilterModel,
  CsvExportParams,
  FilterModel,
  FilterParams,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IRowNode,
  ProvidedFilterModel,
  RowModelType,
  RowSelectionOptions,
  SelectionChangedEvent,
  SimpleFilterModel,
  SortDirection,
  StartEditingCellParams,
} from './types';

export { createGrid } from './session';

export const AllCommunityModule = { moduleName: 'AllCommunity', version: '0.1.0' } as const;

const registered = new Set<string>();

export const ModuleRegistry = {
  registerModules(modules: readonly { moduleName?: string }[]): void {
    for (const module of modules) {
      if (module.moduleName) registered.add(module.moduleName);
    }
  },
  registerModule(module: { moduleName?: string }): void {
    if (module.moduleName) registered.add(module.moduleName);
  },
};

export function isModuleRegistered(moduleName: string): boolean {
  return registered.has(moduleName) || moduleName === 'AllCommunity';
}
