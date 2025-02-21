import { BasePubSubService } from '@slickgrid-universal/event-pub-sub';
import { arrayRemoveItemByIndex } from '@slickgrid-universal/utils';

import { EmitterType } from '../enums/index';
import {
  Column,
  CurrentSorter,
  DOMEvent,
  HeaderMenu,
  HeaderMenuCommandItemCallbackArgs,
  HeaderMenuItems,
  HeaderMenuOption,
  MenuCommandItem,
  MenuCommandItemCallbackArgs,
  MenuOptionItem,
  MultiColumnSort,
  OnHeaderCellRenderedEventArgs,
} from '../interfaces/index';
import { createDomElement, emptyElement, getElementOffsetRelativeToParent, getTranslationPrefix } from '../services/index';
import { ExtensionUtility } from '../extensions/extensionUtility';
import { FilterService } from '../services/filter.service';
import { SharedService } from '../services/shared.service';
import { SortService } from '../services/sort.service';
import { ExtendableItemTypes, ExtractMenuType, MenuBaseClass, MenuType } from './menuBaseClass';

/**
 * A plugin to add drop-down menus to column headers.
 * To specify a custom button in a column header, extend the column definition like so:
 *   this.columnDefinitions = [{
 *     id: 'myColumn', name: 'My column',
 *     header: {
 *       menu: {
 *         items: [{ ...menu item options... }, { ...menu item options... }]
 *       }
 *     }
 *   }];
 */
export class SlickHeaderMenu extends MenuBaseClass<HeaderMenu> {
  protected _activeHeaderColumnElm?: HTMLDivElement;
  protected _defaults = {
    autoAlign: true,
    autoAlignOffset: 0,
    buttonCssClass: null,
    buttonImage: null,
    minWidth: 100,
    hideColumnHideCommand: false,
    hideSortCommands: false,
    title: '',
  } as unknown as HeaderMenuOption;
  pluginName: 'HeaderMenu' = 'HeaderMenu' as const;

  /** Constructor of the SlickGrid 3rd party plugin, it can optionally receive options */
  constructor(
    protected readonly extensionUtility: ExtensionUtility,
    protected readonly filterService: FilterService,
    protected readonly pubSubService: BasePubSubService,
    protected readonly sharedService: SharedService,
    protected readonly sortService: SortService,
  ) {
    super(extensionUtility, pubSubService, sharedService);
    this._menuCssPrefix = 'slick-menu';
    this._menuPluginCssPrefix = 'slick-header-menu';
    this._camelPluginName = 'headerMenu';
    this.sharedService.gridOptions.headerMenu = this.addHeaderMenuCustomCommands(this.sharedService.columnDefinitions);
    this.init(sharedService.gridOptions.headerMenu);
  }

  /** Initialize plugin. */
  init(headerMenuOptions?: HeaderMenu) {
    this._addonOptions = { ...this._defaults, ...headerMenuOptions };

    // when setColumns is called (could be via toggle filtering/sorting or anything else),
    // we need to recreate header menu items custom commands array before the `onHeaderCellRendered` gets called
    this._eventHandler.subscribe(this.grid.onBeforeSetColumns, (e, args) => {
      this.sharedService.gridOptions.headerMenu = this.addHeaderMenuCustomCommands(args.newColumns);
    });
    this._eventHandler.subscribe(this.grid.onHeaderCellRendered, this.handleHeaderCellRendered.bind(this));
    this._eventHandler.subscribe(this.grid.onBeforeHeaderCellDestroy, this.handleBeforeHeaderCellDestroy.bind(this));

    // force the grid to re-render the header after the events are hooked up.
    this.grid.setColumns(this.grid.getColumns());

    // hide the menu when clicking outside the grid
    this._bindEventService.bind(document.body, 'mousedown', this.handleBodyMouseDown.bind(this) as EventListener);
  }

  /** Dispose (destroy) of the plugin */
  dispose() {
    super.dispose();
    this._menuElm = this._menuElm || document.body.querySelector(`.slick-header-menu${this.gridUidSelector}`);
    this._menuElm?.remove();
    this._activeHeaderColumnElm = undefined;
  }

  /** Hide a column from the grid */
  hideColumn(column: Column) {
    if (this.sharedService?.slickGrid?.getColumnIndex) {
      const columnIndex = this.sharedService.slickGrid.getColumnIndex(column.id);
      const currentVisibleColumns = this.sharedService.slickGrid.getColumns();

      // if we're using frozen columns, we need to readjust pinning when the new hidden column is on the left pinning container
      // we need to do this because SlickGrid freezes by index and has no knowledge of the columns themselves
      const frozenColumnIndex = this.sharedService.gridOptions.frozenColumn ?? -1;
      if (frozenColumnIndex >= 0 && frozenColumnIndex >= columnIndex) {
        this.sharedService.gridOptions.frozenColumn = frozenColumnIndex - 1;
        this.sharedService.slickGrid.setOptions({ frozenColumn: this.sharedService.gridOptions.frozenColumn });
      }

      // then proceed with hiding the column in SlickGrid & trigger an event when done
      const visibleColumns = arrayRemoveItemByIndex<Column>(currentVisibleColumns, columnIndex);
      this.sharedService.visibleColumns = visibleColumns;
      this.sharedService.slickGrid.setColumns(visibleColumns);
      this.pubSubService.publish('onHeaderMenuHideColumns', { columns: visibleColumns, hiddenColumn: column });
    }
  }

  /** Hide the Header Menu */
  hideMenu() {
    this._menuElm?.remove();
    this._menuElm = undefined;
    this._activeHeaderColumnElm?.classList.remove('slick-header-column-active');
  }

  showMenu(e: MouseEvent, columnDef: Column, menu: HeaderMenuItems) {
    // let the user modify the menu or cancel altogether,
    // or provide alternative menu implementation.
    const callbackArgs = {
      grid: this.grid,
      column: columnDef,
      menu
    } as unknown as HeaderMenuCommandItemCallbackArgs;

    // execute optional callback method defined by the user, if it returns false then we won't go further and not open the grid menu
    if (typeof e.stopPropagation === 'function') {
      this.pubSubService.publish('onHeaderMenuBeforeMenuShow', callbackArgs);
      if (typeof this.addonOptions?.onBeforeMenuShow === 'function' && this.addonOptions?.onBeforeMenuShow(e, callbackArgs) === false) {
        return;
      }
    }

    if (!this._menuElm) {
      this._menuElm = createDomElement('div', {
        className: 'slick-header-menu',
        style: { minWidth: `${this.addonOptions.minWidth}px` },
      });
      this._menuElm.setAttribute('aria-expanded', 'true');
      this.grid.getContainerNode()?.appendChild(this._menuElm);
    }

    // make sure the menu element is an empty div besore adding all list of commands
    emptyElement(this._menuElm);
    this.populateHeaderMenuCommandList(e, menu, callbackArgs);
  }

  /** Translate the Header Menu titles, we need to loop through all column definition to re-translate them */
  translateHeaderMenu() {
    if (this.sharedService.gridOptions?.headerMenu) {
      this.resetHeaderMenuTranslations(this.sharedService.visibleColumns);
    }
  }

  // --
  // event handlers
  // ------------------

  /**
   * Event handler when column title header are being rendered
   * @param {Object} event - The event
   * @param {Object} args - object arguments
   */
  protected handleHeaderCellRendered(_e: Event, args: OnHeaderCellRenderedEventArgs) {
    const column = args.column;
    const menu = column.header?.menu as HeaderMenuItems;

    if (menu && args.node) {
      // run the override function (when defined), if the result is false we won't go further
      if (!this.extensionUtility.runOverrideFunctionWhenExists(this.addonOptions.menuUsabilityOverride, args)) {
        return;
      }

      const headerButtonDivElm = createDomElement('div', { className: 'slick-header-menu-button' });

      if (this.addonOptions.buttonCssClass) {
        headerButtonDivElm.classList.add(...this.addonOptions.buttonCssClass.split(' '));
      }

      if (this.addonOptions.tooltip) {
        headerButtonDivElm.title = this.addonOptions.tooltip;
      }
      args.node.appendChild(headerButtonDivElm);

      // show the header menu dropdown list of commands
      this._bindEventService.bind(headerButtonDivElm, 'click', ((e: MouseEvent) => this.showMenu(e, column, menu)) as EventListener);
    }
  }

  /**
   * Event handler before the header cell is being destroyed
   * @param {Object} event - The event
   * @param {Object} args.column - The column definition
   */
  protected handleBeforeHeaderCellDestroy(_e: Event, args: { column: Column; node: HTMLElement; }) {
    const column = args.column;

    if (column.header?.menu) {
      // Removing buttons will also clean up any event handlers and data.
      // NOTE: If you attach event handlers directly or using a different framework,
      //       you must also clean them up here to avoid memory leaks.
      args.node.querySelectorAll('.slick-header-menu-button').forEach(elm => elm.remove());
    }
  }

  /** Mouse down handler when clicking anywhere in the DOM body */
  protected handleBodyMouseDown(e: DOMEvent<HTMLDivElement>) {
    if ((this._menuElm !== e.target && !this._menuElm?.contains(e.target)) || e.target.className === 'close') {
      this.hideMenu();
    }
  }

  protected handleMenuItemCommandClick(event: DOMEvent<HTMLDivElement>, _type: MenuType, item: ExtractMenuType<ExtendableItemTypes, MenuType>, columnDef?: Column): boolean | void {
    if (item === 'divider' || (item as MenuCommandItem).command && (item.disabled || (item as MenuCommandItem | MenuOptionItem).divider)) {
      return false;
    }

    const callbackArgs = {
      grid: this.grid,
      command: (item as MenuCommandItem).command,
      column: columnDef,
      item,
    } as MenuCommandItemCallbackArgs;

    // execute Grid Menu callback with command,
    // we'll also execute optional user defined onCommand callback when provided
    this.executeHeaderMenuInternalCommands(event, callbackArgs);
    this.pubSubService.publish('onHeaderMenuCommand', callbackArgs);
    if (typeof this.addonOptions?.onCommand === 'function') {
      this.addonOptions.onCommand(event, callbackArgs);
    }

    // execute action callback when defined
    if (typeof item.action === 'function') {
      (item as MenuCommandItem).action!.call(this, event, callbackArgs);
    }

    // does the user want to leave open the Grid Menu after executing a command?
    if (!event.defaultPrevented) {
      this.hideMenu();
    }

    // Stop propagation so that it doesn't register as a header click event.
    event.preventDefault();
    event.stopPropagation();
  }

  // --
  // protected functions
  // ------------------

  /**
   * Create Header Menu with Custom Commands if user has enabled Header Menu
   * @param gridOptions
   * @param columnDefinitions
   * @return header menu
   */
  protected addHeaderMenuCustomCommands(columnDefinitions: Column[]): HeaderMenu {
    const gridOptions = this.sharedService.gridOptions;
    const headerMenuOptions = gridOptions.headerMenu || {};
    const translationPrefix = getTranslationPrefix(gridOptions);

    if (Array.isArray(columnDefinitions) && gridOptions.enableHeaderMenu) {
      columnDefinitions.forEach((columnDef: Column) => {
        if (columnDef && !columnDef.excludeFromHeaderMenu) {
          if (!columnDef.header) {
            columnDef.header = {
              menu: {
                items: []
              }
            };
          } else if (!columnDef.header.menu) {
            // we might have header buttons without header menu,
            // so only initialize the header menu without overwrite header buttons
            columnDef.header.menu = { items: [] };
          }
          const columnHeaderMenuItems: Array<MenuCommandItem | 'divider'> = columnDef?.header?.menu?.items ?? [];

          // Freeze Column (pinning)
          let hasFrozenOrResizeCommand = false;
          if (headerMenuOptions && !headerMenuOptions.hideFreezeColumnsCommand) {
            hasFrozenOrResizeCommand = true;
            if (!columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'freeze-columns')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconFreezeColumns || 'fa fa-thumb-tack',
                titleKey: `${translationPrefix}FREEZE_COLUMNS`,
                command: 'freeze-columns',
                positionOrder: 47
              });
            }
          }

          // Column Resize by Content (column autofit)
          if (headerMenuOptions && !headerMenuOptions.hideColumnResizeByContentCommand && this.sharedService.gridOptions.enableColumnResizeOnDoubleClick) {
            hasFrozenOrResizeCommand = true;
            if (!columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'column-resize-by-content')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconColumnResizeByContentCommand || 'fa fa-arrows-h',
                titleKey: `${translationPrefix}COLUMN_RESIZE_BY_CONTENT`,
                command: 'column-resize-by-content',
                positionOrder: 48
              });
            }
          }

          // add a divider (separator) between the top freeze columns commands and the rest of the commands
          if (hasFrozenOrResizeCommand && !columnHeaderMenuItems.some(item => item !== 'divider' && item.positionOrder === 49)) {
            columnHeaderMenuItems.push({ divider: true, command: '', positionOrder: 49 });
          }

          // Sorting Commands
          if (gridOptions.enableSorting && columnDef.sortable && headerMenuOptions && !headerMenuOptions.hideSortCommands) {
            if (!columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'sort-asc')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconSortAscCommand || 'fa fa-sort-asc',
                titleKey: `${translationPrefix}SORT_ASCENDING`,
                command: 'sort-asc',
                positionOrder: 50
              });
            }
            if (!columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'sort-desc')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconSortDescCommand || 'fa fa-sort-desc',
                titleKey: `${translationPrefix}SORT_DESCENDING`,
                command: 'sort-desc',
                positionOrder: 51
              });
            }

            // add a divider (separator) between the top sort commands and the other clear commands
            if (!columnHeaderMenuItems.some(item => item !== 'divider' && item.positionOrder === 52)) {
              columnHeaderMenuItems.push({ divider: true, command: '', positionOrder: 52 });
            }

            if (!headerMenuOptions.hideClearSortCommand && !columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'clear-sort')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconClearSortCommand || 'fa fa-unsorted',
                titleKey: `${translationPrefix}REMOVE_SORT`,
                command: 'clear-sort',
                positionOrder: 54
              });
            }
          }

          // Filtering Commands
          if (gridOptions.enableFiltering && columnDef.filterable && headerMenuOptions && !headerMenuOptions.hideFilterCommand) {
            if (!headerMenuOptions.hideClearFilterCommand && !columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'clear-filter')) {
              columnHeaderMenuItems.push({
                iconCssClass: headerMenuOptions.iconClearFilterCommand || 'fa fa-filter',
                titleKey: `${translationPrefix}REMOVE_FILTER`,
                command: 'clear-filter',
                positionOrder: 53
              });
            }
          }

          // Hide Column Command
          if (headerMenuOptions && !headerMenuOptions.hideColumnHideCommand && !columnHeaderMenuItems.some(item => item !== 'divider' && item?.command === 'hide-column')) {
            columnHeaderMenuItems.push({
              iconCssClass: headerMenuOptions.iconColumnHideCommand || 'fa fa-times',
              titleKey: `${translationPrefix}HIDE_COLUMN`,
              command: 'hide-column',
              positionOrder: 55
            });
          }

          this.extensionUtility.translateMenuItemsFromTitleKey(columnHeaderMenuItems);
          this.extensionUtility.sortItems(columnHeaderMenuItems, 'positionOrder');
        }
      });
    }

    return headerMenuOptions;
  }

  /** Clear the Filter on the current column (if it's actually filtered) */
  protected clearColumnFilter(event: Event, args: MenuCommandItemCallbackArgs) {
    if (args?.column) {
      this.filterService.clearFilterByColumnId(event, args.column.id);
    }
  }

  /** Clear the Sort on the current column (if it's actually sorted) */
  protected clearColumnSort(event: Event, args: MenuCommandItemCallbackArgs) {
    if (args?.column && this.sharedService) {
      this.sortService.clearSortByColumnId(event, args.column.id);
    }
  }

  /** Execute the Header Menu Commands that was triggered by the onCommand subscribe */
  protected executeHeaderMenuInternalCommands(event: Event, args: MenuCommandItemCallbackArgs) {
    if (args?.command) {
      switch (args.command) {
        case 'hide-column':
          this.hideColumn(args.column);
          if (this.sharedService.gridOptions?.enableAutoSizeColumns) {
            this.sharedService.slickGrid.autosizeColumns();
          }
          break;
        case 'clear-filter':
          this.clearColumnFilter(event, args);
          break;
        case 'clear-sort':
          this.clearColumnSort(event, args);
          break;
        case 'column-resize-by-content':
          this.pubSubService.publish('onHeaderMenuColumnResizeByContent', { columnId: args.column.id });
          break;
        case 'freeze-columns':
          const visibleColumns = [...this.sharedService.visibleColumns];
          const columnPosition = visibleColumns.findIndex(col => col.id === args.column.id);
          const newGridOptions = { frozenColumn: columnPosition, enableMouseWheelScrollHandler: true };

          // to circumvent a bug in SlickGrid core lib, let's keep the columns positions ref and re-apply them after calling setOptions
          // the bug is highlighted in this issue comment:: https://github.com/6pac/SlickGrid/issues/592#issuecomment-822885069
          const previousColumnDefinitions = this.sharedService.slickGrid.getColumns();

          this.sharedService.slickGrid.setOptions(newGridOptions, false, true); // suppress the setColumns (3rd argument) since we'll do that ourselves
          this.sharedService.gridOptions.frozenColumn = newGridOptions.frozenColumn;
          this.sharedService.gridOptions.enableMouseWheelScrollHandler = newGridOptions.enableMouseWheelScrollHandler;
          this.sharedService.frozenVisibleColumnId = args.column.id;

          // to freeze columns, we need to take only the visible columns and we also need to use setColumns() when some of them are hidden
          // to make sure that we only use the visible columns, not doing this will have the undesired effect of showing back some of the hidden columns
          if (this.sharedService.hasColumnsReordered || (Array.isArray(visibleColumns) && Array.isArray(this.sharedService.allColumns) && visibleColumns.length !== this.sharedService.allColumns.length)) {
            this.sharedService.slickGrid.setColumns(visibleColumns);
          } else {
            // to circumvent a bug in SlickGrid core lib re-apply same column definitions that were backend up before calling setOptions()
            this.sharedService.slickGrid.setColumns(previousColumnDefinitions);
          }

          // we also need to autosize columns if the option is enabled
          const gridOptions = this.sharedService.slickGrid.getOptions();
          if (gridOptions.enableAutoSizeColumns) {
            this.sharedService.slickGrid.autosizeColumns();
          }
          break;
        case 'sort-asc':
        case 'sort-desc':
          const isSortingAsc = (args.command === 'sort-asc');
          this.sortColumn(event, args, isSortingAsc);
          break;
        default:
          break;
      }
    }
  }

  protected populateHeaderMenuCommandList(e: MouseEvent, menu: HeaderMenuItems, args: HeaderMenuCommandItemCallbackArgs) {
    this.populateCommandOrOptionItems(
      'command',
      this.addonOptions,
      this._menuElm as HTMLDivElement,
      menu.items,
      args,
      this.handleMenuItemCommandClick ,
    );

    this.repositionMenu(e);

    // execute optional callback method defined by the user
    this.pubSubService.publish('onHeaderMenuAfterMenuShow', args);
    if (typeof this.addonOptions?.onAfterMenuShow === 'function' && this.addonOptions?.onAfterMenuShow(e, args) === false) {
      return;
    }

    // Stop propagation so that it doesn't register as a header click event.
    e.preventDefault();
    e.stopPropagation();
  }

  protected repositionMenu(e: MouseEvent) {
    const buttonElm = e.target as HTMLDivElement; // get header button createElement
    if (this._menuElm && buttonElm.classList.contains('slick-header-menu-button')) {
      const relativePos = getElementOffsetRelativeToParent(this.sharedService.gridContainerElement, buttonElm);
      let leftPos = relativePos?.left ?? 0;

      // when auto-align is set, it will calculate whether it has enough space in the viewport to show the drop menu on the right (default)
      // if there isn't enough space on the right, it will automatically align the drop menu to the left
      // to simulate an align left, we actually need to know the width of the drop menu
      if (this.addonOptions.autoAlign) {
        const gridPos = this.grid.getGridPosition();
        if (gridPos?.width && (leftPos + (this._menuElm.clientWidth ?? 0)) >= gridPos.width) {
          leftPos = leftPos + buttonElm.clientWidth - this._menuElm.clientWidth + (this.addonOptions?.autoAlignOffset ?? 0);
        }
      }

      this._menuElm.style.top = `${(relativePos?.top ?? 0) + (this.addonOptions?.menuOffsetTop ?? 0) + buttonElm.clientHeight}px`;
      this._menuElm.style.left = `${leftPos}px`;

      // mark the header as active to keep the highlighting.
      this._activeHeaderColumnElm = this._menuElm.closest('.slick-header-column') as HTMLDivElement;
      this._activeHeaderColumnElm?.classList.add('slick-header-column-active');
    }
  }

  /**
   * Reset all the internal Menu options which have text to translate
   * @param header menu object
   */
  protected resetHeaderMenuTranslations(columnDefinitions: Column[]) {
    columnDefinitions.forEach((columnDef: Column) => {
      if (columnDef?.header?.menu?.items && !columnDef.excludeFromHeaderMenu) {
        const columnHeaderMenuItems: Array<MenuCommandItem | 'divider'> = columnDef.header.menu.items || [];
        this.extensionUtility.translateMenuItemsFromTitleKey(columnHeaderMenuItems);
      }
    });
  }

  /** Sort the current column */
  protected sortColumn(event: Event, args: MenuCommandItemCallbackArgs, isSortingAsc = true) {
    if (args?.column) {
      // get previously sorted columns
      const columnDef = args.column;

      // 1- get the sort columns without the current column, in the case of a single sort that would equal to an empty array
      const tmpSortedColumns = !this.sharedService.gridOptions.multiColumnSort ? [] : this.sortService.getCurrentColumnSorts(columnDef.id + '');

      let emitterType = EmitterType.local;

      // 2- add to the column array, the new sorted column by the header menu
      tmpSortedColumns.push({ columnId: columnDef.id, sortCol: columnDef, sortAsc: isSortingAsc });

      if (this.sharedService.gridOptions.backendServiceApi) {
        this.sortService.onBackendSortChanged(event, { multiColumnSort: true, sortCols: tmpSortedColumns, grid: this.sharedService.slickGrid });
        emitterType = EmitterType.remote;
      } else if (this.sharedService.dataView) {
        this.sortService.onLocalSortChanged(this.sharedService.slickGrid, tmpSortedColumns);
        emitterType = EmitterType.local;
      } else {
        // when using customDataView, we will simply send it as a onSort event with notify
        args.grid.onSort.notify(tmpSortedColumns as unknown as MultiColumnSort);
      }

      // update the sharedService.slickGrid sortColumns array which will at the same add the visual sort icon(s) on the UI
      const newSortColumns = tmpSortedColumns.map(col => {
        return {
          columnId: col?.sortCol?.id ?? '',
          sortAsc: col?.sortAsc ?? true,
        };
      });

      // add sort icon in UI
      this.sharedService.slickGrid.setSortColumns(newSortColumns);

      // if we have an emitter type set, we will emit a sort changed
      // for the Grid State Service to see the change.
      // We also need to pass current sorters changed to the emitSortChanged method
      if (emitterType) {
        const currentLocalSorters: CurrentSorter[] = [];
        newSortColumns.forEach((sortCol) => {
          currentLocalSorters.push({
            columnId: `${sortCol.columnId}`,
            direction: sortCol.sortAsc ? 'ASC' : 'DESC'
          });
        });
        this.sortService.emitSortChanged(emitterType, currentLocalSorters);
      }
    }
  }
}