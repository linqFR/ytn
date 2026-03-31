import { parseArgs } from "node:util";
import { z } from "zod";
import {
  CamelCaseSchema,
  KebabCaseSchema,
  kebabToCamel,
  types,
} from "../shared/index.js";

/**
 * @constant {z.ZodSchema} ParseArgFlagNameSchema
 * @description Schema representing a CLI flag name in kebab-case format.
 */
export const ParseArgFlagNameSchema = KebabCaseSchema;

/**
 * @type tsParseArgString
 * @description Type representation of a CLI flag name.
 */
export type tsParseArgString = types.tsKebabCase;

/**
 * @constant {z.ZodSchema} ParseArgObjectNameSchema
 * @description Schema representing a target object property name in camelCase format.
 */
export const ParseArgObjectNameSchema = CamelCaseSchema;

/**
 * @type tsParseArgObjectName
 * @description Type representation of a target object property name.
 */
export type tsParseArgObjectName = types.tsCamelCase;

export type tsTargetName = tsParseArgObjectName & { czvo: { Target: true } };
export type tsTargetFieldName = tsParseArgObjectName & {
  czvo: { TargetField: true };
};

/**
 * @function FlagNameToObjectName
 * @description Utility mapping function, alias of {@link kebabToCamel}.
 */
export const FlagNameToObjectName = kebabToCamel;

export type tsParseArgsResult = ReturnType<typeof parseArgs>;

export type tsParseArgsResultParsed = z.ZodRecord<
  typeof ParseArgObjectNameSchema,
  z.ZodType
>;
