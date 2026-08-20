/**
 * Structural Type Modifiers — transformations that reshape object types.
 * Rules: use '$*' prefix for active type modifiers.
 */

/* -------------------------------------------------------------------------- */
/*                              FLATTEN FAMILY                                */
/* -------------------------------------------------------------------------- */

/**
 * @type {$Flatten} $Flatten
 * @description Forces TypeScript to resolve and display a type as a flat object
 * literal instead of keeping it in its unresolved form (e.g. `Omit<X, "k">`,
 * `Pick<X, "a" | "b">`, intersections). The mapped type `{ [K in keyof T]: T[K] }`
 * forces instantiation, and `& {}` preserves assignability. No runtime effect.
 *
 * **Non-distributive**: on a union `A | B`, produces `{...A & B}` (intersection of
 * common keys). Use `$FlattenDistributive` to preserve each union member separately.
 *
 * @template T
 */
export type $Flatten<T> = { [K in keyof T]: T[K] } & {};

/**
 * Alias for `$Flatten` — emphasizes the combinative (non-distributive) behavior
 * on union types.
 */
export type $FlattenCombinative<T> = $Flatten<T>;

/**
 * Alias for `$Flatten` — emphasizes the conversion from unresolved forms
 * (`Omit`, `Pick`, intersections) to a plain `Record`-like shape.
 */
export type $ToRecord<T> = $Flatten<T>;

/**
 * @type {$FlattenDistributive} $FlattenDistributive
 * @description Distributive version of `$Flatten`. On a union `A | B`, produces
 * `{...A} | {...B}` — each union member is flattened independently, preserving
 * discrimination. Essential for discriminated unions (cliUnion, discriminator).
 *
 * @template T
 */
export type $FlattenDistributive<T> = T extends any ? { [K in keyof T]: T[K] } : never;

/* -------------------------------------------------------------------------- */
/*                          EXCLUSIVE / MUTUAL EXCLUSION                      */
/* -------------------------------------------------------------------------- */

/**
 * @type {$Without} $Without
 * @description Internal primitive for `$Xor`. Marks keys common to T and U as
 * optional `never`, effectively forbidding them. Not intended for direct use.
 *
 * @template T
 * @template U
 */
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * @type {$Xor} $Xor
 * @description Exclusive OR of two types T or U. Used when a structure MUST match
 * exactly one of two different shapes, but not both at once (Mutually Exclusive).
 * Falls back to a plain union for non-object types.
 *
 * @template T
 * @template U
 */
export type $Xor<T, U> = (T | U) extends object
  ? ($Without<T, U> & U) | ($Without<U, T> & T)
  : T | U;

/**
 * @type {$Or} $Or
 * @description Trivial union alias — `T | U`. Provided for syntax consistency
 * alongside `$Xor`.
 *
 * @template T
 * @template U
 */
export type $Or<T, U> = T | U;

/* -------------------------------------------------------------------------- */
/*                              DEEP TRANSFORMS                               */
/* -------------------------------------------------------------------------- */

/**
 * @type {$DeepReadonly} $DeepReadonly
 * @description Recursively applies the `readonly` modifier to every level of an object tree.
 *
 * @template T
 */
export type $DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : $DeepReadonly<T[P]>
    : T[P];
};

/**
 * @type {$ReadonlyValue} $ReadonlyValue
 * @description Applies `Readonly` to non-primitive types, identity for primitives.
 * Unlike `$DeepReadonly`, only wraps the top level.
 *
 * @template T
 */
export type $ReadonlyValue<T> = unknown extends T
  ? T
  : T extends string | number | bigint | boolean | symbol | null | undefined
    ? T
    : Readonly<T>;

/**
 * @type {$RemoveUndefined} $RemoveUndefined
 * @description Removes `undefined` from a type (distributive over unions).
 *
 * @template T
 */
export type $RemoveUndefined<T> = T extends any ? (T extends undefined ? never : T) : never;
