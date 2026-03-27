import { z } from "zod";
import { type tsParseArgObjectName } from "../config/parse-args.js";
import { $Entries, $Keys } from "../types/ts-utils.js";


import { 
  type tsProcessedCliOUT, 
  type tsParseArgSchema, 
  type tsParseArgsResultParser,
  type tsParsedCLI
} from "../types/contract.types.js";
import { 
  ParseArgsConfig, 
  ParseArgsOptionsConfig, 
  ParseArgsOptionDescriptor 
} from "node:util";

/**
 * @internal
 * @function strToZod
 * @description Maps CLI type identifiers to pure Zod validation schemas.
 */
const strToZod = (s: "string" | "boolean"): z.ZodType => {
  if (s === "string") return z.string().optional();
  if (s === "boolean") return z.boolean().optional();
  return z.any().optional();
};

/**
 * @function contractCliToParseArgSchema
 * @description Transforms processed CLI metadata into a configuration for node:util.parseArgs.
 * 
 * @param {tsProcessedCliOUT} cli - The processed metadata.
 * @returns {tsParseArgSchema}
 */
export const contractCliToParseArgSchema = (
  cli: tsProcessedCliOUT,
): tsParseArgSchema => {
  const options: Record<string, { type: "string" | "boolean"; short: string }> = {};
  const positionals: string[] = [];

  Object.values(cli.positionals).forEach((p) => positionals.push(p.long));
  Object.values(cli.flags).forEach((f) => {
    options[f.long] = {
      type: f.type,
      short: f.short,
    };
  });

  return { positionals, options };
};

/**
 * @function computeRoutingDiscriminant
 * @description Calculates the stable routing signature for a given set of mapped arguments.
 */
/**
 * @function forgeRoutingSignature
 * @description Internal utility to create a canonical JSON routing signature.
 */
export const forgeRoutingSignature = (
  targetCode: bigint | string,
  values: string[]
): string => {
  return JSON.stringify([
    typeof targetCode === "bigint" ? targetCode.toString(16) : targetCode,
    ...values
  ]);
};

/**
 * @function computeRoutingDiscriminant
 * @description Runtime tagger that calculates the signature for a parsed object.
 */
export const computeRoutingDiscriminant = (
  res: tsParsedCLI,
  cli: tsProcessedCliOUT,
  discriminantKeys: tsParseArgObjectName[] = [],
  interceptors: Record<string, bigint> = {},
  possibleValues: Record<string, string[]> = {},
): string => {
  let dynamicBitset = 0n;
  (Object.keys(res) as $Keys<tsParsedCLI>).forEach((key) => {
    if (key === "discriminant") return;
    const bPrint = cli.positionals[key] || cli.flags[key];
    if (bPrint) {
      dynamicBitset |= bPrint.bit;
    }
  });



  let targetCode = dynamicBitset;
  for (const bit of Object.values(interceptors)) {
    if ((dynamicBitset & bit) === bit) {
      targetCode &= ~bit;
    }
  }

  const values = discriminantKeys.map((k) => {
    const v = res[k];
    const valStr = v !== undefined ? String(v) : "";
    const isPossible = possibleValues[k]?.includes(valStr);
    return isPossible ? valStr : "";
  });

  return forgeRoutingSignature(targetCode, values);
};

/**
 * @function contractCliToParseArgsParser
 * @description Creates a Zod schema to map and validate the output of node:util.parseArgs.
 * 
 * @param {tsProcessedCliOUT} cli - The processed metadata.
 * @returns {tsParseArgsResultParser}
 */
export const contractCliToParseArgsParser = (
  cli: tsProcessedCliOUT,
  discriminantKeys: tsParseArgObjectName[] = [],
  interceptors: Record<string, bigint> = {},
  possibleValues: Record<string, string[]> = {},
): tsParseArgsResultParser => {
  const flagSchemas: Record<string, z.ZodType> = {};
  const flagLookup: Record<string, tsParseArgObjectName> = {};

  for (const [paName, def] of Object.entries(cli.flags) as $Entries<typeof cli.flags>) {
    flagSchemas[def.long] = strToZod(def.type);
    flagLookup[def.long] = paName;
  }


  return z
    .object({
      values: z.looseObject(flagSchemas), 
      positionals: z.string().array(),
    })
    .transform((data, ctx) => {
      const res = {} as tsParsedCLI;

      // 1. Positionals mapping by index
      (Object.entries(cli.positionals) as $Entries<typeof cli.positionals>).forEach(([paName, _], idx) => {
        if (data.positionals[idx] !== undefined) {
             res[paName] = data.positionals[idx];
        }
      });


      // Extra positionals warning
      const posCount = (Object.keys(cli.positionals) as $Keys<typeof cli.positionals>).length;
      const extraPos = data.positionals.slice(posCount);
      if (extraPos.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Extra positionals ignored: ${extraPos.join(", ")}`,
          input: data.positionals,
          params: { rest: extraPos },
          continue: true
        } as any);
      }

      // 2. Flags mapping and Unrecognized reporting
      const unrecognized: string[] = [];
      const dataValues = data.values as Record<string, any>;

      Object.entries(dataValues).forEach(([k, v]) => {
        const paName = flagLookup[k];
        if (paName) {
           res[paName] = v;
        } else {
           unrecognized.push(k);
        }
      });

      if (unrecognized.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Unrecognized flags: ${unrecognized.join(", ")}`,
          input: dataValues,
          params: { keys: unrecognized },
          continue: true
        } as any);
      }

      // 3. Calculation of Routing Discriminant (Logic Visée)
      res.discriminant = computeRoutingDiscriminant(res, cli, discriminantKeys, interceptors, possibleValues);

      return res;
    }) as tsParseArgsResultParser;
};

/**
 * @function contractCliToParseArgs
 * @description Transforms raw contract CLI flag definitions into a `node:util.parseArgs` configuration.
 *
 * @param {tsProcessedCliOUT["flags"]} flags - Mapping of flag names to their CLI definitions.
 * @returns {ParseArgsConfig} A configuration object ready to be used with `parseArgs`.
 */
export const contractCliToParseArgs = (
  flags: tsProcessedCliOUT["flags"] = {},
): ParseArgsConfig => {
  const options = {} as ParseArgsOptionsConfig;
  const config: ParseArgsConfig = {
    allowPositionals: true,
    strict: true,
    options,
  };
  Object.entries(flags).forEach(([flagname, flagdef]) => {
    options[flagname] = {
      type: flagdef.type,
      short: flagdef.short ?? flagname[0].toLowerCase(),
    } as ParseArgsOptionDescriptor;
  });
  return config;
};

/**
 * @interface tsCliEngineTools
 * @description Bundled tools generated from CLI metadata to drive the parsing engine.
 */
export interface tsCliEngineTools {
  /** Configuration object for node:util.parseArgs */
  config: tsParseArgSchema;
  /** Zod parser to validate and map the raw output of the engine */
  parser: tsParseArgsResultParser;
  /** Full native parseArgs config */
  nativeConfig: ParseArgsConfig;
}

/**
 * @function cliEngineFactory
 * @description Consolidates the creation of the native parser configuration 
 * and the result Zod schema into a single source.
 * 
 * @param {tsProcessedCliOUT} cli - The processed CLI metadata from the contract.
 * @returns {tsCliEngineTools} The bundled tools.
 */
export const cliEngineFactory = (
  cli: tsProcessedCliOUT,
  discriminantKeys: tsParseArgObjectName[] = [],
  interceptors: Record<string, bigint> = {},
): tsCliEngineTools => {
  return {
    config: contractCliToParseArgSchema(cli),
    parser: contractCliToParseArgsParser(cli, discriminantKeys, interceptors),
    nativeConfig: contractCliToParseArgs(cli.flags),
  };
};
