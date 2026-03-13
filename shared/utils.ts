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
 * @function catchAsyncFn
 * @description
 * Higher-order function to wrap async functions and catch errors.
 */
export function catchAsyncFn<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Async function failed:", error);
      throw error;
    }
  }) as T;
}
