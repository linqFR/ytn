
/**
 * Specialized Array manipulation and inspection utilities.
 */

/**
 * Returns a new array with unique values (O(N)).
 */
export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

/**
 * Groups an array of objects by a specific key or derived value.
 * Uses native Object.groupBy if available.
 */
export const groupBy = <T, K extends PropertyKey>(
  array: T[],
  getter: (item: T) => K,
): Record<K, T[]> => {
  // @ts-ignore
  if (Object.groupBy) return Object.groupBy(array, getter) as Record<K, T[]>;

  return array.reduce(
    (acc, item) => {
      const key = getter(item);
      if (!acc[key]) acc[key] = [] as T[];
      (acc[key] as T[]).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
};

/**
 * Wraps a value in an array if it isn't one already.
 */
export const ensureArray = <T>(val: T | T[] | undefined): T[] => {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
};
