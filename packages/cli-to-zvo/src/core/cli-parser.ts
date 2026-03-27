import { parseArgs } from "node:util";
import { z } from "zod";
import { OResponse, tsGate, tsParseArgSchema, tsParsedCLI } from "../types/contract.types.js";

/**
 * @function parseCli
 * @description Manual helper that performs native parsing and Zod validation.
 * @param {string[]} args - Raw CLI arguments to parse.
 * @param {tsParseArgSchema} parsingArgs - The argument structure allowed for parsing.
 * @param {z.ZodType<tsParsedCLI>} resultParser - The Zod schema that transforms and maps the parsed arguments.
 * @param {tsGate} zvoGate - The global Gate for validation and routing.
 * @returns {OResponse} The validated and tagged result object.
 */
export function parseCli(
  args: string[],
  parsingArgs: tsParseArgSchema,
  resultParser: z.ZodType<tsParsedCLI>,
  zvoGate: tsGate,
  options:z.core.ParseContext<any>|undefined = undefined,
): z.ZodSafeParseResult<OResponse>
{
  const raw = parseArgs({
    args,
    options: parsingArgs.options,
    allowPositionals: true,
  });

  return resultParser.pipe(zvoGate).safeParse(raw, options);
}
