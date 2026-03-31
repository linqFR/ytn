import { z } from "zod";
import {
  type tsTargetFieldName,
  type tsParseArgString,
} from "../config/parse-args.js";
import type { tsRoutingKeys } from "../types/bit-router.types.js";

/**
 * @type tsDiscriminantKeys
 * @description Ordered list of target field names whose values are used in forge routing signatures.
 */
export type tsDiscriminantKeys = tsRoutingKeys;

/**
 * @type tsFlagSchemas
 * @description Map of CLI long names to their corresponding Zod schema for initial parsing.
 */
export type tsFlagSchemas = Record<tsParseArgString, z.ZodType>;

/**
 * @type tsFlagLookup
 * @description Map of CLI long names (e.g., 'verbose') back to their internal target field names.
 */
export type tsFlagLookup = Record<tsParseArgString, tsTargetFieldName>;

/**
 * @internal
 * @function strToZod
 * @description Maps CLI type strings ("string", "boolean") to actual Zod schemas.
 *
 * @param {"string" | "boolean"} s - The type identifier.
 * @param {string[]} [allowed] - Optional list of allowed literal values for an enum schema.
 * @returns {z.ZodType} A Zod schema representing the mapping.
 */
export const strToZod = (
  s: "string" | "boolean",
  allowed?: string[],
): z.ZodType => {
  if (s === "string") {
    if (allowed && allowed.length > 0) {
      return z.enum(allowed as [string, ...string[]]).optional();
    }
    return z.string().optional();
  }
  if (s === "boolean") return z.boolean().optional();
  return z.any().optional();
};
