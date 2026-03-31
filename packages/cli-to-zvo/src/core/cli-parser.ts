import { parseArgs } from "node:util";
import { z } from "zod";
import {
  $SafeResult,
  OResponse,
  tsGate,
  tsParseArgSchema,
  tsParsedCLI,
} from "../types/contract.types.js";
import { setZodConfig } from "../config/zod-config.js";

/**
 * @function parseCli
 * @description Manual helper that performs native parsing and Zod validation.
 * @param {string[]} args - Raw CLI arguments to parse.
 * @param {tsParseArgSchema} parsingArgs - The argument structure allowed for parsing.
 * @param {z.ZodType<tsParsedCLI>} resultParser - The Zod schema that transforms and maps the parsed arguments.
 * @param {tsGate} zvoGate - The global Gate for validation and routing.
 * @param {} [options] -
 * @returns {OResponse} The validated and tagged result object.
 */
export function parseCli(
  args: string[],
  parsingArgs: tsParseArgSchema,
  resultParser: z.ZodType<tsParsedCLI>,
  zvoGate: tsGate,
  options: z.core.ParseContext<any> | undefined = undefined,
): $SafeResult<OResponse> {
  const raw = parseArgs({
    args,
    options: parsingArgs.options,
    allowPositionals: true,
    strict: false,
  });

  setZodConfig();

  return resultParser.pipe(zvoGate).safeParse(raw, {
    reportInput: true,
    ...(options ?? {}),
  });
}
