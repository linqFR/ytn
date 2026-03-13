import { z, ZodType } from "zod";
import { repiped } from "./zod-tbx.js";

import { xorGate as ZodRouter } from "./xor-gate.js";
import { isPureObject } from "./utils.js";
import {
  CliContractSchema,
  processedCliContractSchema,
  ArgContractSchema,
  CatalogDefSchema,
  SchemaTargetsSchema,
  UsageSchema,
  XorSchema,
  TargetObjects,
} from "./cli-contract-schema.js";
import { CLI_TYPES } from "./cli-types.js";



export const processContract = CliContractSchema.transform((contract) => {
  const options: ArgContractSchema["options"] = {};
  const allPositionals = new Set<string>();
  const catalogDefs: CatalogDefSchema = {};
  // const undefinedDefs: Record<string, z.ZodType> = {};
  const targetObjects: TargetObjects = {};
  const mapperDefs: Record<string, (val: string) => string> = {};
  const argumentRefs: Record<string, any> = {};

  const helpObj: UsageSchema = {
    name: contract.name,
    description: contract.description,
    usage_cases: [],
    arguments: [],
  };

  Object.entries(contract.def).forEach(([key, def]) => {
    if (def.flags) {
      options[def.flags.long] = {
        type: def.type.includes("json") ? "string" : def.type,
        short: def.flags.short,
      };
    }

    const baseSchema = def.type.includes("|")
      ? (CLI_TYPES["|"](def.type) as ZodType)
      : (CLI_TYPES[def.type.trim()] as ZodType);

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
      // arg_name: def.arg_name,
    });

    const argNameStr = def.arg_name === "" ? undefined : `<${def.arg_name}>`;
    let usageList = undefined;
    if (def.flags) {
      usageList = [
        `--${def.flags.long} ${argNameStr}`,
        `-${def.flags.short} ${argNameStr}`,
      ];
    }
    const argObj = {
      arg_name: argNameStr,
      usages: usageList,
      position: undefined,
      type: def.type,
      description: def.description,
    };
    if (def.arg_name != "") helpObj.arguments.push(argObj);
    argumentRefs[key] = argObj;
    // undefinedDefs[key] = z.undefined();
  });

  Object.entries(contract.targets).forEach(([targetName, target]) => {
    if (!targetObjects[targetName]) targetObjects[targetName] = {};

    let usageParams: string[] = [];

    (target.positionals || []).forEach((p:string, idx) => {
      allPositionals.add(p);
      targetObjects[targetName][p] = catalogDefs[p];

      // Help JSON: Positionals
      const argName = contract.def[p].arg_name || p;
      usageParams.push(`<${argName}>`);
      if (argumentRefs[p].position === undefined) {
        argumentRefs[p].position = idx + 1;
      }
    });
    targetObjects[targetName] = {
      ...targetObjects[targetName],
    };

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

      // Help JSON: Flags
      const flagDefMeta = contract.def[flagKey];
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
      // case: target.caseName || targetName,
      command: `${contract.name} ${usageParams.join(" ")}`.trim(),
      description: target.description || "",
    });
  });

  const router = new ZodRouter(targetObjects);
  const targetSchemas = router.schemaDict;
  const xorSchema = router.xorSchema;

  return {
    args: {
      positionals: Array.from(allPositionals),
      options,
    },
    catalog: catalogDefs,
    targets: targetObjects,
    schemas: targetSchemas,
    xor: xorSchema,
    help: helpObj,
  } as {
    args: ArgContractSchema;
    catalog: CatalogDefSchema;
    targets: TargetObjects;
    schemas: SchemaTargetsSchema;
    xor: XorSchema;
    help: UsageSchema;
  };
})

.pipe(processedCliContractSchema);
