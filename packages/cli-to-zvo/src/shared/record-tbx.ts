/**
 * @function compactRecord
 * @description Removes all properties with `undefined` values from a record.
 * Useful for cleaning up CLI parse results before further validation.
 *
 * @param {T} obj - The object to clean.
 * @returns {Partial<T>} A new object without undefined properties.
 */
export const compactRecord = <T extends Record<string, any>>(
  obj: T,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  ) as Partial<T>;
};

/**
 * @function groupObjectBy
 * @description Groups entries of an object into a new Record by iterating with a for...in loop.
 * 
 * @param {Record<string, T>} srcObj - The source object to group.
 * @param {(key: string, value: T) => K} keyGetter - Function to extract the target group key.
 * @param {(key: string, value: T) => V} [valueGetter] - Optional function to map the stored value.
 * @returns {Record<K, V[]>} The resulting grouped record.
 */


