import { Aggregators, Editors, Enums, Filters, Formatters, GroupTotalFormatters, SortComparers, Utilities } from '@slickgrid-universal/common';
import { BindingService } from '@slickgrid-universal/binding';
import { EventPubSubService } from '@slickgrid-universal/event-pub-sub';
import { SlickCompositeEditorComponent } from '@slickgrid-universal/composite-editor-component';
import { SlickEmptyWarningComponent } from '@slickgrid-universal/empty-warning-component';
import { SlickPaginationComponent } from '@slickgrid-universal/pagination-component';
import { SlickVanillaGridBundle } from './components/slick-vanilla-grid-bundle';
import { ExcelExportService } from '@slickgrid-universal/excel-export';

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
};

// expose the bundle on the global "window" object as Slicker
if (typeof window !== 'undefined') {
  (window as any).Slicker = Slicker;
  (window as any).ExcelExportService = ExcelExportService;
}

export { BindingService };
export { Aggregators, Editors, Enums, EventPubSubService, Filters, Formatters, GroupTotalFormatters, SortComparers, Utilities };
export { SlickCompositeEditorComponent, SlickEmptyWarningComponent, SlickPaginationComponent, SlickVanillaGridBundle }; // export the custom components & interfaces
export { Slicker };
export { ExcelExportService };
export * from './interfaces/index';
export * from './services/index';
