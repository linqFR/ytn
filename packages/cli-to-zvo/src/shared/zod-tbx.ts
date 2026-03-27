import { z } from "zod";

/**
 * Zod v4 Parameter Types
 */
/** @type {ZodTupleItems} Parameter types for Zod tuple items. */
export type ZodTupleItems = Parameters<typeof z.tuple>[0];
/** @type {ZodUnionOptions} Parameter types for Zod union options. */
export type ZodUnionOptions = Parameters<typeof z.union>[0];
/** @type {ZodMetadata} Metadata structure for Zod schemas. */
export type ZodMetadata = Parameters<z.ZodType["meta"]>[0];

export const SnakeCaseSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)")
  .brand<"tsSnakeCase">();

/**
 * @type tsSnakeCase
 * @description Branded string type for validated snake_case keys.
 */
export type tsSnakeCase = z.infer<typeof SnakeCaseSchema>;

export const KebabCaseSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Must be kebab-case (lowercase and hyphens)",
  )
  .brand<"tsKebabCase">();

/**
 * @type tsKebabCase
 * @description Branded string type for validated kebab-case keys.
 */
export type tsKebabCase = z.infer<typeof KebabCaseSchema>;

export const CamelCaseSchema = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    "Must be camelCase (starts with lowercase, alphanumeric only)",
  )
  .brand<"tsCamelCase">();

/**
 * @type tsCamelCase
 * @description Branded string type for validated camelCase keys.
 */
export type tsCamelCase = z.infer<typeof CamelCaseSchema>;

/**
 * @function kebabToCamel
 * @description Transforms a kebab-case string to camelCase.
 * @param {string} str - The kebab-case string to transform.
 * @returns {tsCamelCase} The transformed camelCase string.
 */
export const kebabToCamel = (str: string): tsCamelCase => {
  return str.replace(/-([a-z0-9])/g, (_, char) =>
    char.toUpperCase(),
  ) as tsCamelCase;
};

/** @constant {z.ZodArray} StringArraySchema - Simple string array schema. */
export const StringArraySchema = z.string().array();

/** @type tsStringArray - Array of strings (type-only alias for clarity). */
export type tsStringArray = string[];

/**
 * @function repiped
 * @description Re-pipes a schema into a new one while preserved existing metadata.
 * @param {z.ZodType} oldSchema - The schema to copy metadata from.
 * @param {z.ZodType} targetSchema - The new schema to pipe into.
 * @returns {z.ZodPipe} A new Zod pipe with combined logic and preserved metadata.
 */
export const repiped = (oldSchema: z.ZodType, targetSchema: z.ZodType) => {
  return oldSchema.pipe(targetSchema.meta(oldSchema.meta() as ZodMetadata));
};

/**
 * @function isZodObject
 * @description Robustly checks if an instance is a Zod object in v4.
 */
export function isZodObject(schema: any): schema is z.ZodObject<any> {
  return schema instanceof z.ZodObject;
}

/**
 * @function isZodLiteral
 * @description Robustly checks if an instance is a Zod literal in v4.
 */
export function isZodLiteral(schema: any): schema is z.ZodLiteral {
  return schema instanceof z.ZodLiteral;
}
