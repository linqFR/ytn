
import { z } from "zod";
import * as json from "../js/json.js";

/**
 * Common Zod Codecs for bidirectional transformations.
 * Standards: 
 * - Follows Zod V4 native 'codec' pattern.
 * - Uses 'json.safeParse' from shared toolbox for robust parsing.
 */

/**
 * Utility to parse comma-separated strings into arrays.
 */
export const parseCommaSeparated = (val: unknown): string[] =>
  typeof val === "string" ? val.split(",").map((s) => s.trim()) : [];

/**
 * @constant {z.ZodCodec} stringList
 * @description Zod codec for comma-separated string lists.
 */
export const stringList = z.codec(z.string(), z.array(z.string()), {
  decode: (v: string) => parseCommaSeparated(v),
  encode: (v: string[]) => v.join(", "),
});

/**
 * @constant {z.ZodCodec} jsonCodec
 * @description Zod codec for parsing JSON strings into JavaScript objects.
 */
export const jsonCodec = z.codec(z.string(), z.any(), {
  decode: (val: string, ctx) => {
    const [err, res] = json.safeParse(val);
    if (err) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`,
        input: val,
      });
      return z.NEVER;
    }
    return res;
  },
  encode: (val: unknown) => JSON.stringify(val),
});

/**
 * @constant {z.ZodCodec} jsonl
 * @description Zod codec for JSON Lines (newline-separated JSON objects).
 */
export const jsonl = z.codec(z.string(), z.unknown().array(), {
  decode: (v: string, ctx) => {
    const lines = v.split("\n").filter((line) => line.trim() !== "");
    return lines.map((line, idx) => {
      const [err, res] = json.safeParse(line);
      if (err) {
        ctx.issues.push({
          code: "custom",
          message: `Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`,
          input: line,
          path: ["line", idx],
        });
        return z.NEVER;
      }
      return res;
    });
  },
  encode: (arr: unknown[]) => arr.map((val) => JSON.stringify(val)).join("\n"),
});

/**
 * @constant {z.ZodCodec} jsonSchema
 * @description Zod Codec for string <-> JSON Schema <-> Zod schema
 */
export const jsonSchema = z.codec(z.string(), z.instanceof(z.ZodType), {
  decode: (v: string, ctx) => {
    const [err, objSchema] = json.safeParse(v);
    if (err) {
      ctx.issues.push({
        code: "invalid_format",
        input: v,
        format: "json_string",
      });
      return z.NEVER;
    }
    return z.fromJSONSchema(objSchema as any);
  },
  encode: (zSchema: z.ZodType) => {
    return JSON.stringify(zSchema.toJSONSchema());
  },
});
