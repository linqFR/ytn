import { processContract } from "./cli-contract-parser.js";
import { createParseArgsObject, parseCli } from "./cli-parser.js";
import { xorGate } from "./xor-gate.js";
import { CliContractSchema, RoutedResult } from "./cli-contract-schema.js";

export { createParseArgsObject, parseCli };
export type { CliContractSchema };

/**
 * @function cliToZod
 * @description Converts a CLI Contract into a set of Zod schemas for parsing and routing.
 * @param {CliContractSchema} contract - The CLI contract definition.
 * @returns {object} An object containing the XOR routing schema and a dictionary of target schemas.
 * @throws {SyntaxError} If the contract fails validation.
 */
export const cliToZod = (contract: CliContractSchema) => {
  const res = processContract.safeParse(contract);
  if (!res.success)
    throw new SyntaxError(`Error with the Contract`, { cause: res.error });
  const xorgate = new xorGate(res.data.targetObjects);
  return {
    parsingArgs: res.data.args,
    xorSchema: xorgate.xorSchema,
    targetSchemas: xorgate.schemaDict,
    router: xorgate,
    help: res.data.help,
  };
};

/**
 * @function cliToZVO
 * @description High-level helper that performs full parsing and validation in one call.
 */
export function cliToZVO(
  contract: CliContractSchema,
  args: string[] = process.argv.slice(2),
):RoutedResult {
  const tools = cliToZod(contract);
  return parseCli(args, tools.parsingArgs, tools.xorSchema);
}

