import {
  serializeToExportedObject,
  serializeToFile,
  type IExportedContract,
} from "./exporter.js";
import type { tsContractIN } from "../schema/contract.schema.js";
import { createContract, type uValidateContract } from "../editor.js";
import { IProcessedContract } from "../index.js";

/**
 * @function compileProcessedContract
 * @description Analyzes and compiles a ZVO Contract definition into a pure, serializable plain object.
 * This performs all heavy AST processing and Zod validations, stripping live references
 * so that the output can be persisted and loaded with zero-overhead at runtime.
 *
 * @param {IProcessedContract} contract - The user-defined CLI contract object.
 * @returns {IExportedContract} The static, serializable contract metadata.
 */
export function compileProcessedContract(
  processedContract: IProcessedContract,
): IExportedContract {
  return serializeToExportedObject(processedContract);
}

/**
 * @function compileContract
 * @description Analyzes and compiles a ZVO Contract definition into a pure, serializable plain object.
 * This performs all heavy AST processing and Zod validations, stripping live references
 * so that the output can be persisted and loaded with zero-overhead at runtime.
 *
 * @param {tsContractIN} contract - The user-defined CLI contract object.
 * @returns {IExportedContract} The static, serializable contract metadata.
 */
export function compileContract<I extends tsContractIN = tsContractIN>(
  contract: uValidateContract<I>,
): IExportedContract {
  const processed = createContract(contract);
  return compileProcessedContract(processed);
}

/**
 * @function compileContractToFile
 * @description Compiles a CLI contract and writes the static optimized result directly to a file.
 * Handles both .json (raw data) and .js/.ts (exported JS module) files.
 *
 * @param {tsContractIN} contract - The user-defined CLI contract object.
 * @param {string} outPath - The absolute or relative destination file path (e.g. "./contract.compiled.json").
 */
export function compileContractToFile<I extends tsContractIN = tsContractIN>(
  contract: uValidateContract<I>,
  outPath: string,
): void {
  const processed = createContract(contract);
  serializeToFile(processed, outPath);
}
