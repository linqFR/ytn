import { z } from "zod";
import * as fs from "node:fs";
import type { tsContractIN } from "../schema/contract.schema.js";
import type { IProcessedContract } from "../types/contract.types.js";
import {
  contractCliToParseArgsParser,
  contractCliToParseArgSchema,
  contractCliToParseArgs,
} from "../cli-engine/build-tools.js";
import { generateRoutingTable } from "../cli-engine/tree-processing.js";
import { compileZvoGate } from "../core/gate.js";
import { picoTypeToZod } from "../pico-zod/index.js";
import type { tsProcessedTarget } from "../types/contract.types.js";
import type { tsTargetName } from "../config/parse-args.js";

/**
 * @type IExportedContract
 * @description A serializable version of the compiled CLI contract metadata.
 * It omits live Zod schema instances and functions to allow JSON persistence,
 * but retains the bitmask routing logic and decision trees.
 */
export type IExportedContract = {
  /** The original contract name. */
  name: string;
  /** Description of the CLI */
  description: string;
  /** The routing metadata (bits, signatures, tree). */
  routing: any;
  /** Data models for help generation. */
  dataModels: any;
  /** Whether the contract allows negative flags. */
  allowNegative: boolean;
  /** Whether the contract only allows predefined values. */
  onlyAllowedValues?: boolean;
  /** Processed CLI configuration. */
  cli: any;
};

/**
 * @function serializeToExportedObject
 * @description Transforms a processed contract into a plain JavaScript object
 * that can be safely persisted (NoSQL, Redis, etc.) or serialized.
 * It manually filters out live Zod instances and internal functions.
 *
 * @param {IProcessedContract} processed - The fully compiled runtime contract.
 * @returns {IExportedContract} A serializable plain object.
 */
export function serializeToExportedObject(
  processed: IProcessedContract,
): IExportedContract {
  const exported: IExportedContract = {
    name: processed.name,
    description: processed.description,
    routing: processed.routing,
    dataModels: processed.dataModels,
    allowNegative: processed.allowNegative ?? false,
    cli: processed.cli,
  };

  // Explicit filtering to ensure no live objects/functions remain
  return JSON.parse(
    JSON.stringify(exported, (key, value) => {
      if (
        key === "zvoSchema" ||
        key === "parseArgsResultParser" ||
        key === "zod" ||
        typeof value === "function"
      ) {
        return undefined;
      }
      return value;
    }),
  );
}

/**
 * @function serializeProcessed
 * @description Extracts only the JSON-serializable metadata from a processed contract as a string.
 * Use this to save a compiled CLI tree to a file.
 *
 * @param {IProcessedContract} processed - The fully compiled runtime contract.
 * @returns {string} A JSON-string containing the routing infrastructure.
 */
export function serializeProcessed(processed: IProcessedContract): string {
  return JSON.stringify(serializeToExportedObject(processed));
}

/**
 * @function serializeToFile
 * @description Saves the serialized contract metadata to a local file.
 * Supports .json (raw data) and .ts (as an exported constant).
 *
 * @param {IProcessedContract} processed - The fully compiled runtime contract.
 * @param {string} filePath - Absolute path to the destination file.
 */
export function serializeToFile(
  processed: IProcessedContract,
  filePath: string,
): void {
  const json = serializeProcessed(processed);

  if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
    // For TS/JS, we wrap the JSON in an exported constant for easy re-import.
    const code = `/** @type {import("@ytn/czvo").IExportedContract} */\nexport const contract = ${json};`;
    fs.writeFileSync(filePath, code, "utf8");
  } else {
    fs.writeFileSync(filePath, json, "utf8");
  }
}

/**
 * @function rehydrateContract
 * @description Rebuilds the high-performance Zod routing engine from serialized metadata.
 * Skips structural analysis and bitmask generation to maximize cold-start performance.
 *
 * @param {string | IExportedContract} serialized - The saved metadata.
 * @param {tsContractIN} rawContract - The original source contract containing Zod schemas.
 * @returns {IProcessedContract} A fully functional, accelerated runtime contract.
 */
export function rehydrateContract(
  serialized: string | IExportedContract,
  rawContract: tsContractIN,
): IProcessedContract {
  const data: IExportedContract =
    typeof serialized === "string" ? JSON.parse(serialized) : serialized;

  // 1. Reconstruct fullTargets with live Zod schemas from rawContract
  const fullTargets: Record<tsTargetName, tsProcessedTarget> =
    Object.create(null);

  for (const [targetName, targetDef] of Object.entries(rawContract.targets)) {
    const name = targetName as tsTargetName;
    const preSchema: Record<string, z.ZodType> = {};

    // Map raw field definitions (pico-types or Zod) to live Zod schemas
    for (const [fieldName, fieldDef] of Object.entries(targetDef)) {
      preSchema[fieldName] =
        fieldDef instanceof z.ZodType
          ? fieldDef
          : picoTypeToZod(fieldDef as any);
    }

    fullTargets[name] = {
      name,
      zod: z.object(preSchema),
      // Other fields (bit, mask) aren't strictly needed for the Gate if we have the Router signatures
    } as any;
  }

  // 2. Build the basic Processed object structure
  const processed: IProcessedContract = {
    name: data.name,
    description: data.description,
    routing: data.routing,
    dataModels: data.dataModels,
    targets: fullTargets,
    cli: data.cli,
    allowNegative: data.allowNegative,
    parsingArgs: contractCliToParseArgSchema(data.cli, data.allowNegative),
    parseArgsConfig: contractCliToParseArgs(data.cli.flags),
    // placeholders
    parseArgsResultParser: {} as any,
    zvoSchema: {} as any,
    router: data.routing.router,
    help: data.dataModels,
  };

  // 3. Fast-path: Skip routing table generation (it's already in the data)
  // Re-initialize the Zod parser for CLI results
  processed.parseArgsResultParser = contractCliToParseArgsParser(
    data.cli,
    data.routing.discriminantKeys,
    data.routing.possibleValues,
    data.routing.tree,
    fullTargets,
    data.routing.bitCodes,
    data.onlyAllowedValues,
  );

  // 4. Re-compile the Zod Gate (the final discriminated union)
  processed.zvoSchema = compileZvoGate(processed);

  return processed;
}
