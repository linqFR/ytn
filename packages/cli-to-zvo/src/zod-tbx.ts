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

/**
 * @constant {z.ZodString} zSnakeCaseKey
 * @description Utility schema ensuring a string is in snake_case (alphanumeric and underscores only).
 */
export const zSnakeCaseKey = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)");

/**
 * @constant {z.ZodString} zArgName
 * @description Utility schema for argument names (alphanumeric, hyphens, and underscores).
 */
export const zArgName = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must not contain whitespace (hyphens and underscores allowed)",
  );

/** @constant {z.ZodArray} zStringArray - Simple string array schema. */
export const zStringArray = z.string().array();

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
