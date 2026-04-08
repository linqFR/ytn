import path from "node:path";
import fs from "node:fs";

/**
 * Path manipulation and root resolution helpers.
 */

/**
 * @function resolveSelfRoot
 * @description Searches upwards from a starting directory for a specifically named "marker"
 * (like package.json) to find the project root.
 *
 * @param {string} startDir - The directory to start searching from.
 * @param {string} marker - The filename or directory name to look for.
 * @returns {string | null} The absolute path to the root directory, or null if not found.
 */
export const resolveSelfRoot = (
  startDir: string,
  marker: string,
): string | null => {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (true) {
    if (fs.existsSync(path.join(current, marker))) {
      return current;
    }
    if (current === root) break;
    current = path.dirname(current);
  }
  return null;
};

/**
 * @function toRelPath
 * @description Converts an absolute path to a relative path from the base directory.
 * If the path is not absolute, it is returned as-is.
 *
 * @param {string} absPath - The absolute path to convert.
 * @param {string} [base=process.cwd()] - The base directory for relativity.
 * @returns {string} The relative path.
 */
export const toRelPath = (
  absPath: string,
  base: string = process.cwd(),
): string => {
  if (!absPath || !path.isAbsolute(absPath)) return absPath;
  return path.relative(base, absPath);
};

/**
 * @function normalizePath
 * @description Normalizes a path string by replacing backslashes with forward slashes for consistency.
 *
 * @param {string} p - The path to normalize.
 * @returns {string} The normalized path.
 */
export const normalizePath = (p: string): string => p.replace(/\\/g, "/");
