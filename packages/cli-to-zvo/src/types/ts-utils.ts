/**
 * @type $Without
 * @description Utility type to ensure a type T does not contain any keys from U.
 */
type $Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/**
 * @type $XOR
 * @description Logical XOR between two types T and U.
 * Used for strict subcommand routing validation.
 */
export type $XOR<T, U> = (T & $Without<U, T>) | (U & $Without<T, U>);

/**
 * @type $RequireAtLeastOne
 * @description Utility type to ensure at least one property from a subset of keys is present and not undefined.
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
 * @description Recursively makes all properties of an object (including nested ones) readonly.
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
 * @description Type-level equivalent of Object.entries.
 * Transforms a Record<K, V> into an array of [K, V] tuples.
 */
export type $Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * @type $Keys
 * @description Type-level equivalent of Object.keys.
 * Extracts the keys of an object as a tuple.
 */
export type $Keys<T> = (keyof T)[];

/**
 * @type $RecordSetToArray
 * @description Transforms a Record of Sets into a Record of Arrays.
 */
export type $RecordSetToArray<T extends Record<string, Set<any>>> = {
  [K in keyof T]: T[K] extends Set<infer I> ? I[] : never;
};




