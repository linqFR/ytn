import { z } from "zod";
import { zSnakeCaseKey, zArgName, zStringArray } from "./zod-tbx.js";

/** @constant {z.ZodString} DEFKEY - Validation schema for snake_case definition keys. */
const DEFKEY = zSnakeCaseKey;
/**
 * @constant {z.ZodRecord} CatalogDefSchema
 * @description Schema for catalog definitions mapping snake_case keys to Zod types.
 */
export const CatalogDefSchema = z.record(DEFKEY, z.instanceof(z.ZodType));

/** @constant {z.ZodString} TARGETKEY - Validation schema for snake_case target keys. */
const TARGETKEY = zSnakeCaseKey;
/**
 * @constant {z.ZodRecord} TargetObjects
 * @description Schema for target objects mapping snake_case keys to CatalogDefSchema.
 */
export const TargetObjects = z.record(zSnakeCaseKey, CatalogDefSchema);

/**
 * @constant {z.ZodObject} CliContractSchema
 * @description Main schema for the CLI Contract, defining metadata, global definitions, and target subcommands.
 */
export const CliContractSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    def: z.record(
      DEFKEY,
      z.object({
        type: z.string(),
        description: z.string(),
        arg_name: zArgName.optional().default(""),
        flags: z
          .object({
            long: z.string(),
            short: z.string(),
          })
          .optional(),
        map: z.record(z.string(), z.string()).optional(),
      }),
    ),

    targets: z.record(
      TARGETKEY,
      z.object({
        description: z.string(),
        positionals: zStringArray.optional(),
        flags: z
          .record(
            z.string(),
            z.xor([
              z.array(z.string()), //enum
              z.object({
                optional: z.boolean(),
              }),
              z.string(), //default
              z.number(), //default
              z.boolean(), //default
              z.null(), //default
              z.undefined(), //empty
            ]),
          )
          .optional(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const defKeys = Object.keys(data.def);
    Object.entries(data.targets).forEach(([targetName, targetDef]) => {
      ((targetDef.positionals as any) || [])
        .flat(Infinity)
        .forEach((pos: string, idx: number) => {
          if (!defKeys.includes(pos)) {
            ctx.issues.push({
              code: "custom",
              message: `Positional reference '${pos}' is not defined in 'def'`,
              path: ["targets", targetName, "positionals", idx],
              input: pos,
            });
          }
        });

      Object.keys(targetDef.flags || {}).forEach((flagKey) => {
        if (!defKeys.includes(flagKey)) {
          ctx.issues.push({
            code: "custom",
            message: `Flag reference '${flagKey}' is not defined in 'def'`,
            path: ["targets", targetName, "flags", flagKey],
            input: flagKey,
          });
        }
      });
    });
  });

/**
 * @constant {z.ZodObject} ArgContractSchema
 * @description Internal schema used for mapping parsed arguments to their target definitions.
 */
const ArgContractSchema = z.object({
  positionals: zStringArray,
  options: z.record(
    zSnakeCaseKey, // flag long
    z.object({
      type: z.string(), //type,
      short: z.string(), // flag short
    }),
  ),
});

const SchemaTargetsSchema = z.record(zSnakeCaseKey, z.instanceof(z.ZodType));
const xorSchema = z.instanceof(z.ZodType);

/**
 * @constant {z.ZodObject} UsageSchema
 * @description Schema representing the structured help and usage information for output.
 */
const UsageSchema = z.object({
  name: z.string(),
  description: z.string(),
  usage_cases: z.array(
    z.object({
      // case: z.string(),
      command: z.string(),
      description: z.string(),
    }),
  ),
  arguments: z.array(
    z
      .object({
        //   name: z.string(),
        arg_name: z.string().optional(),
        usages: zStringArray.optional(), // eg ['--result <result>', '-r <result>']
        position: z.number().optional(),
        type: z.string(),
        description: z.string(),
      })
      .refine(
        (arg) => {
          // either arg.position or arg.usages, never both, and at least one is required
          const hasPosition = arg.position !== undefined;
          const hasUsages = arg.usages !== undefined;
          return hasPosition || hasUsages;
        },
        { message: "Argument must have at least one of 'position' or 'usages'" },
      ),
  ),
});

/** Represents a CLI contract definition. */
export type CliContractSchema = z.input<typeof CliContractSchema>;
/** Represents the internal structure for argument parsing. */
export type ArgContractSchema = z.infer<typeof ArgContractSchema>;
/** Represents a collection of type definitions. */
export type CatalogDefSchema = z.infer<typeof CatalogDefSchema>;
/** Represents a mapping of targets to their definitions. */
export type TargetObjects = z.infer<typeof TargetObjects>;
/** Represents a mapping of target names to Zod schemas (ZodTypeAny). */
export type SchemaTargetsSchema = z.infer<typeof SchemaTargetsSchema>;
/** Represents the final XOR union schema (ZodXor). */
export type XorSchema = z.infer<typeof xorSchema>;
/** Represents the structured help/usage information. */
export type UsageSchema = z.infer<typeof UsageSchema>;

/**
 * @constant {z.ZodObject} processedCliContractSchema
 * @description Final schema for the fully processed contract, ready for use by the parser and UI.
 */
export const processedCliContractSchema = z.object({
  args: ArgContractSchema,
  // catalog: CatalogDefSchema,
  targetObjects: TargetObjects,
  // targetsWithMarker: SchemaTargetsSchema,
  // xor: xorSchema,
  help: UsageSchema,
});

/** Represents the output of a processed CLI contract. */
export type processedCliContractSchema = z.infer<
  typeof processedCliContractSchema
>;
