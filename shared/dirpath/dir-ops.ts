
import fs from "node:fs";

/**
 * Directory status and system item predicates.
 */

export const isSystemItem = (name: string): boolean =>
  name.startsWith(".") || name.startsWith("_");

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
