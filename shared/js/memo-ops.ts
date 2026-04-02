
/**
 * Simple and specialized memoization helpers.
 */

/**
 * Memoization for functions receiving exactly one argument.
 * Uses a Map for O(1) retrieval.
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
 * Memoization for functions with multiple primitive arguments.
 * Joins arguments with a null character (`\x00`) to create a stable key.
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
