
import { SafeResult, safeResultErr, safeResultOk } from "../safe/safemode.js";

/**
 * Async timing and promise control utilities.
 */

/**
 * Resolves after a given number of milliseconds.
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

/**
 * Wraps a promise in a timeout. Throws if the timeout is reached first.
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
 * Same as withTimeout but returns a SafeResult instead of throwing.
 */
export async function safeTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = "Operation timed out",
): Promise<SafeResult<T>> {
  try {
    const res = await withTimeout(promise, ms, errorMessage);
    return safeResultOk(res);
  } catch (err) {
    return safeResultErr(err);
  }
}
