/**
 * Record & Key Type Helpers — type-safe signatures for `Object.keys`,
 * `Object.entries`, and record transformations.
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * @type {$Keys} $Keys
 * @description Type-safe signature for `Object.keys(T)`.
 * Returns `(keyof T)[]` — the array of key types.
 *
 * @template T
 */
export type $Keys<T> = (keyof T)[];

/**
 * @type {$Entries} $Entries
 * @description Type-safe signature for `Object.entries(T)`.
 * Returns an array of `[key, value]` tuples.
 *
 * @template T
 */
export type $Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * @type {$RecordSetToArray} $RecordSetToArray
 * @description Maps a record of `Set<I>` to a record of `I[]`.
 *
 * @template {Record<string, Set<any>>} T
 */
export type $RecordSetToArray<T extends Record<string, Set<any>>> = {
  [K in keyof T]: T[K] extends Set<infer I> ? I[] : never;
};

/**
 * @type {$UnionToIntersection} $UnionToIntersection
 * @description Converts a union type to an intersection type.
 * `A | B` → `A & B`.
 *
 * @template U
 */
export type $UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

/**
 * @type {$RequireAtLeastOne} $RequireAtLeastOne
 * @description Enforces that at least one property from the given set of Keys
 * is present in the object.
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
 * @type {$RequiredNotNull} $RequiredNotNull
 * @description Ensures a given property is required and not null/undefined.
 *
 * @template T
 * @template {keyof T} K
 */
export type $RequiredNotNull<T, K extends keyof T> = T & { [P in K]-?: Exclude<T[P], null | undefined> };
