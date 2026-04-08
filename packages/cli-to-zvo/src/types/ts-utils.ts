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
