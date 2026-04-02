
import { readSafe, readSyncSafe } from "../dirpath/fs-ops.js";
import { SafeResult, safeResultErr, safeResultOk } from "../safe/safemode.js";

/**
 * Strict JSON types and safe parsing/loading operations.
 */

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

export type JSONPrimitive = string | number | boolean | null;

/**
 * Recursive type checking for valid JSON structures.
 */
export type ValidJSON<T> = 
  0 extends 1 & T 
  ? T 
  : T extends JSONPrimitive 
    ? T 
    : T extends symbol | bigint | ((...args: any[]) => any) 
      ? never 
      : T extends Array<infer U> 
        ? undefined extends U 
          ? never 
          : Array<ValidJSON<U>> 
        : T extends object 
          ? { 
              [K in keyof T]: 
                | ValidJSON<Exclude<T[K], undefined>> 
                | (undefined extends T[K] ? undefined : never); 
            } 
          : never;

/* -------------------------------------------------------------------------- */
/*                                   PARSING                                  */
/* -------------------------------------------------------------------------- */

/**
 * Synchronously parses a JSON string into a SafeResult.
 */
export function safeParse<T = any>(text: string): SafeResult<T> {
  try {
    return safeResultOk(JSON.parse(text) as T);
  } catch (err: any) {
    return safeResultErr(err);
  }
}

/**
 * Formats an object to a JSON string safely.
 */
export function safeStringify(val: any, space: number = 2): SafeResult<string> {
  try {
    return safeResultOk(JSON.stringify(val, null, space));
  } catch (err: any) {
    return safeResultErr(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                FILE LOADERS                                */
/* -------------------------------------------------------------------------- */

/**
 * Safely loads and parses a JSON file (Async).
 */
export async function loadJSON<T = any>(filePath: string): Promise<SafeResult<T>> {
  const [err, content] = await readSafe(filePath, "utf8");
  if (err || !content) return [err, undefined];
  return safeParse<T>(content as string);
}

/**
 * Safely loads and parses a JSON file (Sync).
 */
export function loadJSONSync<T = any>(filePath: string): SafeResult<T> {
  const [err, content] = readSyncSafe(filePath, "utf8");
  if (err || !content) return [err, undefined];
  return safeParse<T>(content as string);
}
