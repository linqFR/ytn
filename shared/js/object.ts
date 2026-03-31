/**
 * @function isPureObject
 * @description
 * Utility to determine if an entity is a strict, indexable object
 * rather than an Array or a null value.
 */
export const isPureObject = (item: any): item is Record<PropertyKey, any> => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return false;
  }
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null;
};

/**
 * @function protectObject
 * @description
 * Returns a proxy that prevents accidental modification of an object.
 */
export function protectObject<T extends object>(obj: T): T {
  return new Proxy(obj, {
    set() {
      throw new Error("This object is protected and cannot be modified.");
    },
    deleteProperty() {
      throw new Error("This object is protected and cannot be modified.");
    },
  });
}

/**
 * @function deepMerge
 * @description Recursively merges two or more objects into a single target object.
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: any[]
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isPureObject(target) && isPureObject(source)) {
    for (const key in source) {
      if (isPureObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}
