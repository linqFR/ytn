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
 * String case transformations.
 */

/**
 * @function toKebabCase
 * @description Converts a value to kebab-case (lowercase-hyphenated).
 */
export const toKebabCase = (str: unknown): tsKebabCase =>
  String(str)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase() as tsKebabCase;

/**
 * @function toSnakeCase
 * @description Converts a value to snake_case (lowercase_underscored).
 */
export const toSnakeCase = (str: unknown): tsSnakeCase =>
  String(str)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase() as tsSnakeCase;

/**
 * @function toScreamingSnakeCase
 * @description Converts a value to SCREAMING_SNAKE_CASE.
 */
export const toScreamingSnakeCase = (str: unknown): tsScreamingSnakeCase =>
  String(str)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase() as tsScreamingSnakeCase;

/**
 * @function toPascalCase
 * @description Converts a value to PascalCase (UpperCamelCase).
 */
export const toPascalCase = (str: unknown): tsPascalCase =>
  String(str)
    .split(/[\s_-]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("") as tsPascalCase;

/**
 * @function toCamelCase
 * @description Converts a value to camelCase (lowerCamelCase).
 */
export const toCamelCase = (str: unknown): tsCamelCase =>
  String(str)
    .split(/[\s_-]+/)
    .map((s, i) =>
      i === 0
        ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    )
    .join("") as tsCamelCase;

/**
 * @function isKebabCase
 * @description Type guard for kebab-case format.
 */
export const isKebabCase = (str: unknown): str is tsKebabCase =>
  typeof str === "string" && rgxKebabCase.test(str);

/**
 * @function isSnakeCase
 * @description Type guard for snake_case format.
 */
export const isSnakeCase = (str: unknown): str is tsSnakeCase =>
  typeof str === "string" && rgxSnakeCase.test(str);

/**
 * @function isScreamingSnakeCase
 * @description Type guard for SCREAMING_SNAKE_CASE format.
 */
export const isScreamingSnakeCase = (str: unknown): str is tsScreamingSnakeCase =>
  typeof str === "string" && rgxScreamingSnakeCase.test(str);

/**
 * @function isPascalCase
 * @description Type guard for PascalCase format.
 */
export const isPascalCase = (str: unknown): str is tsPascalCase =>
  typeof str === "string" && rgxPascalCase.test(str);

/**
 * @function isCamelCase
 * @description Type guard for camelCase format.
 */
export const isCamelCase = (str: unknown): str is tsCamelCase =>
  typeof str === "string" && rgxCamelCase.test(str);
