import { z } from "zod";

/**
 * Ergonomic Zod shortcuts and common schema aliases.
 * These are "renames" for more practical usage.
 * Rule: use 'sch*' prefix for Zod validation objects.
 */

/**
 * @constant {z.ZodNumber} schNumber
 * @description Standard coerced number schema.
 */
export const schNumber = z.coerce.number();

/**
 * @constant {z.ZodDate} schDate
 * @description Standard coerced date schema.
 */
export const schDate = z.coerce.date();

/**
 * @constant {z.ZodBoolean} schBoolean
 * @description Standard coerced boolean schema.
 */
export const schBoolean = z.coerce.boolean();

/**
 * @constant {z.ZodString} schUUID
 * @description UUID validation schema.
 */
export const schUUID = z.uuid();

/**
 * @constant {z.ZodString} schEmail
 * @description Email validation schema.
 */
export const schEmail = z.email();

/**
 * @constant {z.ZodString} schUrl
 * @description URL validation schema.
 */
export const schUrl = z.url();

/**
 * @constant {z.ZodOptional<z.ZodNumber>} schOptionalNumber
 * @description Shortcut for an optional number.
 */
export const schOptionalNumber = z.number().optional();

/**
 * @constant {z.ZodNullable<z.ZodString>} schNullableString
 * @description Shortcut for a nullable string.
 */
export const schNullableString = z.string().nullable();

// --- Generic Helpers ---
import * as json from "../js/json.js";
import { isSuccess } from "../safe/safemode.js";

/**
 * @constant {z.ZodEffects<z.ZodString>} schJson
 * @description Validates that a string is a valid JSON.
 * Note: Does not transform the output (remains a string).
 */
export const schJson = z
  .string()
  .refine((val) => isSuccess(json.safeParse(val)));
