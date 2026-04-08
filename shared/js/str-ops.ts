/**
 * @function parseCommaSeparated
 * @description Safely parses a comma-separated string into an array of trimmed strings.
 * If the input is not a string, returns an empty array.
 *
 * @param {unknown} val - The input to parse.
 * @returns {string[]} An array of trimmed strings.
 */
export const parseCommaSeparated = (val: unknown): string[] =>
  typeof val === "string" ? val.split(",").map((s) => s.trim()) : [];
