/**
 * Advanced structural Type Modifiers for the YTN ecosystem.
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * @type {$Without} $Without
 * @description Internal primitive that ensures a type T does not contain any keys from U.
 * Used to build mutual exclusions.
 *
 * @template T
 * @template U
 */
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * @type {$XOR} $XOR
 * @description Exclusive OR of two types T or U. Used when a structure MUST match
 * exactly one of two different shapes, but not both at once (Mutually Exclusive).
 *
 * @template T
 * @template U
 */
export type $XOR<T, U> = (T & $Without<U, T>) | (U & $Without<T, U>);

/**
 * @type {$RequireAtLeastOne} $RequireAtLeastOne
 * @description Enforces that at least one property from the given set of Keys is present in the object.
 *
 * @template T - Target object type.
 * @template {keyof T} [Keys=keyof T] - The specific keys to monitor.
 */
export type $RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

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
 * @type {$Entries} $Entries
 * @description Provides a type-safe signature for the result of `Object.entries(T)`.
 *
 * @template T
 */
export type $Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * @type {$Keys} $Keys
 * @description Provides a type-safe signature for the result of `Object.keys(T)`.
 *
 * @template T
 */
export type $Keys<T> = (keyof T)[];

/**
 * @type {$RecordSetToArray} $RecordSetToArray
 * @description Transformation that maps a record of `Set<I>` to a record of `I[]`.
 *
 * @template {Record<string, Set<any>>} T
 */
export type $RecordSetToArray<T extends Record<string, Set<any>>> = {
  [K in keyof T]: T[K] extends Set<infer I> ? I[] : never;
};
