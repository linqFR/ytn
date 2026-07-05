import type { IContext } from "../shared/meta-context.type.js";

// Simple helpers for internal use (extract directly from schema properties)
export type $Output<S> = S extends { _output: infer O } ? O : unknown;
export type $Input<S> = S extends { _input: infer I } ? I : unknown;

export type $State<S> = S extends { _stateDef: infer I } ? I : {};

// Union -> intersection (for allOf member value types)
export type $UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// Exclusive or: a value matches exactly one branch, never both (forbids the T & U overlap).
// Falls back to a plain union for non-object types.
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type $Xor<T, U> = (T | U) extends object ? ($Without<T, U> & U) | ($Without<U, T> & T) : T | U;

// Helper type for property check compatibility (Zod V4 style)
// Creates a mapped type from T to enable structural type checking
// Works for primitives, classes, and objects
export type $ParsePayload<T> = T extends any ? { [K in keyof T]: T[K] } : never;

// Helper type to check if a property exists on a type
export type $HasProperty<T, K extends PropertyKey> = K extends keyof T ? T : never;

// Helper type to enforce property existence in property checks
export type $PropertyCheck<T, K extends PropertyKey, S> = K extends keyof T ? T : { [P in K]: S };

// Helper type to add brand conditionally
export type $WithBrand<T, B extends string = never, D extends "out" | "in" | "inout" = "out"> = B extends never ? T : D extends "out" ? T & { __brand: B } : T & { __brand: B, __BrandDirection: D };

// Helper to unwrap Promise<T> to T (like Zod's MaybePromise)
export type $MaybeAsync<T> = T | Promise<T>;

// Helper to infer return type from function (sync or async)
// Unwraps Promise<T> to T automatically
export type $InferReturnType<F> = F extends (...args: any[]) => $MaybeAsync<infer R>
  ? R
  : never;

// Helper for .catch() recovery value: either a plain fallback value or a recovery function
export type $CatchValue<T, I> = T | ((ctx: IContext<I>) => T);
