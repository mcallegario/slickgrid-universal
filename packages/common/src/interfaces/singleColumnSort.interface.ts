import { ColumnSort } from './columnSort.interface';
import { SlickGrid } from './slickGrid.interface';

export interface SingleColumnSort extends ColumnSort {
  /** SlickGrid grid object */
  grid?: SlickGrid;

  /** is it a multi-column sort? */
  multiColumnSort?: false;

  /** previous sort columns before calling onSort */
  previousSortColumns?: ColumnSort[];
}
