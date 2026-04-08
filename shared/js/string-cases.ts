/**
 * String case transformations.
 */

/**
 * @function toKebabCase
 * @description Converts a string to kebab-case (lowercase-hyphenated).
 *
 * @param {string} str - The source string.
 * @returns {string} The kebab-cased string.
 */
export const toKebabCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

/**
 * @function toSnakeCase
 * @description Converts a string to snake_case (lowercase_underscored).
 *
 * @param {string} str - The source string.
 * @returns {string} The snake_cased string.
 */
export const toSnakeCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

/**
 * @function toScreamingSnakeCase
 * @description Converts a string to SCREAMING_SNAKE_CASE.
 *
 * @param {string} str - The source string.
 * @returns {string} The screaming_snake_cased string.
 */
export const toScreamingSnakeCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

/**
 * @function toPascalCase
 * @description Converts a string to PascalCase (UpperCamelCase).
 *
 * @param {string} str - The source string.
 * @returns {string} The PascalCased string.
 */
export const toPascalCase = (str: string): string =>
  str
    .split(/[\s_-]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");

/**
 * @function toCamelCase
 * @description Converts a string to camelCase (lowerCamelCase).
 *
 * @param {string} str - The source string.
 * @returns {string} The camelCased string.
 */
export const toCamelCase = (str: string): string =>
  str
    .split(/[\s_-]+/)
    .map((s, i) =>
      i === 0
        ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    )
    .join("");

/**
 * @function isKebabCase
 * @description Checks if a string is in kebab-case format.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is kebab-case.
 */
export const isKebabCase = (str: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);

/**
 * @function isSnakeCase
 * @description Checks if a string is in snake_case format.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is snake_case.
 */
export const isSnakeCase = (str: string): boolean =>
  /^[a-z0-9]+(_[a-z0-9]+)*$/.test(str);

/**
 * @function isScreamingSnakeCase
 * @description Checks if a string is in SCREAMING_SNAKE_CASE format.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is SCREAMING_SNAKE_CASE.
 */
export const isScreamingSnakeCase = (str: string): boolean =>
  /^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(str);

/**
 * @function isPascalCase
 * @description Checks if a string is in PascalCase format.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is PascalCase.
 */
export const isPascalCase = (str: string): boolean =>
  /^[A-Z][a-z0-9]+([A-Z][a-z0-9]+)*$/.test(str);

/**
 * @function isCamelCase
 * @description Checks if a string is in camelCase format.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is camelCase.
 */
export const isCamelCase = (str: string): boolean =>
  /^[a-z][a-z0-9]*([A-Z][a-z0-9]+)*$/.test(str);
