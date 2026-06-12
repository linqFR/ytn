
/**
 * Common functional TypeScript utility types.
 */

/** Represents a value that may or may not be wrapped In a Promise. */
export type $Awaitable<T> = T | Promise<T>;

/** Extracts the wrapped type of a Promise. */
export type $UnwrapPromise<T> = T extends Promise<infer U> ? U : T;


