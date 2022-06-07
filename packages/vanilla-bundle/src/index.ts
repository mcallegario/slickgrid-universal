import { Aggregators, Editors, Enums, Filters, Formatters, GroupTotalFormatters, SortComparers, Utilities, SlickCellRangeSelector, SlickCellSelectionModel, SlickRowSelectionModel } from '@slickgrid-universal/common';
import { BindingService } from '@slickgrid-universal/binding';
import { EventPubSubService } from '@slickgrid-universal/event-pub-sub';
import { SlickEmptyWarningComponent } from '@slickgrid-universal/empty-warning-component';
import { SlickPaginationComponent } from '@slickgrid-universal/pagination-component';
import { SlickVanillaGridBundle } from './components/slick-vanilla-grid-bundle';
import { ExcelExportService } from '@slickgrid-universal/excel-export';
import { SlickRowDetailView } from '@slickgrid-universal/row-detail-view-plugin';

const Slicker = {
  GridBundle: SlickVanillaGridBundle,
  Aggregators,
  BindingService,
  Editors,
  Enums,
  Filters,
  Formatters,
  GroupTotalFormatters,
  SortComparers,
  Utilities,
  SlickCellRangeSelector,
  SlickCellSelectionModel,
  SlickRowSelectionModel,
};

// expose the bundle on the global "window" object as Slicker
if (typeof window !== 'undefined') {
  (window as any).Slicker = Slicker;
  (window as any).ExcelExportService = ExcelExportService;
  (window as any).SlickRowDetailView = SlickRowDetailView;
}

export { BindingService };
export { Aggregators, Editors, Enums, EventPubSubService, Filters, Formatters, GroupTotalFormatters, SortComparers, Utilities, SlickCellRangeSelector, SlickCellSelectionModel, SlickRowSelectionModel };
export { SlickEmptyWarningComponent, SlickPaginationComponent, SlickVanillaGridBundle }; // export the custom components & interfaces
export { Slicker };
export { ExcelExportService };
export { SlickRowDetailView };
export * from './interfaces/index';
export * from './services/index';
