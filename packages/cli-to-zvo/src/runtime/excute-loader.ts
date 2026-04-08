import { resolve } from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import type { OSafeResult } from "../types/contract.types.js";
import { execute } from "./execute.js";

/**
 * @function execWithFile
 * @description Load an AOT-compiled contract from a file and execute it.
 *
 * @param {string} file - Path to the compiled contract file (.js or .ts).
 * @param {string[]} [args=argv.slice(2)] - Arguments to parse.
 * @returns {Promise<OSafeResult>} The routing result.
 */
export async function execWithFile(
  file: string,
  args: string[] = argv.slice(2),
): Promise<OSafeResult> {
  const filePath = resolve(process.cwd(), file);
  const module = await import(pathToFileURL(filePath).href);

  const processedContract = module.default || module.contract || module;

  return execute(processedContract, args);
}
