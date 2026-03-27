import { parseArgs } from "node:util";
import { z } from "zod";
import {
  CamelCaseSchema,
  KebabCaseSchema,
  kebabToCamel,
  tsCamelCase,
  tsKebabCase,
} from "../shared/zod-tbx.js";

/**
 * @constant {z.ZodSchema} ParseArgFlagNameSchema
 * @description Schema representing a CLI flag name in kebab-case format.
 */
export const ParseArgFlagNameSchema = KebabCaseSchema;

/**
 * @type tsParseArgString
 * @description Type representation of a CLI flag name.
 */
export type tsParseArgString = tsKebabCase;

/**
 * @constant {z.ZodSchema} ParseArgObjectNameSchema
 * @description Schema representing a target object property name in camelCase format.
 */
export const ParseArgObjectNameSchema = CamelCaseSchema;

/**
 * @type tsParseArgObjectName
 * @description Type representation of a target object property name.
 */
export type tsParseArgObjectName = tsCamelCase;

/**
 * @function FlagNameToObjectName
 * @description Utility mapping function, alias of {@link kebabToCamel}.
 */
export const FlagNameToObjectName = kebabToCamel;

parseArgs;

export type tsParseArgsResult = ReturnType<typeof parseArgs>;

export type tsParseArgsResultParsed = z.ZodRecord<
  typeof ParseArgObjectNameSchema,
  z.ZodType 
>;
