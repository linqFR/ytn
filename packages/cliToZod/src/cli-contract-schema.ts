import { z } from "zod";
import { zSnakeCaseKey, zArgName, zStringArray } from "./zod-tbx.js";


const DEFKEY = zSnakeCaseKey;
export const CatalogDefSchema = z.record(DEFKEY, z.instanceof(z.ZodType));

const TARGETKEY = zSnakeCaseKey;
export const TargetObjects = z.record(zSnakeCaseKey, CatalogDefSchema);


export const CliContractSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    def: z.record(
      DEFKEY,
      z.object({
        type: z.string(),
        description: z.string(),
        arg_name: zArgName.default(""),
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
        caseName: z.string(),
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
      (targetDef.positionals || []).forEach((pos, idx) => {
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
          // soit arg.position, soit arg.usages, jamais les deux en même temps, et il en faut au moins un
          const hasPosition = arg.position !== undefined;
          const hasUsages = arg.usages !== undefined;
          return hasPosition !== hasUsages;
        },
        { message: "Argument must have exactly one of 'position' or 'usages'" },
      ),
  ),
});

export type CliContractSchema = z.infer<typeof CliContractSchema>;
export type ArgContractSchema = z.infer<typeof ArgContractSchema>;
export type CatalogDefSchema = z.infer<typeof CatalogDefSchema>;
export type TargetObjects = z.infer<typeof TargetObjects>;
export type SchemaTargetsSchema = z.infer<typeof SchemaTargetsSchema>;
export type XorSchema = z.infer<typeof xorSchema>;
export type UsageSchema = z.infer<typeof UsageSchema>;

export const processedCliContractSchema = z.object({
  args: ArgContractSchema,
  catalog: CatalogDefSchema,
  targets: TargetObjects,
  schemas: SchemaTargetsSchema,
  xor: xorSchema,
  help: UsageSchema,
});
