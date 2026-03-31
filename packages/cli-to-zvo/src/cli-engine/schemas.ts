import { z } from "zod";
import {
  ParseArgFlagNameSchema,
  ParseArgObjectNameSchema,
} from "../config/parse-args.js";
import { picoSchema } from "../pico-zod/index.js";
import { TARGET_FALLBACK_NAME } from "../config/zod-config.js";

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
 * @constant {z.ZodRecord} contractTargetSchema
 * @description Defines the core structure of the targets block.
 * Mapping from target object names to their respective field schemas.
 */
export const contractTargetSchema = z.record(
  ParseArgObjectNameSchema,
  z.record(ParseArgObjectNameSchema, picoSchema()),
);

/**
 * @type tsContractCliIN
 */
export type tsContractCliIN = z.input<typeof contractCliSchema>;
/**
 * @type tsContractCliOUT
 */
export type tsContractCliOUT = z.output<typeof contractCliSchema>;
/**
 * @type tsContractTargetIN
 */
export type tsContractTargetIN = z.input<typeof contractTargetSchema>;
/**
 * @type tsContractTargetOUT
 */
export type tsContractTargetOUT = z.output<typeof contractTargetSchema>;
