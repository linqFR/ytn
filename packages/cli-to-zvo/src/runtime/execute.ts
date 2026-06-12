import { argv } from "node:process";
import { parseArgs } from "node:util";
import type {
  IProcessedContract,
  OSafeResult,
} from "../types/contract.types.js";
import { setZodConfig } from "../config/zod-config.js";

/**
 * @static
 * @method execute
 * @description Low-level execution of a previously compiled contract metadata against raw arguments.
 * Uses pre-compiled validators for optimal runtime performance.
 *
 * @param {IProcessedContract} processedContract - The compiled contract metadata.
 * @param {string[]} [args=argv.slice(2)] - Arguments to parse.
 * @returns {OSafeResult} The routing and validation result.
 */
export function execute(
  processedContract: IProcessedContract,
  args: string[] = argv.slice(2),
): OSafeResult {
  const raw = parseArgs({
    args,
    options: processedContract.parsingArgs.options,
    allowPositionals: true,
    allowNegative: processedContract.parsingArgs.allowNegative,
    strict: false,
  });

  setZodConfig();

  // Use pre-compiled validator (created once at contract definition)
  return processedContract.compiledValidator.safeParse(raw, {
    reportInput: true,
  }) as OSafeResult;
}
