import { z } from "zod";
import type {
  tsCamelCase,
  tsKebabCase,
  tsPascalCase,
  tsScreamingSnakeCase,
  tsSnakeCase,
} from "../types/str.type.js";
import {
  rgxCamelCase,
  rgxKebabCase,
  rgxPascalCase,
  rgxScreamingSnakeCase,
  rgxSnakeCase,
} from "../regex/str-cases.js";

/**
 * Zod schemas for validated string case naming conventions.
 */

export const schSnakeCase = z
  .string()
  .regex(rgxSnakeCase, "Must be snake_case")
  .brand<"tsSnakeCase">();

type sch = z.infer<typeof schSnakeCase>;
z.core["$brand"]

export const schKebabCase = z
  .string()
  .regex(rgxKebabCase, "Must be kebab-case")
  .brand<"tsKebabCase">();

export const schCamelCase = z
  .string()
  .regex(rgxCamelCase, "Must be camelCase")
  .brand<"tsCamelCase">();

export const schScreamingSnakeCase = z
  .string()
  .regex(rgxScreamingSnakeCase, "Must be SCREAMING_SNAKE_CASE")
  .brand<"tsScreamingSnakeCase">();

export const schPascalCase = z
  .string()
  .regex(rgxPascalCase, "Must be PascalCase")
  .brand<"tsPascalCase">();
