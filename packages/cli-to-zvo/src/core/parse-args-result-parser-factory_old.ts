import { tsProcessedCliOUT, tsParseArgsResultParser } from "../types/contract.types.js";
import { z } from "zod";

/**
 * @internal
 * @function strToZod
 * @description Maps CLI type identifiers to pure Zod validation schemas.
 * Matches the types returned by node:util.parseArgs.
 */
const strToZod = (s: "string" | "boolean"): z.ZodType => {
  if (s === "string") return z.string().optional();
  if (s === "boolean") return z.boolean().optional();
  return z.any().optional();
};

/**
 * @function parseArgsResultParserFactory
 * @description Creates a Zod schema to map and validate the output of node:util.parseArgs.
 * Standard Schema / Pure Zod V4 implementation.
 * @param {tsProcessedCliOUT} cli - The processed metadata of the CLI.
 * @returns {tsParseArgsResultParser} A Zod schema.
 */
export const parseArgsResultParserFactory = (
  cli: tsProcessedCliOUT,
): tsParseArgsResultParser => {
  // Build schema and lookup in a single pass
  const flagSchemas: Record<string, z.ZodType> = {};
  const flagLookup: Record<string, string> = {};

  for (const [paName, def] of Object.entries(cli.flags)) {
    flagSchemas[def.long] = strToZod(def.type);
    flagLookup[def.long] = paName;
  }

  return z
    .object({
      // z.looseObject() is the V4 replacement for .passthrough()
      values: z.looseObject(flagSchemas), 
      positionals: z.string().array(),
    })
    .transform((data, ctx) => {
      const res: Record<string, any> = {};

      // 1. Positionals mapping by index
      Object.entries(cli.positionals).forEach(([paName, _], idx) => {
        if (data.positionals[idx] !== undefined) {
             res[paName] = data.positionals[idx];
        }
      });

      // Warning for extra positionals (non-abortive)
      const posCount = Object.keys(cli.positionals).length;
      const extraPos = data.positionals.slice(posCount);
      if (extraPos.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Extra positionals ignored: ${extraPos.join(", ")}`,
          input: data.positionals,
          params: { rest: extraPos },
          continue: true
        } as any);
      }

      // 2. Flags mapping (known) and Unrecognized reporting
      const unrecognized: string[] = [];
      const dataValues = data.values as Record<string, any>;

      Object.entries(dataValues).forEach(([k, v]) => {
        const paName = flagLookup[k];
        if (paName) {
           res[paName] = v;
           // Known types at `k` are already validated by the static flagSchemas in z.looseObject(flagSchemas)
        } else {
           unrecognized.push(k);
        }
      });

      if (unrecognized.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Unrecognized flags: ${unrecognized.join(", ")}`,
          input: dataValues,
          params: { keys: unrecognized },
          continue: true
        } as any);
      }

      return res;
    }) as tsParseArgsResultParser;
};
