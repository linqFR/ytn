import { z } from "zod";

/**
 * Zod Schema inspection and unwrapping helpers.
 * Standards:
 * - Primary Truth: Official 'zod.dev' (V4) + Local 'node_modules' types.
 * - Hierarchy: 'node_modules' remains the ultimate technical proof.
 * - Protocol: Authoritative Zod V4 '._zod.def' structure.
 * - Priority: 'instanceof' and '.unwrap()' for base identification.
 * - RULE: '_def' (V3) is STRICTLY FORBIDDEN.
 * - RULE: NO 'belt and suspenders'.
 */

/**
 * @function unwrapZod
 * @description Recursively follows internal Zod V4 pointers to find the root
 * type definition. Atomic and generic unwrapping.
 *
 * @param {any} schema - The Zod schema to unwrap.
 * @returns {z.ZodType} The underlying root Zod schema if exists
 */
export const unwrapZod = (schema: any): z.ZodType => {
  if (!schema) return schema;
  if (typeof schema.unwrap === "function") return unwrapZod(schema.unwrap());

  return schema;
};

/**
 * @function isZodObject
 * @description Checks if a schema represents a Zod Object through V4 inspection.
 *
 * @param {z.ZodType} schema - The schema to test.
 * @returns {boolean} True if the schema is a Zod object.
 */
export const isZodObject = (schema: z.ZodType): boolean => {
  return unwrapZod(schema) instanceof z.ZodObject;
};

/**
 * @function isZodOptional
 * @description Checks if a schema is officially marked as Optional (V4).
 *
 * @param {z.ZodType} schema - The schema to test.
 * @returns {boolean} True if the schema represents an optional value.
 */
export const isZodOptional = (schema: z.ZodType): boolean => {
  return schema instanceof z.ZodOptional;
};

/**
 * @function isZodDefault
 * @description Checks if a schema has a default value assigned.
 *
 * @param {z.ZodType} schema - The schema to test.
 * @returns {boolean} True if the schema has a default value.
 */
export const isZodDefault = (schema: z.ZodType): boolean => {
  return schema instanceof z.ZodDefault;
};

/**
 * @function isZodLiteral
 * @description Path-independent check to see if a schema eventually resolves to a literal value.
 *
 * @param {z.ZodType} schema - The schema to inspect.
 * @returns {boolean} True if it is a Literal schema.
 */
export const isZodLiteral = (schema: z.ZodType): boolean => {
  return unwrapZod(schema) instanceof z.ZodLiteral;
};

/**
 * @function isZodEnum
 * @description Path-independent check to see if a schema eventually resolves to an Enum.
 *
 * @param {z.ZodType} schema - The schema to inspect.
 * @returns {boolean} True if it is an Enum schema.
 */
export const isZodEnum = (schema: z.ZodType): boolean => {
  return unwrapZod(schema) instanceof z.ZodEnum;
};

/**
 * @function hasZodValue
 * @description Determines if a schema carries a specific value (Literal or Enum).
 *
 * @param {z.ZodType} schema - The schema to test.
 * @returns {boolean} True if it is a discriminant.
 */
export const hasZodValue = (schema: z.ZodType): boolean => {
  return isZodLiteral(schema) || isZodEnum(schema);
};

/**
 * @function getZodValue
 * @description Retrieves literal/enum values using the PUBLIC V4 API.
 *
 * @param {z.ZodType} schema - The schema to extract values from.
 * @returns {string[]} An array of string values.
 */
export function getZodValue(schema: z.ZodType): string[] {
  const unwrapped = unwrapZod(schema);
  if (!unwrapped) return [""];

  if (unwrapped instanceof z.ZodLiteral) {
    return Array.from(unwrapped.values).map(String);
  }

  if (unwrapped instanceof z.ZodEnum) {
    return unwrapped.options.map(String);
  }

  return [""];
}

/**
 * @function getZodMeta
 * @description Pure surface-level accessor for schema metadata (compliant with .meta() API).
 *
 * @param {z.ZodType} schema - The schema to inspect.
 * @returns {Record<string, z.ZodType>} Metadata object.
 */
export const getZodMeta = (schema: z.ZodType): Record<string, any> => {
  return (typeof schema?.meta === "function" ? schema.meta() : {}) || {};
};

/**
 * @function getZodShape
 * @description Extracts the shape of a ZodObject using the V4 authoritative protocol.
 *
 * @param {z.ZodType} schema - The object schema to inspect.
 * @returns {z.core.$ZodShape | null} The raw shape or null.
 */
export function getZodShape(schema: z.ZodType): z.core.$ZodShape | null {
  const unwrapped = unwrapZod(schema);
  if (unwrapped instanceof z.ZodObject) {
    return unwrapped.shape;
  }
  return null;
}
