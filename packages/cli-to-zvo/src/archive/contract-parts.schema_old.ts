import {
  ParseArgsConfig,
  ParseArgsOptionDescriptor,
  ParseArgsOptionsConfig,
} from "node:util";
import { z } from "zod";
import {
  ParseArgFlagNameSchema,
  ParseArgObjectNameSchema,
} from "../config/parse-args.js";
import { picoSchema } from "../pico-zod/index.js";

/**
 * @internal
 * @constant {z.ZodObject} parseArgOptionContent
 * @description Defines the core structure of a CLI option content.
 */
const parseArgOptionContent = z.object({
  short: z.string().min(1).max(1),
  type: z.enum(["string", "boolean"]).optional().default("string"),
});

/**
 * @internal
 * @constant {z.ZodObject} contractCLiFlagSchema
 * @description Schema for a CLI flag definition, including metadata for help and routing.
 */
const contractCLiFlagSchema = z.object({
  ...parseArgOptionContent.shape,
  desc: z.string().optional(),
  intercept: z.boolean().optional(),
});



/**
 * @constant {z.ZodObject} contractCliSchema
 * @description Internal schema used for mapping parsed arguments to their target definitions.
 * Strictly compatible with node:util.parseArgs options.
 */
export const contractCliSchema = z
  .object({
    positionals: z.array(ParseArgFlagNameSchema).optional(),
    flags: z.record(ParseArgFlagNameSchema, contractCLiFlagSchema).optional(),
  })
  .refine(
    (cli) => {
      // Verify that the CLI block has at least one entry point
      const hasPos = !!cli.positionals?.length;
      const hasFlags = !!(cli.flags && Object.keys(cli.flags).length);

      return hasPos || hasFlags;
    },
    { error: "contract.cli must define at least one positional or one flag." },
  );

/**
 * @type tsContractCliIN
 * @description Raw input for defining Contract CLI configuration (keys as plain strings).
 */
export type tsContractCliIN = z.input<typeof contractCliSchema>;

/**
 * @type tsContractCliOUT
 * @description Processed Contract CLI configuration with branded branded-case keys.
 */
export type tsContractCliOUT = z.output<typeof contractCliSchema>;

// Types Moved to src/types/contract.types.ts

/**
 * @constant {z.ZodRecord} contractTargetSchema
 * @description Defines the core structure of the targets block.
 * Mapping from target object names to their respective field schemas.
 */
export const contractTargetSchema = z.record(
  ParseArgObjectNameSchema,
  z.record(ParseArgObjectNameSchema, picoSchema()),
);

/**
 * @type tsContractTargetIN
 * @description Raw input for defining Contract's target objects and fields (keys as plain strings).
 */
export type tsContractTargetIN = z.input<typeof contractTargetSchema>;

/**
 * @type tsContractTargetOUT
 * @description Processed Contract's targets definition with branded branded-case keys.
 */
export type tsContractTargetOUT = z.output<typeof contractTargetSchema>;

import {
  contractCliToParseArgSchema,
  contractCliToParseArgsParser
} from "../core/cli-engine-factory.js";

export {
  contractCliToParseArgSchema,
  contractCliToParseArgsParser
};

/**
 * @function contractCliToParseArgs
 * @description Transforms raw contract CLI flag definitions into a `node:util.parseArgs` configuration.
 *
 * @param {tsContractCliOUT["flags"]} flags - Mapping of flag names to their CLI definitions.
 * @returns {ParseArgsConfig} A configuration object ready to be used with `parseArgs`.
 */
export const contractCliToParseArgs = (
  flags: tsContractCliOUT["flags"] = {},
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

// /**
//  * @constant {z.ZodObject} UsageSchema
//  * @description Schema representing the structured help and usage information.
//  */
// export const UsageSchema = z.object({
//   name: z.string(),
//   description: z.string(),
//   usage_cases: z.array(
//     z.object({
//       command: z.string(),
//       description: z.string(),
//     }),
//   ),
//   arguments: z.array(
//     z
//       .object({
//         arg_name: z.string().optional(),
//         usages: StringArraySchema.optional(),
//         position: z.number().optional(),
//         type: z.string(),
//         description: z.string(),
//       })
//       .refine((arg) => arg.position !== undefined || arg.usages !== undefined, {
//         message: "Argument must have at least one of 'position' or 'usages'",
//       }),
//   ),
// });

// /** @description Represents the structured help/usage information. */
// export type UsageSchema = z.infer<typeof UsageSchema>;

// /** @description Schema for catalog definitions mapping keys to Zod types. */
// export const CatalogDefSchema = z
//   .record(
//     SnakeCaseSchema,
//     z.custom<z.ZodType<unknown, any>>((v) => v instanceof z.ZodType),
//   )
//   .brand<"tsCatalogDef">();

// export type tsCatalogDef = z.infer<typeof CatalogDefSchema>;

// /** @description Schema for target objects mapping keys to a catalog of Zod types. */
// export const TargetObjectsSchema = z
//   .record(
//     CamelCaseSchema,
//     z.object({
//       name: CamelCaseSchema,
//       zod: z.custom<z.ZodObject<any, any>>((v) => v instanceof z.ZodObject),
//       bitCode: z.bigint(),
//       bitSignature: z.string(),
//       fields: z.record(z.string(), z.string()),
//     }),
//   )
//   .brand<"tsTargetObjects">();
// export type tsTargetObjects = z.infer<typeof TargetObjectsSchema>;

// /** @description Schema for a single data model field in help metadata. */
// export const DataModelSchema = z.object({
//   long: z.string(),
//   short: z.string().optional(),
//   type: z.string(),
//   desc: z.string().optional(),
// });
// export type tsDataModel = z.infer<typeof DataModelSchema>;

// /**
//  * @constant {z.ZodObject} processedCliContractSchema
//  * @description Final schema for the fully processed contract.
//  */
// export const processedCliContractSchema = z.object({
//   name: z.string(),
//   description: z.string(),
//   version: z.string().optional(),
//   cli: z.object({
//     positionals: z.record(
//       CamelCaseSchema,
//       z.object({
//         long: KebabCaseSchema,
//         bit: z.bigint(),
//       }),
//     ),
//     flags: z.record(
//       CamelCaseSchema,
//       z.object({
//         long: KebabCaseSchema,
//         short: z.string(),
//         desc: z.string().optional(),
//         type: z.enum(["string", "boolean"]),
//         intercept: z.boolean().optional(),
//         bit: z.bigint(),
//       }),
//     ),
//   }),
//   targets: TargetObjectsSchema,
//   routing: z.object({
//     groups: z.custom<Map<bigint, string[]>>((v) => v instanceof Map),
//     def: z.record(CamelCaseSchema, z.bigint()),
//     router: z.record(z.string(), z.string()),
//     interceptors: z.record(CamelCaseSchema, z.bigint()),
//     discriminants: z.record(CamelCaseSchema, z.array(CamelCaseSchema)),
//   }),
//   dataModels: z.record(CamelCaseSchema, z.any()),
//   parseArgs: z.any(), // Add parseArgs
// });

// export type tsProcessedCliContract = z.infer<typeof processedCliContractSchema>;

// export type tsProcessedCliPositionals =
//   tsProcessedCliContract["cli"]["positionals"];
// export type tsProcessedCliFlags = tsProcessedCliContract["cli"]["flags"];
// export type tsProcessedTargets = tsProcessedCliContract["targets"];
// export type tsProcessedRouting = tsProcessedCliContract["routing"];

/** @description The final XOR union schema (ZodXor). */
// export type tsGate = z.ZodType | z.ZodXor<readonly z.ZodType[]>;
