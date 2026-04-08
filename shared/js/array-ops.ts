/**
 * Specialized Array manipulation and inspection utilities.
 */

/**
 * @function unique
 * @description Returns a new array containing only unique values from the input.
 *
 * @template T
 * @param {T[]} array - Target array to filter.
 * @returns {T[]} A new array with duplicates removed.
 */
export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

/**
 * @function groupBy
 * @description Groups an array of objects by a specific key or derived value.
 *
 * We avoid Object.groupBy (Node 21+) to ensure the resulting object
 * has a standard prototype and behaves predictably in all environments.
 *
 * @template T
 * @template {PropertyKey} K
 * @param {T[]} array - The array of items to group.
 * @param {(item: T) => K} getter - A function that returns the key for an item.
 * @returns {Record<K, T[]>} An object where keys are group identifiers and values are arrays of items.
 */
export const groupBy = <T, K extends PropertyKey>(
  array: T[],
  getter: (item: T) => K,
): Record<K, T[]> => {
  return array.reduce((acc, item) => {
    const key = getter(item);
    if (!acc[key]) acc[key] = [] as T[];
    (acc[key] as T[]).push(item);
    return acc;
  }, {} as Record<K, T[]>);
};

/**
 * @function ensureArray
 * @description Wraps a value in an array if it's not already an array.
 * returns an empty array if the value is undefined.
 *
 * @template T
 * @param {T | T[] | undefined} val - The value or array to wrap.
 * @returns {T[]} The value wrapped in an array, or the original array.
 */
export const ensureArray = <T>(val: T | T[] | undefined): T[] => {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
};
