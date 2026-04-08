import { z } from "zod";
import { safeParse } from "../js/json.js";
import { parseCommaSeparated } from "../js/str-ops.js";

/**
 * Common Zod Codecs for bidirectional transformations.
 * Standards:
 * - Follows Zod V4 native 'codec' pattern.
 * - Uses 'json.safeParse' from shared toolbox for robust parsing.
 */

/**
 * @constant {z.ZodCodec<z.ZodString, z.ZodArray<z.ZodString>>} stringListCodec
 * @description Zod codec for comma-separated string lists.
 */
export const stringListCodec = z.codec(z.string(), z.array(z.string()), {
  decode: (v: string) => parseCommaSeparated(v),
  encode: (v: string[]) => v.join(", "),
});

/**
 * @constant {z.ZodCodec<z.ZodString, z.ZodAny>} jsonCodec
 * @description Zod codec for parsing JSON strings into JavaScript objects.
 */
export const jsonCodec = z.codec(z.string(), z.any(), {
  decode: (val: string, ctx) => {
    const [err, res] = safeParse(val);
    if (err) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid JSON format: ${
          err instanceof Error ? err.message : String(err)
        }`,
        input: val,
      });
      return z.NEVER;
    }
    return res;
  },
  encode: (val: unknown) => JSON.stringify(val),
});

/**
 * @constant {z.ZodCodec<z.ZodString, z.ZodArray<z.ZodUnknown>>} jsonlCodec
 * @description Zod codec for JSON Lines (newline-separated JSON objects).
 */
export const jsonlCodec = z.codec(z.string(), z.unknown().array(), {
  decode: (v: string, ctx) => {
    const lines = v.split("\n").filter((line) => line.trim() !== "");
    return lines.map((line, idx) => {
      const [err, res] = safeParse(line);
      if (err) {
        ctx.issues.push({
          code: "custom",
          message: `Invalid JSON format: ${
            err instanceof Error ? err.message : String(err)
          }`,
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
 * @constant {z.ZodCodec<z.ZodString, z.ZodType>} jsonSchemaCodec
 * @description Zod Codec for transforming JSON strings to/from live Zod schemas via JSON Schema intermediate.
 */
export const jsonSchemaCodec = z.codec(z.string(), z.instanceof(z.ZodType), {
  decode: (v: string, ctx) => {
    const [err, objSchema] = safeParse(v);
    if (err) {
      ctx.issues.push({
        code: "invalid_format",
        input: v,
        format: "json_string",
      });
      return z.NEVER;
    }
    return z.fromJSONSchema(objSchema);
  },
  encode: (zSchema: z.ZodType) => {
    return JSON.stringify(zSchema.toJSONSchema());
  },
});
