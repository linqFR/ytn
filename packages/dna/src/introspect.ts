/**
 * Introspection utilities for DNA schemas.
 *
 * These functions allow external consumers (e.g. @ytrynot/qb) to query schema
 * properties (optionality, nullability, wrapper type, object shape) without
 * importing DNA's internal classes. The classes are available here because
 * this module lives inside the DNA package.
 */

import { DnaObject, DnaLazy, DnaType, type DnaSomeType } from "@ytrynot/dna/core";

/**
 * Checks if a schema is optional (accepts absent/undefined values).
 * Delegates to the native DnaType.isOptional() which walks the wrapper chain
 * and handles `nonoptional` cancellation.
 *
 * @param schema - Any DNA schema (typically a shape field).
 * @returns `true` if the schema is optional.
 *
 * @example
 * ```ts
 * import { dna } from "@ytrynot/dna";
 * const s = dna.object({ id: dna.string(), name: dna.string().optional() });
 * dna.util.isOptional(s.shape.name); // true
 * dna.util.isOptional(s.shape.id);   // false
 * ```
 */
export function isOptional(schema: DnaSomeType): boolean {
  return schema instanceof DnaType && schema.isOptional();
}

/**
 * Checks if a schema is nullable (accepts `null`).
 * Delegates to the native DnaType.isNullable().
 *
 * @param schema - Any DNA schema.
 * @returns `true` if the schema is nullable.
 */
export function isNullable(schema: DnaSomeType): boolean {
  return schema instanceof DnaType && schema.isNullable();
}

/**
 * Checks if a schema is nullish (accepts both `null` and `undefined`).
 * Delegates to the native DnaType.isNullish().
 *
 * @param schema - Any DNA schema.
 * @returns `true` if the schema is nullish.
 */
export function isNullish(schema: DnaSomeType): boolean {
  return schema instanceof DnaType && schema.isNullish();
}

/**
 * Type guard: checks if a schema is a DnaObject (has a `.shape` property).
 *
 * @param schema - Any DNA schema.
 * @returns `true` if the schema is a DnaObject.
 */
export function isObject(schema: DnaSomeType): schema is DnaObject {
  return schema instanceof DnaObject;
}

/**
 * Returns the wrapper type string of a schema (e.g. "optional", "nullable",
 * "default", "nullish", "nonoptional", "exactOptional", "prefault", "catch").
 * Returns `undefined` if the schema is not a wrapper.
 *
 * @param schema - Any DNA schema.
 * @returns The wrapper type string, or `undefined`.
 */
export function wrapperType(schema: DnaSomeType): string | undefined {
  return schema._core.seed.wrapperType;
}

/**
 * Unwraps a wrapper schema to its inner schema.
 * Returns `null` if the schema is not a wrapper.
 *
 * @param schema - Any DNA schema.
 * @returns The inner schema, or `null` if not a wrapper.
 */
export function unwrap(schema: DnaSomeType): DnaSomeType | null {
  const wt = schema._core.seed.wrapperType;
  if (
    wt === "optional" || wt === "exactOptional" || wt === "default" ||
    wt === "prefault" || wt === "nullable" || wt === "nullish" ||
    wt === "catch" || wt === "nonoptional"
  ) {
    return schema._core.seed.inner as DnaSomeType;
  }
  // Lazy: resolve the getter to get the inner schema
  if (schema instanceof DnaLazy) {
    return schema.innerType;
  }
  return null;
}

/**
 * Unwraps all wrappers to find the innermost schema (for type detection).
 *
 * @param schema - Any DNA schema.
 * @returns The innermost schema.
 */
export function unwrapDeep(schema: DnaSomeType): DnaSomeType {
  let current: DnaSomeType = schema;
  for (let i = 0; i < 32; i++) {
    const inner = unwrap(current);
    if (!inner) return current;
    current = inner;
  }
  return current;
}

/**
 * Returns the default value of a DnaDefault wrapper.
 * Returns `undefined` if the schema is not a DnaDefault wrapper.
 *
 * @param schema - Any DNA schema.
 * @returns The default value, or `undefined`.
 */
export function defaultValue(schema: DnaSomeType): unknown {
  if (schema._core.seed.wrapperType !== "default") return undefined;
  return schema._core.seed.value;
}

/**
 * Returns the class name of a schema instance (e.g. "DnaString", "DnaObject",
 * "DnaOptional", "DnaNumber", etc.).
 *
 * Useful for debugging and generic introspection where you need to know the
 * concrete type without importing the class for `instanceof`.
 *
 * @param schema - Any DNA schema.
 * @returns The class name, or "Object" if the constructor is anonymous.
 *
 * @example
 * ```ts
 * import { dna } from "@ytrynot/dna";
 * import * as introspect from "@ytrynot/dna/introspect";
 * introspect.getClassName(dna.string());        // "DnaString"
 * introspect.getClassName(dna.string().optional()); // "DnaOptional"
 * introspect.getClassName(dna.object({ id: dna.string() })); // "DnaObject"
 * ```
 */
export function getClassName(schema: DnaSomeType): string {
  return schema.constructor.name;
}
