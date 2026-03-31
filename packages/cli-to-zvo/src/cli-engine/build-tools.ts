import type {
  ParseArgsConfig,
  ParseArgsOptionDescriptor,
  ParseArgsOptionsConfig,
} from "node:util";
import { z } from "zod";
import { type tsParseArgString } from "../config/parse-args.js";
import { arrOp } from "../shared/index.js";
import {
  tsPossibleValuesData,
  type tsBitCodes,
  type tsBitRouter,
  type tsPossibleValuesArray,
  type tsRoutingMasks,
} from "../types/bit-router.types.js";
import type {
  tsParseArgSchema,
  tsParseArgsResultParser,
  tsParsedCLI,
  tsProcessedCliOUT,
} from "../types/contract.types.js";
import { type $Entries } from "../types/ts-utils.js";
import { computeRoutingDiscriminant } from "./runtime-tools.js";
import {
  strToZod,
  type tsDiscriminantKeys,
  type tsFlagLookup,
  type tsFlagSchemas,
} from "./shared-tools.js";

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
  const options: Record<string, { type: "string" | "boolean"; short: string }> =
    {};
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

const getAllowedValues = <
  T extends tsPossibleValuesArray = tsPossibleValuesArray,
>(
  paName: keyof T,
  possibleValues: T,
) => {
  const fieldTargets = (possibleValues[paName] || {}) as tsPossibleValuesData;
  const targetValues = Object.values(fieldTargets);
  if (targetValues.some((v) => v.length === 0)) return [];
  return arrOp.unique(targetValues.flat());
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
  discriminantKeys: tsDiscriminantKeys = [],
  possibleValues: tsPossibleValuesArray = {},
  router: tsBitRouter = {},
  masks: tsRoutingMasks = {},
  bitCodes: tsBitCodes = {},
  onlyAllowedValues: boolean = false,
): tsParseArgsResultParser => {
  const flagSchemas: tsFlagSchemas = Object.create(null);
  const flagLookup: tsFlagLookup = Object.create(null);

  for (const [paName, def] of Object.entries(cli.flags) as $Entries<
    typeof cli.flags
  >) {
    flagSchemas[def.long] = strToZod(
      def.type,
      onlyAllowedValues ? getAllowedValues(paName, possibleValues) : [],
    );
    flagLookup[def.long] = paName;
  }

  const positionalEntries = Object.entries(cli.positionals) as $Entries<
    typeof cli.positionals
  >;

  const posSchemas = positionalEntries.map(([paName, _]) =>
    strToZod(
      "string",
      onlyAllowedValues ? getAllowedValues(paName, possibleValues) : [],
    ).optional(),
  ) as z.ZodType[];

  const posCount = positionalEntries.length;

  return z
    .object({
      values: z.object(flagSchemas),
      positionals:
        posSchemas.length > 0
          ? z.tuple(posSchemas as [z.ZodType, ...z.ZodType[]])
          : z.string().array(),
    })
    .transform((data, ctx) => {
      const res = Object.create(null) as tsParsedCLI;

      // 1. Positionals mapping by index
      positionalEntries.forEach(([paName, _], idx) => {
        if (data.positionals[idx] !== undefined) {
          res[paName] = data.positionals[idx];
        }
      });

      // Extra positionals warning
      const extraPos = data.positionals.slice(posCount);
      if (extraPos.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Extra positionals ignored: ${extraPos.join(", ")}`,
          input: data.positionals,
          params: { rest: extraPos },
          path: ["positionals"],
          continue: true,
        } as any);
      }

      // 2. Flags mapping and Unrecognized reporting
      const unrecognized: string[] = [];
      const dataValues = data.values;

      for (const k in dataValues) {
        const paName = flagLookup[k as tsParseArgString];
        if (paName) {
          res[paName] = dataValues[k as tsParseArgString] as any;
        } else {
          unrecognized.push(k);
        }
      }

      if (unrecognized.length > 0) {
        ctx.issues.push({
          code: "custom",
          message: `Unrecognized flags: ${unrecognized.join(", ")}`,
          input: dataValues,
          params: { keys: unrecognized },
          path: ["values"],
          continue: true,
        } as any);
      }

      // 3. Calculation of Routing Discriminant (Target Logic)
      res.discriminant = computeRoutingDiscriminant(
        res,
        cli,
        discriminantKeys as any,
        router,
        masks,
        bitCodes,
      );

      return res;
    }) as tsParseArgsResultParser;
};

/**
 * @function contractCliToParseArgs
 * @description Transforms raw contract CLI flag definitions into a `node:util.parseArgs` configuration.
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
  Object.values(flags).forEach((flagdef) => {
    options[flagdef.long] = {
      type: flagdef.type,
      short: flagdef.short,
    } as ParseArgsOptionDescriptor;
  });
  return config;
};

/**
 * @interface tsCliEngineTools
 * @description Bundled tools generated from CLI metadata to drive the parsing engine.
 */
export interface tsCliEngineTools {
  config: tsParseArgSchema;
  parser: tsParseArgsResultParser;
  nativeConfig: ParseArgsConfig;
}

/**
 * @function cliEngineFactory
 * @description Consolidates the creation of the native parser configuration
 * and the result Zod schema into a single source.
 */
export const cliEngineFactory = (
  cli: tsProcessedCliOUT,
  discriminantKeys: tsDiscriminantKeys = [],
  possibleValues: tsPossibleValuesArray = {},
  router: tsBitRouter = {},
  masks: tsRoutingMasks = {},
  bitCodes: tsBitCodes = {},
): tsCliEngineTools => {
  return {
    config: contractCliToParseArgSchema(cli),
    parser: contractCliToParseArgsParser(
      cli,
      discriminantKeys,
      possibleValues,
      router,
      masks,
      bitCodes,
    ),
    nativeConfig: contractCliToParseArgs(cli.flags),
  };
};
