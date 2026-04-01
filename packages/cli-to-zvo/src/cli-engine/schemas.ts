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
export const parseArgOptionContent = z.object({
  short: z.string().min(1).max(1).optional(),
  type: z.enum(["string", "boolean"]).optional().default("string"),
});

/**
 * @internal
 * @constant {z.ZodObject} contractCLiFlagSchema
 * @description Schema for a CLI flag definition, including metadata for help and routing.
 */
export const contractCLiFlagSchema = z.object({
  ...parseArgOptionContent.shape,
  desc: z.string().optional(),
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
  .superRefine((contract, ctx) => {
    // Verify that the CLI block has at least one entry point
    const hasPos = !!contract.positionals?.length;
    const hasFlags = !!(contract.flags && Object.keys(contract.flags).length);

    if (!(hasPos || hasFlags))
      ctx.issues.push({
        code: "custom",
        message:
          "contract.cli must define at least one positional or one flag.",
        path: ["contract", "cli"],
        input: [
          ...(contract?.positionals ?? []),
          ...Object.keys(contract?.flags ?? {}),
        ],
      });

    const posCount = contract.positionals?.length || 0;
    const flagsCount = Object.keys(contract.flags || {}).length;
    if (posCount + flagsCount > 31)
      ctx.issues.push({
        code: "custom",
        message:
          "The 32-bit routing engine supports a maximum of 31 total arguments (flags + positionals)",
        path: ["contract", "cli"],
        input: [
          ...(contract?.positionals ?? []),
          ...Object.keys(contract?.flags ?? {}),
        ],
      });
  });

/**
 * @constant {z.ZodRecord} contractTargetSchema
 * @description Defines the core structure of the targets block.
 * Mapping from target object names to their respective field schemas.
 */
export const contractTargetSchema = z.record(
  ParseArgObjectNameSchema,
  z
    .record(ParseArgObjectNameSchema, picoSchema())
    .refine((fields) => Object.keys(fields).length > 0, {
      message: "A target must have at least one defined field.",
    }),
);

/**
 * @type contractFallbackSchema
 * @description Record of maps for fallback targets.
 * Validated identically to targets but allows empty records for global catch-alls.
 */
export const contractFallbackSchema = z.record(
  ParseArgObjectNameSchema,
  z.record(ParseArgObjectNameSchema, picoSchema()),
);

/**
 * @type tsContractCliIN
 * @description Input type for the CLI configuration block before Zod refinement.
 */
export type tsContractCliIN = z.input<typeof contractCliSchema>;

/**
 * @type tsContractCliOUT
 * @description Output type for the CLI configuration block after Zod validation.
 */
export type tsContractCliOUT = z.output<typeof contractCliSchema>;

/**
 * @type tsContractTargetIN
 * @description Input type for the targets definition block.
 */
export type tsContractTargetIN = z.input<typeof contractTargetSchema>;

/**
 * @type tsContractTargetOUT
 * @description Output type for the targets definition block, mapping target names to their field schemas.
 */
export type tsContractTargetOUT = z.output<typeof contractTargetSchema>;
