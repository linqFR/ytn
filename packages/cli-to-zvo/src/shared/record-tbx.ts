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
 * @description Regroupe les entrées d'un objet en itérant directement avec for...in.
 * 
 * @param {Record<string, T>} srcObj - L'objet source.
 * @param {(key: string, value: T) => K} keyGetter - Retourne la clé de destination.
 * @param {(key: string, value: T) => V} valueGetter - Retourne la valeur à stocker dans le tableau.
 * @returns {Record<K, V[]>} L'objet regroupé.
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


