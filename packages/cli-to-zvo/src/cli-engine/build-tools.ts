import type {
  ParseArgsConfig,
  ParseArgsOptionDescriptor,
  ParseArgsOptionsConfig,
} from "node:util";
import { z } from "zod";
import { tsTargetName, type tsParseArgString } from "../config/parse-args.js";
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
import type { tsDecisionNode } from "../types/tree.types.js";
import type { tsProcessedTarget } from "../types/contract.types.js";
import {
  strToZod,
  type tsDiscriminantKeys,
  type tsFlagLookup,
  type tsFlagSchemas,
} from "./shared-tools.js";

/**
 * @function contractCliToParseArgSchema
 * @description Transforms the processed CLI metadata into the specific schema
 * required by the `node:util.parseArgs` configuration.
 *
 * @param {tsProcessedCliOUT} cli - The processed interface metadata.
 * @returns {tsParseArgSchema} The mapping of positionals and options for the parser.
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

/**
 * @internal
 * @function getAllowedValues
 * @description Extracts the unique set of allowed literal values for a given field
 * across all targets. This is used when `onlyAllowedValues` is enabled to
 * restrict the parser at the entry level.
 *
 * @param {keyof tsPossibleValuesArray} paName - The name of the field to check.
 * @param {tsPossibleValuesArray} possibleValues - The map of all possible values.
 * @returns {string[]} The list of unique literal values.
 */
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
 * @description Creates the primary Zod transformation schema that bridge the gap
 * between `node:util.parseArgs` output and the internal domain-mapped `tsParsedCLI`.
 *
 * This schema handles:
 * 1. Mapping indexed positionals back to named target fields.
 * 2. Mapping kebab-case flags back to camelCase target fields.
 * 3. Reporting unrecognized flags as Zod issues.
 * 4. Calculating the routing discriminant at runtime via the decision tree.
 *
 * @param {tsProcessedCliOUT} cli - The processed CLI metadata.
 * @param {tsDiscriminantKeys} [discriminantKeys=[]] - Keys used for literal routing.
 * @param {tsPossibleValuesArray} [possibleValues={}] - Cached values for enum validation.
 * @param {tsDecisionNode | tsTargetName[]} [tree=[]] - The pre-compiled routing tree.
 * @param {Record<tsTargetName, tsProcessedTarget>} [targets={}] - Detailed target metadata.
 * @param {tsBitCodes} [bitCodes={}] - Unique bits for every CLI argument.
 * @param {boolean} [onlyAllowedValues=false] - If true, restricts inputs to known target literals.
 * @returns {tsParseArgsResultParser} The Zod schema for the parsing stage.
 */
export const contractCliToParseArgsParser = (
  cli: tsProcessedCliOUT,
  discriminantKeys: tsDiscriminantKeys = [],
  possibleValues: tsPossibleValuesArray = {},
  tree: tsDecisionNode | tsTargetName[] = [],
  targets: Record<tsTargetName, tsProcessedTarget> = {},
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
      res.discriminant = computeRoutingDiscriminant(res, {
        routing: {
          def: bitCodes,
          tree,
          discriminantKeys,
        },
        targets,
      } as any);

      return res;
    }) as tsParseArgsResultParser;
};

/**
 * @function contractCliToParseArgs
 * @description Generates the native `ParseArgsConfig` for Node's `util.parseArgs`.
 * This effectively "configures" the underlying hardware-level parser.
 *
 * @param {tsProcessedCliOUT["flags"]} [flags={}] - The processed flag definitions.
 * @returns {ParseArgsConfig} Configuration object for `parseArgs`.
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
 * @description Bundled configuration and logic required to initialize the CLI engine.
 */
export interface tsCliEngineTools {
  /** High-level schema representing the CLI structure. */
  config: tsParseArgSchema;
  /** The Zod transformation schema to run after parsing. */
  parser: tsParseArgsResultParser;
  /** The native Node.js configuration for parseArgs. */
  nativeConfig: ParseArgsConfig;
}

/**
 * @function cliEngineFactory
 * @description The main factory for generating all runtime tools needed to drive
 * the CLI-to-Zod parsing engine.
 *
 * @param {tsProcessedCliOUT} cli - The processed interface definition.
 * @param {tsDiscriminantKeys} [discriminantKeys] - Keys for literal routing.
 * @param {tsPossibleValuesArray} [possibleValues] - Pre-calculated valid values.
 * @param {tsDecisionNode | tsTargetName[]} [tree] - The routing decision tree.
 * @param {Record<tsTargetName, tsProcessedTarget>} [targets] - Metadata for all targets.
 * @param {tsBitCodes} [bitCodes] - Bitfield mapping for routing.
 * @returns {tsCliEngineTools} Complete set of engine configurations and parsers.
 */
export const cliEngineFactory = (
  cli: tsProcessedCliOUT,
  discriminantKeys: tsDiscriminantKeys = [],
  possibleValues: tsPossibleValuesArray = {},
  tree: tsDecisionNode | tsTargetName[] = [],
  targets: Record<tsTargetName, tsProcessedTarget> = {},
  bitCodes: tsBitCodes = {},
): tsCliEngineTools => {
  return {
    config: contractCliToParseArgSchema(cli),
    parser: contractCliToParseArgsParser(
      cli,
      discriminantKeys,
      possibleValues,
      tree,
      targets,
      bitCodes,
    ),
    nativeConfig: contractCliToParseArgs(cli.flags),
  };
};
