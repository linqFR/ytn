import { defineContract } from "../editor/contract-create.js";
import { uValidateContract } from "../editor/contract-create.type.js";
import { parseCli } from "./cli-parser.js";
import { formatOutput } from "./response.js";
import { type tsContractIN } from "../schema/contract.schema.js";
import type { OResponseErr, OResponseOk } from "../types/contract.types.js";

// export const cliToZod = (contract: tsContractIN): IProcessedContract => {
//   const res = ContractSchema.safeParse(contract);
//   if (!res.success) {
//     throw new SyntaxError(`Error with the Contract`, { cause: res.error });
//   }

//   return res.data;
// };

/**
 * @function executeRaw
 * @description High-level helper that performs full parsing and validation in one call.
 * @param {tsContractAny} contract - The CLI contract definition.
 * @param {string[]} args - Raw CLI arguments (defaults to argv.slice(2)).
 * @returns {OResponseOk} A validated object containing matched route data or an error.
 */
export function executeRaw<I extends tsContractIN>(
  contract: uValidateContract<I>,
  args: string[] = process.argv.slice(2),
): OResponseOk | OResponseErr {
  const tools = defineContract(contract);
  const parsed = parseCli(
    args,
    tools.parsingArgs,
    tools.parseArgsResultParser,
    tools.zvoSchema,
  );
  return formatOutput(parsed);
}
