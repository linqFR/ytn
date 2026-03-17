import { parseArgs } from "node:util";
import { z } from "zod";
import {
  ArgContractSchema,
  RoutedResult,
  XorSchema,
} from "./cli-contract-schema_old.js";

/**
 * @function createParseArgsObject
 * @description Creates a Zod schema that transforms raw argument parser output into a mapped object based on the provided argument contract.
 * @param {ArgContractSchema} contract - The argument contract defining positionals and options.
 * @returns {z.ZodPipe} A Zod schema (ZodPipe wrapping ZodTransform) that transforms and maps the parsed arguments.
 */
export function createParseArgsObject(contract: ArgContractSchema) {
  return z
    .object({
      positionals: z.array(z.string()),
      values: z.record(z.string(), z.any()),
    })
    .transform((raw) => {
      const mappedObj = { ...raw.values };

      contract.positionals.forEach((keyName, index) => {
        mappedObj[keyName] = raw.positionals[index];
      });

      return mappedObj;
    });
}

/**
 * @function parseCli
 * @description High-level helper that performs native parsing, positional mapping, and Zod validation.
 * @param {string[]} args - Raw CLI arguments to parse.
 * @param {ArgContractSchema} parsingArgs - The argument structure allowed for parsing.
 * @param {XorSchema} xorSchema - The global XOR union schema for validation and routing.
 * @returns {RoutedResult} The validated and tagged result object.
 */
export function parseCli(
  args: string[],
  parsingArgs: ArgContractSchema,
  xorSchema: XorSchema,
): RoutedResult {
  const raw = parseArgs({
    args,
    options: parsingArgs.options,
    allowPositionals: true,
  });

  const mapped = createParseArgsObject(parsingArgs).parse(raw);
  return xorSchema.parse(mapped);
}
