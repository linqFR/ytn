
import { protectObject, unProtectObject } from "../js/guarded_object.js";

/* -------------------------------------------------------------------------- */
/*                            INFRASTRUCTURE & TYPES                          */
/* -------------------------------------------------------------------------- */

/**
 * Brand for SafeResult identification at runtime.
 */
export const SAFE_MODE_WMARK = Symbol("SafeModeResult");

/**
 * Standard Return Tuple: [Error | null, Result | undefined]
 */
export type SafeResult<T> = [any | null | undefined, T | null | undefined];

/**
 * Generic bouncer signatures for sync/async pipelines.
 */
export type BouncerSync = (arg: any, isolated?: boolean) => SafeResult<any>;
export type BouncerAsync = (arg: any, protect?: boolean) => Promise<SafeResult<any>>;

/**
 * Validates if an entity is a branded SafeResult.
 */
export const isSafeResult = (val: any): boolean =>
  Array.isArray(val) && (val as any)[SAFE_MODE_WMARK] === true;

/* -------------------------------------------------------------------------- */
/*                                CONSTRUCTORS                                */
/* -------------------------------------------------------------------------- */

/**
 * Brands and packs a result into a SafeResult tuple.
 */
export const safeResultPack = <T>(
  err: any,
  res: T = undefined as any,
): SafeResult<T> => {
  const tuple = [err, res] as SafeResult<T>;
  (tuple as any)[SAFE_MODE_WMARK] = true;
  return tuple;
};

/** Creates a SafeResult representing a failure. */
export const safeResultErr = <T = any>(err: any): SafeResult<T> =>
  safeResultPack<T>(err);

/** Creates a SafeResult representing a success. */
export const safeResultOk = <T>(res: T): SafeResult<T> =>
  safeResultPack<T>(null, res);

/* -------------------------------------------------------------------------- */
/*                                 CONVERSIONS                                */
/* -------------------------------------------------------------------------- */

/**
 * Explicit object-based variant of SafeResult.
 */
export type SafeResultObj<T> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: any };

/** Checks if a SafeResult or a Zod-like result object is successful. */
export function isSuccess<T>(
  res: SafeResult<T> | { success: boolean },
): res is [null | undefined, T] | { success: true; data: T } {
  if (Array.isArray(res)) return res[0] === null || res[0] === undefined;
  return res.success === true;
}

/** Checks if a SafeResult or a Zod-like result object contains an error. */
export function isFailure<T>(
  res: SafeResult<T> | { success: boolean },
): res is [any, any] | { success: false; error: any } {
  return !isSuccess(res);
}

/**
 * Transforms a SafeResult tuple into an explicit object.
 */
export function toObject<T>(result: SafeResult<T>): SafeResultObj<T> {
  const [err, res] = result;
  return err ? { success: false, error: err } : { success: true, data: res as T };
}

/**
 * Transforms a SafeResult-like object into a standard branded tuple.
 */
export function fromObject<T>(obj: SafeResultObj<T>): SafeResult<T> {
  return obj.success ? safeResultOk(obj.data) : safeResultErr(obj.error);
}

/* -------------------------------------------------------------------------- */
/*                                   WRAPPERS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Universal wrapper that guarantees a SafeResult.
 */
export async function catchSafe<T>(input: T | Promise<T>): Promise<SafeResult<T>> {
  if (isSafeResult(input)) return input as SafeResult<T>;
  try {
    const res = await input;
    if (isSafeResult(res)) return res as SafeResult<T>;
    return safeResultOk(res);
  } catch (err) {
    return safeResultErr(err);
  }
}

/**
 * Synchronous version of the universal wrapper.
 */
export function catchSafeSync<T>(input: T): SafeResult<T> {
  if (isSafeResult(input)) return input as SafeResult<T>;
  return safeResultOk(input);
}

/**
 * Unwraps a SafeResult and THROWS if there is an error.
 */
export function unSafe<T>(result: SafeResult<T>): T {
  const [err, res] = result;
  if (err) throw err;
  return res as T;
}

/**
 * Recovers a SafeResult with a default value.
 */
export function withDefault<T>(result: SafeResult<T>, defaultValue: T): T {
  const [err, res] = result;
  return err ? defaultValue : (res as T);
}

/* -------------------------------------------------------------------------- */
/*                             PIPELINES & BOUNCERS                           */
/* -------------------------------------------------------------------------- */

/**
 * Transforms an async function into its SafeResult-returning version.
 */
export const catchAsyncFn =
  <T, A extends any[]>(asyncFn: (...args: A) => T | Promise<T>) =>
  async (...args: A): Promise<SafeResult<T>> => {
    try {
      const data = await asyncFn(...args);
      if (isSafeResult(data)) return data as SafeResult<T>;
      return safeResultPack(null, data as T);
    } catch (err: any) {
      return safeResultPack(err);
    }
  };

/**
 * Transforms a sync function into its SafeResult-returning version.
 */
export const catchSyncFn =
  <T, A extends any[]>(syncFn: (...args: A) => T) =>
  (...args: A): SafeResult<T> => {
    try {
      const res = syncFn(...args);
      if (isSafeResult(res)) return res as SafeResult<T>;
      return safeResultPack(null, res);
    } catch (err: any) {
      return safeResultPack(err);
    }
  };

/**
 * Pipeline finalizer (Sync).
 */
export const failfastBouncer =
  (...fnBlocks: Array<(...args: any[]) => any>): BouncerSync =>
  (arg: any, isolated: boolean = false): SafeResult<any> => {
    let currentRes = isolated ? protectObject(arg) : arg;
    for (const b of fnBlocks) {
      const [err, stepRes] = catchSyncFn(b)(currentRes);
      if (err) return safeResultPack(err, stepRes);
      currentRes = isolated ? protectObject(stepRes) : stepRes;
    }
    return safeResultPack(null, unProtectObject(currentRes));
  };

/**
 * Pipeline finalizer (Async).
 */
export const failfastBouncerAsync =
  (...fnBlocks: Array<(...args: any[]) => any>): BouncerAsync =>
  async (arg: any, protect: boolean = false): Promise<SafeResult<any>> => {
    let currentRes = protect ? protectObject(arg) : arg;
    for (const b of fnBlocks) {
      const [err, stepRes] = await catchAsyncFn(b as any)(currentRes);
      if (err) return safeResultPack(err, stepRes);
      currentRes = protect ? protectObject(stepRes) : stepRes;
    }
    return safeResultPack(null, unProtectObject(currentRes));
  };
