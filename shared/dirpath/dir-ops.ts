import fs from "node:fs";

/**
 * @function isSystemItem
 * @description Checks if a file or directory name is considered a "system item"
 * (starts with a dot or an underscore).
 *
 * @param {string} name - The item name to check.
 * @returns {boolean} True if the item is a system item.
 */
export const isSystemItem = (name: string): boolean =>
  name.startsWith(".") || name.startsWith("_");

/**
 * @function isEmptyDir
 * @description Checks if a directory is empty, with an optional flag to ignore system items.
 *
 * @param {string} dirPath - The absolute path to the directory.
 * @param {boolean} [ignoreSystem=false] - If true, ignores files starting with '.' or '_'.
 * @returns {boolean} True if the directory exists and is empty (or only contains ignored items).
 */
export const isEmptyDir = (
  dirPath: string,
  ignoreSystem: boolean = false,
): boolean => {
  try {
    const files = fs.readdirSync(dirPath);
    if (!ignoreSystem) return files.length === 0;
    return files.filter((f) => !isSystemItem(f)).length === 0;
  } catch {
    return false;
  }
};
