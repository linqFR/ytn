import {
  ContractSchema,
  type tsContractIN,
} from "../schema/contract.schema.js";
import type { IProcessedContract, OResponse } from "../types/contract.types.js";
import { parseCli } from "./cli-parser.js";
import { formatOutput } from "./response.js";

export const cliToZod = (contract: tsContractIN): IProcessedContract => {
  const res = ContractSchema.safeParse(contract);
  if (!res.success) {
    throw new SyntaxError(`Error with the Contract`, { cause: res.error });
  }

  return res.data;
};

/**
 * @function cliToZVO
 * @description High-level helper that performs full parsing and validation in one call.
 * @param {tsContractAny} contract - The CLI contract definition.
 * @param {string[]} args - Raw CLI arguments (defaults to process.argv.slice(2)).
 * @returns {OResponse} A validated object containing matched route data or an error.
 */
export function cliToZVO(
  contract: tsContractIN,
  args: string[] = process.argv.slice(2),
): OResponse {
  const tools = cliToZod(contract);
  const parsed = parseCli(
    args,
    tools.parsingArgs,
    tools.parseArgsResultParser,
    tools.zvoSchema,
  );
  return formatOutput(parsed);
}
