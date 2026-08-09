import type { namerFn } from "./utils.js";

/**
 * Parses a JSON Schema `type` keyword value into nullable flag and concrete types.
 *
 * Accepts either a single type string or an array of type strings (per the
 * JSON Schema `type` keyword). The `"null"` type is extracted into the
 * `isNullable` flag and removed from the returned `types` list.
 *
 * @param rawType - The raw `type` value from the schema (string or array of strings).
 * @returns An object with `isNullable` (whether `"null"` was present) and
 *   `types` (the non-null type strings).
 */
export const parseType = (rawType: any): { isNullable: boolean; types: string[] } => {
  const isNullable = Array.isArray(rawType)
    ? rawType.includes("null")
    : rawType === "null";
  const types = Array.isArray(rawType)
    ? rawType.filter((t) => t !== "null")
    : rawType && rawType !== "null"
    ? [rawType]
    : [];
  return { isNullable, types };
};

/**
 * Resolves a relative URI against a base URI, following RFC 3986 semantics.
 *
 * Absolute URIs (`http://`, `https://`, `urn:`) are returned as-is. Fragment
 * references (`#...`) are appended to the base's canonical (fragment-stripped)
 * form. Falls back to string concatenation when `URL` construction fails
 * (e.g. for `urn:` bases or non-standard schemes).
 *
 * @param base - The base URI to resolve against.
 * @param relative - The relative URI or fragment to resolve.
 * @returns The resolved absolute URI string.
 */
export const resolveUri = (base: string, relative: string): string => {
  if (!relative) return base;
  if (
    relative.startsWith("http://") ||
    relative.startsWith("https://") ||
    relative.startsWith("urn:")
  ) {
    return relative;
  }
  try {
    const url = new URL(
      relative,
      base.includes("#") ? base.split("#")[0] : base,
    );
    return url.href;
  } catch {
    if (relative.startsWith("#")) return base.split("#")[0] + relative;
    if (typeof base === "string" && base.startsWith("urn:"))
      return (
        base.split("#")[0] + (relative.startsWith("/") ? "" : "/") + relative
      );
    return relative;
  }
};

/** Validator function signature: returns a DNA bytecode triplet `[opcode, args, meta]`. */
export type tsValidatorFn = () => [string, string, string];
/** Modifier function signature: takes numeric args and returns a DNA bytecode triplet. */
export type tsModifierFn = (args: number[]) => [string, string, string];
/** Wrapper function signature: takes an item index and a value, returns a DNA bytecode triplet. */
export type tsWrapperFn = (item: [number], value: any) => [string, string, string];
/** Constraint function signature: variadic args returning a DNA bytecode triplet. */
export type tsConstraintFn = (...args: any[]) => [string, string, string];

// Legacy mapper for dna-to-txt-raw.ts (returns simple strings)
/** Legacy validator function signature returning a plain string (for `dna-to-txt-raw.ts`). */
export type tsLegacyValidatorFn = () => string;
/** Legacy modifier function signature returning a plain string (for `dna-to-txt-raw.ts`). */
export type tsLegacyModifierFn = (args: number[]) => string;
/** Legacy wrapper function signature returning a plain string (for `dna-to-txt-raw.ts`). */
export type tsLegacyWrapperFn = (item: [number], value: any) => string;
/** Legacy constraint function signature returning a plain string (for `dna-to-txt-raw.ts`). */
export type tsLegacyConstraintFn = (...args: any[]) => string;

/** Record mapping opcode names to validator/modifier/wrapper/constraint functions. */
export type tsMapperRec = Record<string, tsValidatorFn | tsModifierFn | tsWrapperFn | tsConstraintFn>;
/** Legacy record mapping opcode names to legacy string-returning functions. */
export type tsLegacyMapperRec = Record<string, tsLegacyValidatorFn | tsLegacyModifierFn | tsLegacyWrapperFn | tsLegacyConstraintFn>;
/** Mapper function signature: takes a namer function and args, returns a string. */
export type tsMapperFn = (fn: namerFn, args: any[]) => string;

// export type tsDnaBytecode = [string, ...any[]]

