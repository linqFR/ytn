
/**
 * Advanced structural Type Modifiers for the YTN ecosystem.
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * Ensures a type T does not contain any keys from U.
 */
export type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * Exclusive OR of two types T or U. Used when a structure MUST match
 * exactly one of two different shapes, but not both at once.
 */
export type $XOR<T, U> = (T & $Without<U, T>) | (U & $Without<T, U>);

/**
 * Enforces that at least one property from the given set of Keys is present.
 */
export type $RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Recursively applies the `readonly` modifier to every level of an object tree.
 */
export type $DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : $DeepReadonly<T[P]>
    : T[P];
};

/**
 * Provides a type-safe signature for the result of `Object.entries(T)`.
 */
export type $Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Provides a type-safe signature for the result of `Object.keys(T)`.
 */
export type $Keys<T> = (keyof T)[];

/**
 * Transformation that maps a record of `Set<I>` to a record of `I[]`.
 */
export type $RecordSetToArray<T extends Record<string, Set<any>>> = {
  [K in keyof T]: T[K] extends Set<infer I> ? I[] : never;
};
