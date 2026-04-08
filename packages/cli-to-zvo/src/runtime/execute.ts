import { argv } from "node:process";
import type {
  IProcessedContract,
  OSafeResult,
} from "../types/contract.types.js";
import { parseCli } from "./cli-parser.js";

/**
 * @static
 * @method execute
 * @description Low-level execution of a previously compiled contract metadata against raw arguments.
 * Useful in serverless or pre-compiled environments where you don't want to re-run the DSL compiler.
 *
 * @param {IProcessedContract} processedContract - The compiled contract metadata.
 * @param {string[]} [args=argv.slice(2)] - Arguments to parse.
 * @returns {OSafeResult} The routing and validation result.
 */
export function execute(
  processedContract: IProcessedContract,
  args: string[] = argv.slice(2),
): OSafeResult {
  return parseCli(
    args,
    processedContract.parsingArgs,
    processedContract.parseArgsResultParser,
    processedContract.zvoSchema,
  );
}
