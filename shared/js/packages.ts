
import path from "node:path";
import { loadJSON, loadJSONSync } from "./json.js";
import { resolveSelfRoot } from "../dirpath/path-ops.js";
import { SafeResult, safeResultErr } from "../safe/safemode.js";

/**
 * Utilities for locating and loading Node.js package.json data.
 */

/**
 * Locates and parses the nearest package.json (Async).
 * Starts searching from the given directory upwards.
 */
export async function loadPackage(startDir: string): Promise<SafeResult<any>> {
  const root = resolveSelfRoot(startDir, "package.json");
  if (!root) {
    return safeResultErr(new Error(`package.json not found from ${startDir}`));
  }
  return loadJSON(path.join(root, "package.json"));
}

/**
 * Locates and parses the nearest package.json (Sync).
 * Starts searching from the given directory upwards.
 */
export function loadPackageSync(startDir: string): SafeResult<any> {
  const root = resolveSelfRoot(startDir, "package.json");
  if (!root) {
    return safeResultErr(new Error(`package.json not found from ${startDir}`));
  }
  return loadJSONSync(path.join(root, "package.json"));
}
