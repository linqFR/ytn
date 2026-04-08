import { z } from "zod";
import * as setOp from "@ytn/shared/js/set-ops.js";

import { getZodValue } from "../shared/zod-tbx.js";
import {
  contractCliToParseArgs,
  contractCliToParseArgSchema,
  contractCliToParseArgsParser,
} from "../cli-engine/build-tools.js";
import { compileZvoGate } from "../core/gate.js";
import {
  contractCliSchema,
  contractFallbackSchema,
  contractTargetSchema,
} from "../cli-engine/schemas.js";
import {
  buildDecisionTree,
  generateRoutingTable,
} from "../cli-engine/tree-processing.js";
import {
  FlagNameToObjectName,
  type tsParseArgString,
  type tsTargetFieldName,
  type tsTargetName,
} from "../config/parse-args.js";
import { picoTypeToZod } from "../pico-zod/index.js";
import type {
  tsBitCodes,
  tsBitGroups,
  tsBitRouterSet,
  tsPossibleValuesArray,
  tsRoutingMasksSet,
} from "../types/bit-router.types.js";
import type {
  IProcessedContract,
  tsDiscriminantMap,
  tsGate,
  tsPossibleValuesSet,
  tsProcessedCliOUT,
  tsProcessedDataModel,
  tsProcessedFlag,
  tsProcessedPositional,
  tsProcessedTarget,
} from "../types/contract.types.js";
import {
  hasZodValueDeep,
  isZodDefaultDeep,
  isZodOptionalDeep,
} from "@ytn/shared/zod/zod-reflection.js";

const baseContractSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().optional(),
  cli: contractCliSchema,
  targets: contractTargetSchema,
  fallbacks: contractFallbackSchema.optional().default({}),
  options: z
    .object({
      /** If true, restricts inputs for literal/enum fields at the entry level (fail-fast) (default: true) */
      onlyAllowedValues: z.boolean().default(true),
      /** If true, Allows explicitly setting boolean options to false by prefixing the option name with --no- (default: false) */
      allowNegative: z.boolean().default(false),
    })
    .partial()
    .default({}),
});

/**
 * @constant ContractSchema
 * @description The primary compiler and validator for CLI contracts.
 * It transforms a high-level, human-readable CLI definition into an optimized,
 * bit-mapped runtime engine.
 *
 * The compilation process follows these phases:
 * 1. **Validation**: Ensures every field used in targets is defined in the CLI block.
 * 2. **Bitcode Generation**: Assigns unique 2^n bitmasks to each CLI argument and flag.
 * 3. **Metadata Enrichment**: Processes flags and positionals into a unified internal model.
 * 4. **Target Analysis**: Deconstructs Zod schemas to identify literals and required/optional bits.
 * 5. **Decision Tree Compilation**: Builds an optimized binary search tree for bitwise routing.
 * 6. **Routing Table Generation**: Flattens the tree into O(1) string signatures for Zod V4 jumping.
 * 7. **Gate Creation**: Initializes the final Zod Discriminated Union dispatcher.
 */
export const ContractSchema = baseContractSchema.transform((data, ctx) => {
  const {
    cli,
    targets,
    fallbacks = {},
    options,
  } = data;

  // Phase 1: Key Validation
  // Map kebab-case CLI names to camelCase internal target field names.
  const positionals = cli.positionals ?? [];
  const paPostionals = positionals.map((v) =>
    FlagNameToObjectName<tsTargetFieldName>(v),
  );
  const flags = cli.flags ?? {};
  const paFlags = Object.keys(flags).map((v) =>
    FlagNameToObjectName<tsTargetFieldName>(v),
  );
  const knownKeys = new Set<tsTargetFieldName>([...paPostionals, ...paFlags]);

  // Phase 2: Bitcode Assignment
  // Bitmasks allow O(1) check for the presence of multiple flags/positionals.
  const bitCodes: tsBitCodes = Object.fromEntries(
    Array.from(knownKeys).map((v, idx) => [v, 1 << idx]),
  );
  const bitRouterSet: tsBitRouterSet = Object.create(null);
  const bitGroups: tsBitGroups = new Map();
  const masks: tsRoutingMasksSet = Object.create(null);

  const cliPos: Record<tsTargetFieldName, tsProcessedPositional> =
    Object.create(null);
  const cliFlags: Record<tsTargetFieldName, tsProcessedFlag> =
    Object.create(null);
  const dataModels: Record<tsTargetFieldName, tsProcessedDataModel> =
    Object.create(null);

  const discriminants: tsDiscriminantMap = Object.create(null);
  const discriminantKeys = Array.from(knownKeys);

  // Phase 3: CLI Element Enrichment
  // Initialize help metadata and bitwise records for positionals.
  positionals.forEach((cliName, idx) => {
    const paName = paPostionals[idx];
    const entry = { long: cliName, bit: bitCodes[paName] };
    cliPos[paName] = entry;
    dataModels[paName] = { ...entry, type: "string" };
    discriminants[paName] = [];
  });

  // Initialize help metadata and bitwise records for flags.
  Object.entries(cli.flags ?? {}).forEach(([cliName, def]) => {
    const paName = FlagNameToObjectName<tsTargetFieldName>(cliName);
    const entry = {
      ...def,
      long: cliName as tsParseArgString,
      bit: bitCodes[paName],
      short: def?.short ?? cliName[0].toLowerCase(),
    };
    cliFlags[paName] = entry;
    dataModels[paName] = entry;
  });

  const fullTargets: Record<tsTargetName, tsProcessedTarget> =
    Object.create(null);

  const possibleValues: tsPossibleValuesSet = Object.create(null);
  Array.from(knownKeys).forEach((k) => (possibleValues[k] = {}));

  // Active discriminants are fields that use literals/enums to differentiate targets
  // sharing the same bitmask (same set of present arguments).
  const activeDiscriminantSet = new Set<tsTargetFieldName>();

  // Phase 4: Individual Target Analysis
  Object.entries(targets).forEach(([_targetName, targetFields]) => {
    const targetName = _targetName as tsTargetName;
    const preSchema: Record<string, z.ZodType> = {};
    const helpFields: Record<tsParseArgString, string> = {};
    let targetCode = 0;
    let targetMask = 0;
    const targetLiterals: Record<tsTargetFieldName, string[]> = {};

    let optionalBits = 0;
    let requiredBits = 0;

    Object.entries(targetFields).forEach(([fieldName, fieldSchema]) => {
      const paFieldName = fieldName as tsTargetFieldName;
      if (!knownKeys.has(paFieldName)) {
        ctx.issues.push({
          code: "custom",
          message: `Field "${fieldName}" in target "${targetName}" is not defined in cli.`,
          path: ["targets", targetName, fieldName],
          input: data,
        });
      } else {
        const zod = picoTypeToZod(fieldSchema);
        const dModel = cliPos[paFieldName] || cliFlags[paFieldName];
        const desc =
          cliFlags[paFieldName]?.desc ?? zod.meta()?.description ?? fieldName;

        preSchema[paFieldName] = zod;
        if (dModel) helpFields[dModel.long as tsParseArgString] = desc;

        const bit = bitCodes[paFieldName];
        targetCode |= bit;
        if (isZodOptionalDeep(zod) || isZodDefaultDeep(zod)) {
          optionalBits |= bit;
        } else {
          requiredBits |= bit;
        }

        // Inspect Zod schemas for literal/enum values to use as routing discriminants.
        if (hasZodValueDeep(zod)) {
          const zodVal = getZodValue(zod);
          targetMask |= bit;
          activeDiscriminantSet.add(paFieldName);
          targetLiterals[paFieldName] = zodVal;

          if (!discriminants[paFieldName]) discriminants[paFieldName] = [];
          for (const v of zodVal) {
            if (!discriminants[paFieldName].includes(v)) {
              discriminants[paFieldName].push(v);
            }
          }
        }
      }
    });

    let group = bitGroups.get(targetCode);
    if (!group) {
      group = [];
      bitGroups.set(targetCode, group);
    }
    group.push(targetName);

    fullTargets[targetName] = {
      name: targetName,
      zod: z.strictObject(preSchema),
      targetCode: targetCode,
      targetRequiredBits: requiredBits,
      targetMask: targetMask,
      targetSignatures: [], // Populated later via routing table flattening
      targetLiterals,
      fields: helpFields,
    };
  });

  // Process fallback targets (catch-alls).
  Object.entries(fallbacks).forEach(([_targetName, targetFields]) => {
    const targetName = _targetName as tsTargetName;
    const preSchema: Record<string, z.ZodType> = {};
    const helpFields: Record<tsParseArgString, string> = {};
    let targetCode = 0;
    let targetMask = 0;

    Object.entries(targetFields).forEach(([fieldName, fieldSchema]) => {
      const paFieldName = fieldName as tsTargetFieldName;
      const zod = picoTypeToZod(fieldSchema);
      const dModel = cliPos[paFieldName] || cliFlags[paFieldName];
      const desc =
        cliFlags[paFieldName]?.desc ?? zod.meta()?.description ?? fieldName;

      preSchema[paFieldName] = zod;
      if (dModel) helpFields[dModel.long as tsParseArgString] = desc;

      targetCode |= bitCodes[paFieldName];
    });

    fullTargets[targetName] = {
      name: targetName,
      zod: z.looseObject(preSchema),
      targetCode: targetCode,
      targetRequiredBits: targetCode,
      targetMask: targetMask,
      targetSignatures: [],
      targetLiterals: {},
      fields: helpFields,
    };
  });

  const cliProcessed: tsProcessedCliOUT = {
    positionals: cliPos,
    flags: cliFlags,
  };

  /** Utility to transform internal Set-based tracking into Arrays for the final contract. */
  const _possibleValuesToArray = () =>
    Object.fromEntries(
      (Object.entries(possibleValues) as any).map(([k, targets]: any) => [
        k,
        setOp.recordSetToRecordArray(targets),
      ]),
    ) as unknown as tsPossibleValuesArray;

  // Phase 5: Routing Tree Compilation
  const tree = buildDecisionTree(
    Object.values(fullTargets).map((t) => ({
      name: t.name,
      requiredBits: t.targetRequiredBits,
      allowedBits: t.targetCode,
    })),
    Object.values(bitCodes),
  );

  const filteredDiscriminantKeys = discriminantKeys.filter((k) =>
    activeDiscriminantSet.has(k),
  );

  // Initial build of the processed contract structure.
  const processed: IProcessedContract = {
    name: data.name,
    description: data.description,
    version: data.version,
    cli: cliProcessed,
    targets: fullTargets,
    routing: {
      groups: bitGroups,
      def: bitCodes,
      router: {}, // Placeholder for Phase 6
      discriminants,
      discriminantKeys: filteredDiscriminantKeys,
      possibleValues: _possibleValuesToArray(),
      masks: {}, // Legacy slot (Tree resolution is now primary)
      tree,
    },
    dataModels,
    parsingArgs: contractCliToParseArgSchema(
      cliProcessed,
      options.allowNegative,
    ),
    parseArgsResultParser: {} as any, // Placeholder for Phase 6
    parseArgsConfig: contractCliToParseArgs(cliProcessed.flags),
    zvoSchema: {} as tsGate, // Placeholder for Phase 7
    router: {}, // Placeholder for Phase 6
    help: dataModels,
    allowNegative: options.allowNegative ?? false,
  };

  // Phase 6: Routing Table Flattening
  // Transforms the tree + literal combinations into O(1) lookup signatures.
  const finalRouter = generateRoutingTable(processed);

  processed.routing.router = finalRouter;
  processed.router = finalRouter;

  // Initialize the Zod parser for the result of Node's parseArgs.
  processed.parseArgsResultParser = contractCliToParseArgsParser(
    cliProcessed,
    filteredDiscriminantKeys,
    _possibleValuesToArray(),
    tree,
    fullTargets,
    bitCodes,
    options.onlyAllowedValues,
  );

  // Phase 7: Gate Initialization
  // The Gate creates the final Zod Discriminated Union based on the router signatures.
  processed.zvoSchema = compileZvoGate(processed);
  return processed;
});

/**
 * @type tsContractIN
 * @description Inferred input type for use in Contract definition files.
 */
export type tsContractIN = z.input<typeof ContractSchema>;

/**
 * @type tsContractOUT
 * @description Inferred output type representing a fully compiled CLI contract.
 */
export type tsContractOUT = z.output<typeof ContractSchema>;
