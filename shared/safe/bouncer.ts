import { protectObject, unProtectObject } from "../js/guarded_object.js";
import {
  catchAsyncFn,
  catchSyncFn,
  safeResultPack,
} from "./safemode.js";
import type { tsSafeResult } from "./safemode.js";

/**
 * Generic bouncer signatures for sync/async pipelines.
 */
export type tsBouncerSync<A = any, E = any> = (
  arg: A,
  isolated?: boolean,
) => tsSafeResult<A, E> | tsSafeResult<A, null>;
export type tsBouncerAsync<A = any, E = any> = (
  arg: A,
  protect?: boolean,
) => Promise<tsSafeResult<A, E> | tsSafeResult<A, null>>;

/**
 * @function failfastBouncer
 * @description Orchestrates a sequence of synchronous fallible blocks. 
 * If any block returns an error (via SafeResult), the execution stops and returns the error.
 * Supports isolated mode via object protection.
 *
 * @template A - The argument and result type for the pipeline.
 * @template E - The error type expected on failure.
 * @param {...Array<(...args: A[]) => A>} fnBlocks - The sequence of functions to execute.
 * @returns {tsBouncerSync<A, E>} A synchronized bouncer function.
 */
export const failfastBouncer =
  <A = any, E = any>(
    ...fnBlocks: Array<(...args: A[]) => A>
  ): tsBouncerSync<A, E> =>
  (arg: A, isolated: boolean = false) => {
    let currentRes = isolated ? protectObject(arg) : arg;
    for (const b of fnBlocks) {
      const [err, stepRes] = catchSyncFn<A, A[]>(b)(currentRes);
      if (err) return safeResultPack<E, A>(err, stepRes as A);
      currentRes = (isolated ? protectObject(stepRes) : stepRes) as A;
    }
    return safeResultPack<null, A>(null, unProtectObject<A>(currentRes));
  };

/**
 * @function failfastBouncerAsync
 * @description Orchestrates a sequence of asynchronous fallible blocks.
 * If any block returning a Promise resolves to an error (via SafeResult), 
 * the execution stops and returns the error.
 *
 * @template A - The argument and result type for the pipeline.
 * @template E - The error type expected on failure.
 * @param {...Array<(...args: A[]) => A>} fnBlocks - The sequence of async functions to execute.
 * @returns {tsBouncerAsync<A, E>} An asynchronous bouncer function.
 */
export const failfastBouncerAsync =
  <A = any, E = any>(
    ...fnBlocks: Array<(...args: A[]) => A>
  ): tsBouncerAsync<A, E> =>
  async (arg: any, protect: boolean = false) => {
    let currentRes = protect ? protectObject(arg) : arg;
    for (const b of fnBlocks) {
      const [err, stepRes] = await catchAsyncFn<A, A[]>(b)(currentRes);
      if (err) return safeResultPack<E, A>(err, stepRes as A);
      currentRes = (protect ? protectObject(stepRes) : stepRes) as A;
    }
    return safeResultPack<null, A>(null, unProtectObject(currentRes));
  };
