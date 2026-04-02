
import { z } from "zod";

/**
 * Zod schemas for validated string case naming conventions.
 */

/**
 * Validates snake_case strings.
 */
export const schSnakeCase = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)")
  .brand<"tsSnakeCase">();

export type tsSnakeCase = z.infer<typeof schSnakeCase>;

/**
 * Validates kebab-case strings.
 */
export const schKebabCase = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case (lowercase and hyphens)")
  .brand<"tsKebabCase">();

export type tsKebabCase = z.infer<typeof schKebabCase>;

/**
 * Validates camelCase strings.
 */
export const schCamelCase = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, "Must be camelCase (starts with lowercase, alphanumeric only)")
  .brand<"tsCamelCase">();

export type tsCamelCase = z.infer<typeof schCamelCase>;

/**
 * Transforms a kebab-case string into camelCase.
 */
export const kebabToCamel = <T extends tsCamelCase>(str: string): T => {
  return str.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()) as T;
};
