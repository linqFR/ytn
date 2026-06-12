import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { catchAsyncFn } from "../safe/safemode.js";

/**
 * @function importSafe
 * @description Platform-agnostic dynamic import wrapper.
 * Converts absolute file paths to valid ESM URLs and returns a SafeResult.
 */
export const importSafe = catchAsyncFn(async <T = any>(path: string): Promise<T> => {
  const target = isAbsolute(path) ? pathToFileURL(path).href : path;
  return import(target);
});
