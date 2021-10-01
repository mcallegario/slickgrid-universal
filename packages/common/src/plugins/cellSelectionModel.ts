import { CellRange, OnActiveCellChangedEventArgs, SlickGrid, SlickNamespace, SlickRange, } from '../interfaces/index';
import { CellRangeSelector } from './index';

// using external SlickGrid JS libraries
declare const Slick: SlickNamespace;

export class CellSelectionModel {
  protected _addonOptions: any;
  protected _grid!: SlickGrid;
  protected _canvas: HTMLElement | null = null;
  protected _ranges: SlickRange[] = [];
  protected _selector: CellRangeSelector;
  protected _defaults = {
    selectActiveCell: true,
  };
  onSelectedRangesChanged = new Slick.Event();
  pluginName = 'CellSelectionModel';

  constructor(options?: any) {
    if (options === undefined || typeof options.cellRangeSelector === undefined) {
      this._selector = new CellRangeSelector({
        selectionCss: {
          border: '2px solid black'
        }
      });
    } else {
      this._selector = options.cellRangeSelector;
    }
    this._addonOptions = options;
  }


  init(grid: SlickGrid) {
    this._addonOptions = { ...this._defaults, ...this._addonOptions };
    this._grid = grid;
    this._canvas = this._grid.getCanvasNode();
    this._grid.onActiveCellChanged.subscribe(this.handleActiveCellChange.bind(this));
    this._grid.onKeyDown.subscribe(this.handleKeyDown.bind(this));
    grid.registerPlugin(this._selector);
    this._selector.onCellRangeSelected.subscribe(this.handleCellRangeSelected.bind(this));
    this._selector.onBeforeCellRangeSelected.subscribe(this.handleBeforeCellRangeSelected.bind(this));
  }

  /** @deprecated @use `dispose` Destroy plugin. */
  destroy() {
    this.dispose();
  }

  dispose() {
    this._grid.onActiveCellChanged.unsubscribe(this.handleActiveCellChange.bind(this));
    this._grid.onKeyDown.unsubscribe(this.handleKeyDown.bind(this));
    this._selector.onCellRangeSelected.unsubscribe(this.handleCellRangeSelected.bind(this));
    this._selector.onBeforeCellRangeSelected.unsubscribe(this.handleBeforeCellRangeSelected.bind(this));
    this._grid.unregisterPlugin(this._selector as any);
    this._canvas = null;
    this._selector?.destroy();
  }

  removeInvalidRanges(ranges: any[]) {
    const result = [];

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (this._grid.canCellBeSelected(r.fromRow, r.fromCell) && this._grid.canCellBeSelected(r.toRow, r.toCell)) {
        result.push(r);
      }
    }

    return result;
  }

  rangesAreEqual(range1: any, range2: any) {
    let areDifferent = (range1.length !== range2.length);
    if (!areDifferent) {
      for (let i = 0; i < range1.length; i++) {
        if (
          range1[i].fromCell !== range2[i].fromCell
          || range1[i].fromRow !== range2[i].fromRow
          || range1[i].toCell !== range2[i].toCell
          || range1[i].toRow !== range2[i].toRow
        ) {
          areDifferent = true;
          break;
        }
      }
    }
    return !areDifferent;
  }

  setSelectedRanges(ranges: any[]) {
    // simple check for: empty selection didn't change, prevent firing onSelectedRangesChanged
    if ((!this._ranges || this._ranges.length === 0) && (!ranges || ranges.length === 0)) { return; }

    // if range has not changed, don't fire onSelectedRangesChanged
    const rangeHasChanged = !this.rangesAreEqual(this._ranges, ranges);

    this._ranges = this.removeInvalidRanges(ranges);
    if (rangeHasChanged) {
      this.onSelectedRangesChanged.notify(this._ranges);
    }
  }

  getSelectedRanges() {
    return this._ranges;
  }

  handleBeforeCellRangeSelected(e: any): boolean | void {
    if (this._grid.getEditorLock().isActive()) {
      e.stopPropagation();
      return false;
    }
  }

  handleCellRangeSelected(_e: any, args: { range: CellRange; }) {
    this._grid.setActiveCell(args.range.fromRow, args.range.fromCell, false, false, true);
    this.setSelectedRanges([args.range]);
  }

  handleActiveCellChange(_e: any, args: OnActiveCellChangedEventArgs) {
    if (this._addonOptions.selectActiveCell && args.row !== null && args.cell !== null) {
      this.setSelectedRanges([new Slick.Range(args.row, args.cell)]);
    } else if (!this._addonOptions.selectActiveCell) {
      // clear the previous selection once the cell changes
      this.setSelectedRanges([]);
    }
  }

  handleKeyDown(e: any) {
    /***
     * Кey codes
     * 37 left
     * 38 up
     * 39 right
     * 40 down
     */
    let ranges: SlickRange[];
    let last: SlickRange;
    const active = this._grid.getActiveCell();
    const metaKey = e.ctrlKey || e.metaKey;

    if (active && e.shiftKey && !metaKey && !e.altKey &&
      (e.which === 37 || e.which === 39 || e.which === 38 || e.which === 40)) {

      ranges = this.getSelectedRanges().slice();
      if (!ranges.length) {
        ranges.push(new Slick.Range(active.row, active.cell));
      }
      // keyboard can work with last range only
      last = ranges.pop() as SlickRange;

      // can't handle selection out of active cell
      if (!last.contains(active.row, active.cell)) {
        last = new Slick.Range(active.row, active.cell);
      }
      let dRow = last.toRow - last.fromRow;
      let dCell = last.toCell - last.fromCell;
      // walking direction
      const dirRow = active.row === last.fromRow ? 1 : -1;
      const dirCell = active.cell === last.fromCell ? 1 : -1;

      if (e.which === 37) {
        dCell -= dirCell;
      } else if (e.which === 39) {
        dCell += dirCell;
      } else if (e.which === 38) {
        dRow -= dirRow;
      } else if (e.which === 40) {
        dRow += dirRow;
      }

      // define new selection range
      const newLast = new Slick.Range(active.row, active.cell, active.row + dirRow * dRow, active.cell + dirCell * dCell);
      if (this.removeInvalidRanges([newLast]).length) {
        ranges.push(newLast);
        const viewRow = dirRow > 0 ? newLast.toRow : newLast.fromRow;
        const viewCell = dirCell > 0 ? newLast.toCell : newLast.fromCell;
        this._grid.scrollRowIntoView(viewRow);
        this._grid.scrollCellIntoView(viewRow, viewCell, false);
      }
      else {
        ranges.push(last);
      }
      this.setSelectedRanges(ranges);

      e.preventDefault();
      e.stopPropagation();
    }
  }
}