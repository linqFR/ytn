import { z } from "zod";
import { ContractSchema, tsContractIN } from "../schema/contract.schema.js";
import { OResponse } from "../types/contract.types.js";
import { parseCli } from "./cli-parser.js";
import { formatError, formatResponse } from "./response.js";

export const cliToZod = (contract: tsContractIN) => {
  const res = ContractSchema.safeParse(contract);
  if (!res.success) {
    throw new SyntaxError(`Error with the Contract`, { cause: res.error });
  }

  const {
    cli,
    targets,
    parsingArgs,
    parseArgsResultParser,
    zvoSchema,
    routing,
  } = res.data;

  return {
    parsingArgs,
    parseArgsResultParser,
    zvoSchema,
    targetSchemas: targets,
    router: routing.router,
    help: { ...cli.positionals, ...cli.flags },
  };
};

export type tsProcessedContract = ReturnType<typeof cliToZod>;

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
  if (parsed.success) {
    const { route, data } = parsed.data;
    return formatResponse(route)(data);
  }
  return formatError("error")(z.treeifyError(parsed.error));
}
