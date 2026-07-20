import type { DnaType } from "../builder/dna-interfaces.js";
import type { IContext } from "../shared/meta-context.type.js";
import type { tsPrimitiveLiteral, tsTmplLitPart } from "../shared/base.types.js";


// =================================
// infering tools for Dna
// =================================

// Simple helpers for internal use (extract directly from schema properties)
export type $Output<S> = S extends { _output: infer O } ? O : unknown;
export type $Input<S> = S extends { _input: infer I } ? I : unknown;
export type $InputHead<T> = T extends { _head: infer H }
  ? unknown extends H
  ? $Input<T>
  : $InputHead<H>
  : $Input<T>;
export type infer<T> = $Output<T>;

// export type $State<S> = S extends { _stateDef: infer I } ? I : {};

// =================================
// tools for combinaisons
// =================================


// Union -> intersection (for allOf member value types)
export type $UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// Exclusive or: a value matches exactly one branch, never both (forbids the T & U overlap).
// Falls back to a plain union for non-object types.
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type $Xor<T, U> = (T | U) extends object ? ($Without<T, U> & U) | ($Without<U, T> & T) : T | U;
export type $Or<T, U> = T | U;

// Helper type for property check compatibility (Zod V4 style)
// Creates a mapped type from T to enable structural type checking
// Works for primitives, classes, and objects
export type $ParsePayload<T> = T extends any ? { [K in keyof T]: T[K] } : never;

// Helper type to check if a property exists on a type
export type $HasProperty<T, K extends PropertyKey> = K extends keyof T ? T : never;

// Helper type to enforce property existence in property checks
export type $PropertyCheck<T, K extends PropertyKey, S> = K extends keyof T ? T : { [P in K]: S };

// Helper type to add brand conditionally
// export type $WithBrand<T, B extends PropertyKey = never, D extends "out" | "in" | "inout" = "out"> = B extends never ? T : D extends "out" ? T & { __brand: B } : T & { __brand: B, __BrandDirection: D };

// Brand symbol (like Zod's $brand)
export declare const $brand: unique symbol;
export type $brand<T extends PropertyKey = PropertyKey> = {
  [$brand]: {
    [k in T]: true;
  };
};

// Helper type for branded schemas (like Zod's $ZodBranded)
// Modifies _input and _output to include the brand directly
export type $DnaBranded<T extends DnaType<any, any>, Brand extends PropertyKey, Dir extends "in" | "out" | "inout" = "out"> = T & (Dir extends "inout" ? {
  _input: $Input<T> & $brand<Brand>;
  _output: $Output<T> & $brand<Brand>;
} : Dir extends "in" ? {
  _input: $Input<T> & $brand<Brand>;
} : {
  _output: $Output<T> & $brand<Brand>;
});

// Helper to unwrap Promise<T> to T (like Zod's MaybePromise)
export type $MaybeAsync<T> = T | Promise<T>;

// Helper to infer return type from function (sync or async)
// Unwraps Promise<T> to T automatically
export type $InferReturnType<F> = F extends (...args: any[]) => $MaybeAsync<infer R>
  ? R
  : never;

// Helper for .catch() recovery value: either a plain fallback value or a recovery function
export type $CatchValue<T, I> = T | ((ctx: IContext<I>) => T);

// Enum type helpers
// Extract keys from an enum object
export type $EnumKeys<T> = T extends Record<infer K, any> ? K : never;

// Extract values from an enum object or array
export type $EnumValues<T> = T extends (infer V)[] ? V : T extends Record<string, infer V> ? V : never;

// Convert array or object to normalized enum object type (like Zod)
export type $EnumAsObj<T> = T extends (infer V)[] ? { readonly [K in V as string]: V } : T extends Record<string, infer V> ? { readonly [K in keyof T]: V } : never;

// Extract the full enum object type (keys and values)
export type $EnumObj<T> = T extends Record<string, infer V> ? Record<string, V> : never;

// Helper for array types
export type $ArrayItem<T> = T extends (infer I)[] ? I : never;

// Helper to remove undefined from a type (distributive)
export type $RemoveUndefined<T> = T extends any ? T extends undefined ? never : T : never;

// Helper to flatten types (like Zod's Flatten)
export type $Flatten<T> = { [K in keyof T]: T[K] } & {};

// Helper to convert array values to enum object keys (like Zod's ToEnum)
export type $ToEnum<T extends string | number | bigint> = $Flatten<{ [K in T as K extends string | number | symbol ? K : never]: K }>;

// Map object schemas to their output types
export type $DnaObjectOutput<T extends Record<string, DnaType<any, any>>> = {
  [K in keyof T]: $Output<T[K]>
};

// Map object schemas to their input types
export type $DnaObjectInput<T extends Record<string, DnaType<any, any>>> = {
  [K in keyof T]: $Input<T[K]>
};

// Helper to infer template literal type from parts array
// Adapted from Zod's approach to handle runtime arrays
type $UndefinedToEmptyString<T> = T extends undefined ? "" : T;
type $ResolvePart<T> = T extends DnaType<any, any> ? $Output<T> : T;

export type $AppendToTemplateLiteral<Template extends string, Suffix extends tsTmplLitPart> =
  Suffix extends tsPrimitiveLiteral ?
  `${Template}${$UndefinedToEmptyString<Suffix>}`
  : Suffix extends DnaType<any, any> ?
  `${Template}${$Output<Suffix> extends infer T extends tsPrimitiveLiteral ? $UndefinedToEmptyString<T> : never}`
  : never;

/**
 * Recursively builds the template literal string type from a parts tuple.
 * `Parts` is `readonly` because `templateLiteral()` uses `readonly [...PP]`, so the
 * helper must accept readonly tuples. `readonly [...infer Rest, infer Last]` is the
 * tuple-safe way to destructure the last element while preserving the rest of the tuple.
 */
export type $TemplateLiteral<Parts extends readonly tsTmplLitPart[]> =
  [] extends Parts ? ``
  : Parts extends readonly [...infer Rest, infer Last extends tsTmplLitPart]
  ? Rest extends readonly tsTmplLitPart[] ?  $AppendToTemplateLiteral<$TemplateLiteral<Rest>, Last>
  : never
  : never;

