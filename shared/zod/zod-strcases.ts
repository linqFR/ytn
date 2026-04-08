import { z } from "zod";

/**
 * Zod schemas for validated string case naming conventions.
 */

/**
 * @constant {z.ZodBranded<z.ZodString, "tsSnakeCase">} schSnakeCase
 * @description Validates snake_case strings.
 */
export const schSnakeCase = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)")
  .brand<"tsSnakeCase">();

/**
 * @type {string} tsSnakeCase
 * @description A branded string type representing a validated snake_case value.
 */
export type tsSnakeCase = z.infer<typeof schSnakeCase>;

/**
 * @constant {z.ZodBranded<z.ZodString, "tsKebabCase">} schKebabCase
 * @description Validates kebab-case strings.
 */
export const schKebabCase = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Must be kebab-case (lowercase and hyphens)",
  )
  .brand<"tsKebabCase">();

/**
 * @type {string} tsKebabCase
 * @description A branded string type representing a validated kebab-case value.
 */
export type tsKebabCase = z.infer<typeof schKebabCase>;

/**
 * @constant {z.ZodBranded<z.ZodString, "tsCamelCase">} schCamelCase
 * @description Validates camelCase strings.
 */
export const schCamelCase = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    "Must be camelCase (starts with lowercase, alphanumeric only)",
  )
  .brand<"tsCamelCase">();

/**
 * @type {string} tsCamelCase
 * @description A branded string type representing a validated camelCase value.
 */
export type tsCamelCase = z.infer<typeof schCamelCase>;

/**
 * @function kebabToCamel
 * @description Manual transformation logic to convert a kebab-case string into camelCase.
 * Performs a regex search-and-replace for hyphenated characters.
 *
 * @template {tsCamelCase} T
 * @param {string} str - The kebab-case input string.
 * @returns {T} The resulting camelCase string.
 */
export const kebabToCamel = <T extends tsCamelCase>(str: string): T => {
  return str.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()) as T;
};
