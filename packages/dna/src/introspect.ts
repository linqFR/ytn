/**
 * Introspection utilities for DNA schemas.
 *
 * These functions allow external consumers (e.g. @ytrynot/qb) to query schema
 * properties (optionality, nullability, wrapper type, object shape) without
 * importing DNA's internal classes. The classes are available here because
 * this module lives inside the DNA package.
 */

import { DnaArray, DnaBoolean, DnaLiteral, DnaObject, DnaLazy, DnaMarangetUnion, DnaPipe, DnaType, type DnaSomeType, DnaDefault, DnaPrefault } from "@ytrynot/dna/core";
import { detectDiscriminators, detectPositionals, sortForCli, unwrapToDnaObject } from "@ytrynot/dna/core";
import { isWrapper } from "./algo/maranget-keys.js";

// Former `DnaMarangetUnion` statics (SoC) — publicly exposed here as
// introspection/analysis utilities: the class carries instance behavior +
// seed data; key derivation lives in these functions.
export { detectDiscriminators, detectPositionals, sortForCli, unwrapToDnaObject };

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
 * import { isOptional } from "@ytrynot/dna/introspect";
 * const s = dna.object({ id: dna.string(), name: dna.string().optional() });
 * isOptional(s.shape.name); // true
 * isOptional(s.shape.id);   // false
 * // Equivalent: s.shape.name.isOptional() — native DnaType method
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
 * Getter functions (`dna.x().default(() => value)`) are resolved by the
 * `DnaDefault.defaultValue` getter itself — this function delegates to it,
 * matching Zod v4's `def.defaultValue` behavior.
 *
 * @param schema - Any DNA schema.
 * @returns The resolved default value, or `undefined`.
 */
export function defaultValue(schema: DnaSomeType): unknown {
  if (schema instanceof DnaDefault) return schema._core.defaultValue;
  return undefined;
}

/**
 * Returns the prefault value of a DnaPrefault wrapper.
 * Returns `undefined` if the schema is not a DnaPrefault wrapper.
 *
 * Getter functions (`dna.x().prefault(() => value)`) are resolved by the
 * `DnaPrefault.prefaultValue` getter itself — this function delegates to it.
 *
 * @param schema - Any DNA schema.
 * @returns The resolved prefault value, or `undefined`.
 */
export function prefaultValue(schema: DnaSomeType): unknown {
  if (schema instanceof DnaPrefault) return schema._core.prefaultValue;
  return undefined;
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

/**
 * Unwraps a property schema to its leaf type, stripping wrappers (optional,
 * nullable, default, prefault, etc.) and pipe steps. Mirrors the builder's
 * internal `DnaMarangetUnion.unwrapToLeaf`.
 */
function unwrapToLeaf(s: DnaSomeType): DnaSomeType {
  let leaf: DnaSomeType = s instanceof DnaLazy ? s.innerType : s;
  // Strip wrappers (optional, nullable, default, prefault, catch, ...)
  // Uses the public `isWrapper` guard (checks `s.type` against wrapper names)
  // rather than accessing `_core.seed.wrapperType` directly — single source
  // of truth for wrapper detection (maranget-keys.ts, SoC DEC-0043).
  while (isWrapper(leaf)) {
    const inner = unwrap(leaf);
    if (!inner) break;
    leaf = inner;
  }
  // Strip pipe — take the first step
  if (leaf instanceof DnaPipe) {
    leaf = leaf._core.seed.steps[0];
    while (isWrapper(leaf)) {
      const inner = unwrap(leaf);
      if (!inner) break;
      leaf = inner;
    }
  }
  return leaf;
}

/**
 * Derives the `node:util.parseArgs` option type from a leaf schema.
 * - `DnaBoolean` or `DnaLiteral(true|false)` → `"boolean"`
 * - `DnaArray` → unwrap item, recurse for type, mark `multiple`
 * - everything else → `"string"`
 *
 * @param leaf - The unwrapped leaf schema.
 * @returns The parseArgs option type descriptor.
 */
function deriveOptionType(leaf: DnaSomeType): { type: "string" | "boolean"; multiple: boolean } {
  if (leaf instanceof DnaArray) {
    const itemLeaf = unwrapDeep(leaf._core.seed.itemSchema);
    const inner = deriveOptionType(itemLeaf);
    return { type: inner.type, multiple: true };
  }
  if (leaf instanceof DnaBoolean) return { type: "boolean", multiple: false };
  if (leaf instanceof DnaLiteral) {
    if (typeof leaf._core.seed.value === "boolean") return { type: "boolean", multiple: false };
  }
  return { type: "string", multiple: false };
}

/**
 * Builds a `node:util.parseArgs` config from a `marangetUnion`/`cliUnion`
 * schema. This is a **CLI-facing schema concern** (parseArgs is a Node CLI
 * tokenizer) — it needs NO output from the Maranget routing algorithm: it
 * reads only the schema metadata (`positionals`, `flags`, branch shapes).
 *
 * - Positionals come from `schema.positionals` (ordered).
 * - Flags come from all non-positional keys across branches.
 * - Option types (`"string"` / `"boolean"`) are inferred from the leaf schema.
 * - `multiple` is detected from `DnaArray` wrappers.
 * - Defaults are NOT injected — DNA owns defaulting via `DnaDefault` wrappers.
 *
 * @param schema - A `marangetUnion`/`cliUnion` schema.
 * @param opts - Optional configuration.
 * @param opts.strict - Whether `parseArgs` should run in strict mode (default: `false`).
 * @returns A `ParseArgsConfig`-compatible object for `node:util.parseArgs`.
 */
export function toParseArgsConfig(
  schema: DnaMarangetUnion<any>,
  opts?: {
    strict?: boolean;
    /** CLI-level positional override — keys consumed positionally, in order.
     *  Absent → the class-derived positionals (detectPositionals). Never
     *  stored in the seed nor the ADN: this override lives where parseArgs is
     *  configured. */
    positionals?: string[];
  }
): {
  allowPositionals: true;
  strict: boolean;
  options: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }>;
} {
  const strict = opts?.strict ?? false;
  // Effective positional set: CLI override ?? derived (the generic
  // `DnaMarangetUnion` carries no positionals — derivation lives here).
  const positionalSet = new Set(
    opts?.positionals ?? detectPositionals(schema.options, schema.discriminators)
  );
  // Single pass: collect declared keys AND option metadata.
  // Flags = declared keys NOT positional — recomputed from the EFFECTIVE set so
  // a CLI-level override stays consistent (the class getter uses the derived
  // set; with no override this equals schema.flags, same insertion order).
  const declaredKeys = new Set<string>();
  const optionMeta: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }> = {};

  for (const branch of schema.options) {
    const obj = unwrapToDnaObject(branch);
    for (const key of Object.keys(obj.shape)) {
      declaredKeys.add(key);
      if (positionalSet.has(key)) continue;
      if (optionMeta[key]) continue; // first branch wins

      const propSchema = obj.shape[key];
      const leaf = unwrapToLeaf(propSchema);
      const { type, multiple } = deriveOptionType(leaf);

      optionMeta[key] = { type, multiple };
    }
  }
  const flags = [...declaredKeys].filter(k => !positionalSet.has(k));

  const options: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }> = {};

  for (const key of flags) {
    const meta = optionMeta[key];
    if (!meta) continue;

    options[key] = {
      type: meta.type,
      multiple: meta.multiple,
    };
  }

  return { allowPositionals: true, strict, options };
}
