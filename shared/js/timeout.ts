import { catchAsyncFn, tsSafeResult } from "../safe/safemode.js";

/**
 * Async timing and promise control utilities.
 */

/**
 * @function delay
 * @description Native-style async sleep. Resolves after a given number of milliseconds.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

/**
 * @function withTimeout
 * @description Wraps an existing promise in a timeout guard.
 *
 * @template T
 * @param {Promise<T>} promise - The operation to monitor.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} [errorMessage="Operation timed out"] - Custom error message for timeout.
 * @returns {Promise<T>} Resolves with the promise result or rejects on timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = "Operation timed out",
): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timeoutId = setTimeout(() => rej(new Error(errorMessage)), ms);
  });
  const res = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timeoutId);
  return res;
}

/**
 * @function safeTimeout
 * @description Non-throwing version of withTimeout. Returns a SafeResult [error, result].
 *
 * @template T
 * @param {Promise<T>} promise - The operation to monitor.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} [errorMessage="Operation timed out"] - Custom error message for timeout.
 * @returns {Promise<tsSafeResult<T>>} A SafeResult tuple.
 */
export async function safeTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = "Operation timed out",
): Promise<Promise<tsSafeResult<T>>> {
  return catchAsyncFn(withTimeout)(promise, ms, errorMessage);
}
