import { z } from "zod";

import { ArgContractSchema } from "./cli-contract-schema.js";

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
      // CHECK: map positionals to their defined names based on the contract
      const mappedObj = { ...raw.values };

      contract.positionals.forEach((keyName, index) => {
        mappedObj[keyName] = raw.positionals[index];
      });

      return mappedObj;
    });
}
