import { z } from "zod";

/**
 * Shared Zod v4 Types
 */

export type ZodTupleItems = Parameters<typeof z.tuple>[0];
export type ZodUnionOptions = Parameters<typeof z.union>[0];
export type ZodMetadata = Parameters<z.ZodType["meta"]>[0];

export const zSnakeCaseKey = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)");

export const zArgName = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must not contain whitespace (hyphens and underscores allowed)",
  );

export const zStringArray = z.string().array();


/** 
*  Shared Zod v4 utily functions
*
*/

export const repiped = (oldSchema: z.ZodType, targetSchema: z.ZodType) => {
  return oldSchema.pipe(targetSchema.meta(oldSchema.meta() as ZodMetadata));
};