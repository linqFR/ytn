/**
 * Object manipulation utilities for deep cloning and merging.
 */

/**
 * @function isObject
 * @description Standard type guard to verify if a value is an object (and not null).
 * Note: Arrays and Classes return true.
 *
 * @param {any} item - The value to check.
 * @returns {item is object} True if the value is an object.
 */
export const isObject = (item: any): item is object =>
  !!(item && typeof item === "object");

/**
 * @function isPureObject
 * @description Verifies if a value is a plain JavaScript object (literal).
 * Excludes Arrays, nulls, and custom Classes/Prototypes.
 *
 * @param {any} item - The value to check.
 * @returns {item is Record<PropertyKey, any>} True if the value is a POJO.
 */
export const isPureObject = (item: any): item is Record<PropertyKey, any> => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return false;
  }
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null;
};

/**
 * @function deepMerge
 * @description Deeply merges multiple source objects into a target object recursively.
 * Only 'pure' objects are merged; other types (including arrays) are overwritten.
 *
 * @param {any} target - The target object to receive properties.
 * @param {...any[]} sources - One or more source objects.
 * @returns {any} The modified target object.
 */
export const deepMerge = (target: any, ...sources: any[]): any => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isPureObject(target) && isPureObject(source)) {
    for (const key in source) {
      if (isPureObject(source[key])) {
        if (!isPureObject(target[key])) {
          Object.assign(target, { [key]: {} });
        }
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
};

/**
 * @function deepClone
 * @description Performs a bit-for-bit deep clone using the native structuredClone API.
 *
 * @template T
 * @param {T} obj - The object to clone.
 * @returns {T} A perfect deep copy of the object.
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === undefined) return undefined as any;
  return structuredClone(obj);
};
