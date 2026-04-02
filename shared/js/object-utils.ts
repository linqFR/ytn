
/**
 * Object manipulation utilities for deep cloning and merging.
 */

export const isObject = (item: any): item is object =>
  !!(item && typeof item === "object");

export const isPureObject = (item: any): item is Record<PropertyKey, any> => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return false;
  }
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null;
};

/**
 * Deep merges multiple source objects into a target.
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
 * Executes a deterministic deep clone using structuredClone.
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === undefined) return undefined as any;
  return structuredClone(obj);
};
