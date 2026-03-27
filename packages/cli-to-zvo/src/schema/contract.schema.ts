import { z } from "zod";

import {
  contractCliSchema,
  contractTargetSchema
} from "../cli-engine/schemas.js";
import {
  contractCliToParseArgs,
  contractCliToParseArgSchema,
  contractCliToParseArgsParser,
  forgeRoutingSignature,
} from "../cli-engine/tools.js";
import {
  FlagNameToObjectName, tsParseArgObjectName,
  tsParseArgString
} from "../config/parse-args.js";
import { ZvoGate } from "../cli-engine/gate.js";
import { picoTypetoZod } from "../pico-zod/index.js";
import {
  isZodLiteral
} from "../shared/zod-tbx.js";
import {
  tsBitCodes,
  tsBitGroups,
  tsBitRouter,
  tsInterceptor,
} from "../types/bit-router.types.js";
import {
  tsDiscriminantMap, tsGate,
  tsProcessedCliOUT, tsProcessedContract,
  tsProcessedFlag,
  tsProcessedPositional,
  tsProcessedTarget
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
  })
  .transform((data, ctx) => {
    const { cli, targets } = data;

    // Validate that every field in every target exists in the CLI definition
    const positionals = cli.positionals ?? [];
    const paPostionals = positionals.map(FlagNameToObjectName);
    const flags = cli.flags ?? {};
    const paFlags = Object.keys(flags).map(FlagNameToObjectName);
    const knownKeys = new Set<tsParseArgObjectName>([
      ...paPostionals,
      ...paFlags,
    ]);

    const bitCodes: tsBitCodes = Object.fromEntries(
      Array.from(knownKeys).map((v, idx) => [v, 1n << BigInt(idx)]),
    );
    const bitRouter: tsBitRouter = {};
    const bitGroups: tsBitGroups = new Map();
    const interceptors: tsInterceptor = {};

    const cliPos: Record<tsParseArgObjectName, tsProcessedPositional> = {};
    const cliFlags: Record<tsParseArgObjectName, tsProcessedFlag> = {};

    positionals.forEach((cliName, idx) => {
      const paName = paPostionals[idx];
      cliPos[paName] = {
        long: cliName,
        bit: bitCodes[paName],
      };
    });

    Object.entries(cli.flags ?? {}).forEach(([cliName, def]) => {
      const paName = FlagNameToObjectName(cliName);
      if (def.intercept) {
        interceptors[paName] = bitCodes[paName];
      }
      cliFlags[paName] = {
        ...def,
        long: cliName as tsParseArgString,
        bit: bitCodes[paName],
      };
    });

    const fullTargets: Record<tsParseArgObjectName, tsProcessedTarget> = {};

    const discriminants: tsDiscriminantMap = Object.fromEntries(
      paPostionals.map((v) => [v, []]),
    );

    const dataModels = Object.fromEntries(
      Object.entries(cliPos)
        .map(([k, v]) => [k, { ...v, type: "string" }])
        .concat(Object.entries(cliFlags).map(([k, v]) => [k, v])),
    );

    // Signature Slots (Positionnels + Tous les Flags)
    const discriminantKeys = Array.from(knownKeys);

    const possibleValues: Record<tsParseArgObjectName, Set<string>> = {};
    Array.from(knownKeys).forEach((k) => (possibleValues[k] = new Set()));

    Object.entries(targets).forEach(([targetName, targetFields]) => {
      const camelTargetName = targetName as tsParseArgObjectName;
      const preSchema: Record<string, z.ZodType> = {};
      const helpFields: Record<tsParseArgString, string> = {};
      let targetCode = 0n;

      Object.entries(targetFields).forEach(([fieldName, fieldSchema]) => {
        const paFieldName = fieldName as tsParseArgObjectName;
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
          const desc = cliFlags[paFieldName]?.desc ?? zod.meta()?.description ?? fieldName;

          // Collect possible literal values for routing metadata
          if (isZodLiteral(zod)) {
            possibleValues[paFieldName].add(String(zod.value));
          }

          if (!cliFlags[paFieldName]?.intercept) {
            targetCode |= bitCodes[paFieldName];
          }
          preSchema[paFieldName] = zod;
          helpFields[dModel.long as tsParseArgString] = desc;

          if (paPostionals.includes(paFieldName) && isZodLiteral(zod))
            discriminants[paFieldName].push(camelTargetName);
        }
      });

      // Signature de routage centralisée
      const routingSignature = forgeRoutingSignature(
        targetCode,
        discriminantKeys.map((k) =>
          isZodLiteral(preSchema[k]) ? String((preSchema[k] as any).value) : "",
        ),
      );
      bitRouter[routingSignature] = camelTargetName;

      let group = bitGroups.get(targetCode);
      if (!group) {
        group = [];
        bitGroups.set(targetCode, group);
      }
      group.push(camelTargetName);

      fullTargets[camelTargetName] = {
        name: camelTargetName,
        zod: z.object(preSchema),
        bitCode: targetCode,
        bitSignature: routingSignature,
        fields: helpFields,
      };
    });

    const cliProcessed: tsProcessedCliOUT = {
      positionals: cliPos,
      flags: cliFlags,
    };

    const processed: tsProcessedContract = {
      name: data.name,
      description: data.description,
      version: data.version,
      cli: cliProcessed,
      targets: fullTargets,
      routing: {
        groups: bitGroups,
        def: bitCodes,
        router: bitRouter,
        interceptors,
        discriminants,
        discriminantKeys,
        possibleValues: Object.fromEntries(
          Object.entries(possibleValues).map(([k, v]) => [k, Array.from(v)]),
        ),
      },
      dataModels,
      parsingArgs: contractCliToParseArgSchema(cliProcessed),
      parseArgsResultParser: contractCliToParseArgsParser(
        cliProcessed,
        discriminantKeys,
        interceptors,
        Object.fromEntries(
          Object.entries(possibleValues).map(([k, v]) => [k, Array.from(v)]),
        ),
      ),
      parseArgsConfig: contractCliToParseArgs(cli.flags),
      zvoSchema: {} as tsGate,
    };

    processed.zvoSchema = new ZvoGate(processed).zvoSchema;
    return processed;
  });

export type tsContractIN = z.input<typeof ContractSchema>;
export type tsContractOUT = z.output<typeof ContractSchema>;
