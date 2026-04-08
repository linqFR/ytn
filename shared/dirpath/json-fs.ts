import { readSafe, readSyncSafe } from "./fs-ops.js";
import { safeParse as jsonSafeParse } from "../js/json.js";
import { type tsSafeResult, safeResultErr } from "../safe/safemode.js";

/**
 * File-system based JSON loaders.
 * Decoupled from core JSON logic to allow pure JS bundles to exclude Node.js 'fs'.
 */

/**
 * Safely loads and parses a JSON file (Async).
 */
export async function loadJSON<T = any>(
  filePath: string,
): Promise<tsSafeResult<T, SyntaxError | NodeJS.ErrnoException>> {
  const [err, content] = await readSafe(filePath, "utf8");
  if (err || !content) return safeResultErr(err);
  return jsonSafeParse<T>(content as string);
}

/**
 * Safely loads and parses a JSON file (Sync).
 */
export function loadJSONSync<T = any>(
  filePath: string,
): tsSafeResult<T, SyntaxError | NodeJS.ErrnoException> {
  const [err, content] = readSyncSafe(filePath, "utf8");
  if (err || !content) return safeResultErr(err);
  return jsonSafeParse<T>(content as string);
}
