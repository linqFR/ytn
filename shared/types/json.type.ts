/**
 * Strict JSON types and safe parsing/stringifying operations.
 * Pure JS, no Node.js dependencies.
 */

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

/**
 * @type {string | number | boolean | null} JSONPrimitive
 * @description The base set of primitives allowed in a JSON structure.
 */
export type tsJSONPrimitive = string | number | boolean | null;

/**
 * @type {T} ValidJSON
 * @description Strict recursive type checking to ensure a structure T is fully serializable to JSON.
 * It recursively validates arrays and objects while forbidding symbols, bigints, and functions.
 *
 * @template T - The type to validate.
 */
export type tsValidJSON<T> = 0 extends 1 & T
  ? T
  : T extends tsJSONPrimitive
  ? T
  : T extends symbol | bigint | ((...args: any[]) => any)
  ? never
  : T extends Array<infer U>
  ? undefined extends U
    ? never
    : Array<tsValidJSON<U>>
  : T extends object
  ? {
      [K in keyof T]:
        | tsValidJSON<Exclude<T[K], undefined>>
        | (undefined extends T[K] ? undefined : never);
    }
  : never;
