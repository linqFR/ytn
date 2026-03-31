

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
