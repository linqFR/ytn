/**
 * Centralized naming convention patterns.
 */

/**
 * @constant {RegExp} rgxKebabCase
 * @description Matches lowercase strings separated by single hyphens.
 */
export const rgxKebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @constant {RegExp} rgxSnakeCase
 * @description Matches lowercase strings separated by underscores.
 */
export const rgxSnakeCase = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/**
 * @constant {RegExp} rgxCamelCase
 * @description Matches camelCase strings (starts with lower).
 */
export const rgxCamelCase = /^[a-z][a-zA-Z0-9]*$/;

/**
 * @constant {RegExp} rgxPascalCase
 * @description Matches PascalCase strings (starts with upper).
 */
export const rgxPascalCase = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * @constant {RegExp} rgxScreamingSnakeCase
 * @description Matches SCREAMING_SNAKE_CASE strings.
 */
export const rgxScreamingSnakeCase = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
