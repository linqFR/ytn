import { protectObject, unProtectObject } from "../js/guarded_object.js";
import {
  catchAsyncFn,
  catchSyncFn,
  safeResultPack,
  tsSafeResult,
} from "./safemode.js";

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
 * Pipeline finalizer (Sync).
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
 * Pipeline finalizer (Async).
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
