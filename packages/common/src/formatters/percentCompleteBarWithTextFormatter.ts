import { isNumber } from '@slickgrid-universal/utils';

import { Formatter } from './../interfaces/index';

/** Takes a cell value number (between 0-100) and displays SlickGrid custom "percent-complete-bar" with Text a red (<30), silver (>30 & <70) or green (>=70) bar */
export const percentCompleteBarWithTextFormatter: Formatter = (_row, _cell, value) => {
  if (!isNumber(value)) {
    return '';
  }

  let color = '';
  let inputNumber = parseFloat(value);
  if (inputNumber > 100) {
    inputNumber = 100;
  }

  if (inputNumber < 30) {
    color = 'red';
  } else if (inputNumber < 70) {
    color = 'silver';
  } else {
    color = 'green';
  }

  return `<div class="percent-complete-bar-with-text" title="${inputNumber}%" style="background:${color}; width:${inputNumber}%">${inputNumber}%</div>`;
};
