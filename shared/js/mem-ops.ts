
/**
 * Simple and specialized memoization helpers.
 */

/**
 * @function memoizeOne
 * @description Simple memoization for functions receiving exactly one argument.
 * Uses a Map to cache results based on the argument value.
 *
 * @param {(arg: Arg) => Res} fn - The function to memoize.
 * @returns {(arg: Arg) => Res} The memoized wrapper.
 */
export const memoizeOne = <Arg, Res>(fn: (arg: Arg) => Res) => {
  const cache = new Map<Arg, Res>();

  return (arg: Arg): Res => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
};

/**
 * @function memoizePrimitives
 * @description Memoization for functions with multiple primitive arguments.
 * Join arguments with a null character (`\x00`) to create a stable cache key.
 *
 * @param {T} fn - The function to memoize.
 * @returns {T} The memoized wrapper.
 */
export const memoizePrimitives = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = args.join("\x00");

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};
