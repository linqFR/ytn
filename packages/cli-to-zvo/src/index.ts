import { processContract } from "./cli-contract-parser.js";
export { createParseArgsObject } from "./cli-parser.js";
import { xorGate } from "./xor-gate.js";
import { CliContractSchema } from "./cli-contract-schema.js";

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
