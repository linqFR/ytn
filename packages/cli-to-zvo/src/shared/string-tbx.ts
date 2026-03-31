/**
 * @function camelToKebab
 * @description Transforms a camelCase string to kebab-case.
 * @param {string} str - The camelCase string.
 * @returns {string} The transformed kebab-case string.
 */
export const camelToKebab = (str: string): string =>
  str.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/**
 * @function camelToSnake
 * @description Transforms a camelCase string to snake_case.
 * @param {string} str - The camelCase string.
 * @returns {string} The transformed snake_case string.
 */
export const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/**
 * @function snakeToCamel
 * @description Transforms a snake_case string to camelCase.
 * @param {string} str - The snake_case string.
 * @returns {string} The transformed camelCase string.
 */
export const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
