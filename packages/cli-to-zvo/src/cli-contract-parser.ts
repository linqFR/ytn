import { z, ZodType } from "zod";
import { repiped } from "./zod-tbx.js";

import { isPureObject } from "@shared/utils.js";

import {
  ArgContractSchema,
  CatalogDefSchema,
  CliContractSchema,
  processedCliContractSchema,
  TargetObjects,
  UsageSchema,
} from "./cli-contract-schema_old.js";

import { CLI_ARG_TYPES, CLI_TYPES } from "./cli-types.js";

/**
 * @constant {Object} NATIVE_GLOBAL_CONTRACT
 * @description Native global definitions and targets injected into every contract.
 */
const NATIVE_GLOBAL_CONTRACT = {
  def: {
    help: {
      type: "boolean",
      description: "Show help information",
      flags: { long: "help", short: "h" },
    },
  },
  targets: {
    Help: {
      description: "Show help information",
      flags: {
        help: { optional: true },
      },
    },
  },
};

/**
 * @constant {z.ZodPipe} processContract
 * @description Transformation logic that converts a raw CliContractSchema into a processedCliContractSchema.
 * This includes resolving type definitions, building help information, and preparing target schemas.
 * @returns {z.ZodPipe} The processed contract as a Zod pipeline result.
 */
export const processContract = CliContractSchema.transform((contract) => {
  const contract_def = {
    ...contract.def,
    ...NATIVE_GLOBAL_CONTRACT.def,
  } as CliContractSchema["def"];
  const contact_targets = {
    ...contract.targets,
    ...NATIVE_GLOBAL_CONTRACT.targets,
  } as CliContractSchema["targets"];

  const options: ArgContractSchema["options"] = {};
  const allPositionals = new Set<string>();
  const catalogDefs: CatalogDefSchema = {};
  const targetObjects: TargetObjects = {};
  const mapperDefs: Record<string, (val: string) => string> = {};
  const argumentRefs: Record<string, any> = {};

  // initialize help object
  const helpObj: UsageSchema = {
    name: contract.name,
    description: contract.description,
    usage_cases: [],
    arguments: [],
  };

  // 1. Build and register all expected value schemas from the combined definitions
  Object.entries(contract_def).forEach(([key, def]) => {
    if (def.flags) {
      options[def.flags.long] = {
        type: CLI_ARG_TYPES[def.type],
        short: def.flags.short,
      };
    }

    const baseSchema = CLI_TYPES[def.type.trim()] as ZodType;

    if (isPureObject(def.map)) {
      const definedMap = def.map;
      mapperDefs[key] = (val) => {
        return definedMap[val.trim()] ?? val.trim();
      };
    }
    catalogDefs[key] = (
      !def.map
        ? baseSchema
        : baseSchema.transform((val: any) => {
            return mapperDefs[key](val as string);
          })
    ).meta({
      description: def.description,
    });

    const argNameStr =
      def.arg_name === "" || def.arg_name === undefined
        ? undefined
        : `<${def.arg_name}>`;
    const valPart = argNameStr ? ` ${argNameStr}` : "";
    let usageList = undefined;
    if (def.flags) {
      usageList = [
        `--${def.flags.long}${valPart}`,
        `-${def.flags.short}${valPart}`,
      ];
    }
    const argObj = {
      arg_name: argNameStr,
      usages: usageList,
      position: undefined,
      type: def.type,
      description: def.description,
    };
    if (argNameStr || def.flags) helpObj.arguments.push(argObj);
    argumentRefs[key] = argObj;
  });

  // 2. Build and register all expected target schemas
  Object.entries(contact_targets).forEach(([targetName, target]) => {
    if (!targetObjects[targetName]) targetObjects[targetName] = {};

    let usageParams: string[] = [];

    // map positionals to their defined names based on the contract
    (target.positionals || []).forEach((p, idx) => {
      allPositionals.add(p);
      targetObjects[targetName][p] = catalogDefs[p];

      // Help JSON: Positionals
      const argName = contract_def[p].arg_name || p;
      usageParams.push(`<${argName}>`);
      if (argumentRefs[p] && argumentRefs[p].position === undefined) {
        argumentRefs[p].position = idx + 1;
      }
    });

    // build and register all expected target flags schemas
    Object.entries(target.flags || {}).forEach(([flagKey, flagDef]) => {
      if (Array.isArray(flagDef)) {
        const newflagDef = [
          ...new Set(
            flagDef.map((val) =>
              mapperDefs[flagKey] ? mapperDefs[flagKey](val) : val,
            ),
          ),
        ];
        switch (newflagDef.length) {
          case 0:
            targetObjects[targetName][flagKey] = repiped(
              catalogDefs[flagKey],
              z.never(),
            );
            break;
          case 1:
            targetObjects[targetName][flagKey] = repiped(
              catalogDefs[flagKey],
              z.literal(newflagDef[0]),
            );
            break;
          default:
            targetObjects[targetName][flagKey] = repiped(
              catalogDefs[flagKey],
              z.enum(newflagDef),
            );
            break;
        }
      } else if (
        isPureObject(flagDef) &&
        "optional" in flagDef &&
        flagDef.optional
      ) {
        targetObjects[targetName][flagKey] = catalogDefs[flagKey].optional();
      } else {
        targetObjects[targetName][flagKey] = catalogDefs[flagKey];
      }

      // Help JSON: Flags Usage Generation
      const flagDefMeta = contract_def[flagKey];
      let flagStr = flagDefMeta.flags
        ? `--${flagDefMeta.flags.long}`
        : `--${flagKey}`;
      if (Array.isArray(flagDef)) {
        // we use the original flagDef values unmapped for the help string
        flagStr += ` <${flagDef.join("|")}>`;
      } else {
        flagStr += flagDefMeta.arg_name ? ` <${flagDefMeta.arg_name}>` : "";
      }

      if (isPureObject(flagDef) && "optional" in flagDef && flagDef.optional) {
        usageParams.push(`[${flagStr}]`);
      } else {
        usageParams.push(flagStr);
      }
    });

    // Help JSON: Push usage case
    helpObj.usage_cases.push({
      command: `${contract.name} ${usageParams.join(" ")}`.trim(),
      description: target.description || "",
    });
  });

  return {
    args: {
      positionals: Array.from(allPositionals),
      options,
    },
    targetObjects: targetObjects,
    help: helpObj,
  } as processedCliContractSchema;
}).pipe(processedCliContractSchema);
