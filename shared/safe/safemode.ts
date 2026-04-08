/* -------------------------------------------------------------------------- */
/*                            INFRASTRUCTURE & TYPES                          */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                            INFRASTRUCTURE & TYPES                          */
/* -------------------------------------------------------------------------- */

/**
 * @constant {symbol} SAFE_MODE_WMARK
 * @description Internal brand for SafeResult identification at runtime.
 */
export const SAFE_MODE_WMARK = Symbol("SafeModeResult");

/**
 * @type {Object} tsSafeResultObj
 * @description Explicit object-based variant of SafeResult for easier destructuring
 * in specific contexts or library integrations.
 *
 * @template {unknown} D - Data type on success.
 * @template {any} E - Error type on failure.
 *
 * @property {boolean} success - True if the operation succeeded.
 * @property {D | null | undefined} [data] - The result data (present only if success is true).
 * @property {E | null | undefined} [error] - The error details (present only if success is false).
 */
export type tsSafeResultObj<D = unknown, E = any> =
  | { success: true; data: D | null | undefined; error?: never }
  | { success: false; data?: never; error: E | null | undefined };

/**
 * @type {Array & {toObject: tsSafeResultObj, toArr: Array}} tsSafeResult
 * @description The standard "Linq" Return Tuple: [Error | null, Result | undefined].
 * It is enhanced with specific non-enumerable getters for fluent conversion.
 *
 * @template {unknown} R - Result type.
 * @template {any} E - Error type.
 */
export type tsSafeResult<R = unknown, E = any> = [
  error: E | null | undefined,
  result: R | null | undefined,
] & {
  /** Converts the tuple to an explicit { success, data, error } object (Getter). */
  readonly toObject: tsSafeResultObj<R, E>;
  /** Returns a plain, unbranded array representation (Getter). */
  readonly toArr: [error: E | null | undefined, result: R | null | undefined];
};

/**
 * @function isSafeResult
 * @description Runtime guard that validates if an entity is a branded SafeResult.
 *
 * @param {unknown} val - The value to inspect.
 * @returns {boolean} True if the value is a valid SafeResult tuple.
 */
export const isSafeResult = (
  val: unknown,
): val is tsSafeResult<unknown, unknown> =>
  Array.isArray(val) &&
  (val as unknown as { [SAFE_MODE_WMARK]: boolean })[SAFE_MODE_WMARK] === true;

/* -------------------------------------------------------------------------- */
/*                                CONSTRUCTORS                                */
/* -------------------------------------------------------------------------- */

/**
 * @function safeResultPack
 * @description Internal primitive that brands and packs values into a SafeResult tuple.
 * It injects non-enumerable helper properties for fluent usage.
 *
 * @template {any | null} E
 * @template {unknown} R
 * @param {E} err - The error value (null or undefined if success).
 * @param {R} [res] - The result data.
 * @returns {tsSafeResult<R, E>} The branded SafeResult tuple.
 */
export const safeResultPack = <E = any | null, R = unknown>(
  err: E,
  res: R = undefined as unknown as R,
): tsSafeResult<R, E> => {
  const tuple = [err, res] as tsSafeResult<R, E>;

  // We use defineProperties to inject non-enumerable getters
  Object.defineProperties(tuple, {
    [SAFE_MODE_WMARK]: { value: true, enumerable: false },
    toObject: { get: () => toObject(tuple), enumerable: false },
    toArr: { get: () => [tuple[0], tuple[1]], enumerable: false },
  });

  return tuple;
};

/**
 * @function safeResultErr
 * @description Creates a standardized SafeResult representing a failure.
 *
 * @template {any} E
 * @param {E} err - The failure details.
 * @returns {tsSafeResult<never, E>} A SafeResult containing the error.
 */
export const safeResultErr = <E = any>(err: E) => safeResultPack<E, never>(err);

/**
 * @function safeResultOk
 * @description Creates a standardized SafeResult representing a success.
 *
 * @template {unknown} T
 * @param {T} res - The operation result.
 * @returns {tsSafeResult<T, null>} A SafeResult containing the data and no error.
 */
export const safeResultOk = <T>(res: T) => safeResultPack<null, T>(null, res);

/* -------------------------------------------------------------------------- */
/*                                 CONVERSIONS                                */
/* -------------------------------------------------------------------------- */

/**
 * @function isSuccess
 * @description Deterministic check to verify if a SafeResult (tuple or object) represents success.
 *
 * @template D
 * @template E
 * @param {tsSafeResult<D, E> | tsSafeResultObj<D, E>} res - The result to verify.
 * @returns {boolean} True if the operation succeeded.
 */
export function isSuccess<D, E>(
  res: tsSafeResult<D, E> | tsSafeResultObj<D, E>,
): res is
  | (tsSafeResult<D, never> & [null | undefined, D])
  | { success: true; data: D } {
  if (Array.isArray(res)) return res[0] === null || res[0] === undefined;
  return "success" in res && res.success === true;
}

/**
 * @function isFailure
 * @description Deterministic check to verify if a SafeResult represents a failure.
 *
 * @template D
 * @template E
 * @param {tsSafeResult<D, E> | tsSafeResultObj<D, E>} res - The result to verify.
 * @returns {boolean} True if the operation failed.
 */
export function isFailure<D, E>(
  res: tsSafeResult<D, E> | tsSafeResultObj<D, E>,
): res is
  | (tsSafeResult<D, E> & [Exclude<E, null | undefined>, unknown])
  | { success: false; error: E } {
  return !isSuccess(res);
}

/**
 * @function toObject
 * @description Transforms a standard SafeResult tuple into an explicit object.
 *
 * @template D
 * @template E
 * @param {tsSafeResult<D, E>} result - The source tuple.
 * @returns {tsSafeResultObj<D, E>} The equivalent result object.
 */
export function toObject<D, E>(
  result: tsSafeResult<D, E>,
): tsSafeResultObj<D, E> {
  const [err, res] = result;
  return err
    ? { success: false, error: err }
    : { success: true, data: res as D };
}

/**
 * @function fromObject
 * @description Transforms an explicit SafeResult object into a standard branded tuple.
 * Useful for normalizing heterogeneous API returns.
 *
 * @template D
 * @template E
 * @param {tsSafeResultObj<D, E>} obj - The source object.
 * @returns {tsSafeResult<D, E>} The equivalent branded tuple.
 */
export function fromObject<D, E>(obj: tsSafeResultObj<D, E>) {
  return obj.success ? safeResultOk(obj.data) : safeResultErr(obj.error);
}

/* -------------------------------------------------------------------------- */
/*                                   WRAPPERS                                 */
/* -------------------------------------------------------------------------- */

/**
 * @function catchSafe
 * @description Universal wrapper that guarantees return of a SafeResult.
 * It handles raw values, promises, and existing SafeResults by normalizing them.
 *
 * @template T
 * @template {Error | null} E
 * @param {T | Promise<T>} input - The operation or value to wrap.
 * @returns {Promise<tsSafeResult<T, E>>} A promise resolving to a SafeResult.
 */
export async function catchSafe<T, E extends Error | null>(
  input: T | Promise<T>,
) {
  if (isSafeResult(input)) return input as tsSafeResult<T, E>;
  try {
    const res = await input;
    if (isSafeResult(res)) return res as tsSafeResult<T, E>;
    return safeResultOk<T>(res);
  } catch (err: any) {
    return safeResultErr<typeof err>(err);
  }
}

/**
 * @function ensureSafe
 * @description Ensures a value is a branded SafeResult.
 * If the value is already a SafeResult, it is returned as-is;
 * otherwise it's wrapped in a success tuple.
 *
 * @template T
 * @template E
 * @param {T} input - The value to normalize.
 * @returns {tsSafeResult<T, E>} A guaranteed SafeResult tuple.
 */
export function ensureSafe<T, E>(input: T) {
  if (isSafeResult(input)) return input as tsSafeResult<T, E>;
  return safeResultOk<T>(input);
}

/**
 * @function unSafe
 * @description Unwraps a SafeResult and THROWS the error if the operation failed.
 * Use this in contexts where standard try/catch is preferred or at boundary levels.
 *
 * @template E
 * @template R
 * @param {tsSafeResult<R, E>} result - The SafeResult to unwrap.
 * @returns {R} The data if success.
 * @throws {E} The error if failure.
 */
export function unSafe<E, R>(result: tsSafeResult<R, E>): R {
  const [err, res] = result;
  if (err) throw err;
  return res as R;
}

/**
 * @function withDefault
 * @description Recovers a SafeResult by returning a default value on failure.
 *
 * @template E
 * @template R
 * @param {tsSafeResult<R, E>} result - The SafeResult to inspect.
 * @param {R} defaultValue - The fallback value to use on error.
 * @returns {R} The actual data or the default value.
 */
export function withDefault<E, R>(
  result: tsSafeResult<R, E>,
  defaultValue: R,
): R {
  const [err, res] = result;
  return err ? defaultValue : (res as R);
}

/* -------------------------------------------------------------------------- */
/*                             PIPELINES & BOUNCERS                           */
/* -------------------------------------------------------------------------- */

/**
 * @function catchAsyncFn
 * @description Decorator that transforms an async function into its SafeResult-returning version.
 * This is the primary tool for building linear, failure-transparent async flows.
 *
 * @template T - Return type of the underlying function.
 * @template {any[]} A - Argument types.
 * @param {(...args: A) => T | Promise<T>} asyncFn - The async function to wrap.
 * @returns {(...args: A) => Promise<tsSafeResult<T, any>>} A safe version of the function.
 */
export const catchAsyncFn =
  <T, A extends any[]>(asyncFn: (...args: A) => T | Promise<T>) =>
  async (...args: A) => {
    try {
      const data = await asyncFn(...args);
      if (isSafeResult(data)) return data as tsSafeResult<T, any>;
      return safeResultOk<T>(data);
    } catch (err: any) {
      return safeResultErr<typeof err>(err);
    }
  };

/**
 * @function catchSyncFn
 * @description Decorator that transforms a synchronous function into its SafeResult-returning version.
 * Replaces standard try/catch blocks with deterministic tuple returns.
 *
 * @template T - Return type.
 * @template {any[]} A - Argument types.
 * @param {(...args: A) => T} syncFn - The function to wrap.
 * @returns {(...args: A) => tsSafeResult<T, any>} A safe version of the function.
 */
export const catchSyncFn =
  <T, A extends any[]>(syncFn: (...args: A) => T) =>
  (...args: A) => {
    try {
      const res = syncFn(...args);
      if (isSafeResult(res)) return res as tsSafeResult<T, any>;
      return safeResultOk<T>(res);
    } catch (err: any) {
      return safeResultErr<typeof err>(err);
    }
  };
