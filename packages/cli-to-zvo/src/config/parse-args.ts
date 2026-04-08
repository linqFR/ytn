import {
  kebabToCamel,
  schCamelCase,
  schKebabCase,
  type tsCamelCase,
  type tsKebabCase,
} from "@ytn/shared/zod/zod-strcases.js";
import type { ZodRecord, ZodType } from "zod";

/**
 * @constant {z.ZodSchema} ParseArgFlagNameSchema
 * @description Schema representing a CLI flag name in kebab-case format.
 */
export const ParseArgFlagNameSchema = schKebabCase;

/**
 * @type tsParseArgString
 * @description Type representation of a CLI flag name.
 */
export type tsParseArgString = tsKebabCase;

/**
 * @constant {z.ZodSchema} ParseArgObjectNameSchema
 * @description Schema representing a target object property name in camelCase format.
 */
export const ParseArgObjectNameSchema = schCamelCase;

/**
 * @type tsParseArgObjectName
 * @description Type representation of a target object property name.
 */
export type tsParseArgObjectName = tsCamelCase;

/**
 * @type tsTargetName
 * @description Branded camelCase string representing the unique name of a Target definition.
 */
export type tsTargetName = tsParseArgObjectName & { czvo: { Target: true } };

/**
 * @type tsTargetFieldName
 * @description Branded camelCase string representing a field within a Target definition.
 */
export type tsTargetFieldName = tsParseArgObjectName & {
  czvo: { TargetField: true };
};

/**
 * @function FlagNameToObjectName
 * @description Utility mapping function, alias of {@link kebabToCamel}.
 */
export const FlagNameToObjectName = kebabToCamel;

export type tsParseArgsResult = ReturnType<
  typeof import("node:util").parseArgs
>;

export type tsParseArgsResultParsed = ZodRecord<
  typeof ParseArgObjectNameSchema,
  ZodType
>;
