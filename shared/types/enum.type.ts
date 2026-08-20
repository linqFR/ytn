/**
 * Enum & Array Type Helpers — extract keys, values, and convert between
 * enum representations (arrays, objects, record types).
 * Rules: use '$*' prefix for active type modifiers.
 */

/**
 * @type {$EnumKeys} $EnumKeys
 * @description Extracts the key type from an enum-like object.
 * Equivalent to `keyof T` but named for clarity in enum contexts.
 *
 * @template T
 */
export type $EnumKeys<T> = T extends Record<infer K, any> ? K : never;

/**
 * @type {$EnumValues} $EnumValues
 * @description Extracts the value type from an enum object or array.
 * Handles both `["a", "b"]` (array) and `{ a: "a", b: "b" }` (object).
 *
 * @template T
 */
export type $EnumValues<T> = T extends (infer V)[] ? V : T extends Record<string, infer V> ? V : never;

/**
 * @type {$EnumAsObj} $EnumAsObj
 * @description Converts an array or object to a normalized readonly enum object
 * (like Zod's approach). `["a", "b"]` → `{ readonly a: "a"; readonly b: "b" }`.
 *
 * @template T
 */
export type $EnumAsObj<T> = T extends (infer V)[]
  ? { readonly [K in V as string]: V }
  : T extends Record<string, infer V>
    ? { readonly [K in keyof T]: V }
    : never;

/**
 * @type {$EnumObj} $EnumObj
 * @description Extracts the full enum object type (keys and values as a Record).
 *
 * @template T
 */
export type $EnumObj<T> = T extends Record<string, infer V> ? Record<string, V> : never;

/**
 * @type {$ArrayItem} $ArrayItem
 * @description Extracts the item type from an array type.
 * Equivalent to `T[number]` but more explicit in some contexts.
 *
 * @template T
 */
export type $ArrayItem<T> = T extends (infer I)[] ? I : never;

/**
 * @type {$ToEnum} $ToEnum
 * @description Converts a string/number/bigint union to a flattened enum object
 * with each value as both key and value. Uses `$Flatten` for IDE readability.
 *
 * @template {string | number | bigint} T
 */
export type $ToEnum<T extends string | number | bigint> = {
  [K in T as K extends string | number | symbol ? K : never]: K;
} & {};
