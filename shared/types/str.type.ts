import type { $Branded } from "./branding.type.js";
import type { $IsLower, $IsUpper, $IsDigit } from "./modifiers.type.js";

/**
 * Compile-time String Pattern Validation.
 * Leverages Template Literal Types to enforce naming conventions at the type level.
 */

/**
 * Validates KebabCase: lowercase, digits, and single hyphens. No start/end hyphens.
 */
/**
 * Validates KebabCase: lowercase, digits, and single hyphens. No start/end hyphens.
 */
type $ValidateKebab<S extends string, Prev extends string = ""> = 
  S extends `${infer First}${infer Rest}`
    ? First extends "-" 
      ? (Prev extends "" | "-" ? never : $ValidateKebab<Rest, First>)
      : (First extends Lowercase<First> 
          ? (First extends Uppercase<First> ? never : $ValidateKebab<Rest, First>)
          : $IsDigit<First> extends true ? $ValidateKebab<Rest, First> : never)
    : (Prev extends "-" ? never : string);

/**
 * Validates CamelCase: starts with lower, then alphanumeric.
 */
type $ValidateCamel<S extends string, Index extends number = 0> = 
    S extends `${infer First}${infer Rest}`
      ? Index extends 0
        ? ($IsLower<First> extends true ? $ValidateCamel<Rest, 1> : never)
        : ($IsLower<First> extends true ? $ValidateCamel<Rest, 1> 
            : $IsUpper<First> extends true ? $ValidateCamel<Rest, 1>
            : $IsDigit<First> extends true ? $ValidateCamel<Rest, 1>
            : never)
      : string;

/**
 * @type {string} tsKebabCase
 */
export type tsKebabCase = $Branded<string, "tsKebabCase"> & ($ValidateKebab<string>);

/**
 * @type {string} tsCamelCase
 */
export type tsCamelCase = $Branded<string, "tsCamelCase"> & ($ValidateCamel<string>);

/**
 * @type {string} tsSnakeCase
 */
export type tsSnakeCase = $Branded<string, "tsSnakeCase">;

/**
 * @type {string} tsScreamingSnakeCase
 */
export type tsScreamingSnakeCase = $Branded<string, "tsScreamingSnakeCase">;

/**
 * @type {string} tsPascalCase
 */
export type tsPascalCase = $Branded<string, "tsPascalCase">;
