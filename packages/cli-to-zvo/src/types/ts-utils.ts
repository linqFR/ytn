/**
 * @type $Without
 * @description Utility type to ensure a type T does not contain any keys from U.
 * @template T - The base type.
 * @template U - The set of forbidden keys.
 */
type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * @type $XOR
 * @description Exclusive OR of two types T or U. Used when a structure MUST match
 * exactly one of two different shapes, but not both at once.
 *
 * @template T - First mutually exclusive type.
 * @template U - Second mutually exclusive type.
 */
export type $XOR<T, U> = (T & $Without<U, T>) | (U & $Without<T, U>);

/**
 * @type $RequireAtLeastOne
 * @description Enforces that at least one property from the given set of Keys is present and defined.
 *
 * @template T - The source object type.
 * @template Keys - The list of keys where at least one is mandatory.
 */
export type $RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * @type $DeepReadonly
 * @description Recursively applies the `readonly` modifier to every level of an object tree.
 *
 * @template T - The type to perform the recursive readonly transformation on.
 */
export type $DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : $DeepReadonly<T[P]>
    : T[P];
};

/**
 * @type $Entries
 * @description Provides a type-safe signature for the result of `Object.entries(T)`.
 *
 * @template T - The object or record type.
 */
export type $Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * @type $Keys
 * @description Provides a type-safe signature for the result of `Object.keys(T)`.
 *
 * @template T - The object type.
 */
export type $Keys<T> = (keyof T)[];

/**
 * @type $RecordSetToArray
 * @description Transformation type that maps a record of `Set<T>` to a record of `T[]`.
 *
 * @template T - A Record where values are Sets.
 */
export type $RecordSetToArray<T extends Record<string, Set<any>>> = {
  [K in keyof T]: T[K] extends Set<infer I> ? I[] : never;
};
