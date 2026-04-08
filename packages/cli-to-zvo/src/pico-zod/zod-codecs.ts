import { z } from "zod";

/**
 * Utility to parse comma-separated strings into arrays.
 */
// export const parseCommaSeparated = (val: unknown): string[] =>
//   typeof val === "string" ? val.split(",").map((s) => s.trim()) : [];

/**
 * Utility to handle empty or specific strings ("null", "undefined") as null/undefined values.
 */
export const makeEmptyTo = <T extends z.ZodTypeAny>(
  targetStr: string,
  fallback: T,
) =>
  z.coerce.string().pipe(
    z.preprocess((v) => {
      const s = typeof v === "string" ? v.toLowerCase() : "";
      return s === targetStr || s === ""
        ? fallback instanceof z.ZodNull
          ? null
          : undefined
        : v;
    }, fallback),
  );


/**
 * @function csvPreProcess
 * @description Wraps a Zod collection (Array or Tuple) to handle comma-separated strings from the CLI.
 *
 * ### The V4-Native Inverted Proxy
 * This function ensures Zod v4 compatibility without using the legacy `ZodEffects` (preprocess) class:
 * 1. It wraps the original `target` (ZodArray or ZodTuple) in a Proxy.
 * 2. It intercepts the `~standard` validation property (the core of Zod v4 / Standard Schema).
 * 3. Its custom `validate` function first performs the CSV splitting, then delegates the rest
 *    of the validation to the original schema's engine.
 * 4. This ensures that the schema is seen as a native collection schema by both TypeScript
 *    and Zod's internal compositional logic, while still behaving like a preprocessor.
 *
 * @template {z.ZodArray<any> | z.ZodTuple<any>} T
 * @param {T} target - The original Zod collection schema.
 * @returns {T} A pure collection schema that performs internal CSV splitting.
 */
import { bridgeZod } from "./sealer.js";
import { parseCommaSeparated } from "@ytn/shared/js/str-ops.js";

/**
 * @function csvPreProcess
 * @description Native Zod v4 preprocessing via Inverted Recursive Proxy.
 * Ensures CSV splitting logic survives modifiers chaining (.min, .max, etc.)
 */
export const csvPreProcess = <T extends z.ZodArray<any> | z.ZodTuple<any>>(
  target: T,
): T => {
  // 1. Create a V4-native pipeline that splits the string BEFORE the array validation.
  const v4Pipe = z
    .string()
    .transform((v): any[] => parseCommaSeparated(v))
    .pipe(target);

  // 2. Use the unified Bridge mechanism from sealer.ts to delegate methods.
  // We don't pass 'isForbidden' here because this internal bridge needs to expose '.parse()'
  // for the routing engine. Top-level sealing will happen in the factories.
  return bridgeZod(v4Pipe, target, csvPreProcess);
};
