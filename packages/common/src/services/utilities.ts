import * as DOMPurify_ from 'dompurify';
import * as moment_ from 'moment-mini';
const DOMPurify = DOMPurify_; // patch to fix rollup to work
const moment = (moment_ as any)['default'] || moment_; // patch to fix rollup "moment has no default export" issue, document here https://github.com/rollup/rollup/issues/670

import { FieldType, OperatorString, OperatorType } from '../enums/index';
import { EventSubscription, GridOption } from '../interfaces/index';
import { Observable, RxJsFacade, Subject, Subscription } from './rxjsFacade';

/**
 * Add an item to an array only when the item does not exists, when the item is an object we will be using their "id" to compare
 * @param inputArray
 * @param inputItem
 * @param itemIdPropName
 */
export function addToArrayWhenNotExists<T = any>(inputArray: T[], inputItem: T, itemIdPropName = 'id') {
  let arrayRowIndex = -1;
  if (typeof inputItem === 'object' && itemIdPropName in inputItem) {
    arrayRowIndex = inputArray.findIndex((item) => (item as any)[itemIdPropName] === (inputItem as any)[itemIdPropName]);
  } else {
    arrayRowIndex = inputArray.findIndex((item) => item === inputItem);
  }

  if (arrayRowIndex < 0) {
    inputArray.push(inputItem);
  }
}

/**
 * Simple function to which will loop and create as demanded the number of white spaces,
 * this is used in the CSV export
 * @param int nbSpaces: number of white spaces to create
 */
export function addWhiteSpaces(nbSpaces: number): string {
  let result = '';

  for (let i = 0; i < nbSpaces; i++) {
    result += ' ';
  }
  return result;
}

/**
 * Remove a column from the grid by it's index in the grid
 * @param array input
 * @param index
 */
export function arrayRemoveItemByIndex<T>(array: T[], index: number): T[] {
  return array.filter((_el: T, i: number) => index !== i);
}

/**
 * Try casting an input of type Promise | Observable into a Promise type.
 * @param object which could be of type Promise or Observable
 * @param fromServiceName string representing the caller service name and will be used if we throw a casting problem error
 */
export function castObservableToPromise<T>(rxjs: RxJsFacade, input: Promise<T> | Observable<T> | Subject<T>, fromServiceName = ''): Promise<T> {
  let promise: any = input;

  if (input instanceof Promise) {
    // if it's already a Promise then return it
    return input;
  } else if (rxjs.isObservable(input)) {
    promise = rxjs.firstValueFrom(input);
  }

  if (!(promise instanceof Promise)) {
    throw new Error(`Something went wrong, Slickgrid-Universal ${fromServiceName} is not able to convert the Observable into a Promise.`);
  }

  return promise;
}

/**
 * Convert a flat array (with "parentId" references) into a hierarchical dataset structure (where children are array(s) inside their parent objects)
 * @param flatArray input array (flat dataset)
 * @param options you can provide the following options:: "parentPropName" (defaults to "parent"), "childrenPropName" (defaults to "children") and "identifierPropName" (defaults to "id")
 * @return roots - hierarchical data view array
 */
export function convertParentChildArrayToHierarchicalView<T = any>(flatArray: T[], options?: { parentPropName?: string; childrenPropName?: string; identifierPropName?: string; levelPropName?: string; }): T[] {
  const childrenPropName = options?.childrenPropName ?? 'children';
  const parentPropName = options?.parentPropName ?? '__parentId';
  const identifierPropName = options?.identifierPropName ?? 'id';
  const hasChildrenFlagPropName = '__hasChildren';
  const treeLevelPropName = options?.levelPropName ?? '__treeLevel';
  const inputArray: T[] = deepCopy(flatArray || []);

  const roots: T[] = []; // things without parent

  // make them accessible by guid on this map
  const all: any = {};

  inputArray.forEach((item: any) => all[item[identifierPropName]] = item);

  // connect childrens to its parent, and split roots apart
  Object.keys(all).forEach((id) => {
    const item = all[id];
    if (!(parentPropName in item) || item[parentPropName] === null || item[parentPropName] === undefined || item[parentPropName] === '') {
      delete item[parentPropName];
      roots.push(item);
    } else if (item[parentPropName] in all) {
      const p = all[item[parentPropName]];
      if (!(childrenPropName in p)) {
        p[childrenPropName] = [];
      }
      delete item[parentPropName];
      p[childrenPropName].push(item);
    }

    // delete any unnecessary properties that were possibly created in the flat array but shouldn't be part of the tree data
    delete item[treeLevelPropName];
    delete item[hasChildrenFlagPropName];
  });

  return roots;
}

/**
 * Convert a hierarchical array (with children) into a flat array structure array (where the children are pushed as next indexed item in the array)
 * @param hierarchicalArray - input hierarchical array
 * @param options - you can provide "childrenPropName" (defaults to "children")
 * @return output - Parent/Child array
 */
export function convertHierarchicalViewToParentChildArray<T = any>(hierarchicalArray: T[], options?: { parentPropName?: string; childrenPropName?: string; identifierPropName?: string; }): T[] {
  const outputArray: T[] = [];
  convertHierarchicalViewToParentChildArrayByReference($.extend(true, [], hierarchicalArray), outputArray, options, 0);

  // the output array is the one passed as reference
  return outputArray;
}

/**
 * Convert a hierarchical array (with children) into a flat array structure array but using the array as the output (the array is the pointer reference)
 * @param hierarchicalArray - input hierarchical array
 * @param outputArrayRef - output array passed (and modified) by reference
 * @param options - you can provide "childrenPropName" (defaults to "children")
 * @param treeLevel - tree level number
 * @param parentId - parent ID
 */
export function convertHierarchicalViewToParentChildArrayByReference<T = any>(hierarchicalArray: T[], outputArrayRef: T[], options?: { childrenPropName?: string; parentPropName?: string; hasChildrenFlagPropName?: string; levelPropName?: string; identifierPropName?: string; }, treeLevel = 0, parentId?: string) {
  const childrenPropName = options?.childrenPropName ?? 'children';
  const identifierPropName = options?.identifierPropName ?? 'id';
  const hasChildrenFlagPropName = options?.hasChildrenFlagPropName ?? '__hasChildren';
  const treeLevelPropName = options?.levelPropName ?? '__treeLevel';
  const parentPropName = options?.parentPropName ?? '__parentId';

  if (Array.isArray(hierarchicalArray)) {
    for (const item of hierarchicalArray) {
      if (item) {
        const itemExist = outputArrayRef.some((itm: T) => (itm as any)[identifierPropName] === (item as any)[identifierPropName]);
        if (!itemExist) {
          (item as any)[treeLevelPropName] = treeLevel; // save tree level ref
          (item as any)[parentPropName] = parentId ?? null;
          outputArrayRef.push(item);
        }
        if (Array.isArray((item as any)[childrenPropName])) {
          treeLevel++;
          convertHierarchicalViewToParentChildArrayByReference((item as any)[childrenPropName], outputArrayRef, options, treeLevel, (item as any)[identifierPropName]);
          treeLevel--;
          (item as any)[hasChildrenFlagPropName] = true;
          delete (item as any)[childrenPropName]; // remove the children property
        }
      }
    }
  }
}

/**
 * Create an immutable clone of an array or object
 * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {Array|Object} objectOrArray The array or object to copy
 * @return {Array|Object}     The clone of the array or object
 */
export function deepCopy(objectOrArray: any | any[]): any | any[] {
  /**
   * Create an immutable copy of an object
   * @return {Object}
   */
  const cloneObj = () => {
    // Create new object
    const clone = {};

    // Loop through each item in the original
    // Recursively copy it's value and add to the clone
    for (const key in objectOrArray) {
      if (Object.prototype.hasOwnProperty.call(objectOrArray, key)) {
        (clone as any)[key] = deepCopy(objectOrArray[key]);
      }
    }
    return clone;
  };

  /**
   * Create an immutable copy of an array
   * @return {Array}
   */
  const cloneArr = () => {
    return objectOrArray.map((item: any) => deepCopy(item));
  };

  // -- init --//
  // Get object type
  const type = Object.prototype.toString.call(objectOrArray).slice(8, -1).toLowerCase();

  // If an object
  if (type === 'object') {
    return cloneObj();
  }
  // If an array
  if (type === 'array') {
    return cloneArr();
  }
  // Otherwise, return it as-is
  return objectOrArray;
}

/**
 * Empty a DOM element by removing all of its DOM element children leaving with an empty element (basically an empty shell)
 * @return {object} element - updated element
 */
export function emptyElement<T extends HTMLElement = HTMLElement>(element?: T): T | undefined {
  if (element?.firstChild) {
    while (element.firstChild) {
      if (element.lastChild) {
        element.removeChild(element.lastChild);
      }
    }
  }
  return element;
}

/**
 * Empty an object properties by looping through them all and deleting them
 * @param obj - input object
 */
export function emptyObject(obj: any) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      delete obj[key];
    }
  }
  obj = null;
  obj = {};

  return obj;
}

/**
 * Find an item from a hierarchical view structure (a parent that can have children array which themseleves can children and so on)
 * @param hierarchicalArray
 * @param predicate
 * @param childrenPropertyName
 */
export function findItemInHierarchicalStructure<T = any>(hierarchicalArray: T[], predicate: (item: T) => boolean, childrenPropertyName: string): T | undefined {
  if (!childrenPropertyName) {
    throw new Error('findRecursive requires parameter "childrenPropertyName"');
  }
  const initialFind = hierarchicalArray.find(predicate);
  const elementsWithChildren = hierarchicalArray.filter((x: T) => childrenPropertyName in x && (x as any)[childrenPropertyName]);
  if (initialFind) {
    return initialFind;
  } else if (elementsWithChildren.length) {
    const childElements: T[] = [];
    elementsWithChildren.forEach((item: T) => {
      if (childrenPropertyName in item) {
        childElements.push(...(item as any)[childrenPropertyName]);
      }
    });
    return findItemInHierarchicalStructure<T>(childElements, predicate, childrenPropertyName);
  }
  return undefined;
}

/**
 * HTML encode using jQuery with a <div>
 * Create a in-memory div, set it's inner text(which jQuery automatically encodes)
 * then grab the encoded contents back out.  The div never exists on the page.
 */
export function htmlEncode(inputValue: string): string {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
  };
  return (inputValue || '').toString().replace(/[&<>"']/g, (s) => (entityMap as any)[s]);
}

/**
 * Decode text into html entity
 * @param string text: input text
 * @param string text: output text
 */
export function htmlEntityDecode(input: string): string {
  return input.replace(/&#(\d+);/g, (_match, dec) => {
    return String.fromCharCode(dec);
  });
}

/**
 * Encode string to html special char and add html space padding defined
 * @param {string} inputStr - input string
 * @param {number} paddingLength - padding to add
 */
export function htmlEncodedStringWithPadding(inputStr: string, paddingLength: number): string {
  const inputStrLn = inputStr.length;
  let outputStr = htmlEncode(inputStr);

  if (inputStrLn < paddingLength) {
    for (let i = inputStrLn; i < paddingLength; i++) {
      outputStr += `&nbsp;`;
    }
  }
  return outputStr;
}

/**
 * Check if input value is a number, by default it won't be a strict checking
 * but optionally we could check for strict equality, for example in strict "3" will return False but without strict it will return True
 * @param value - input value of any type
 * @param strict - when using strict it also check for strict equality, for example in strict "3" will return but without strict it will return true
 */
export function isNumber(value: any, strict = false) {
  if (strict) {
    return (value === null || value === undefined || typeof value === 'string') ? false : !isNaN(value);
  }
  return (value === null || value === undefined || value === '') ? false : !isNaN(+value);
}

/**
 * Take a number (or a string) and display it as a formatted decimal string with defined minimum and maximum decimals
 * @param input
 * @param minDecimal
 * @param maxDecimal
 * @param decimalSeparator
 * @param thousandSeparator
 */
export function decimalFormatted(input: number | string, minDecimal?: number, maxDecimal?: number, decimalSeparator: '.' | ',' = '.', thousandSeparator: ',' | '_' | '.' | ' ' | '' = ''): string {
  if (isNaN(+input)) {
    return input as string;
  }

  const minDec = (minDecimal === undefined) ? 2 : minDecimal;
  const maxDec = (maxDecimal === undefined) ? 2 : maxDecimal;
  let amount = String(Math.round(+input * Math.pow(10, maxDec)) / Math.pow(10, maxDec));

  if ((amount.indexOf('.') < 0) && (minDec > 0)) {
    amount += '.';
  }
  while ((amount.length - amount.indexOf('.')) <= minDec) {
    amount += '0';
  }

  const decimalSplit = amount.split('.');
  let integerNumber;
  let decimalNumber;

  // do we want to display our number with a custom separator in each thousand position
  if (thousandSeparator) {
    integerNumber = decimalSplit.length >= 1 ? thousandSeparatorFormatted(decimalSplit[0], thousandSeparator) : undefined;
  } else {
    integerNumber = decimalSplit.length >= 1 ? decimalSplit[0] : amount;
  }

  // when using a separator that is not a dot, replace it with the new separator
  if (decimalSplit.length > 1) {
    decimalNumber = decimalSplit[1];
  }

  let output = '';
  if (integerNumber !== undefined && decimalNumber !== undefined) {
    output = `${integerNumber}${decimalSeparator}${decimalNumber}`;
  } else if (integerNumber !== undefined && integerNumber !== null) {
    output = integerNumber;
  }
  return output;
}

/**
 * Loop through all properties of an object and nullify any properties that are instanceof HTMLElement,
 * if we detect an array then use recursion to go inside it and apply same logic
 * @param obj - object containing 1 or more properties with DOM Elements
 */
export function destroyObjectDomElementProps(obj: any) {
  if (obj) {
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        destroyObjectDomElementProps(obj[key]);
      }
      if (obj[key] instanceof HTMLElement) {
        obj[key] = null;
      }
    }
  }
}

/**
 * Format a number following options passed as arguments (decimals, separator, ...)
 * @param input
 * @param minDecimal
 * @param maxDecimal
 * @param displayNegativeNumberWithParentheses
 * @param symbolPrefix
 * @param symbolSuffix
 * @param decimalSeparator
 * @param thousandSeparator
 */
export function formatNumber(input: number | string, minDecimal?: number, maxDecimal?: number, displayNegativeNumberWithParentheses?: boolean, symbolPrefix = '', symbolSuffix = '', decimalSeparator: '.' | ',' = '.', thousandSeparator: ',' | '_' | '.' | ' ' | '' = ''): string {
  if (isNaN(+input)) {
    return input as string;
  }

  const calculatedValue = ((Math.round(parseFloat(input as string) * 1000000) / 1000000));

  if (calculatedValue < 0) {
    const absValue = Math.abs(calculatedValue);
    if (displayNegativeNumberWithParentheses) {
      if (!isNaN(minDecimal as number) || !isNaN(maxDecimal as number)) {
        return `(${symbolPrefix}${decimalFormatted(absValue, minDecimal, maxDecimal, decimalSeparator, thousandSeparator)}${symbolSuffix})`;
      }
      const formattedValue = thousandSeparatorFormatted(`${absValue}`, thousandSeparator);
      return `(${symbolPrefix}${formattedValue}${symbolSuffix})`;
    } else {
      if (!isNaN(minDecimal as number) || !isNaN(maxDecimal as number)) {
        return `-${symbolPrefix}${decimalFormatted(absValue, minDecimal, maxDecimal, decimalSeparator, thousandSeparator)}${symbolSuffix}`;
      }
      const formattedValue = thousandSeparatorFormatted(`${absValue}`, thousandSeparator);
      return `-${symbolPrefix}${formattedValue}${symbolSuffix}`;
    }
  } else {
    if (!isNaN(minDecimal as number) || !isNaN(maxDecimal as number)) {
      return `${symbolPrefix}${decimalFormatted(input, minDecimal, maxDecimal, decimalSeparator, thousandSeparator)}${symbolSuffix}`;
    }
    const formattedValue = thousandSeparatorFormatted(`${input}`, thousandSeparator);
    return `${symbolPrefix}${formattedValue}${symbolSuffix}`;
  }
}

/**
 * From a dot (.) notation path, find and return a property within an object given a path
 * @param object - object input
 * @param path - path of the complex object, string with dot (.) notation
 * @returns outputValue - the object property value found if any
 */
export function getDescendantProperty<T = any>(object: T, path: string | undefined): any {
  if (!object || !path) {
    return object;
  }
  return path.split('.').reduce((obj, prop) => obj && (obj as any)[prop], object);
}

/** Get I18N Translation Prefix, defaults to an empty string */
export function getTranslationPrefix(gridOptions?: GridOption): string {
  if (gridOptions && gridOptions.translationNamespace) {
    return gridOptions.translationNamespace + (gridOptions.translationNamespaceSeparator || '');
  }
  return '';
}

/**
 * From a Date FieldType, return it's equivalent moment.js format
 * refer to moment.js for the format standard used: https://momentjs.com/docs/#/parsing/string-format/
 * @param fieldType
 */
export function mapMomentDateFormatWithFieldType(fieldType: typeof FieldType[keyof typeof FieldType]): string {
  let map: string;
  switch (fieldType) {
    case FieldType.dateTime:
    case FieldType.dateTimeIso:
      map = 'YYYY-MM-DD HH:mm:ss';
      break;
    case FieldType.dateTimeIsoAmPm:
      map = 'YYYY-MM-DD hh:mm:ss a';
      break;
    case FieldType.dateTimeIsoAM_PM:
      map = 'YYYY-MM-DD hh:mm:ss A';
      break;
    case FieldType.dateTimeShortIso:
      map = 'YYYY-MM-DD HH:mm';
      break;
    // all Euro Formats (date/month/year)
    case FieldType.dateEuro:
      map = 'DD/MM/YYYY';
      break;
    case FieldType.dateEuroShort:
      map = 'D/M/YY';
      break;
    case FieldType.dateTimeEuro:
      map = 'DD/MM/YYYY HH:mm:ss';
      break;
    case FieldType.dateTimeShortEuro:
      map = 'DD/MM/YYYY HH:mm';
      break;
    case FieldType.dateTimeEuroAmPm:
      map = 'DD/MM/YYYY hh:mm:ss a';
      break;
    case FieldType.dateTimeEuroAM_PM:
      map = 'DD/MM/YYYY hh:mm:ss A';
      break;
    case FieldType.dateTimeEuroShort:
      map = 'D/M/YY H:m:s';
      break;
    case FieldType.dateTimeEuroShortAmPm:
      map = 'D/M/YY h:m:s a';
      break;
    // all US Formats (month/date/year)
    case FieldType.dateUs:
      map = 'MM/DD/YYYY';
      break;
    case FieldType.dateUsShort:
      map = 'M/D/YY';
      break;
    case FieldType.dateTimeUs:
      map = 'MM/DD/YYYY HH:mm:ss';
      break;
    case FieldType.dateTimeUsAmPm:
      map = 'MM/DD/YYYY hh:mm:ss a';
      break;
    case FieldType.dateTimeUsAM_PM:
      map = 'MM/DD/YYYY hh:mm:ss A';
      break;
    case FieldType.dateTimeUsShort:
      map = 'M/D/YY H:m:s';
      break;
    case FieldType.dateTimeUsShortAmPm:
      map = 'M/D/YY h:m:s a';
      break;
    case FieldType.dateTimeShortUs:
      map = 'MM/DD/YYYY HH:mm';
      break;
    case FieldType.dateUtc:
      map = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
      break;
    case FieldType.date:
    case FieldType.dateIso:
    default:
      map = 'YYYY-MM-DD';
      break;
  }
  return map;
}

/**
 * From a Date FieldType, return it's equivalent Flatpickr format
 * refer to Flatpickr for the format standard used: https://chmln.github.io/flatpickr/formatting/#date-formatting-tokens
 * also note that they seem very similar to PHP format (except for am/pm): http://php.net/manual/en/function.date.php
 * @param fieldType
 */
export function mapFlatpickrDateFormatWithFieldType(fieldType: typeof FieldType[keyof typeof FieldType]): string {
  /*
    d: Day of the month, 2 digits with leading zeros	01 to 31
    D: A textual representation of a day	Mon through Sun
    l: (lowercase 'L')	A full textual representation of the day of the week	Sunday through Saturday
    j: Day of the month without leading zeros	1 to 31
    J: Day of the month without leading zeros and ordinal suffix	1st, 2nd, to 31st
    w: Numeric representation of the day of the week	0 (for Sunday) through 6 (for Saturday)
    F: A full textual representation of a month	January through December
    m: Numeric representation of a month, with leading zero	01 through 12
    n: Numeric representation of a month, without leading zeros	1 through 12
    M: A short textual representation of a month	Jan through Dec
    U: The number of seconds since the Unix Epoch	1413704993
    y: A two digit representation of a year	99 or 03
    Y: A full numeric representation of a year, 4 digits	1999 or 2003
    H: Hours (24 hours)	00 to 23
    h: Hours	1 to 12
    i: Minutes	00 to 59
    S: Seconds, 2 digits	00 to 59
    s: Seconds	0, 1 to 59
    K: AM/PM	AM or PM
  */
  let map: string;
  switch (fieldType) {
    case FieldType.dateTime:
    case FieldType.dateTimeIso:
      map = 'Y-m-d H:i:S';
      break;
    case FieldType.dateTimeShortIso:
      map = 'Y-m-d H:i';
      break;
    case FieldType.dateTimeIsoAmPm:
    case FieldType.dateTimeIsoAM_PM:
      map = 'Y-m-d h:i:S K'; // there is no lowercase in Flatpickr :(
      break;
    // all Euro Formats (date/month/year)
    case FieldType.dateEuro:
      map = 'd/m/Y';
      break;
    case FieldType.dateEuroShort:
      map = 'd/m/y';
      break;
    case FieldType.dateTimeEuro:
      map = 'd/m/Y H:i:S';
      break;
    case FieldType.dateTimeShortEuro:
      map = 'd/m/y H:i';
      break;
    case FieldType.dateTimeEuroAmPm:
      map = 'd/m/Y h:i:S K'; // there is no lowercase in Flatpickr :(
      break;
    case FieldType.dateTimeEuroAM_PM:
      map = 'd/m/Y h:i:s K';
      break;
    case FieldType.dateTimeEuroShort:
      map = 'd/m/y H:i:s';
      break;
    case FieldType.dateTimeEuroShortAmPm:
      map = 'd/m/y h:i:s K'; // there is no lowercase in Flatpickr :(
      break;
    // all US Formats (month/date/year)
    case FieldType.dateUs:
      map = 'm/d/Y';
      break;
    case FieldType.dateUsShort:
      map = 'm/d/y';
      break;
    case FieldType.dateTimeUs:
      map = 'm/d/Y H:i:S';
      break;
    case FieldType.dateTimeShortUs:
      map = 'm/d/y H:i';
      break;
    case FieldType.dateTimeUsAmPm:
      map = 'm/d/Y h:i:S K'; // there is no lowercase in Flatpickr :(
      break;
    case FieldType.dateTimeUsAM_PM:
      map = 'm/d/Y h:i:s K';
      break;
    case FieldType.dateTimeUsShort:
      map = 'm/d/y H:i:s';
      break;
    case FieldType.dateTimeUsShortAmPm:
      map = 'm/d/y h:i:s K'; // there is no lowercase in Flatpickr :(
      break;
    case FieldType.dateUtc:
      map = 'Z';
      break;
    case FieldType.date:
    case FieldType.dateIso:
    default:
      map = 'Y-m-d';
      break;
  }
  return map;
}

/**
 * Mapper for query operators (ex.: <= is "le", > is "gt")
 * @param string operator
 * @returns string map
 */
export function mapOperatorType(operator: OperatorType | OperatorString): OperatorType {
  let map: OperatorType;

  switch (operator) {
    case '<':
    case 'LT':
      map = OperatorType.lessThan;
      break;
    case '<=':
    case 'LE':
      map = OperatorType.lessThanOrEqual;
      break;
    case '>':
    case 'GT':
      map = OperatorType.greaterThan;
      break;
    case '>=':
    case 'GE':
      map = OperatorType.greaterThanOrEqual;
      break;
    case '<>':
    case '!=':
    case 'NE':
      map = OperatorType.notEqual;
      break;
    case '*':
    case 'a*':
    case 'StartsWith':
      map = OperatorType.startsWith;
      break;
    case '*z':
    case 'EndsWith':
      map = OperatorType.endsWith;
      break;
    case '=':
    case '==':
    case 'EQ':
      map = OperatorType.equal;
      break;
    case 'IN':
      map = OperatorType.in;
      break;
    case 'NIN':
    case 'NOT_IN':
      map = OperatorType.notIn;
      break;
    case 'Not_Contains':
    case 'NOT_CONTAINS':
      map = OperatorType.notContains;
      break;
    case 'Contains':
    case 'CONTAINS':
    default:
      map = OperatorType.contains;
      break;
  }

  return map;
}

/**
 * Find equivalent short designation of an Operator Type or Operator String.
 * When using a Compound Filter, we use the short designation and so we need the mapped value.
 * For example OperatorType.startsWith short designation is "a*", while OperatorType.greaterThanOrEqual is ">="
 */
export function mapOperatorToShorthandDesignation(operator: OperatorType | OperatorString): OperatorString {
  let shortOperator: OperatorString = '';

  switch (operator) {
    case OperatorType.greaterThan:
    case '>':
      shortOperator = '>';
      break;
    case OperatorType.greaterThanOrEqual:
    case '>=':
      shortOperator = '>=';
      break;
    case OperatorType.lessThan:
    case '<':
      shortOperator = '<';
      break;
    case OperatorType.lessThanOrEqual:
    case '<=':
      shortOperator = '<=';
      break;
    case OperatorType.notEqual:
    case '<>':
      shortOperator = '<>';
      break;
    case OperatorType.equal:
    case '=':
    case '==':
    case 'EQ':
      shortOperator = '=';
      break;
    case OperatorType.startsWith:
    case 'a*':
    case '*':
      shortOperator = 'a*';
      break;
    case OperatorType.endsWith:
    case '*z':
      shortOperator = '*z';
      break;
    default:
      // any other operator will be considered as already a short expression, so we can return same input operator
      shortOperator = operator;
      break;
  }

  return shortOperator;
}

/**
 * Mapper for query operator by a Filter Type
 * For example a multiple-select typically uses 'IN' operator
 * @param operator
 * @returns string map
 */
export function mapOperatorByFieldType(fieldType: typeof FieldType[keyof typeof FieldType]): OperatorType {
  let map: OperatorType;

  switch (fieldType) {
    case FieldType.unknown:
    case FieldType.string:
    case FieldType.text:
    case FieldType.password:
    case FieldType.readonly:
      map = OperatorType.contains;
      break;
    case FieldType.float:
    case FieldType.number:
    case FieldType.date:
    case FieldType.dateIso:
    case FieldType.dateUtc:
    case FieldType.dateTime:
    case FieldType.dateTimeIso:
    case FieldType.dateTimeIsoAmPm:
    case FieldType.dateTimeIsoAM_PM:
    case FieldType.dateEuro:
    case FieldType.dateEuroShort:
    case FieldType.dateTimeEuro:
    case FieldType.dateTimeEuroAmPm:
    case FieldType.dateTimeEuroAM_PM:
    case FieldType.dateTimeEuroShort:
    case FieldType.dateTimeEuroShortAmPm:
    case FieldType.dateTimeEuroShortAM_PM:
    case FieldType.dateUs:
    case FieldType.dateUsShort:
    case FieldType.dateTimeUs:
    case FieldType.dateTimeUsAmPm:
    case FieldType.dateTimeUsAM_PM:
    case FieldType.dateTimeUsShort:
    case FieldType.dateTimeUsShortAmPm:
    case FieldType.dateTimeUsShortAM_PM:
    default:
      map = OperatorType.equal;
      break;
  }

  return map;
}

/** Parse any input (bool, number, string) and return a boolean or False when not possible */
export function parseBoolean(input: any): boolean {
  return /(true|1)/i.test(input + '');
}

/**
 * Parse a date passed as a string (Date only, without time) and return a Date object (if valid)
 * @param inputDateString
 * @returns string date formatted
 */
export function parseUtcDate(inputDateString: any, useUtc?: boolean): string {
  let date = '';

  if (typeof inputDateString === 'string' && /^[0-9\-\/]*$/.test(inputDateString)) {
    // get the UTC datetime with moment.js but we need to decode the value so that it's valid text
    const dateString = decodeURIComponent(inputDateString);
    const dateMoment = moment(new Date(dateString));
    if (dateMoment.isValid() && dateMoment.year().toString().length === 4) {
      date = (useUtc) ? dateMoment.utc().format() : dateMoment.format();
    }
  }

  return date;
}

/**
 * Sanitize, return only the text without HTML tags
 * @input htmlString
 * @return text
 */
export function sanitizeHtmlToText(htmlString: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = htmlString;
  return temp.textContent || temp.innerText || '';
}

/**
 * Sanitize possible dirty html string (remove any potential XSS code like scripts and others), we will use 2 possible sanitizer
 * 1. optional sanitizer method defined in the grid options
 * 2. DOMPurify sanitizer (defaults)
 * @param gridOptions: grid options
 * @param dirtyHtml: dirty html string
 * @param domPurifyOptions: optional DOMPurify options when using that sanitizer
 */
export function sanitizeTextByAvailableSanitizer(gridOptions: GridOption, dirtyHtml: string, domPurifyOptions?: DOMPurify.Config & { RETURN_TRUSTED_TYPE: true; }): string {
  let sanitizedText = dirtyHtml;
  if (gridOptions && typeof gridOptions.sanitizer === 'function') {
    sanitizedText = gridOptions.sanitizer(dirtyHtml || '');
  } else if (typeof DOMPurify.sanitize === 'function') {
    sanitizedText = (DOMPurify.sanitize(dirtyHtml || '', domPurifyOptions || {}) || '').toString();
  }

  return sanitizedText;
}

/** Set the object value of deeper node from a given dot (.) notation path (e.g.: "user.firstName") */
export function setDeepValue<T = any>(obj: T, path: string | string[], value: any) {
  if (typeof path === 'string') {
    path = path.split('.');
  }

  if (path.length > 1) {
    const e = path.shift();
    if (obj && e !== undefined) {
      setDeepValue(
        (obj as any)[e] = Object.prototype.toString.call((obj as any)[e]) === '[object Object]' ? (obj as any)[e] : {},
        path,
        value
      );
    }
  } else if (obj && path[0]) {
    (obj as any)[path[0]] = value;
  }
}

/**
 * Format a number or a string into a string that is separated every thousand,
 * the default separator is a comma but user can optionally pass a different one
 * @param inputValue
 * @param separator default to comma ","
 * @returns string
 */
export function thousandSeparatorFormatted(inputValue: string | number | null, separator: ',' | '_' | '.' | ' ' | '' = ','): string | null {
  if (inputValue !== null && inputValue !== undefined) {
    const stringValue = `${inputValue}`;
    const decimalSplit = stringValue.split('.');
    if (decimalSplit.length === 2) {
      return `${decimalSplit[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator)}.${decimalSplit[1]}`;
    }
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  }
  return inputValue as null;
}

/**
 * Title case (or capitalize) first char of a string, for example "hello world" will become "Hello world"
 * Change the string to be title case on the complete sentence (upper case first char of each word while changing everything else to lower case)
 * @param inputStr
 * @returns string
 */
export function titleCase(inputStr: string, caseEveryWords = false): string {
  if (typeof inputStr === 'string') {
    if (caseEveryWords) {
      return inputStr.replace(/\w\S*/g, (outputStr) => {
        return outputStr.charAt(0).toUpperCase() + outputStr.substr(1).toLowerCase();
      });
    }
    return inputStr.charAt(0).toUpperCase() + inputStr.slice(1);
  }
  return inputStr;
}

/**
 * Converts a string to camel case (camelCase), for example "hello-world" (or "hellow world") will become "helloWorld"
 * @param inputStr the string to convert
 * @return the string in camel case
 */
export function toCamelCase(inputStr: string): string {
  if (typeof inputStr === 'string') {
    return inputStr.replace(/(?:^\w|[A-Z]|\b\w|[\s+\-_\/])/g, (match: string, offset: number) => {
      // remove white space or hypens or underscores
      if (/[\s+\-_\/]/.test(match)) {
        return '';
      }

      return offset === 0 ? match.toLowerCase() : match.toUpperCase();
    });
  }
  return inputStr;
}

/**
 * Converts a string to kebab (hypen) case, for example "helloWorld" will become "hello-world"
 * @param str the string to convert
 * @return the string in kebab case
 */
export function toKebabCase(inputStr: string): string {
  if (typeof inputStr === 'string') {
    return toCamelCase(inputStr).replace(/([A-Z])/g, '-$1').toLowerCase();
  }
  return inputStr;
}

/**
 * Uses the logic function to find an item in an array or returns the default
 * value provided (empty object by default)
 * @param any[] array the array to filter
 * @param function logic the logic to find the item
 * @param any [defaultVal={}] the default value to return
 * @return object the found object or default value
 */
export function findOrDefault<T = any>(array: T[], logic: (item: T) => boolean, defaultVal = {}): any {
  if (Array.isArray(array)) {
    return array.find(logic) || defaultVal;
  }
  return array;
}

/** Get HTML Element position offset (without jQuery) */
export function getHtmlElementOffset(element: HTMLElement): { top: number; left: number; } {
  const rect = element && element.getBoundingClientRect && element.getBoundingClientRect();
  let top = 0;
  let left = 0;

  if (rect && rect.top !== undefined && rect.left !== undefined) {
    top = rect.top + window.pageYOffset;
    left = rect.left + window.pageXOffset;
  }
  return { top, left };
}

/**
 * Converts a string from camelCase to snake_case (underscore) case
 * @param str the string to convert
 * @return the string in kebab case
 */
export function toSnakeCase(inputStr: string): string {
  if (typeof inputStr === 'string') {
    return toCamelCase(inputStr).replace(/([A-Z])/g, '_$1').toLowerCase();
  }
  return inputStr;
}

/**
 * Unsubscribe all Subscriptions
 * It will return an empty array if it all went well
 * @param subscriptions
 */
export function unsubscribeAll(subscriptions: Array<EventSubscription | Subscription>): Array<EventSubscription | Subscription> {
  if (Array.isArray(subscriptions)) {
    while (subscriptions.length > 0) {
      const subscription = subscriptions.pop();
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    }
  }

  return subscriptions;
}

/**
 * Takes an input array and makes sure the array has unique values by removing duplicates
 * @param array input with possible duplicates
 * @return array output without duplicates
 */
export function uniqueArray<T = any>(arr: T[]): T[] {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.filter((item: T, index: number) => {
      return arr.indexOf(item) >= index;
    });
  }
  return arr;
}

/**
 * Takes an input array of objects and makes sure the array has unique object values by removing duplicates
 * it will loop through the array using a property name (or "id" when is not provided) to compare uniqueness
 * @param array input with possible duplicates
 * @param propertyName defaults to "id"
 * @return array output without duplicates
 */
export function uniqueObjectArray(arr: any[], propertyName = 'id'): any[] {
  if (Array.isArray(arr) && arr.length > 0) {
    const result = [];
    const map = new Map();

    for (const item of arr) {
      if (item && !map.has(item[propertyName])) {
        map.set(item[propertyName], true);    // set any value to Map
        result.push({
          id: item[propertyName],
          name: item.name
        });
      }
    }
    return result;
  }
  return arr;
}
