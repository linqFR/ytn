
/**
 * Common functional TypeScript utility types.
 */

/** Represents a value that may or may not be wrapped In a Promise. */
export type Awaitable<T> = T | Promise<T>;

/** Extracts the wrapped type of a Promise. */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/** Converts a union type to an intersection type. */
export type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

/** Ensures a given property is required and not null/undefined. */
export type RequiredNotNull<T, K extends keyof T> = T & { [P in K]-?: Exclude<T[P], null | undefined> };
