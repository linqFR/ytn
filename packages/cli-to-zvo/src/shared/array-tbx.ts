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

