import { z } from "zod";

/**
 * @function safeJSONParse
 * @description Safely parses a JSON string, returning a tuple with error or result.
 * @param {string} text - The JSON string to parse.
 * @returns {[any, any]} A tuple of [Error | null, ParsedData | undefined].
 */
const safeJSONParse = (text: string) => {
  try {
    return [null, JSON.parse(text)];
  } catch (error) {
    return [error, undefined];
  }
};

/**
 * @constant {z.ZodCodec} listCodec
 * @description Zod codec for comma-separated string lists.
 */
export const listCodec = z.codec(z.string(), z.array(z.string()), {
  decode: (v) => v.split(",").map((s) => s.trim()),
  encode: (v) => v.join(", "),
});

/**
 * @constant {z.ZodCodec} jsonCodec
 * @description Zod codec for parsing JSON strings into JavaScript objects.
 */
export const jsonCodec = z.codec(z.string(), z.any(), {
  decode: (val, ctx) => {
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
  encode: (val) => JSON.stringify(val),
});

/**
 * @constant {z.ZodCodec} jsonlCodec
 * @description Zod codec for JSON Lines (newline-separated JSON objects).
 */
export const jsonlCodec = z.codec(z.string(), z.any().array(), {
  decode: (v, ctx) => {
    const lines = v.split("\n").filter((line) => line.trim() !== "");
    return lines.map((line) => {
      const [err, res] = safeJSONParse(line);
      if (err) {
        if (ctx) {
          ctx.issues.push({
            code: "custom",
            message: `Invalid JSON format: ${
              err instanceof Error ? err.message : String(err)
            }`,
            input: line,
          });
        }
        return z.NEVER;
      }
      return res;
    });
  },
  encode: (arr) => arr.map((val) => JSON.stringify(val)).join("\n"),
});
