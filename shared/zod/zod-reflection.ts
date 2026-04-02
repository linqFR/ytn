import { z } from "zod";

/**
 * Zod Schema inspection and unwrapping helpers.
 * Standards:
 * - Follows official Zod.dev public API.
 * - Prioritizes 'instanceof' and '.unwrap()' as recommended by the documentation.
 * - RULE: '_def' (V3) is STRICTLY FORBIDDEN.
 */

export const unwrapZod = (schema: any): any => {
  if (typeof schema?.unwrap === "function") return unwrapZod(schema.unwrap());
  return schema;
};

/** Checks if a schema represents a Zod Object. */
export const isZodObject = (schema: any): boolean => {
  return getZodShape(schema) !== null;
};

/** Checks if a schema is marked as Optional. */
export const isZodOptional = (schema: any): boolean => {
  return schema instanceof z.ZodOptional;
};

/** Checks if a schema has a default value assigned. */
export const isZodDefault = (schema: any): boolean => {
  return schema instanceof z.ZodDefault;
};

/** Checks if a schema eventually resolves to a literal value. */
export const isZodLiteral = (schema: any): boolean => {
  return unwrapZod(schema) instanceof z.ZodLiteral;
};

/** Checks if a schema eventually resolves to an Enum. */
export const isZodEnum = (schema: any): boolean => {
  return unwrapZod(schema) instanceof z.ZodEnum;
};

/**
 * Determines if a schema carries a specific value (Literal or Enum)
 * that contributes to the routing bitmask.
 */
export const hasZodValue = (schema: any): boolean => {
  return isZodLiteral(schema) || isZodEnum(schema);
};

/** Retrieves the underlying values of a literal or enum schema. */
export function getZodValue(schema: any): string[] {
  const unwrapped = unwrapZod(schema);

  if (unwrapped instanceof z.ZodLiteral) {
    // V4 Classic uses .values (Set) or .value (Legacy single)
    // We favor .values as it's the most robust in V4
    return unwrapped.values
      ? Array.from(unwrapped.values).map(String)
      : [String(unwrapped.value)];
  }

  if (unwrapped instanceof z.ZodEnum) {
    // V4 Classic uses .options (Array)
    return unwrapped.options.map(String);
  }

  return [""];
}

/* -------------------------------------------------------------------------- */
/*                                INTROSPECTION                               */
/* -------------------------------------------------------------------------- */

/**
 * Safely retrieves metadata from a Zod schema.
 * Falls back to an empty object if no meta is present.
 */
export const getZodMeta = (schema: any): Record<string, any> => {
  return (typeof schema?.meta === "function" ? schema.meta() : {}) || {};
};

export function getZodShape(schema: z.ZodType): z.core.$ZodShape | null {
  const unwrapped = unwrapZod(schema);
  if (unwrapped instanceof z.ZodObject) {
    return unwrapped.shape as z.core.$ZodShape;
  }
  return null;
}
