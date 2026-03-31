/**
 * @function ensureArray
 * @description Wraps a value in an array if it isn't one already.
 * Useful for handling CLI flags that can be either single strings or arrays.
 *
 * @param {T | T[] | undefined} val - The candidate value.
 * @returns {T[]} An array containing the value(s).
 */
export const ensureArray = <T>(val: T | T[] | undefined): T[] => {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
};

/**
 * @function groupByOld
 * @description Groups an array of objects by a specific key or derived value.
 *
 * @param {T[]} array - The array to group.
 * @param {(item: T) => K} getter - A function that returns the key to group by.
 * @returns {Record<K, T[]>} An object where keys are the result of the getter and values are arrays of items.
 */
export const groupByOld = <T, K extends string | number | symbol>(
  array: T[],
  getter: (item: T) => K,
): Record<K, T[]> => {
  return array.reduce(
    (acc, item) => {
      const key = getter(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
};

/**
 * @function unique
 * @description Returns a new array with unique values.
 *
 * @param {T[]} array - The input array.
 * @returns {T[]} Array with duplicates removed.
 */
export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

/**
 * @function groupBy
 * @description Uses the native Object.groupBy for performance (Node 21+).
 *
 * @param {T[]} array - The array to group.
 * @param {(item: T) => K} getter - A function that returns the key to group by.
 * @returns {Record<K, T[]>} An object where keys are the result of the getter and values are arrays of items.
 */
export const groupBy = <T, K extends PropertyKey>(
  array: T[],
  getter: (item: T) => K,
): Record<K, T[]> => {
  // @ts-ignore - Support for Object.groupBy may vary by environment
  return Object.groupBy(array, getter) as Record<K, T[]>;
};

