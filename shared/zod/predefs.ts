
import { z } from "zod";

/**
 * Ergonomic Zod shortcuts and common schema aliases.
 * These are "renames" for more practical usage.
 * Rule: use 'sch*' prefix for Zod validation objects.
 */

// --- Base Coerced Schemas (Standard) ---
export const schNumber = z.coerce.number();
export const schDate = z.coerce.date();
export const schBoolean = z.coerce.boolean();

// --- Common string identifiers (Zod V4 Top-level) ---
export const schUUID = z.uuid();
export const schEmail = z.email();
export const schUrl = z.url();

// --- Common compositions ---
export const schOptionalNumber = z.number().optional();
export const schNullableString = z.string().nullable();

// --- Generic Helpers ---
import * as json from "../js/json.js";
import { isSuccess } from "../safe/safemode.js";

/**
 * Validates that a string is a valid JSON.
 * Does not transform the output (remains a string).
 */
export const schJson = z.string().refine((val) => isSuccess(json.safeParse(val)));
