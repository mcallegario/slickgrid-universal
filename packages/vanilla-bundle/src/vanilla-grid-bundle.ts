import 'slickgrid/lib/jquery.event.drag-2.3.0';
import 'slickgrid/lib/jquery.mousewheel';
import 'slickgrid/slick.core';
import 'slickgrid/slick.grid';
import 'slickgrid/slick.dataview';
import 'slickgrid/plugins/slick.resizer';
import {
  BackendServiceApi,
  Column,
  ExtensionName,
  EventNamingStyle,
  GridOption,
  Metrics,
  SlickEventHandler,
  GlobalGridOptions,

  // extensions
  AutoTooltipExtension,
  CheckboxSelectorExtension,
  CellExternalCopyManagerExtension,
  CellMenuExtension,
  ColumnPickerExtension,
  ContextMenuExtension,
  DraggableGroupingExtension,
  ExtensionUtility,
  GridMenuExtension,
  GroupItemMetaProviderExtension,
  HeaderMenuExtension,
  HeaderButtonExtension,
  RowSelectionExtension,

  // services
  FilterService,
  GridService,
  ExtensionService,
  SharedService,
  SortService,
  RowMoveManagerExtension,
  FilterFactory,
  CollectionService,
  GroupingAndColspanService,
  SlickgridConfig,
} from '@slickgrid-universal/common';

import { TranslateService } from './services/translate.service';
import { EventPubSubService } from './services/eventPubSub.service';

// using external non-typed js libraries
declare var Slick: any;
declare var $: any;

export class VanillaGridBundle {
  private _columnDefinitions: Column[];
  private _gridOptions: GridOption;
  private _dataset: any[];
  private _gridElm: Element;
  private _gridContainerElm: Element;
  private _hideHeaderRowAfterPageLoad = false;
  private _isLocalGrid = true;
  private _eventHandler: SlickEventHandler = new Slick.EventHandler();
  private _eventPubSubService: EventPubSubService;
  private _slickgridInitialized = false;
  backendServiceApi: BackendServiceApi | undefined;
  dataView: any;
  grid: any;
  metrics: Metrics;
  customDataView = false;
  groupItemMetadataProvider: any;

  // extensions
  extensionUtility: ExtensionUtility;
  autoTooltipExtension: AutoTooltipExtension;
  cellExternalCopyManagerExtension: CellExternalCopyManagerExtension;
  cellMenuExtension: CellMenuExtension;
  contextMenuExtension: ContextMenuExtension;
  columnPickerExtension: ColumnPickerExtension;
  checkboxExtension: CheckboxSelectorExtension;
  draggableGroupingExtension: DraggableGroupingExtension;
  gridMenuExtension: GridMenuExtension;
  groupItemMetaProviderExtension: GroupItemMetaProviderExtension;
  headerButtonExtension: HeaderButtonExtension;
  headerMenuExtension: HeaderMenuExtension;
  rowMoveManagerExtension: RowMoveManagerExtension;
  rowSelectionExtension: RowSelectionExtension;

  // services
  collectionService: CollectionService;
  extensionService: ExtensionService;
  filterService: FilterService;
  gridService: GridService;
  groupingAndColspanService: GroupingAndColspanService;
  sharedService: SharedService;
  sortService: SortService;
  translateService: TranslateService;

  gridWidthString = 'width: 800px';
  gridHeightString = 'height: 500px';
  gridClass: string;
  gridClassName: string;
  gridOptions: GridOption;

  get columnDefinitions() {
    return this._columnDefinitions;
  }
  set columnDefinitions(columnDefinitions) {
    this._columnDefinitions = columnDefinitions;
    if (this._slickgridInitialized) {
      this.updateColumnDefinitionsList(this._columnDefinitions);
    }
  }

  get dataset() {
    return this._dataset;
  }
  set dataset(dataset) {
    this._dataset = dataset;
    // this.refreshGridData(dataset);
  }

  constructor(gridContainerElm: Element, columnDefs: Column[], options: GridOption, dataset?: any[]) {
    this._columnDefinitions = columnDefs;
    this._gridOptions = options;
    this.dataset = dataset || [];
    this._eventPubSubService = new EventPubSubService(gridContainerElm);

    const slickgridConfig = new SlickgridConfig();
    this.sharedService = new SharedService();
    this.translateService = new TranslateService();
    this.collectionService = new CollectionService(this.translateService);
    const filterFactory = new FilterFactory(slickgridConfig, this.collectionService, this.translateService);
    this.filterService = new FilterService(filterFactory, this._eventPubSubService, this.sharedService);
    this.sortService = new SortService(this._eventPubSubService);
    this.extensionUtility = new ExtensionUtility(this.sharedService, this.translateService);
    this.groupingAndColspanService = new GroupingAndColspanService(this.extensionUtility);
    this.autoTooltipExtension = new AutoTooltipExtension(this.extensionUtility, this.sharedService);
    this.cellExternalCopyManagerExtension = new CellExternalCopyManagerExtension(this.extensionUtility, this.sharedService);
    this.cellMenuExtension = new CellMenuExtension(this.extensionUtility, this.sharedService, this.translateService);
    this.contextMenuExtension = new ContextMenuExtension(this.extensionUtility, this.sharedService, this.translateService);
    this.columnPickerExtension = new ColumnPickerExtension(this.extensionUtility, this.sharedService);
    this.checkboxExtension = new CheckboxSelectorExtension(this.extensionUtility, this.sharedService);
    this.draggableGroupingExtension = new DraggableGroupingExtension(this.extensionUtility, this.sharedService);
    this.gridMenuExtension = new GridMenuExtension(this.extensionUtility, this.filterService, this.sharedService, this.sortService, this.translateService);
    this.groupItemMetaProviderExtension = new GroupItemMetaProviderExtension(this.sharedService);
    this.headerButtonExtension = new HeaderButtonExtension(this.extensionUtility, this.sharedService);
    this.headerMenuExtension = new HeaderMenuExtension(this.extensionUtility, this.filterService, this._eventPubSubService, this.sharedService, this.sortService, this.translateService);
    this.rowMoveManagerExtension = new RowMoveManagerExtension(this.extensionUtility, this.sharedService);
    this.rowSelectionExtension = new RowSelectionExtension(this.extensionUtility, this.sharedService);
    this.gridService = new GridService(this.extensionService, this.filterService, this._eventPubSubService, this.sharedService, this.sortService)
    this.extensionService = new ExtensionService(
      this.autoTooltipExtension,
      this.cellExternalCopyManagerExtension,
      this.cellMenuExtension,
      this.checkboxExtension,
      this.columnPickerExtension,
      this.contextMenuExtension,
      this.draggableGroupingExtension,
      this.gridMenuExtension,
      this.groupItemMetaProviderExtension,
      this.headerButtonExtension,
      this.headerMenuExtension,
      this.rowMoveManagerExtension,
      this.rowSelectionExtension,
      this.sharedService,
      this.translateService,
    );

    this.initialization(gridContainerElm);
  }

  dispose() {
    this.dataView = undefined;
    this.gridOptions = {};
    this.extensionService.dispose();
    this.filterService.dispose();
    // this.gridEventService.dispose();
    // this.gridStateService.dispose();
    this.groupingAndColspanService.dispose();
    // this.paginationService.dispose();
    // this.resizer.dispose();
    this.sortService.dispose();
    if (this._eventHandler && this._eventHandler.unsubscribeAll) {
      this._eventHandler.unsubscribeAll();
    }
    this._eventPubSubService.unsubscribeAll();
    if (this.grid && this.grid.destroy) {
      this.grid.destroy();
    }
  }

  initialization(gridContainerElm: Element) {
    // create the slickgrid container and add it to the user's grid container
    this._gridContainerElm = gridContainerElm;
    this._gridElm = document.createElement('div');
    this._gridElm.className = 'slickgrid-container';
    gridContainerElm.appendChild(this._gridElm);

    this._gridOptions = this.mergeGridOptions(this._gridOptions);
    this.backendServiceApi = this.gridOptions && this.gridOptions.backendServiceApi;
    this._isLocalGrid = !this.backendServiceApi; // considered a local grid if it doesn't have a backend service set
    this._eventPubSubService.eventNamingStyle = this._gridOptions && this._gridOptions.eventNamingStyle || EventNamingStyle.camelCase;
    this._eventHandler = new Slick.EventHandler();
    if (!this.customDataView) {
      if (this._gridOptions.draggableGrouping || this._gridOptions.enableGrouping) {
        this.extensionUtility.loadExtensionDynamically(ExtensionName.groupItemMetaProvider);
        this.groupItemMetadataProvider = new Slick.Data.GroupItemMetadataProvider();
        this.sharedService.groupItemMetadataProvider = this.groupItemMetadataProvider;
        this.dataView = new Slick.Data.DataView({ groupItemMetadataProvider: this.groupItemMetadataProvider });
      } else {
        this.dataView = new Slick.Data.DataView();
      }
      this._eventPubSubService.publish('onDataviewCreated', this.dataView);
    }
    this.sharedService.allColumns = this._columnDefinitions;
    this.sharedService.visibleColumns = this._columnDefinitions;
    this.extensionService.createExtensionsBeforeGridCreation(this._columnDefinitions, this._gridOptions);

    this._columnDefinitions = this.swapInternalEditorToSlickGridFactoryEditor(this._columnDefinitions);
    this.grid = new Slick.Grid(this._gridElm, this.dataView, this._columnDefinitions, this._gridOptions);
    this.sharedService.dataView = this.dataView;
    this.sharedService.grid = this.grid;

    this.extensionService.bindDifferentExtensions();
    this.bindDifferentHooks(this.grid, this._gridOptions, this.dataView);
    this._slickgridInitialized = true;

    // initialize the SlickGrid grid
    this.grid.init();

    // load the data in the DataView
    this.dataView.beginUpdate();
    this.dataView.setItems(this.dataset, this._gridOptions.datasetIdPropertyName);
    this.dataView.endUpdate();

    this.grid.invalidate();
    this.grid.render();

    // bind & initialize the grid service
    this.gridService.init(this.grid, this.dataView);

    if (this._gridOptions.enableAutoResize) {
      const resizer = new Slick.Plugins.Resizer(this._gridOptions.autoResize);
      this.grid.registerPlugin(resizer);
    }

    // user might want to hide the header row on page load but still have `enableFiltering: true`
    // if that is the case, we need to hide the headerRow ONLY AFTER all filters got created & dataView exist
    if (this._hideHeaderRowAfterPageLoad) {
      this.showHeaderRow(false);
    }

    const slickerElementInstance = {
      // Slick Grid & DataView objects
      dataView: this.dataView,
      slickGrid: this.grid,

      // return all available Services (non-singleton)
      backendService: this.gridOptions && this.gridOptions.backendServiceApi && this.gridOptions.backendServiceApi.service,
      // excelExportService: this.excelExportService,
      // exportService: this.exportService,
      filterService: this.filterService,
      // gridEventService: this.gridEventService,
      // gridStateService: this.gridStateService,
      gridService: this.gridService,
      groupingService: this.groupingAndColspanService,
      extensionService: this.extensionService,
      // paginationService: this.paginationService,
      sortService: this.sortService,
    }

    this._eventPubSubService.publish('onSlickerGridCreated', slickerElementInstance);
  }

  mergeGridOptions(gridOptions: GridOption) {
    const options = $.extend(true, {}, GlobalGridOptions, gridOptions);

    // also make sure to show the header row if user have enabled filtering
    this._hideHeaderRowAfterPageLoad = (options.showHeaderRow === false);
    if (options.enableFiltering && !options.showHeaderRow) {
      options.showHeaderRow = options.enableFiltering;
    }

    // when we use Pagination on Local Grid, it doesn't seem to work without enableFiltering
    // so we'll enable the filtering but we'll keep the header row hidden
    if (!options.enableFiltering && options.enablePagination && this._isLocalGrid) {
      options.enableFiltering = true;
      options.showHeaderRow = false;
    }

    return options;
  }

  bindDifferentHooks(grid: any, gridOptions: GridOption, dataView: any) {
    // bind external filter (backend) when available or default onFilter (dataView)
    if (gridOptions.enableFiltering && !this.customDataView) {
      this.filterService.init(grid);

      // if user entered some Filter "presets", we need to reflect them all in the DOM
      // if (gridOptions.presets && Array.isArray(gridOptions.presets.filters) && gridOptions.presets.filters.length > 0) {
      //   this.filterService.populateColumnFilterSearchTermPresets(gridOptions.presets.filters);
      // }
      // bind external filter (backend) unless specified to use the local one
      if (gridOptions.backendServiceApi && !gridOptions.backendServiceApi.useLocalFiltering) {
        this.filterService.bindBackendOnFilter(grid, dataView);
      } else {
        this.filterService.bindLocalOnFilter(grid, dataView);
      }
    }

    // bind external sorting (backend) when available or default onSort (dataView)
    if (gridOptions.enableSorting && !this.customDataView) {
      // bind external sorting (backend) unless specified to use the local one
      if (gridOptions.backendServiceApi && !gridOptions.backendServiceApi.useLocalSorting) {
        this.sortService.bindBackendOnSort(grid, dataView);
      } else {
        this.sortService.bindLocalOnSort(grid, dataView);
      }
    }

    if (dataView && grid) {
      // expose all Slick Grid Events through dispatch
      for (const prop in grid) {
        if (grid.hasOwnProperty(prop) && prop.startsWith('on')) {
          this._eventHandler.subscribe(grid[prop], (event: Event, args: any) => {
            const gridEventName = this._eventPubSubService.getEventNameByNamingConvention(prop, this._gridOptions && this._gridOptions.defaultSlickgridEventPrefix || '');
            return this._eventPubSubService.dispatchCustomEvent(gridEventName, { eventData: event, args });
          });
        }
      }

      // expose all Slick DataView Events through dispatch
      for (const prop in dataView) {
        if (dataView.hasOwnProperty(prop) && prop.startsWith('on')) {
          this._eventHandler.subscribe(dataView[prop], (event: Event, args: any) => {
            const dataViewEventName = this._eventPubSubService.getEventNameByNamingConvention(prop, this._gridOptions && this._gridOptions.defaultSlickgridEventPrefix || '');
            return this._eventPubSubService.dispatchCustomEvent(dataViewEventName, { eventData: event, args });
          });
        }
      }

      this._eventHandler.subscribe(dataView.onRowCountChanged, (e: Event, args: { current: number }) => {
        grid.invalidate();

        this.metrics = {
          startTime: new Date(),
          endTime: new Date(),
          itemCount: args && args.current || 0,
          totalItemCount: Array.isArray(this.dataset) ? this.dataset.length : 0
        };
      });

      // without this, filtering data with local dataset will not always show correctly
      // also don't use "invalidateRows" since it destroys the entire row and as bad user experience when updating a row
      // see commit: https://github.com/ghiscoding/slickgrid-universal/commit/bb62c0aa2314a5d61188ff005ccb564577f08805
      if (gridOptions && gridOptions.enableFiltering && !gridOptions.enableRowDetailView) {
        this._eventHandler.subscribe(dataView.onRowsChanged, (e: Event, args: { rows: number[] }) => {
          if (args && args.rows && Array.isArray(args.rows)) {
            args.rows.forEach((row) => grid.updateRow(row));
            grid.render();
          }
        });
      }
    }
  }

  /**
   * Dynamically change or update the column definitions list.
   * We will re-render the grid so that the new header and data shows up correctly.
   * If using i18n, we also need to trigger a re-translate of the column headers
   */
  updateColumnDefinitionsList(newColumnDefinitions: Column[]) {
    // map/swap the internal library Editor to the SlickGrid Editor factory
    // console.log('newColumnDefinitions', newColumnDefinitions)
    newColumnDefinitions = this.swapInternalEditorToSlickGridFactoryEditor(newColumnDefinitions);
    if (this._gridOptions.enableTranslate) {
      this.extensionService.translateColumnHeaders(false, newColumnDefinitions);
    } else {
      this.extensionService.renderColumnHeaders(newColumnDefinitions);
    }

    if (this._gridOptions && this._gridOptions.enableAutoSizeColumns) {
      this.grid.autosizeColumns();
    }
  }

  /**
   * Show the filter row displayed on first row, we can optionally pass false to hide it.
   * @param showing
   */
  showHeaderRow(showing = true) {
    this.grid.setHeaderRowVisibility(showing);
    return showing;
  }


  /**
   * For convenience to the user, we provide the property "editor" as an Slickgrid-Universal editor complex object
   * however "editor" is used internally by SlickGrid for it's own Editor Factory
   * so in our lib we will swap "editor" and copy it into a new property called "internalColumnEditor"
   * then take back "editor.model" and make it the new "editor" so that SlickGrid Editor Factory still works
   */
  swapInternalEditorToSlickGridFactoryEditor(columnDefinitions: Column[]) {
    return columnDefinitions.map((column: Column) => {
      // on every Editor that have a "collectionAsync", resolve the data and assign it to the "collection" property
      // if (column.editor && column.editor.collectionAsync) {
      // this.loadEditorCollectionAsync(column);
      // }

      return { ...column, editor: column.editor && column.editor.model, internalColumnEditor: { ...column.editor } };
    });
  }
}
