import { z } from "zod";

import {
  contractCliToParseArgs,
  contractCliToParseArgSchema,
  contractCliToParseArgsParser,
} from "../cli-engine/build-tools.js";
import { ZvoGate } from "../cli-engine/gate.js";
import {
  contractCliSchema,
  contractTargetSchema,
} from "../cli-engine/schemas.js";
import {
  FlagNameToObjectName,
  type tsParseArgString,
  type tsTargetFieldName,
  type tsTargetName,
} from "../config/parse-args.js";
import { TARGET_FALLBACK_NAME } from "../config/zod-config.js";
import { isPico, picoTypetoZod } from "../pico-zod/index.js";
import {
  allCombinations,
  forgeRoutingSignature,
  getZodValue,
  hasZodValue,
  isZodOptional,
  setOp,
} from "../shared/index.js";
import type {
  tsBitCodes,
  tsBitGroups,
  tsBitRouter,
  tsBitRouterSet,
  tsPossibleValuesArray,
  tsRoutingMasks,
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

/**
 * @constant ContractSchema
 * @description Fail-Fast Zod schema for contract validation at runtime.
 */
export const ContractSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    version: z.string().optional(),
    cli: contractCliSchema,
    targets: contractTargetSchema,
    fallbacks: contractTargetSchema.optional().default({}),
    options: z
      .object({
        onlyAllowedValues: z.boolean(),
      })
      .partial()
      .optional(),
  })
  .transform((data, ctx) => {
    const {
      cli,
      targets,
      fallbacks = {},
      options = { onlyAllowedValues: false },
    } = data;

    // Validate that every field in every target exists in the CLI definition
    const positionals = cli.positionals ?? [];
    const paPostionals = positionals.map((v) =>
      FlagNameToObjectName<tsTargetFieldName>(v),
    );
    const flags = cli.flags ?? {};
    const paFlags = Object.keys(flags).map((v) =>
      FlagNameToObjectName<tsTargetFieldName>(v),
    );
    const knownKeys = new Set<tsTargetFieldName>([...paPostionals, ...paFlags]);

    // Generate unique bitmasks for each argument/flag to enable high-performance bitwise routing
    const bitCodes: tsBitCodes = Object.fromEntries(
      Array.from(knownKeys).map((v, idx) => [v, 1n << BigInt(idx)]),
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
    // Signature Slots (Positionnels + all Flags)
    const discriminantKeys = Array.from(knownKeys);

    // Enrich positionals: generate bitmasks, map to object names, and initialize help metadata and discriminants
    positionals.forEach((cliName, idx) => {
      const paName = paPostionals[idx];
      const entry = { long: cliName, bit: bitCodes[paName] };
      cliPos[paName] = entry;
      dataModels[paName] = { ...entry, type: "string" };
      discriminants[paName] = [];
    });

    // Process CLI flags: track interceptors, store metadata, and consolidate into unified data models
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

    Object.entries(targets).forEach(([_targetName, targetFields]) => {
      const targetName = _targetName as tsTargetName;
      const preSchema: Record<string, z.ZodType> = {};
      const helpFields: Record<tsParseArgString, string> = {};
      let targetCode = 0n;
      let targetMask = 0n;

      let optionalBits = 0n;
      let requiredBits = 0n;

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
          const zod = picoTypetoZod(fieldSchema);
          const dModel = cliPos[paFieldName] || cliFlags[paFieldName];
          const desc =
            cliFlags[paFieldName]?.desc ?? zod.meta()?.description ?? fieldName;

          const bit = bitCodes[paFieldName];
          targetCode |= bit;
          if (isZodOptional(zod)) {
            optionalBits |= bit;
          } else {
            requiredBits |= bit;
          }

          // Collect possible literal values for routing metadata
          possibleValues[paFieldName][targetName] = new Set();
          if (hasZodValue(zod)) {
            targetMask |= bit;
            getZodValue(zod).forEach((v) =>
              possibleValues[paFieldName][targetName].add(v),
            );
            if (paPostionals.includes(paFieldName)) {
              discriminants[paFieldName].push(targetName);
            }
          }
          preSchema[paFieldName] = zod;
          helpFields[dModel.long as tsParseArgString] = desc;
        }
      });

      const signaturePermutations = allCombinations(
        ...discriminantKeys.map((key) => getZodValue(preSchema[key])),
      );

      // BIT-PERMUTATION: Register signatures for all possible combinations of present optional fields
      const bitSubsets = (bits: bigint): bigint[] => {
        const result: bigint[] = [0n];
        let temp = bits;
        let currentBit = 1n;
        // Search through bits of the 64-bit space (enough for BigInt bitmask)
        for (let i = 0; i < 64; i++) {
          if (temp & currentBit) {
            const len = result.length;
            for (let j = 0; j < len; j++) {
              result.push(result[j] | currentBit);
            }
          }
          currentBit <<= 1n;
          if (currentBit > temp) break;
        }
        return result;
      };

      const possibleCodes = bitSubsets(optionalBits).map(
        (subset) => subset | requiredBits,
      );

      const routingSignatures: string[] = [];

      possibleCodes.forEach((code) => {
        const shapeKey = String(code);
        if (!masks[shapeKey]) masks[shapeKey] = new Set<bigint>();
        masks[shapeKey].add(targetMask);

        signaturePermutations.forEach((combo) => {
          const sig = forgeRoutingSignature(code, targetMask, combo);
          routingSignatures.push(sig);
          if (!bitRouterSet[sig]) bitRouterSet[sig] = new Set();
          bitRouterSet[sig].add(targetName);
        });
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
        targetMask: targetMask,
        targetSignatures: routingSignatures,
        fields: helpFields,
      };
    });

    Object.entries(fallbacks).forEach(([_targetName, targetFields]) => {
      const targetName = _targetName as tsTargetName;
      const preSchema: Record<string, z.ZodType> = {};
      const helpFields: Record<tsParseArgString, string> = {};
      let targetCode = 0n;
      let targetMask = 0n;

      Object.entries(targetFields).forEach(([fieldName, fieldSchema]) => {
        const paFieldName = fieldName as tsTargetFieldName;
        const zod = picoTypetoZod(fieldSchema);
        const dModel = cliPos[paFieldName] || cliFlags[paFieldName];
        const desc =
          cliFlags[paFieldName]?.desc ?? zod.meta()?.description ?? fieldName;

        preSchema[paFieldName] = zod;
        if (dModel) helpFields[dModel.long as tsParseArgString] = desc;

        targetCode |= bitCodes[paFieldName];
      });

      // Fallbacks use their total bitset as targetCode for the registry
      const routingSignatures: string[] = [];

      // Map all fallbacks to the universal signature for grouping
      if (!bitRouterSet[TARGET_FALLBACK_NAME])
        bitRouterSet[TARGET_FALLBACK_NAME] = new Set();
      bitRouterSet[TARGET_FALLBACK_NAME].add(targetName);

      fullTargets[targetName] = {
        name: targetName,
        zod: z.looseObject(preSchema),
        targetCode: targetCode,
        targetMask: targetMask,
        targetSignatures: routingSignatures,
        fields: helpFields,
      };
    });

    const cliProcessed: tsProcessedCliOUT = {
      positionals: cliPos,
      flags: cliFlags,
    };
    // transform Sets to Arrays
    const _possibleValuesToArray = () =>
      Object.fromEntries(
        (Object.entries(possibleValues) as any).map(([k, targets]: any) => [
          k,
          setOp.recordSetToRecordArray(targets),
        ]),
      ) as unknown as tsPossibleValuesArray;

    const _masksToArray = () => {
      const result = setOp.recordSetToRecordArray(masks);
      const countBits = (n: bigint) => {
        let count = 0;
        let temp = n;
        while (temp > 0n) {
          temp &= temp - 1n;
          count++;
        }
        return count;
      };

      for (const shape in result) {
        // Sort masks by specificity (descending number of set bits)
        // This ensures the most complex targets are resolved first.
        result[shape].sort(
          (a: bigint, b: bigint) => countBits(b) - countBits(a),
        );
      }
      return result as tsRoutingMasks;
    };

    // Project BitRouterSet to tsBitRouter (Record<string, string | string[]>)
    const bitRouter: tsBitRouter = Object.fromEntries(
      Object.entries(bitRouterSet).map(([sig, set]) => {
        const names = Array.from(set);
        return [sig, names.length === 1 ? names[0]! : names];
      }),
    );

    const processed: IProcessedContract = {
      name: data.name,
      description: data.description,
      version: data.version,
      cli: cliProcessed,
      targets: fullTargets,
      routing: {
        groups: bitGroups,
        def: bitCodes,
        router: bitRouter,
        discriminants,
        discriminantKeys,
        possibleValues: _possibleValuesToArray(),
        masks: _masksToArray(),
      },
      dataModels,
      parsingArgs: contractCliToParseArgSchema(cliProcessed),
      parseArgsResultParser: contractCliToParseArgsParser(
        cliProcessed,
        discriminantKeys,
        _possibleValuesToArray(),
        bitRouter,
        _masksToArray(),
        bitCodes,
        options.onlyAllowedValues,
      ),
      parseArgsConfig: contractCliToParseArgs(cliProcessed.flags),
      zvoSchema: {} as tsGate,
      router: bitRouter,
      help: dataModels,
    };

    processed.zvoSchema = new ZvoGate(processed).zvoSchema;
    return processed;
  });

export type tsContractIN = z.input<typeof ContractSchema>;
export type tsContractOUT = z.output<typeof ContractSchema>;
