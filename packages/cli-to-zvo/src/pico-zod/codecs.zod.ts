import { z } from "zod";

/**
 * Utility to parse comma-separated strings into arrays.
 */
export const parseCommaSeparated = (val: unknown): string[] =>
  typeof val === "string" ? val.split(",").map((s) => s.trim()) : [];

/**
 * @function safeJSONParse
 * @description Safely parses a JSON string, returning a tuple with error or result.
 * @param {string} text - The JSON string to parse.
 * @returns {[Error | null, unknown]} A tuple of [Error | null, ParsedData | undefined].
 */
const safeJSONParse = (text: string): [Error | null, unknown] => {
  try {
    return [null, JSON.parse(text)];
  } catch (error) {
    return [
      error instanceof Error ? error : new Error(String(error)),
      undefined,
    ];
  }
};

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
 * @constant {z.ZodCodec} stringListCodec
 * @description Zod codec for comma-separated string lists.
 */
export const stringListCodec = z.codec(z.string(), z.array(z.string()), {
  decode: (v: string) => parseCommaSeparated(v),
  encode: (v: string[]) => v.join(", "),
});

/**
 * @constant {z.ZodCodec} jsonCodec
 * @description Zod codec for parsing JSON strings into JavaScript objects.
 */
export const jsonCodec = z.codec(z.string(), z.any(), {
  decode: (val: string, ctx) => {
    const [err, res] = safeJSONParse(val);
    if (err) {
      if (ctx) {
        ctx.issues.push({
          code: "custom",
          message: `Invalid JSON format: ${
            err instanceof Error ? err.message : String(err)
          }`,
          input: val,
        });
      }
      return z.NEVER;
    }
    return res;
  },
  encode: (val: unknown) => JSON.stringify(val),
});

/**
 * @constant {z.ZodCodec} jsonlCodec
 * @description Zod codec for JSON Lines (newline-separated JSON objects).
 */
export const jsonlCodec = z.codec(z.string(), z.unknown().array(), {
  decode: (v: string, ctx) => {
    const lines = v.split("\n").filter((line) => line.trim() !== "");
    return lines.map((line, idx) => {
      const [err, res] = safeJSONParse(line);
      if (err) {
        if (ctx) {
          ctx.issues.push({
            code: "custom",
            message: `Invalid JSON format: ${
              err instanceof Error ? err.message : String(err)
            }`,
            input: line,
            path: ["line", idx],
          });
        }
        return z.NEVER;
      }
      return res;
    });
  },
  encode: (arr: unknown[]) => arr.map((val) => JSON.stringify(val)).join("\n"),
});

/**
 * @constant {z.ZodCodec} jsonSchemaCodec
 * @description Zod Codec for string <-> JSON Schema <-> Zod schema
 */
export const jsonSchemaCodec = z.codec(z.string(), z.instanceof(z.ZodType), {
  // convert a JSONSchema string to convert it to a ZodType objet
  decode: (v: string, ctx) => {
    const [err, objSchema] = safeJSONParse(v);
    if (err) {
      ctx.issues.push({
        code: "invalid_format",
        input: v,
        format: "json_string",
      });
      return z.NEVER;
    }
    const params = {};
    const zodSchema = z.fromJSONSchema(objSchema as never, params);
    return zodSchema;
  },
  // convert a ZodType Object to a schema, then to a JSONSchema string
  encode: (zSchema: z.ZodType) => {
    const params: z.core.ToJSONSchemaParams = {};
    const jsonschema = (zSchema as z.ZodJSONSchema).toJSONSchema(params);
    return JSON.stringify(jsonschema);
  },
});

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
