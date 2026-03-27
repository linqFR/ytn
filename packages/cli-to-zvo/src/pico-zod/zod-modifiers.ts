import { z } from "zod";
/**
 * Internal Zod properties that should always be hidden (branding, metadata).
 * Uses template literals to automatically match all _prop and ~prop.
 */
export type InternalKeys = "def" | "~standard" | `_${string}` | `~${string}`;

/**
 * Zod modifiers that we block to keep the CLI contract predictable.
 * These are the methods that change the structure or flow (e.g., .optional(), .pipe()).
 */
export const FORBIDDEN_MODIFIERS = [
  "array",
  "brand",
  "catch",
  "clone",
  "default",
  "describe",
  "intersection",
  "lazy",
  "map",
  "nonoptional",
  "nullable",
  "nullish",
  "object",
  // "optional",
  "pipe",
  "prefault",
  "preprocess",
  "readonly",
  "record",
  "refine",
  "superRefine",
  "transform",
  "tuple",
  "union",
  "unwrap",

  // those too
  "~standard",
  "and",
  "apply",
  "check",
  "decode",
  "decodeAsync",
  "encode",
  "encodeAsync",
  "exactOptional",
  "isNullable",
  "isOptional",
  "meta",
  // "or",
  // "xor",
  "overwrite",
  "parse",
  "parseAsync",
  "register",
  "safeDecode",
  "safeDecodeAsync",
  "safeEncode",
  "safeEncodeAsync",
  "safeParse",
  "safeParseAsync",
  "spa",
  "toJSONSchema",
  "with",
] as const;

/**
 * Runtime check to identify forbidden access to Zod internals or complex modifiers.
 * @param p Property key to check.
 * @returns True if the property is forbidden in the CLI contract.
 */
export function isForbidden(p: string | symbol): boolean {
  if (typeof p !== "string") return false;
  // 1. Block internal props via convention (_prop, ~prop) or explicit 'def'
  if (p.startsWith("_") || p.startsWith("~") || p === "def") return true;
  // 2. Block explicit modifiers that break contract simplicity
  return (FORBIDDEN_MODIFIERS as readonly string[]).includes(p);
}

/**
 * @function isSchemaCompatible
 * @description Flexible check for Zod-compatible schemas (Standard Schema aware).
 */
export const isSchemaCompatible = (v: unknown): v is z.ZodType =>
  !!v &&
  typeof v === "object" &&
  ("_zod" in (v as object) || "~standard" in (v as object));

export const isSchemaCompatibleProp = (p: string | symbol) =>
  typeof p === "string" && ["~standard", "_zod"].includes(p);
