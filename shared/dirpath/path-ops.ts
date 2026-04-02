
import path from "node:path";
import fs from "node:fs";

/**
 * Path manipulation and root resolution helpers.
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

export const toRelPath = (
  absPath: string,
  base: string = process.cwd(),
): string => {
  if (!absPath || !path.isAbsolute(absPath)) return absPath;
  return path.relative(base, absPath);
};

export const normalizePath = (p: string): string =>
  p.replace(/\\/g, "/");
