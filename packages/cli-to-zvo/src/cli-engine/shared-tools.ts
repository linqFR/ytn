import { z } from "zod";
import { type tsTargetFieldName, type tsParseArgString } from "../config/parse-args.js";
import type { tsRoutingKeys } from "../types/bit-router.types.js";

/** @type tsDiscriminantKeys - Ordered list of fields used for routing signatures. */
export type tsDiscriminantKeys = tsRoutingKeys;

/** @type tsFlagSchemas - Dictionary of Zod schemas mapped to their CLI long names. */
export type tsFlagSchemas = Record<tsParseArgString, z.ZodType>;

/** @type tsFlagLookup - Mapping from CLI long names back to the internal target field names. */
export type tsFlagLookup = Record<tsParseArgString, tsTargetFieldName>;

/**
 * @internal
 * @function strToZod
 * @description Maps CLI type identifiers to pure Zod validation schemas.
 */
export const strToZod = (s: "string" | "boolean", allowed?: string[]): z.ZodType => {
  if (s === "string") {
    if (allowed && allowed.length > 0) {
      return z.enum(allowed as [string, ...string[]]).optional();
    }
    return z.string().optional();
  }
  if (s === "boolean") return z.boolean().optional();
  return z.any().optional();
};
