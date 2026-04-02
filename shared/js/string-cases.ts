
/**
 * String case transformations.
 */

export const toKebabCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

export const toSnakeCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

export const toScreamingSnakeCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

export const toPascalCase = (str: string): string =>
  str
    .split(/[\s_-]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");

export const toCamelCase = (str: string): string =>
  str
    .split(/[\s_-]+/)
    .map((s, i) =>
      i === 0
        ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    )
    .join("");

export const isKebabCase = (str: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);

export const isSnakeCase = (str: string): boolean =>
  /^[a-z0-9]+(_[a-z0-9]+)*$/.test(str);

export const isScreamingSnakeCase = (str: string): boolean =>
  /^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(str);

export const isPascalCase = (str: string): boolean =>
  /^[A-Z][a-z0-9]+([A-Z][a-z0-9]+)*$/.test(str);

export const isCamelCase = (str: string): boolean =>
  /^[a-z][a-z0-9]*([A-Z][a-z0-9]+)*$/.test(str);
