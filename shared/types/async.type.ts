
/**
 * Async & Function Type Helpers — Promise unwrapping and return type inference.
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * @type {$Awaitable} $Awaitable
 * @description Represents a value that may or may not be wrapped in a Promise.
 *
 * @template T
 */
export type $Awaitable<T> = T | Promise<T>;

/**
 * @type {$UnwrapPromise} $UnwrapPromise
 * @description Extracts the wrapped type of a Promise. `Promise<T>` → `T`, `T` → `T`.
 *
 * @template T
 */
export type $UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * @type {$MaybeAsync} $MaybeAsync
 * @description Alias for `$Awaitable` — used by DNA transforms that may be sync or async.
 *
 * @template T
 */
export type $MaybeAsync<T> = T | Promise<T>;

/**
 * @type {$InferReturnType} $InferReturnType
 * @description Infers the return type of a function (sync or async), unwrapping
 * `Promise<T>` to `T` automatically. Unlike the native `ReturnType<F>`, this
 * resolves the inner value of async functions.
 *
 * @template F
 */
export type $InferReturnType<F> = F extends (...args: any[]) => $MaybeAsync<infer R>
  ? R
  : never;
