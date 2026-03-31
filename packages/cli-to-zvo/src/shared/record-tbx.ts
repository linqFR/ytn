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
export const groupObjectBy = <T, K extends PropertyKey, V = T>(
  srcObj: Record<string, T>,
  keyGetter: (key: string, value: T) => K,
  valueGetter: (key: string, value: T) => V = (_, value) => value as unknown as V
): Record<K, V[]> => {
  // Création d'un dictionnaire pur, sans prototype
  const acc = Object.create(null) as Record<K, V[]>;

  for (const key in srcObj) {
    // Object.hasOwn garantit qu'on ignore les propriétés héritées du prototype
    if (Object.hasOwn(srcObj, key)) {
      const value = srcObj[key];
      const newKey = keyGetter(key, value);

      if (acc[newKey] === undefined) {
        acc[newKey] = [];
      }
      acc[newKey].push(valueGetter(key, value));
    }
  }

  return acc;
};


